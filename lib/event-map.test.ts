import assert from 'node:assert/strict'
import test from 'node:test'
import { createEventMapReader, eventMapAddress, eventMapRevision, mapCoordinates, mapLayout } from './event-map.ts'
import { publicEventFixture as base } from './seo-fixtures.ts'

const event={...base,address:'Rue de la Rôtisserie 10',npa:'1204',city:'Genève',country_code:'CH'}
const point={lon:6.147,lat:46.201}
const revision=eventMapRevision(event)!
const feature={features:[{place_type:['address'],properties:{country_code:'ch'},geometry:{type:'Point',coordinates:[point.lon,point.lat]}}]}
const png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(256,16);png.writeUInt32BE(256,20)
test('map lookup requires an eligible public parent and street address; no city-only fallback',()=>{
  assert.equal(eventMapAddress(event),'Rue de la Rôtisserie 10, 1204, Genève, CH')
  for(const change of [{is_public:false},{is_public:null},{address:null},{address:''},{country_code:null},{ai_moderation_status:'pending'},{recurrence_state:'excluded'},{users:{...base.users!,account_status:'pending_deletion'}}])assert.equal(eventMapAddress({...event,...change}),null)
})
test('only an address-level result in the expected country produces a finite Mercator layout',()=>{
  assert.deepEqual(mapCoordinates(feature,'CH'),point)
  assert.equal(mapCoordinates(feature,'FR'),null)
  assert.equal(mapCoordinates({...feature,features:[{...feature.features[0],place_type:['place']} ]},'CH'),null)
  assert.equal(mapCoordinates({...feature,features:[{...feature.features[0],geometry:{type:'Point',coordinates:[0,89]}}]},'CH'),null)
  for(const coordinates of [point,{lon:180,lat:0},{lon:-180,lat:0},{lon:0,lat:85.05112878},{lon:0,lat:-85.05112878}]){
    const layout=mapLayout(coordinates);assert.equal(layout.tiles.length,8)
    for(const tile of layout.tiles)assert.ok(tile.x>=0&&tile.y>=0&&tile.x<2**15&&tile.y<2**15)
    assert.ok(layout.offsetX>=384&&layout.offsetX<640)
  }
  assert.throws(()=>mapLayout({lon:NaN,lat:0}))
})
test('map provider stays fixed; simultaneous tiles reuse only the coordinate lookup, never eligibility or visitor credentials',async()=>{
  let geocodes=0,tiles=0
  const reader=createEventMapReader('synthetic_map_key',async(url,init)=>{
    const target=new URL(String(url));assert.equal(target.origin,'https://api.maptiler.com')
    assert.equal(init?.cache,'no-store');assert.equal(init?.redirect,'manual')
    assert.ok(!new Headers(init?.headers).has('Authorization'));assert.ok(!new Headers(init?.headers).has('Cookie'));assert.ok(!new Headers(init?.headers).has('Referer'))
    if(target.pathname.startsWith('/geocoding/')){geocodes++;assert.equal(target.searchParams.get('country'),'ch');return Response.json(feature)}
    tiles++;assert.match(target.pathname,/^\/maps\/streets-v4\/256\/15\/\d+\/\d+\.png$/);return new Response(png,{headers:{'Content-Type':'image/png'}})
  })
  const preview=await reader.preview(event);assert.equal(preview?.tiles.length,8);assert.doesNotMatch(JSON.stringify(preview),/synthetic_map_key|maptiler\.com|Rôtisserie/)
  await Promise.all([reader.tile(event,0,revision),reader.tile(event,1,revision),reader.tile(event,7,revision)])
  assert.equal(geocodes,1);assert.equal(tiles,3)
  assert.equal(await reader.preview({...event,is_public:false}),null)
  assert.equal(await reader.tile({...event,is_public:false},0,revision),null)
  assert.equal(await reader.tile(event,8,revision),null)
  assert.equal(await reader.tile({...event,address:'Different public address 1'},0,revision),null)
  assert.equal(geocodes,1)
  assert.equal(tiles,3)
  await reader.preview({...event,address:'Different public address 1'});assert.equal(geocodes,2)
  assert.throws(()=>createEventMapReader('x',fetch,'https://evil.example'))
})
test('missing config, geocoding outage and non-address results safely omit the map',async()=>{
  let calls=0
  const unavailable=createEventMapReader(undefined,async()=>{calls++;throw Error('must not fetch')})
  assert.equal(await unavailable.preview(event),null);assert.equal(calls,0)
  for(const response of [new Response('forbidden',{status:403}),Response.json({features:[]}),Response.json({...feature,features:[{...feature.features[0],properties:{country_code:'fr'}}]})])assert.equal(await createEventMapReader('synthetic',async()=>response).preview(event),null)
})
test('tile redirects, error images, wrong dimensions and oversized streams never become a map',async()=>{
  for(const response of [new Response(null,{status:302,headers:{Location:'https://evil.example'}}),new Response('not png',{headers:{'Content-Type':'image/png'}}),new Response(png,{headers:{'Content-Type':'text/html'}}),new Response(Buffer.alloc(1024*1024+1),{headers:{'Content-Type':'image/png'}})]){
    const reader=createEventMapReader('synthetic',async url=>String(url).includes('/geocoding/')?Response.json(feature):response)
    assert.equal(await reader.tile(event,0,revision),null)
  }
})
