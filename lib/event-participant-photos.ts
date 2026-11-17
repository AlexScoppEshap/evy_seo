import type { SupabaseClient } from '@supabase/supabase-js'
import { assertAnonymousKey } from './public-backend.ts'
import { directPageEligible, isoInstant, type PublicEvent } from './event-seo.ts'
import { MAX_IMAGE_BYTES, MEDIA_HEADERS } from './event-media.ts'

export type PublicParticipantPhoto = { id: string; authorName: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const participantPhotoSlot = /^(thumb|photo)-([0-5])$/

export async function readPublicParticipantPhotos(db: SupabaseClient, anchor: PublicEvent, signal = AbortSignal.timeout(5_000)): Promise<PublicParticipantPhoto[]> {
  if (!directPageEligible(anchor)) return []
  try {
    // The native page permits approved public viewing separately from upload
    // eligibility. Use caller RLS, not a definer's participant/photo payload.
    const { data, error } = await db.from('event_participant_photos')
      .select('id,event_id,status,uploaded_at,author:users!event_participant_photos_user_id_fkey!inner(username,account_status)')
      .eq('event_id', anchor.id).eq('status','approved').eq('author.account_status','active').not('uploaded_at','is',null)
      .order('created_at',{ascending:false}).order('id',{ascending:false}).limit(6).abortSignal(signal)
    if (error || !Array.isArray(data)) return []
    const seen = new Set<string>()
    return data.slice(0,6).flatMap(row => {
      const author = row?.author as unknown
      if (!row || typeof row.id !== 'string' || !uuid.test(row.id) || row.event_id !== anchor.id || row.status !== 'approved' ||
          typeof row.uploaded_at !== 'string' || !isoInstant(row.uploaded_at) || !author || typeof author !== 'object' ||
          !('account_status' in author) || author.account_status !== 'active' || seen.has(row.id)) return []
      seen.add(row.id)
      const name = 'username' in author && typeof author.username === 'string' && /^[\p{L}\p{N}_.-]{1,100}$/u.test(author.username) ? author.username : ''
      return [{ id: row.id, authorName: name }]
    })
  } catch { return [] }
}

export function createAnonymousParticipantPhotoFetch(backend: string, anonKey: string, upstream: typeof fetch = fetch) {
  assertAnonymousKey(anonKey)
  const origin = new URL(backend).origin
  return async (photoId: string, thumbnail: boolean) => {
    const failure = (status: number) => new Response('Photo unavailable', {status,headers:{...MEDIA_HEADERS,'X-Robots-Tag':'noindex'}})
    if (!uuid.test(photoId)) return failure(404)
    try {
      const url = new URL('/functions/v1/ik-storage',origin)
      url.searchParams.set('action','participant_photo');url.searchParams.set('photo_id',photoId);url.searchParams.set('thumbnail',String(thumbnail))
      // This is the dedicated anon client identity, never a visitor session or
      // elevated credential. The deployed Edge repeats current photo RLS.
      const response = await upstream(url,{method:'GET',headers:{apikey:anonKey,Authorization:`Bearer ${anonKey}`},cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(5_000)})
      const type = response.headers.get('content-type')?.split(';')[0].toLowerCase()
      if (response.status !== 200 || !['application/octet-stream','image/jpeg'].includes(type ?? '') || Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) {
        await response.body?.cancel();return failure([401,403,404].includes(response.status)?404:502)
      }
      const reader=response.body?.getReader();if(!reader)return failure(502)
      const chunks:Uint8Array[]=[];let size=0
      for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_IMAGE_BYTES){await reader.cancel();return failure(502)}chunks.push(value)}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
      // Upload and thumbnail workers publish sanitized JPEG, not arbitrary files.
      if(size<3||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)return failure(502)
      return new Response(bytes,{headers:{...MEDIA_HEADERS,'Content-Type':'image/jpeg','X-Robots-Tag':'noindex'}})
    }catch{return failure(502)}
  }
}
