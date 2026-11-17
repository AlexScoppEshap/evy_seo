import { createHash } from 'node:crypto'
import { directPageEligible, type PublicEvent } from './event-seo.ts'

export const MAP_HEADERS = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' }
const mapOrigin = 'https://api.maptiler.com'
const maxMercatorLatitude = 85.05112878
const zoom = 15, tileSize = 256, columns = 4, rows = 2
type Coordinates = { lon: number; lat: number }
type Layout = { offsetX: number; offsetY: number; tiles: { x: number; y: number }[] }
const record = (value: unknown): value is Record<string,unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

export function eventMapAddress(event: PublicEvent) {
  if (!directPageEligible(event) || !event.address?.trim() || !/^[A-Z]{2}$/i.test(event.country_code ?? '')) return null
  const address = [event.address.trim(),event.npa?.trim(),event.city?.trim(),event.country_code!.toUpperCase()].filter(Boolean).join(', ')
  return address.length <= 600 && !/[\u0000-\u001f]/.test(address) ? address : null
}
export function eventMapRevision(event: PublicEvent) {
  const address=eventMapAddress(event)
  return address?createHash('sha256').update(address).digest('hex').slice(0,16):null
}
export function mapCoordinates(value: unknown, country: string): Coordinates | null {
  if (!record(value) || !Array.isArray(value.features)) return null
  const feature: unknown = value.features[0]
  if (!record(feature) || !Array.isArray(feature.place_type) || !feature.place_type.includes('address') ||
      !record(feature.properties) || feature.properties.country_code !== country.toLowerCase() ||
      !record(feature.geometry) || feature.geometry.type !== 'Point' || !Array.isArray(feature.geometry.coordinates)) return null
  const [lon, lat] = feature.geometry.coordinates
  return typeof lon === 'number' && typeof lat === 'number' && Number.isFinite(lon) && Number.isFinite(lat) &&
    Math.abs(lon) <= 180 && Math.abs(lat) <= maxMercatorLatitude ? {lon,lat} : null
}
export function mapLayout({lon,lat}: Coordinates): Layout {
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon)>180 || Math.abs(lat)>maxMercatorLatitude) throw Error('Invalid coordinates')
  const size = 2 ** zoom
  const x = (lon + 180) / 360 * size * tileSize
  const y = Math.max(0,Math.min(size*tileSize,(1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * size * tileSize))
  const firstX = Math.floor((x-768/2)/tileSize), firstY = Math.max(0,Math.min(size-rows,Math.floor((y-256/2)/tileSize)))
  return { offsetX: x-firstX*tileSize, offsetY: y-firstY*tileSize,
    tiles: Array.from({length:columns*rows},(_,index)=>({x:((firstX+index%columns)%size+size)%size,y:firstY+Math.floor(index/columns)})) }
}
async function boundedBytes(response: Response, maximum: number) {
  if (Number(response.headers.get('content-length'))>maximum) {await response.body?.cancel();throw Error('Map response too large')}
  const reader=response.body?.getReader();if(!reader)throw Error('Missing map response')
  const chunks:Uint8Array[]=[];let length=0
  for(;;){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>maximum){await reader.cancel();throw Error('Map response too large')}chunks.push(value)}
  return Buffer.concat(chunks)
}

export function createEventMapReader(apiKey: string | undefined, upstream: typeof fetch = fetch, apiOrigin = mapOrigin) {
  const origin = new URL(apiOrigin)
  if (apiOrigin !== mapOrigin && !(origin.protocol === 'http:' && origin.hostname === '127.0.0.1' && origin.pathname === '/' && !origin.search && !origin.username && !origin.password && !origin.hash)) throw Error('Invalid map provider')
  const key = apiKey?.trim() ?? ''
  // Memory-only coordinate cache: no eligibility, event rows or raster images.
  // Every manifest/tile route must re-read its own current public parent.
  const cache = new Map<string,{expires:number;value:Promise<Layout|null>}>()
  const layout = async (event: PublicEvent) => {
    const address=eventMapAddress(event)
    if(!key||!address)return null
    const hash=createHash('sha256').update(address).digest('hex'),now=Date.now()
    const previous=cache.get(hash)
    if(previous&&previous.expires>now)return previous.value
    cache.delete(hash)
    if(cache.size>=128)cache.delete(cache.keys().next().value!)
    const value=(async()=>{
      const url=new URL(`/geocoding/${encodeURIComponent(address)}.json`,origin)
      url.search=new URLSearchParams({key,types:'address',country:event.country_code!.toLowerCase(),limit:'1'}).toString()
      const response=await upstream(url,{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(5_000),headers:{Accept:'application/json'}})
      if(response.status!==200||!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')??'')){await response.body?.cancel();throw Error('Geocoding unavailable')}
      const point=mapCoordinates(JSON.parse((await boundedBytes(response,64*1024)).toString('utf8')),event.country_code!)
      return point?mapLayout(point):null
    })().catch(()=>null)
    cache.set(hash,{expires:now+300_000,value})
    return value
  }
  return {
    configured:!!key,
    async preview(event:PublicEvent){
      const value=await layout(event);if(!value)return null
      const revision=eventMapRevision(event)!
      return {version:1,revision,offsetX:value.offsetX,offsetY:value.offsetY,tiles:value.tiles.map((_,index)=>`/events/${encodeURIComponent(event.seo_slug!)}/map/tile-${index}-${revision}`)}
    },
    async tile(event:PublicEvent,index:number,revision:string){
      if(!Number.isInteger(index)||index<0||index>=columns*rows||eventMapRevision(event)!==revision)return null
      const value=await layout(event);if(!value)return null
      const tile=value.tiles[index],url=new URL(`/maps/streets-v4/256/${zoom}/${tile.x}/${tile.y}.png`,origin)
      url.searchParams.set('key',key)
      try{
        const response=await upstream(url,{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(5_000),headers:{Accept:'image/png'}})
        if(response.status!==200||response.headers.get('content-type')?.split(';')[0].toLowerCase()!=='image/png'){await response.body?.cancel();return null}
        const bytes=await boundedBytes(response,1024*1024)
        if(bytes.length<24||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(16)!==256||bytes.readUInt32BE(20)!==256)return null
        return bytes
      }catch{return null}
    },
  }
}
