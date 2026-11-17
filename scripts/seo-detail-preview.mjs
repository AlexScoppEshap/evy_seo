// Local visual-review fixture only. No database connection, migration or writes.
// node --experimental-strip-types scripts/seo-detail-preview.mjs
import { createServer } from 'node:http'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { publicEventFixture as base, FIXTURE_ANON_KEY } from '../lib/seo-fixtures.ts'
import { fixtureWordPressIndex, fixtureGeocoding, fixtureMapPng } from './seo-qualification-fixtures.mjs'

const port = Number(process.env.SEO_DETAIL_PREVIEW_PORT ?? 3211)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid local preview port')
const appRoot = resolve(process.env.EVY_APP_ASSET_ROOT ?? '../../App/evy')
const illustrations = [
  readFileSync(resolve(appRoot,'assets/branding/create/event.png')),
  readFileSync(resolve(appRoot,'assets/branding/create/meetup.png')),
  readFileSync(resolve(appRoot,'assets/branding/screen/welcome/welcome-bg.png')),
]
// Existing approved Evy marketing reference, used as a clearly synthetic local
// participant image. No real participant/photo record is queried or created.
const reference = readFileSync(resolve(appRoot,'docs/evy-v2-premium-store-screenshots/masters/03-event-detail-en-review-1206x2622.jpg'))
const owner='3b271647-4f96-4a95-b788-f6de233d0bba'
const id=n=>`10000000-0000-0000-0000-${String(n).padStart(12,'0')}`
const photoId='90000000-0000-0000-0000-000000000001'
const start=new Date(Date.now()-3600000).toISOString(), end=new Date(Date.now()+10800000).toISOString()
const description='LOCAL DEMO — sample data, not a published event.\n\nThis preview shows the Event Detail sections together: multiple ticket tiers, artists, practical information, community, approved participant photos, comments, contacts and related events.\n\nThe images belong to the Evy app asset collection. No participation, group membership, purchase or claim is created here. Links into Evy use fixture event identifiers.\n\nThis longer description also demonstrates the Read more / Read less control.'
const full={...base,creator_id:owner,name:'Local demo — Evy Live Sessions',category:'music_party',description,
  start_date:start,end_date:end,price:25,currency_code:'CHF',ticketing_url:'https://tickets.example/event',
  venue_name:'Demo Hall',address:'Demo address',npa:'1000',city:'Lausanne',note:'Sample practical note: doors open one hour before the show.',
  artists:['Demo Artist One','Demo Artist Two','Demo Artist Three','Demo Artist Four','Demo Artist Five'],
  event_styles:['house','tech_house','afro_house','melodic_techno'].map(name=>({styles:{name}})),
  event_ticket_types:[{name:'Early bird',price:15,currency:'CHF',sort_order:0},{name:'Standard',price:25,currency:'CHF',sort_order:1},{name:'VIP',price:45,currency:'CHF',sort_order:2}],
  likescount:42,participantscount:8,users:{fullname:'Demo Organizer',username:'demo_organizer',profileimageurl:null,account_status:'active'},
}
const rows=[
  {...full,id:id(1),seo_slug:'detail-demo'},
  {...full,id:id(2),seo_slug:'series-demo',name:'Local demo — recurring edition',series_id:id(99),recurrence_state:'active'},
  {...full,id:id(3),seo_slug:'next-demo',name:'Local demo — next edition',series_id:id(99),recurrence_state:'active',start_date:new Date(Date.now()+604800000).toISOString(),end_date:new Date(Date.now()+615600000).toISOString()},
  {...full,id:id(4),seo_slug:'related-demo',name:'Local demo — another event'},
  {...full,id:id(5),seo_slug:'meetup-demo',name:'Local demo — outdoor Meetup',creator_id:id(90),event_type:'meetup',meetup_subcategory:'outdoor_nature',category:'meetups',participation_mode:'approval_required',participation_capacity:8,price:12,note:'Sample shared cost for the outdoor activity.',artists:null,event_styles:[],ticketing_url:null,event_ticket_types:[],image_url:null,gallery_image_urls:null},
]
let backendOrigin=''
const backend=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://fixture')
  const send=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data))}
  if(url.pathname==='/sitemap_index.xml'){res.writeHead(200,{'Content-Type':'application/xml'});res.end(fixtureWordPressIndex);return}
  if(url.pathname.startsWith('/geocoding/'))return send(fixtureGeocoding)
  if(url.pathname.startsWith('/maps/streets-v4/')){res.writeHead(200,{'Content-Type':'image/png'});res.end(fixtureMapPng);return}
  if(url.pathname==='/functions/v1/ik-storage'){
    if(url.searchParams.get('action')==='participant_photo'){res.writeHead(200,{'Content-Type':'application/octet-stream'});res.end(reference);return}
    const index=Math.max(0,Number(url.searchParams.get('id')?.slice(-1)??1)-1)%illustrations.length
    res.writeHead(200,{'Content-Type':'image/png'});res.end(illustrations[index]);return
  }
  if(req.headers.apikey!==FIXTURE_ANON_KEY)return send({message:'Local fixture only'},401)
  let text='';for await(const chunk of req)text+=chunk
  const body=text?JSON.parse(text):{}
  const anchor=rows.find(row=>row.id===(body.p_event_id??body.p_event))
  if(url.pathname.endsWith('/get_meetup_capabilities'))return send({contract_version:1,discover_enabled:true})
  if(url.pathname.endsWith('/get_public_organizer_pro_badges'))return send((body.p_organizer_ids??[]).map(organizer_id=>({organizer_id,has_pro_badge:true})))
  if(url.pathname.endsWith('/get_public_event_organizer_contacts'))return send(anchor?[{organizer_id:anchor.creator_id,channel_type:'website',value:'https://myevy.app'},{organizer_id:anchor.creator_id,channel_type:'phone',value:'+1 202 555 0123'},{organizer_id:anchor.creator_id,channel_type:'social',platform:'instagram',value:'https://instagram.com/example_organizer'}]:[])
  if(url.pathname.endsWith('/get_public_related_events'))return send({entries:rows.filter(row=>row.id!==anchor?.id&&row.seo_slug!=='next-demo').slice(0,4).map(row=>({event_id:row.id}))})
  if(url.pathname.endsWith('/get_public_series_occurrences'))return send({entries:anchor?.series_id?[{event_id:id(3)}]:[]})
  if(url.pathname.endsWith('/image_event_gallery'))return send([])
  if(url.pathname.endsWith('/event_comments')){res.writeHead(200,{'Content-Range':'*/7'});res.end();return}
  if(url.pathname.endsWith('/event_participant_photos'))return send([{id:photoId,event_id:url.searchParams.get('event_id')?.slice(3),status:'approved',uploaded_at:start,author:{username:'native_reference',account_status:'active'}}])
  if(!url.pathname.endsWith('/events'))return send([],404)
  let result=rows
  for(const[key,value]of url.searchParams){
    if(key==='seo_slug'&&value.startsWith('eq.'))result=result.filter(row=>row.seo_slug===value.slice(3))
    if(key==='id'&&value.startsWith('in.'))result=result.filter(row=>value.slice(4,-1).split(',').includes(row.id))
    if(key==='id'&&value.startsWith('gte.'))result=result.filter(row=>row.id>=value.slice(4))
    if(key==='id'&&value.startsWith('gt.'))result=result.filter(row=>row.id>value.slice(3))
    if(key==='id'&&value.startsWith('lt.'))result=result.filter(row=>row.id<value.slice(3))
    if(key==='event_type'&&value.startsWith('eq.'))result=result.filter(row=>row.event_type===value.slice(3))
    if(key==='recurrence_state'&&value==='eq.active')result=result.filter(row=>row.recurrence_state==='active')
  }
  return send(result)
})
backend.listen(0,'127.0.0.1');await once(backend,'listening')
backendOrigin=`http://127.0.0.1:${backend.address().port}`
for(const row of rows){if(row.event_type==='meetup')continue;row.image_url=`${backendOrigin}/functions/v1/ik-storage?action=image_public&id=${id(1)}&token=synthetic_public_signature_123456&published=1`;row.gallery_image_urls=[1,2,3].map(n=>`${backendOrigin}/functions/v1/ik-storage?action=image_public&id=${id(n)}&token=synthetic_public_signature_123456&published=1`)}
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,SUPABASE_URL:backendOrigin,SUPABASE_ANON_KEY:FIXTURE_ANON_KEY,WORDPRESS_SITEMAP_INDEX_URL:`${backendOrigin}/sitemap_index.xml`,MAPTILER_API_KEY:'synthetic_map_key',MAPTILER_API_ORIGIN:backendOrigin},stdio:['ignore','pipe','pipe']})
server.stdout.on('data',data=>{if(String(data).includes('Ready'))console.log(JSON.stringify({mode:'LOCAL SAMPLE DATA — no production database',previews:['detail-demo','series-demo','meetup-demo'].map(slug=>`http://127.0.0.1:${port}/events/${slug}`)}))})
server.stderr.on('data',()=>{})
let stopped=false
function stop(){if(stopped)return;stopped=true;server.kill('SIGTERM');backend.closeAllConnections();backend.close()}
process.once('SIGINT',stop);process.once('SIGTERM',stop);server.once('exit',stop)
