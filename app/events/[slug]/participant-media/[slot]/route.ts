import { supabase, fetchAnonymousParticipantPhoto } from '@/lib/supabase'
import { readPublicEvent } from '@/lib/public-event-data'
import { participantPhotoSlot, readPublicParticipantPhotos } from '@/lib/event-participant-photos'
import { MEDIA_HEADERS } from '@/lib/event-media'

export async function GET(request: Request,{params}:{params:Promise<{slug:string;slot:string}>}) {
  const {slug,slot}=await params
  const match=participantPhotoSlot.exec(slot)
  const unavailable=(status:number)=>new Response('Photo unavailable',{status,headers:{...MEDIA_HEADERS,'X-Robots-Tag':'noindex'}})
  if(!match||new URL(request.url).search)return unavailable(404)
  try{
    const event=await readPublicEvent(supabase,slug)
    if(!event)return unavailable(404)
    const photos=await readPublicParticipantPhotos(supabase,event)
    const photo=photos[Number(match[2])]
    if(!photo)return unavailable(404)
    return await fetchAnonymousParticipantPhoto(photo.id,match[1]==='thumb')
  }catch{return unavailable(503)}
}
