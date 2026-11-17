import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { publicEventFixture as base, FIXTURE_ANON_KEY } from './seo-fixtures.ts'
import { readPublicParticipantPhotos, createAnonymousParticipantPhotoFetch } from './event-participant-photos.ts'
import { MAX_IMAGE_BYTES, allowedMediaSource } from './event-media.ts'

const photoId='90000000-0000-0000-0000-000000000001'
const row={id:photoId,event_id:base.id,status:'approved',uploaded_at:'2026-10-12T12:00:00Z',author:{username:'public_author',account_status:'active'}}
function backend(rows: unknown) {
  const calls: URL[] = []
  const db = createClient('https://fixture.supabase.co', FIXTURE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async input => {
      calls.push(new URL(String(input)))
      return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json' } })
    } },
  })
  return { db, calls }
}

test('anonymous photo projection uses approved/current event and active author RLS without storage keys',async()=>{
  const{db,calls}=backend([row])
  assert.deepEqual(await readPublicParticipantPhotos(db,base),[{id:photoId,authorName:'public_author'}])
  const query=calls[0].searchParams
  assert.equal(query.get('event_id'),`eq.${base.id}`);assert.equal(query.get('status'),'eq.approved');assert.equal(query.get('author.account_status'),'eq.active')
  assert.match(query.get('select')!,/event_participant_photos_user_id_fkey!inner/)
  assert.doesNotMatch(query.get('select')!,/storage_path|thumbnail_path|upload_token|lease_until|reviewed_by/)
})
test('private parent, pending/deleted photos, inactive authors and unrelated photos never become public',async()=>{
  const{db,calls}=backend([row]);assert.deepEqual(await readPublicParticipantPhotos(db,{...base,is_public:false}),[]);assert.equal(calls.length,0)
  for(const patch of [{status:'pending'},{status:'removed'},{event_id:photoId},{uploaded_at:null},{uploaded_at:'invalid'},{author:{username:'private',account_status:'pending_deletion'}},{id:'invalid'}]){
    assert.deepEqual(await readPublicParticipantPhotos(backend([{...row,...patch}]).db,base),[])
  }
})
test('photo list is bounded, deduplicated and does not infer a name from private identifiers',async()=>{
  const rows=Array.from({length:10},(_,index)=>({...row,id:`90000000-0000-0000-0000-${String(index+1).padStart(12,'0')}`}))
  assert.equal((await readPublicParticipantPhotos(backend(rows).db,base)).length,6)
  assert.equal((await readPublicParticipantPhotos(backend([row,row]).db,base)).length,1)
  assert.equal((await readPublicParticipantPhotos(backend([{...row,author:{username:'private@example.com',account_status:'active'}}]).db,base))[0].authorName,'')
})
test('photo image GET repeats authorization using only the dedicated anon key, with no redirects or public cache',async()=>{
  let requested:URL|undefined
  const fetchPhoto=createAnonymousParticipantPhotoFetch('https://fixture.supabase.co',FIXTURE_ANON_KEY,async(input,init)=>{
    requested=new URL(String(input));const headers=new Headers(init?.headers)
    assert.equal(init?.method,'GET');assert.equal(init?.redirect,'manual');assert.equal(init?.cache,'no-store')
    assert.equal(headers.get('Authorization'),`Bearer ${FIXTURE_ANON_KEY}`);assert.equal(headers.get('apikey'),FIXTURE_ANON_KEY);assert.equal(headers.get('cookie'),null)
    return new Response(new Uint8Array([255,216,255,217]),{headers:{'Content-Type':'application/octet-stream','Set-Cookie':'private'}})
  })
  const result=await fetchPhoto(photoId,true)
  assert.equal(result.status,200);assert.equal(requested?.searchParams.get('photo_id'),photoId);assert.equal(requested?.searchParams.get('thumbnail'),'true')
  assert.equal(result.headers.get('Content-Type'),'image/jpeg');assert.equal(result.headers.get('Cache-Control'),'private, no-store');assert.equal(result.headers.get('Set-Cookie'),null);assert.equal(result.headers.get('X-Robots-Tag'),'noindex')
  assert.throws(()=>createAnonymousParticipantPhotoFetch('https://fixture.supabase.co','sb_secret_synthetic_fixture'),/invalid/)
})
test('denial, removal, redirects, non-JPEG and oversized photo streams never leak upstream diagnostics',async()=>{
  for(const response of [
    new Response('PRIVATE_SQL_ERROR',{status:403}),new Response(null,{status:302,headers:{Location:'https://attacker.example'}}),
    new Response('<svg/>',{headers:{'Content-Type':'application/octet-stream'}}),
    new Response(new Uint8Array([255,216,255]),{headers:{'Content-Type':'application/octet-stream','Content-Length':String(MAX_IMAGE_BYTES+1)}}),
    new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(MAX_IMAGE_BYTES+1));c.close()}}),{headers:{'Content-Type':'application/octet-stream'}}),
  ]){
    const result=await createAnonymousParticipantPhotoFetch('https://fixture.supabase.co',FIXTURE_ANON_KEY,async()=>response)(photoId,false)
    assert.ok([404,502].includes(result.status));assert.doesNotMatch(await result.text(),/PRIVATE|attacker|storage|token/)
  }
})
test('legacy cover proxy cannot be used to publish a participant storage key',()=>{
  const source=`https://fixture.supabase.co/functions/v1/ik-storage?action=proxy&bucket_kind=event&key=events/${base.id}/participants/${photoId}/private.jpg&token=synthetic_public_signature_123456`
  assert.equal(allowedMediaSource(source,'https://fixture.supabase.co',base,'cover'),undefined)
})
