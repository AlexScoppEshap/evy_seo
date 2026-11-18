// Runs the actual production build against an isolated, read-only HTTP fixture.
// Requires: npx next build --webpack (or npm run build), then npm run test:http.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { readFileSync, readdirSync } from 'node:fs'
import { publicEventFixture as base, FIXTURE_ANON_KEY } from '../lib/seo-fixtures.ts'
import { runProxyChecks } from './seo-proxy-harness.mjs'
import { fixtureWordPressIndex, fixtureGeocoding, fixtureMapPng } from './seo-qualification-fixtures.mjs'
import { runApacheChecks } from './seo-apache-qualification.mjs'

let assertions = 0
const check = (fn) => { fn(); assertions++ }
const rows = [
  { ...base, seo_slug: 'scheduled', recurrence_state: 'active', address:'Public fixture street 1' },
  { ...base, id: '10000000-0000-0000-0000-000000000002', seo_slug: 'next', recurrence_state: 'active', start_date: '2026-10-30T22:30:00Z' },
  { ...base, id: '10000000-0000-0000-0000-000000000003', seo_slug: 'cancelled', status: 'cancelled', recurrence_state: 'active' },
  { ...base, id: '10000000-0000-0000-0000-000000000004', seo_slug: 'postponed', status: 'postponed' },
  { ...base, id: '10000000-0000-0000-0000-000000000005', seo_slug: 'rescheduled', status: 'postponed', previous_start_at: '2026-10-16T21:30:00Z' },
  { ...base, id: '10000000-0000-0000-0000-000000000006', seo_slug: 'private', is_public: false },
  { ...base, id: '10000000-0000-0000-0000-000000000007', seo_slug: 'excluded', recurrence_state: 'excluded' },
  { ...base, id: '10000000-0000-0000-0000-000000000008', seo_slug: 'hidden' },
  { ...base, id: '10000000-0000-0000-0000-000000000009', seo_slug: 'draft-null', is_public: null },
  { ...base, id: '10000000-0000-0000-0000-00000000000a', seo_slug: 'moderation-pending', ai_moderation_status: 'pending' },
  { ...base, id: '10000000-0000-0000-0000-00000000000b', seo_slug: 'deleting-creator', users: { ...base.users, account_status: 'pending_deletion' } },
  { ...base, id: '10000000-0000-0000-0000-00000000000c', seo_slug: 'meetup', event_type: 'meetup', meetup_subcategory: 'drinks_nightlife', participation_mode: 'approval_required', participation_capacity: 8 },
].map(row => ({ ...row, image_url: 'https://fixture.supabase.co/functions/v1/ik-storage?key=private-object&token=private-token' }))
const calls = []
const requestMethods = []
let sitemapOutage = false
let rpcMode = 'normal'
let changingRead = false
let credentialBoundaryViolations = 0
let meetupsEnabled = true
let imageFetches = 0
let mapFetches = 0
let wordPressMode = 'normal'
let mapMode = 'normal'
const fixture = createServer((req, res) => {
  const url = new URL(req.url, 'http://fixture')
  calls.push(url)
  requestMethods.push(req.method)
  if (url.pathname === '/sitemap_index.xml') {
    if (req.headers.authorization || req.headers.cookie || req.headers.apikey) credentialBoundaryViolations++
    res.setHeader('Content-Type','application/xml')
    if(wordPressMode==='outage'){res.statusCode=502;res.end('PRIVATE_WORDPRESS_DIAGNOSTIC');return}
    if(wordPressMode==='nested'){res.end(fixtureWordPressIndex.replace('page-sitemap.xml','sitemap_index.xml'));return}
    res.end(fixtureWordPressIndex);return
  }
  if (url.pathname.startsWith('/geocoding/') || url.pathname.startsWith('/maps/streets-v4/')) {
    mapFetches++
    if(req.headers.authorization||req.headers.cookie||req.headers.apikey||req.headers.referer||url.searchParams.get('key')!=='synthetic_map_key')credentialBoundaryViolations++
    if(mapMode==='outage'){res.statusCode=403;res.end('PRIVATE_MAP_DIAGNOSTIC');return}
    if(url.pathname.startsWith('/geocoding/')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(fixtureGeocoding));return}
    res.setHeader('Content-Type','image/png');res.end(fixtureMapPng);return
  }
  if (url.pathname === '/functions/v1/ik-storage') {
    if (url.searchParams.get('action') === 'participant_photo') {
      if (req.headers.apikey !== FIXTURE_ANON_KEY || req.headers.authorization !== `Bearer ${FIXTURE_ANON_KEY}` || req.headers.cookie) credentialBoundaryViolations++
      res.setHeader('Content-Type','application/octet-stream');res.end(Buffer.from([255,216,255,217]));return
    }
    imageFetches++
    if (req.headers.apikey || req.headers.authorization || req.headers.cookie) credentialBoundaryViolations++
    res.setHeader('Content-Type', 'image/png')
    res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4AWMAAQAABQABNtCI3QAAAABJRU5ErkJggg==', 'base64'))
    return
  }
  if (req.headers.apikey !== FIXTURE_ANON_KEY || req.headers.authorization !== `Bearer ${FIXTURE_ANON_KEY}`) credentialBoundaryViolations++
  res.setHeader('Content-Type', 'application/json')
  if (url.pathname.endsWith('/rpc/get_meetup_capabilities')) {
    res.end(JSON.stringify({ contract_version: 1, discover_enabled: meetupsEnabled, create_enabled: false })); return
  }
  if (url.pathname.endsWith('/rpc/image_event_gallery')) { res.end('[]'); return }
  if (url.pathname.endsWith('/rpc/get_public_organizer_pro_badges')) { res.end('[]'); return }
  if (url.pathname.endsWith('/rpc/get_public_event_organizer_contacts')) {
    res.end(JSON.stringify([{organizer_id:base.creator_id,channel_type:'website',platform:null,value:'https://organizer.example/'}]));return
  }
  if (url.pathname.endsWith('/rpc/get_public_related_events')) {
    res.end(JSON.stringify({entries:[{event_id:rows[1].id,title:'PRIVATE_RELATED_RPC_TEXT'},{event_id:rows[5].id}]}));return
  }
  if (url.pathname.endsWith('/event_comments')) {
    if (req.method !== 'HEAD' || url.searchParams.get('moderation_status') !== 'eq.approved') {res.statusCode=403;res.end('{}');return}
    res.setHeader('Content-Range','*/7');res.end();return
  }
  if (url.pathname.endsWith('/event_participant_photos')) {
    res.end(JSON.stringify(url.searchParams.get('event_id') === `eq.${base.id}` ? [{id:'90000000-0000-0000-0000-000000000001',event_id:base.id,status:'approved',uploaded_at:'2026-10-12T12:00:00Z',author:{username:'public_author',account_status:'active'}}] : []));return
  }
  if (url.pathname.endsWith('/rpc/get_public_series_occurrences')) {
    if (rpcMode === 'timeout') return
    if (rpcMode === 'outage') { res.statusCode = 502; res.end(JSON.stringify({ message: 'PRIVATE_SQL_ERROR' })); return }
    if (rpcMode === 'malformed') { res.end(JSON.stringify({ entries: [{ event_id: rows[1].id }] })); return }
    res.end(JSON.stringify({ entries: rows.map(row => ({ event_id: row.id, title: 'PRIVATE_RPC_PAYLOAD' })) }))
    return
  }
  if (url.searchParams.get('seo_slug') === 'eq.outage' || (sitemapOutage && url.searchParams.has('id'))) {
    res.statusCode = 400; res.end(JSON.stringify({ message: 'PRIVATE_SQL_ERROR', code: 'fixture' })); return
  }
  if (url.searchParams.get('seo_slug') === 'eq.timeout') return
  if (url.searchParams.get('seo_slug') === 'eq.malformed') { res.end(JSON.stringify({ private: 'PRIVATE_BACKEND_DIAGNOSTIC' })); return }
  let visible = rows.filter(row => row.seo_slug !== 'hidden') // restrictive anon RLS
  for (const [key, expression] of url.searchParams) {
    if (key === 'select' || key === 'order' || key === 'limit') continue
    if (key === 'or') { visible = visible.filter(row => expression.includes('is_public') ? row.is_public !== true : row.recurrence_state === null || row.recurrence_state === 'active'); continue }
    const [op, ...rest] = expression.split('.')
    const value = rest.join('.')
    if (op === 'is' && value === 'null') visible = visible.filter(row => row[key] === null)
    if (op === 'not' && value === 'is.null') visible = visible.filter(row => row[key] !== null)
    if (op === 'eq') visible = visible.filter(row => String(key === 'users.account_status' ? row.users?.account_status : row[key]) === value)
    if (op === 'gte') visible = visible.filter(row => row[key] >= value)
    if (op === 'lte') visible = visible.filter(row => row[key] <= value)
    if (op === 'gt') visible = visible.filter(row => row[key] > value)
    if (op === 'lt') visible = visible.filter(row => row[key] < value)
    if (op === 'in') visible = visible.filter(row => value.slice(1,-1).split(',').includes(row[key]))
  }
  visible.sort((a,b) => a.id.localeCompare(b.id))
  if (String(req.headers.prefer).includes('count=exact')) res.setHeader('Content-Range',`*/${visible.length}`)
  const selected = visible.slice(0, Number(url.searchParams.get('limit') ?? 100))
  const payload = rpcMode === 'malformed' && url.searchParams.has('id') ? [{ ...rows[1], name: { private: 'PRIVATE_BACKEND_DIAGNOSTIC' } }] : selected
  res.end(JSON.stringify(payload))
  if (changingRead && url.searchParams.get('seo_slug') === 'eq.scheduled') { rows[0].name = 'CHANGED_AFTER_METADATA'; rows[0].status = 'cancelled' }
})
fixture.listen(0, '127.0.0.1')
await once(fixture, 'listening')
const fixturePort = fixture.address().port
rows[0].image_url = `http://127.0.0.1:${fixturePort}/functions/v1/ik-storage?action=image_public&id=${base.id}&token=synthetic_public_signature_123456&published=0`
rows[0].gallery_image_urls = [rows[0].image_url]
const reserve = createServer()
reserve.listen(0, '127.0.0.1'); await once(reserve, 'listening')
const appPort = reserve.address().port
await new Promise(resolve => reserve.close(resolve))
let serverLog = ''
const server = spawn(process.execPath, ['--require', './scripts/seo-test-clock.cjs', 'node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(appPort)], {
  env: { ...process.env, SUPABASE_URL: `http://127.0.0.1:${fixturePort}`, SUPABASE_ANON_KEY: FIXTURE_ANON_KEY,
    WORDPRESS_SITEMAP_INDEX_URL:`http://127.0.0.1:${fixturePort}/sitemap_index.xml`,MAPTILER_API_KEY:'synthetic_map_key',MAPTILER_API_ORIGIN:`http://127.0.0.1:${fixturePort}` },
  stdio: ['ignore','pipe','pipe'],
})
server.stdout.on('data', data => { serverLog += data })
server.stderr.on('data', data => { serverLog += data })
const origin = `http://127.0.0.1:${appPort}`
try {
  const deadline = Date.now()+20_000
  while (!serverLog.includes('Ready')) {
    if (Date.now()>deadline || server.exitCode !== null) throw new Error('Fixture Next server failed to start')
    await new Promise(resolve=>setTimeout(resolve,50))
  }
  const summaries = []
  const forbiddenOutput = /Evy SEO test|Create Next App|SUPABASE_|postgres(?:ql)?:\/\/|private-token|private-object|PRIVATE_SQL_ERROR|PRIVATE_BACKEND_DIAGNOSTIC/
  for (const agent of ['Evy-readiness-test', 'Googlebot', 'facebookexternalhit']) {
    for (const method of ['GET', 'HEAD']) {
      const before = calls.length
      const root = await fetch(origin, { method, headers: { 'User-Agent': agent, cookie: 'debug=1', authorization: 'Bearer pretend-viewer-token' } })
      const rootBody = await root.text()
      // HEAD ends before the streamed SSR work finishes; include its fixture reads
      // in this request's budget rather than the following GET's budget.
      if (method === 'HEAD') await new Promise(resolve=>setTimeout(resolve,100))
      check(()=>assert.equal(root.status,200))
      check(()=>assert.equal(root.headers.get('location'),null))
      check(()=>assert.equal(root.headers.get('x-powered-by'),null))
      check(()=>assert.match(root.headers.get('content-type'),/text\/html/))
      check(()=>assert.doesNotMatch(rootBody + JSON.stringify([...root.headers]),forbiddenOutput))
      check(()=>assert.ok(calls.length-before <= 5, 'Homepage caps four availability probes plus one selected-city query'))
      const homepageCalls=calls.slice(before)
      check(()=>assert.ok(homepageCalls.every(url=>url.pathname==='/rest/v1/events'&&url.searchParams.get('limit')==='12')))
      check(()=>assert.ok(homepageCalls.filter(url=>url.searchParams.get('select')?.includes('description')).length<=1))
      if (method === 'GET') {
        check(()=>assert.match(rootBody,/<h1[^>]*><span>Ta vibe\.<\/span>/))
        check(()=>assert.match(rootBody,/<meta name="robots" content="noindex, follow"/))
        check(()=>assert.match(rootBody,/rel="canonical" href="https:\/\/myevy.app\/"/))
      } else check(()=>assert.equal(rootBody,''))
    }
  }
  const unknown = await fetch(`${origin}/unknown-route-readiness`)
  check(()=>assert.equal(unknown.status,404))
  const awaitedUnknownBody = await unknown.text()
  check(()=>assert.doesNotMatch(awaitedUnknownBody,forbiddenOutput))

  for (const slug of ['scheduled','next','cancelled','postponed','rescheduled','meetup','moderation-pending','deleting-creator','private','draft-null','excluded','hidden','missing','outage','malformed','timeout']) {
    const before = calls.length
    const started = performance.now()
    const response = await fetch(`${origin}/events/${slug}`)
    const html = await response.text()
    const expected = ['private','draft-null','excluded','hidden','missing','moderation-pending','deleting-creator'].includes(slug) ? 404 : ['outage','malformed','timeout'].includes(slug) ? 500 : 200
    check(()=>assert.equal(response.status, expected, slug))
    check(()=>assert.doesNotMatch(html, /private-token|private-object|PRIVATE_RPC_PAYLOAD|PRIVATE_SQL_ERROR|PRIVATE_BACKEND_DIAGNOSTIC|synthetic_public_signature_123456/))
    const directReads = calls.slice(before).filter(url => url.searchParams.get('seo_slug') === `eq.${slug}`)
    // Next may start a fresh render attempt after a thrown backend error.
    check(()=>assert.equal(directReads.length, ['outage','malformed','timeout'].includes(slug) ? 2 : 1, `${slug}: metadata/page memoization`))
    if (expected === 200) {
      check(()=>assert.ok(html.includes(`rel="canonical" href="https://myevy.app/events/${slug}"`)))
      check(()=>assert.doesNotMatch(html,/<meta name="robots" content="noindex/))
      const payload = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])
      check(()=>assert.equal(payload.url, `https://myevy.app/events/${slug}`))
      if (slug === 'cancelled') check(()=>assert.match(html, /role="status"[^>]*>Cancelled/))
      if (slug === 'postponed') check(()=>assert.equal(payload.eventStatus, 'https://schema.org/EventPostponed'))
      if (slug === 'rescheduled') check(()=>assert.equal(payload.eventStatus, 'https://schema.org/EventRescheduled'))
      if (slug === 'scheduled') {
        for (const section of ['event-community','event-participation','participants-title','event-location','organizer-contacts','participant-photos','comments-title','related-events']) check(()=>assert.ok(html.includes(`id="${section}"`),section))
        check(()=>assert.match(html.replaceAll('<!-- -->',''),/Comments \(7\)/))
        check(()=>assert.match(html,/Follow in Evy/))
        check(()=>assert.match(html,/Add to calendar in Evy/))
        check(()=>assert.match(html,/href="https:\/\/organizer.example\/"/))
        check(()=>assert.doesNotMatch(html,/PRIVATE_RELATED_RPC_TEXT|wa.me|whatsapp|conversation_id|\.ics/))
        check(()=>assert.doesNotMatch(html,/90000000-0000-0000-0000-000000000001|storage_path|upload_token/))
        check(()=>assert.match(html, /<a href="https:\/\/myevy.app\/events\/next"/))
        check(()=>assert.doesNotMatch(html, /<a href="https:\/\/myevy.app\/events\/(?:private|excluded|hidden|cancelled)"/))
        const authResponse = await fetch(`${origin}/events/${slug}`, { headers: { cookie: 'sb-auth-token=pretend-viewer-session', authorization: 'Bearer pretend-viewer-token' } })
        const authHtml = await authResponse.text()
        check(()=>assert.equal(authResponse.status, 200))
        check(()=>assert.equal(authHtml.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1], JSON.stringify(payload)))
      }
    } else if (expected === 404) check(()=>assert.doesNotMatch(html, /application\/ld\+json|rel="canonical"/))
    summaries.push({slug,status:response.status,ms:Math.round(performance.now()-started),bytes:Buffer.byteLength(html),backendCalls:calls.length-before})
  }
  for (const patch of [ { is_public: false }, { recurrence_state: 'excluded' }, { ai_moderation_status: 'pending' }, { users: { ...base.users, account_status: 'pending_deletion' } }, { status: 'cancelled' },
    { status: 'postponed', previous_start_at: '2026-10-16T21:30:00Z' }, { status: 'scheduled', previous_start_at: null } ]) {
    Object.assign(rows[0], patch)
    const response = await fetch(`${origin}/events/scheduled`)
    const html = await response.text()
    const blocked = rows[0].is_public === false || rows[0].recurrence_state === 'excluded' || rows[0].ai_moderation_status !== 'approved' || rows[0].users.account_status !== 'active'
    check(()=>assert.equal(response.status, blocked ? 404 : 200))
    check(()=>assert.match(response.headers.get('cache-control'),/no-store/))
    const child = await (await fetch(`${origin}/events-sitemap.xml?partition=10`)).text()
    check(()=>assert.equal(child.includes('<loc>https://myevy.app/events/scheduled</loc>'), !blocked && rows[0].status !== 'cancelled'))
    if (blocked) check(()=>assert.doesNotMatch(html,/application\/ld\+json|rel="canonical"/))
    else {
      const status = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]).eventStatus
      check(()=>assert.equal(status,`https://schema.org/${rows[0].status === 'cancelled' ? 'EventCancelled' : rows[0].status === 'postponed' ? 'EventRescheduled' : 'EventScheduled'}`))
    }
    Object.assign(rows[0],{is_public:true,recurrence_state:'active',status:'scheduled',previous_start_at:null,ai_moderation_status:'approved',users:base.users})
  }
  const revisionZeroCover = rows[0].image_url
  for (const [suffix, expected] of [
    ['&published=0',200], ['&published=2',200], ['',200],
    ['&published=-1',404], ['&published=1.5',404], ['&published=',404],
    ['&published=0&published=1',404], ['&published=0&published=0',404],
  ]) {
    rows[0].image_url = revisionZeroCover.replace('&published=0', suffix)
    rows[0].gallery_image_urls = [rows[0].image_url]
    const before = imageFetches
    const response = await fetch(`${origin}/events/scheduled/media/cover`)
    check(()=>assert.equal(response.status,expected))
    check(()=>assert.equal(response.headers.get('cache-control'),'private, no-store'))
    check(()=>assert.equal(imageFetches-before,expected===200?1:0))
    await response.arrayBuffer()
  }
  rows[0].image_url = revisionZeroCover
  rows[0].gallery_image_urls = [revisionZeroCover]
  // The same stable public media URL must revoke on the next request, independent
  // of viewer cookies, RSC, the old upstream cache or source signed URL lifetime.
  for (const [patch, expected] of [[{},200],[{is_public:false},404],[{ai_moderation_status:'rejected'},404],[{users:{...base.users,account_status:'pending_deletion'}},404]]) {
    Object.assign(rows[0],patch)
    const before = imageFetches
    const response = await fetch(`${origin}/events/scheduled/media/cover`, {headers:{cookie:'sb-auth-token=viewer',authorization:'Bearer viewer'}})
    check(()=>assert.equal(response.status,expected))
    check(()=>assert.match(response.headers.get('cache-control'),/no-store/))
    check(()=>assert.equal(imageFetches-before,expected===200?1:0))
    if (expected===200) check(()=>assert.equal(response.headers.get('content-type'),'image/png'))
    Object.assign(rows[0],{is_public:true,ai_moderation_status:'approved',users:base.users})
  }
  for (const path of ['cover?url=http://localhost','unknown','gallery-9']) {
    const before = calls.length
    const response = await fetch(`${origin}/events/scheduled/media/${path}`)
    check(()=>assert.equal(response.status,404));check(()=>assert.equal(calls.length,before))
  }
  for (const [patch,expected] of [[{},200],[{is_public:false},404],[{ai_moderation_status:'pending'},404]]) {
    Object.assign(rows[0],patch)
    const photo=await fetch(`${origin}/events/scheduled/participant-media/thumb-0`,{headers:{cookie:'viewer=session',authorization:'Bearer viewer'}})
    check(()=>assert.equal(photo.status,expected));check(()=>assert.match(photo.headers.get('cache-control'),/no-store/))
    if(expected===200)check(()=>assert.equal(photo.headers.get('content-type'),'image/jpeg'))
    Object.assign(rows[0],{is_public:true,ai_moderation_status:'approved'})
  }
  meetupsEnabled = false
  const disabledMeetup = await fetch(`${origin}/events/meetup`)
  check(()=>assert.equal(disabledMeetup.status,404))
  const withoutMeetups = await (await fetch(`${origin}/events-sitemap.xml?partition=10`)).text()
  check(()=>assert.doesNotMatch(withoutMeetups, /events\/meetup</))
  check(()=>assert.match(withoutMeetups, /events\/scheduled</))
  meetupsEnabled = true
  const mapPreview=await fetch(`${origin}/events/scheduled/map/preview`,{headers:{cookie:'viewer=session',authorization:'Bearer viewer'}})
  check(()=>assert.equal(mapPreview.status,200))
  const map=await mapPreview.json()
  check(()=>assert.equal(map.tiles.length,8));check(()=>assert.doesNotMatch(JSON.stringify(map),/synthetic_map_key|Public fixture street|maptiler\.com/))
  for(const [patch,expected] of [[{},200],[{is_public:false},404],[{ai_moderation_status:'pending'},404],[{users:{...base.users,account_status:'pending_deletion'}},404],[{recurrence_state:'excluded'},404]]){
    Object.assign(rows[0],patch);const before=mapFetches
    const tile=await fetch(origin+map.tiles[0],{headers:{cookie:'viewer=session',authorization:'Bearer viewer'}})
    check(()=>assert.equal(tile.status,expected));check(()=>assert.match(tile.headers.get('cache-control'),/no-store/));check(()=>assert.equal(tile.headers.get('x-robots-tag'),'noindex'))
    check(()=>assert.equal(mapFetches-before,expected===200?1:0))
    Object.assign(rows[0],{is_public:true,ai_moderation_status:'approved',users:base.users,recurrence_state:'active'})
  }
  rows[0].address='Changed fixture venue 2'
  const staleMap=await fetch(origin+map.tiles[0])
  check(()=>assert.equal(staleMap.status,404))
  rows[0].address='Public fixture street 1'
  mapMode='outage'
  const noTile=await fetch(origin+map.tiles[0])
  const noTileBody=await noTile.text()
  check(()=>assert.equal(noTile.status,503));check(()=>assert.doesNotMatch(noTileBody,/PRIVATE_MAP_DIAGNOSTIC|synthetic_map_key/))
  mapMode='normal'
  for(const path of ['tile-8','tile-0?url=http://localhost','preview?key=override']){
    const invalidMap=await fetch(`${origin}/events/scheduled/map/${path}`)
    check(()=>assert.equal(invalidMap.status,404))
  }
  changingRead = true
  const stable = await (await fetch(`${origin}/events/scheduled`)).text()
  changingRead = false
  check(()=>assert.doesNotMatch(stable,/CHANGED_AFTER_METADATA|EventCancelled/))
  check(()=>assert.match(stable,/<h1[^>]*>Friday live<\/h1>/))
  rows[0].name = base.name; rows[0].status = 'scheduled'
  for (const mode of ['outage','malformed','timeout']) {
    rpcMode = mode
    const isolated = await fetch(`${origin}/events/scheduled`)
    const html = await isolated.text()
    check(()=>assert.equal(isolated.status,200))
    check(()=>assert.doesNotMatch(html,/id="other-dates"|PRIVATE_SQL_ERROR|PRIVATE_BACKEND_DIAGNOSTIC/))
  }
  rpcMode = 'normal'
  for (const slug of ['private','draft-null','excluded','hidden','missing','moderation-pending','deleting-creator','scheduled','outage']) {
    const prefetch = await fetch(`${origin}/events/${slug}`,{headers:{RSC:'1','Next-Router-Prefetch':'1'}})
    const expected = ['private','draft-null','excluded','hidden','missing','moderation-pending','deleting-creator'].includes(slug) ? 404 : slug === 'outage' ? 503 : 200
    check(()=>assert.equal(prefetch.status,expected))
    const body = await prefetch.text()
    check(()=>assert.doesNotMatch(body,forbiddenOutput))
    if (expected !== 200) {
      check(()=>assert.equal(prefetch.headers.get('cache-control'),'no-store'))
      check(()=>assert.equal(prefetch.headers.get('x-robots-tag'),'noindex'))
      check(()=>assert.doesNotMatch(body,/Friday live|application\/ld\+json|canonical/))
    }
  }
  rows[0].is_public = false
  const unpublished = await fetch(`${origin}/events/scheduled`)
  const unpublishedHtml = await unpublished.text()
  check(()=>assert.equal(unpublished.status,404))
  check(()=>assert.doesNotMatch(unpublishedHtml,/application\/ld\+json|rel="canonical"/))
  check(()=>assert.match(unpublished.headers.get('cache-control'),/no-store/))
  rows[0].is_public = true
  const indexResponse = await fetch(`${origin}/events-sitemap.xml`)
  const index = await indexResponse.text()
  check(()=>assert.equal(indexResponse.status,200))
  check(()=>assert.equal(indexResponse.headers.get('cache-control'),'no-store'))
  check(()=>assert.equal((index.match(/<sitemap>/g)??[]).length,256))
  check(()=>assert.match(index,/https:\/\/myevy.app\/events-sitemap.xml\?partition=10/))
  const childResponse = await fetch(`${origin}/events-sitemap.xml?partition=10`)
  const child = await childResponse.text()
  check(()=>assert.equal(childResponse.status,200))
  check(()=>assert.doesNotMatch(child,/\/events\/(?:private|excluded|hidden|cancelled)</))
  sitemapOutage = true
  const failedSitemap = await fetch(`${origin}/events-sitemap.xml?partition=10`)
  check(()=>assert.equal(failedSitemap.status,503))
  const awaitedSitemapBody = await failedSitemap.text()
  check(()=>assert.doesNotMatch(awaitedSitemapBody,/PRIVATE_SQL_ERROR/))
  sitemapOutage = false
  const invalidResponse = await fetch(`${origin}/events-sitemap.xml?partition=invalid`)
  check(()=>assert.equal(invalidResponse.status,400))
  const robots = await (await fetch(`${origin}/robots.txt`)).text()
  check(()=>assert.match(robots,/Sitemap: https:\/\/myevy.app\/sitemap.xml/))
  check(()=>assert.equal(serverLog.includes('PRIVATE_SQL_ERROR'),false))
  const merged=await fetch(`${origin}/sitemap.xml`,{headers:{cookie:'viewer=session',authorization:'Bearer viewer'}})
  check(()=>assert.equal(merged.status,200));check(()=>assert.equal(merged.headers.get('cache-control'),'no-store'))
  const mergedXml=await merged.text()
  check(()=>assert.equal((mergedXml.match(/<loc>/g)??[]).length,257));check(()=>assert.match(mergedXml,/page-sitemap.xml/));check(()=>assert.doesNotMatch(mergedXml,/<loc>[^<]*sitemap_index.xml/))
  for(const mode of ['outage','nested']){
    wordPressMode=mode;const failedRoot=await fetch(`${origin}/sitemap.xml`)
    const failedRootBody=await failedRoot.text()
    check(()=>assert.equal(failedRoot.status,200));check(()=>assert.equal(failedRootBody,mergedXml));check(()=>assert.doesNotMatch(failedRootBody,/PRIVATE_WORDPRESS_DIAGNOSTIC/))
  }
  wordPressMode='normal'
  check(()=>assert.equal(calls.some(url=>url.pathname==='/sitemap_index.xml'),false))
  for(const query of ['city=unknown','city=ch-lausanne&city=ch-geneve','city=ch-lausanne&extra=1','city=ch-lausanne%2Cor%28is_public.eq.false%29']) {
    const response=await fetch(`${origin}/api/marketing/events?${query}`);check(()=>assert.equal(response.status,400));
  }
  const cityResponse=await fetch(`${origin}/api/marketing/events?city=ch-lausanne`);
  check(()=>assert.equal(cityResponse.status,200));check(()=>assert.equal(cityResponse.headers.get('cache-control'),'private, no-store'));
  const cityBody=await cityResponse.text();check(()=>assert.doesNotMatch(cityBody,/private-token|ik-storage|creator_id|description/));
  const foreignCity=await fetch(`${origin}/api/marketing/events?city=ch-geneve`);
  const foreignCityData=await foreignCity.json();check(()=>assert.deepEqual(foreignCityData.events,[]));
  const clientFiles = readdirSync('.next/static', { recursive: true }).filter(name => String(name).endsWith('.js'))
  const forbiddenClientFiles = clientFiles.filter(name => /SUPABASE_SERVICE_ROLE_KEY|service_role|ik-storage|private-token|private-object|synthetic_map_key/.test(readFileSync(`.next/static/${name}`, 'utf8')))
  check(()=>assert.equal(forbiddenClientFiles.length,0))
  check(()=>assert.equal(credentialBoundaryViolations,0))
  for (const [isPrivate,expectedExit] of [[false,0],[true,2]]) {
    rows.find(row=>row.seo_slug==='private').is_public = !isPrivate
    rows.find(row=>row.seo_slug==='draft-null').is_public = isPrivate ? null : true
    const before = calls.length
    const audit = spawn(process.execPath,['--experimental-strip-types','scripts/seo-anon-audit.mjs'],{
      env:{...process.env,SUPABASE_URL:`http://127.0.0.1:${fixturePort}`,SUPABASE_ANON_KEY:FIXTURE_ANON_KEY},
      stdio:['ignore','pipe','pipe'],
    })
    let output=''
    audit.stdout.on('data',data=>{output+=data})
    const [code]=await once(audit,'close')
    check(()=>assert.equal(code,expectedExit))
    check(()=>assert.doesNotMatch(output,/fixture_signature|PRIVATE_SQL_ERROR|Friday live/))
    check(()=>assert.equal(JSON.parse(output).rowsExported,0))
    check(()=>assert.ok(requestMethods.slice(before).every(method=>method==='HEAD')))
  }
  const proxy = await runProxyChecks({ appOrigin: origin, check })
  const apache = await runApacheChecks({ appOrigin: origin, check })
  check(()=>assert.equal(credentialBoundaryViolations,0))
  console.log(JSON.stringify({suite:'actual Next HTTP fixture',assertions,failures:0,proxy,apache,pages:summaries},null,2))
} finally {
  server.kill('SIGTERM')
  fixture.closeAllConnections()
  await new Promise(resolve=>fixture.close(resolve))
}
