import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { publicEventFixture as base } from './seo-fixtures.ts'
import { emptyEventDetailExtras, publicContact, readEventDetailExtras, readRelatedEvents } from './event-detail-data.ts'
import { presentPublicEvent, readPublicEventGallery } from './event-media.ts'

const owner = '20000000-0000-0000-0000-000000000001'
const anchor = { ...base, creator_id: owner }
const id = (n: number) => `10000000-0000-0000-0000-${String(n).padStart(12,'0')}`
const now = new Date('2026-10-12T12:00:00Z')
function backend(handle: (url: URL, body: Record<string,unknown> | undefined, method: string) => unknown) {
  const calls: {path:string;query:URLSearchParams;body:Record<string,unknown>|undefined;method:string}[] = []
  const db = createClient('https://fixture.supabase.co', 'synthetic-anon-key', {
    auth: { persistSession:false, autoRefreshToken:false }, global: { fetch: async (input, init) => {
      const url = new URL(String(input)), body = init?.body ? JSON.parse(String(init.body)) : undefined
      const method = init?.method ?? 'GET'; calls.push({path:url.pathname,query:url.searchParams,body,method})
      const result = handle(url,body,method)
      return result instanceof Response ? result : new Response(JSON.stringify(result), {headers:{'Content-Type':'application/json'}})
    } },
  })
  return {db,calls}
}

test('full public detail uses selected public contacts, real badge, approved HEAD count; never private member readers', async () => {
  const {db,calls} = backend((url,_body,method) => {
    if (url.pathname.endsWith('/event_comments')) { assert.equal(method,'HEAD');return new Response(null,{headers:{'Content-Range':'*/7'}}) }
    if (url.pathname.endsWith('/get_public_organizer_pro_badges')) return [{organizer_id:owner,has_pro_badge:true}]
    if (url.pathname.endsWith('/get_public_event_organizer_contacts')) return [
      {organizer_id:owner,channel_type:'website',value:'https://organizer.example'},
      {organizer_id:owner,channel_type:'phone',value:'+41 21 555 01 23'},
      {organizer_id:owner,channel_type:'social',platform:'instagram',value:'https://instagram.com/organizer'},
      {organizer_id:owner,channel_type:'website',value:'https://chat.whatsapp.com/PRIVATE'},
      {organizer_id:id(99),channel_type:'website',value:'https://unrelated.example'},
    ]
    return {entries:[]}
  })
  const result = await readEventDetailExtras(db,anchor)
  assert.equal(result.commentsCount,7);assert.equal(result.organizerPro,true)
  assert.deepEqual(result.contacts.map(contact=>contact.label),['Website','Call organizer','Instagram'])
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE|unrelated/)
  assert.ok(calls.every(call=>call.method==='HEAD'||call.method==='POST'||(call.method==='GET'&&call.path.endsWith('/event_participant_photos'))))
  assert.doesNotMatch(JSON.stringify(calls),/event_participants|participant_photo_page|conversations|messages|organizer_contact_profiles|organizer_entitlements|subscriptions/)
  const count = calls.find(call=>call.method==='HEAD')!
  assert.equal(count.query.get('event_id'),`eq.${anchor.id}`)
  assert.equal(count.query.get('moderation_status'),'eq.approved')
})
test('private or hidden anchors perform no supplemental queries', async () => {
  const {db,calls}=backend(()=>{throw Error('private query')})
  for (const patch of [{is_public:false},{ai_moderation_status:'pending'},{users:null},{users:{...base.users!,account_status:'pending_deletion'}}]) {
    assert.deepEqual(await readEventDetailExtras(db,{...anchor,...patch}),emptyEventDetailExtras())
    assert.deepEqual(await readRelatedEvents(db,{...anchor,...patch}),[])
  }
  assert.equal(calls.length,0)
})
test('optional RPC failure preserves an honest unknown count and ordinary organizer badge', async () => {
  const {db} = backend(()=>new Response(JSON.stringify({message:'PRIVATE_SQL_BODY'}),{status:503,headers:{'Content-Type':'application/json'}}))
  assert.deepEqual(await readEventDetailExtras(db,anchor),emptyEventDetailExtras())
  const malformed = backend(url=>url.pathname.endsWith('/get_public_organizer_pro_badges') ? [{organizer_id:owner,has_pro_badge:'true'},{organizer_id:id(99),has_pro_badge:true}] : {}).db
  assert.equal((await readEventDetailExtras(malformed,anchor)).organizerPro,false)
})
test('Meetups never fetch event organizer contacts', async () => {
  const {db,calls}=backend(()=>[])
  const result=await readEventDetailExtras(db,{...anchor,event_type:'meetup'})
  assert.deepEqual(result.contacts,[])
  assert.ok(!calls.some(call=>call.path.endsWith('/get_public_event_organizer_contacts')))
})
test('contact parser rejects scripts, unknown channels, credentials, private WhatsApp and social impersonation', () => {
  for (const patch of [
    {value:'javascript:alert(1)'},{value:'https://user:secret@example.com'},
    {value:'https://127.0.0.1/private'},{value:'https://wa.me/secret'},{value:'https://api.whatsapp.com/send?secret=1'},
    {channel_type:'social',platform:'instagram',value:'https://instagram.com.attacker.example/user'},
    {channel_type:'social',platform:'instagram',value:'https://instagram.com/'},
    {channel_type:'email',value:'private@example.com'},{channel_type:'phone',value:'+12<script>'},
    {organizer_id:id(99)},
  ]) assert.equal(publicContact({organizer_id:owner,channel_type:'website',value:'https://example.com',...patch},owner),null)
})
test('related cards re-read concrete events with eligibility and preserve RPC ranking', async () => {
  const first={...base,id:id(2),seo_slug:'first-ranked'}, second={...base,id:id(3),seo_slug:'second-ranked'}
  const {db,calls}=backend(url=>url.pathname.endsWith('/get_public_related_events')
    ? {entries:[{event_id:second.id,title:'PRIVATE_RPC_METADATA'},{event_id:first.id},{event_id:second.id},{event_id:anchor.id}]}
    : [first,second])
  const result=await readRelatedEvents(db,anchor,undefined,now)
  assert.deepEqual(result.map(row=>row.id),[second.id,first.id])
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE_RPC_METADATA/)
  assert.equal(calls[1].query.get('is_public'),'eq.true')
  assert.equal(calls[1].query.get('ai_moderation_status'),'eq.approved')
  assert.equal(calls[1].query.get('users.account_status'),'eq.active')
  assert.equal(calls[0].body?.p_limit,4)
})
test('related cards exclude private, unapproved, excluded, hidden, cancelled, past and malformed snapshots', async () => {
  for (const patch of [
    {is_public:false},{ai_moderation_status:'pending'},{recurrence_state:'excluded'},
    {users:{...base.users!,account_status:'pending_deletion'}},{status:'cancelled'},
    {end_date:'2020-01-01T00:00:00Z'},{seo_slug:null},{name:{private:'body'}},
  ]) {
    const {db}=backend(url=>url.pathname.endsWith('/get_public_related_events')?{entries:[{event_id:id(2)}]}:[{...base,id:id(2),...patch}])
    assert.deepEqual(await readRelatedEvents(db,anchor,undefined,now),[])
  }
})
test('related Meetups also respect the anonymous capability contract', async () => {
  for (const discover of [false,true]) {
    const {db}=backend(url=>url.pathname.endsWith('/get_public_related_events')?{entries:[{event_id:id(2)}]}:
      url.pathname.endsWith('/get_meetup_capabilities')?{contract_version:1,discover_enabled:discover}:[{...base,id:id(2),event_type:'meetup'}])
    assert.equal((await readRelatedEvents(db,anchor,undefined,now)).length,discover?1:0)
  }
})
test('managed gallery merges approved public slots, preserves the occurrence cover and keeps source tokens server-side', async () => {
  const origin='https://fixture.supabase.co', token='synthetic_public_signature_123456'
  const cover=`${origin}/functions/v1/ik-storage?action=proxy&bucket_kind=event&key=events/${base.id}/main.jpg&token=${token}`
  const managed=(n:number)=>`${origin}/functions/v1/ik-storage?action=image_public&id=${id(n)}&token=${token}&published=1`
  const {db,calls}=backend(()=>[
    {key:`events/${base.id}/gallery_1.jpg`,url:managed(2)},
    {key:`events/${base.id}/main.jpg`,url:managed(3)},
    {key:`events/${id(99)}/gallery_2.jpg`,url:managed(4)},
    {key:`events/${base.id}/gallery_2.jpg`,url:managed(5).replace('image_public','image_review')},
  ])
  const event=await readPublicEventGallery(db,{...base,image_url:cover},origin)
  assert.equal(event.image_url,cover)
  assert.deepEqual(event.gallery_image_urls,[cover,managed(2)])
  assert.deepEqual(calls[0].body,{p_event:base.id})
  assert.doesNotMatch(JSON.stringify(presentPublicEvent(event,origin)),/synthetic_public_signature|ik-storage|token=/)
})
test('gallery denial is optional, private anchors never call it, and the existing cover survives', async () => {
  const {db,calls}=backend(()=>new Response('{}',{status:403,headers:{'Content-Type':'application/json'}}))
  const privateEvent={...base,is_public:false}
  assert.equal(await readPublicEventGallery(db,privateEvent,'https://fixture.supabase.co'),privateEvent)
  assert.equal(calls.length,0)
  const cover='https://fixture.supabase.co/storage/v1/object/public/events/cover.jpg'
  assert.equal((await readPublicEventGallery(db,{...base,image_url:cover},'https://fixture.supabase.co')).image_url,cover)
})

test('photo identifiers remain server-side while the public detail receives only scoped media URLs',async()=>{
  const photoId='90000000-0000-0000-0000-000000000001'
  const {db}=backend(url=>url.pathname.endsWith('/event_participant_photos')?[{id:photoId,event_id:base.id,status:'approved',uploaded_at:'2026-10-12T12:00:00Z',author:{username:'public_author',account_status:'active'}}]:[])
  const result=await readEventDetailExtras(db,anchor)
  assert.equal(result.participantPhotos[0].thumbnail,`/events/${base.seo_slug}/participant-media/thumb-0`)
  assert.equal(result.participantPhotos[0].image,`/events/${base.seo_slug}/participant-media/photo-0`)
  assert.doesNotMatch(JSON.stringify(result),new RegExp(`${photoId}|storage_path|upload_token`))
})
