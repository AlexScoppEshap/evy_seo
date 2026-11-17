import { supabase } from '@/lib/supabase'
import { readPublicEvent } from '@/lib/public-event-data'
import { eventMapReader } from '@/lib/event-map-server'
import { MAP_HEADERS, eventMapRevision } from '@/lib/event-map'

export async function GET(request:Request,{params}:{params:Promise<{slug:string;slot:string}>}){
  const {slug,slot}=await params
  const failure=(status:number)=>new Response('Map unavailable',{status,headers:MAP_HEADERS})
  const tile=/^tile-([0-7])-([0-9a-f]{16})$/.exec(slot)
  if(new URL(request.url).search||(slot!=='preview'&&!tile))return failure(404)
  try{
    const event=await readPublicEvent(supabase,slug)
    if(!event)return failure(404)
    if(!eventMapReader.configured)return failure(503)
    if(slot==='preview'){
      const preview=await eventMapReader.preview(event)
      return preview?Response.json(preview,{headers:MAP_HEADERS}):failure(404)
    }
    if(!tile||eventMapRevision(event)!==tile[2])return failure(404)
    const bytes=await eventMapReader.tile(event,Number(tile[1]),tile[2])
    return bytes?new Response(new Uint8Array(bytes),{headers:{...MAP_HEADERS,'Content-Type':'image/png'}}):failure(503)
  }catch{return failure(503)}
}
