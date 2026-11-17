import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { publicEventFixture as base } from './seo-fixtures.ts'
import * as seo from './event-seo.ts'
import * as jsonLd from './event-json-ld.ts'
import * as presentation from './event-presentation.ts'
import type { PublicEvent } from './event-seo.ts'
import * as sharing from './event-share.ts'
import { emptyEventDetailExtras, type EventDetailExtras } from './event-detail-data.ts'

const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../app/events/[slug]/page.tsx', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText
function pageModule(event: PublicEvent, alternatives: PublicEvent[] = [], extras: EventDetailExtras = emptyEventDetailExtras()) {
  const exports: Record<string, (props: unknown) => Promise<React.ReactNode>> = {}
  const load = (id: string) => {
    if (id === '@/lib/event-seo') return seo
    if (id === '@/lib/event-json-ld') return jsonLd
    if (id === '@/lib/event-presentation') return presentation
    if (id === '@/lib/event-share') return sharing
    if (id === '@/lib/public-events') return { getPublicEvent: async () => event, getOtherDates: async () => alternatives, getEventDetailExtras: async () => extras }
    if (id.endsWith('.webp') || id.endsWith('.svg')) return { default: { src: `/_next/static/media/${id.split('/').at(-1)}` } }
    if (id === '@/app/components/event-share-actions' || id === '@/app/components/event-photos' || id === '@/app/components/meetup-cover' || id === '@/app/components/event-location-map') {
      const component = readFileSync(new URL(`../app/components/${id.split('/').at(-1)}.tsx`, import.meta.url), 'utf8')
      const result = {}
      new Function('require', 'exports', ts.transpileModule(component, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(load, result)
      return result
    }
    if (id === 'next/image') return { default: (props: Record<string, unknown>) => React.createElement('img', {
      src: props.src, alt: props.alt, width: props.width, height: props.height,
    }) }
    return require(id)
  }
  new Function('require', 'exports', compiled)(load, exports)
  return exports
}
for (const [status, previous, notice] of [
  ['scheduled', null, null], ['cancelled', null, 'Cancelled'],
  ['postponed', null, 'Postponed'], ['postponed', '2026-10-16T21:30:00Z', 'Rescheduled'],
] as const) {
  test(`actual server page HTML: ${status}/${notice ?? 'scheduled'}`, async () => {
    const event = { ...base, status, previous_start_at: previous,
      image_url: 'https://fixture.supabase.co/functions/v1/ik-storage?key=private&token=secret' }
    const renderedPage = pageModule(event)
    const html = renderToStaticMarkup(await renderedPage.default({ params: Promise.resolve({ slug: base.seo_slug }) }))
    assert.match(html, /<h1[^>]*>Friday live<\/h1>/)
    assert.match(html, /<time dateTime="2026-10-23T21:30:00.000Z"/)
    assert.match(html, new RegExp(`https://app.myevy.app/event/${base.id}`))
    assert.doesNotMatch(html, /token=secret|key=private|creator|InStock/)
    if (notice) assert.match(html, new RegExp(`role="status"[^>]*>${notice}`))
    if (status === 'cancelled') assert.doesNotMatch(html, /href="https:\/\/tickets.example/)
    const payload = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]
    assert.equal(JSON.parse(payload).url, seo.eventUrl(base.seo_slug!))
  })
}
test('Other Dates anchors and localized times exist in server HTML before hydration', async () => {
  const next = { ...base, id: '10000000-0000-0000-0000-000000000002', seo_slug: 'next-edition', start_date: '2026-10-30T22:30:00Z', end_date: null }
  const html = renderToStaticMarkup(await pageModule({ ...base, status: 'cancelled' }, [next]).default({ params: Promise.resolve({ slug: base.seo_slug }) }))
  assert.match(html, /<h2 id="other-dates"/)
  assert.match(html, /<a href="https:\/\/myevy.app\/events\/next-edition"/)
  assert.match(html, /Fri, Oct 30, 2026, 23:30/)
})
test('missing organizer/venue/image and hostile description render without invented entities or scripts', async () => {
  const event = { ...base, users: null, venue_name: null, city: null, country_code: null, name: null,
    description: '</script><script>attack</script>', price: 0 }
  const html = renderToStaticMarkup(await pageModule(event).default({ params: Promise.resolve({ slug: base.seo_slug }) }))
  assert.match(html, /Untitled event/)
  assert.match(html, /Location to be announced/)
  assert.doesNotMatch(html, /Evy Organizer|<script>attack|verified/i)
  assert.match(html, />Free admission</)
})

test('release sections and SEO-specific branding remain in server-rendered HTML', async () => {
  const event = { ...base, price: 90, note: 'Doors open at 20:00', event_styles: [{ styles: { name: 'all_genres' } }],
    event_ticket_types: [{ name: 'Early bird', price: 15, currency: 'CHF', sort_order: 0 }],
    gallery_image_urls: [`https://myevy.app/events/${base.seo_slug}/media/gallery-0`, `https://myevy.app/events/${base.seo_slug}/media/gallery-1`],
  }
  const html = renderToStaticMarkup(await pageModule(event).default({ params: Promise.resolve({ slug: base.seo_slug }) }))
  for (const text of ['Artists', 'Artist', 'About', 'Note', 'Doors open at 20:00', 'Photos', 'Early bird', '15 CHF', 'All genres', 'Open in Evy']) assert.ok(html.includes(text), text)
  assert.match(html, /src="https:\/\/seo.myevy.app\/logo.svg"/)
  assert.doesNotMatch(html, /90 CHF/)
})
test('Meetup page has cost and participation summary without a ticket action or group/WhatsApp metadata', async () => {
  const event = { ...base, event_type: 'meetup', meetup_subcategory: 'drinks_nightlife', participation_mode: 'approval_required', participation_capacity: 8, price: 12, end_date: null, note: 'Shared activity cost' }
  const html = renderToStaticMarkup(await pageModule(event).default({ params: Promise.resolve({ slug: base.seo_slug }) }))
  assert.match(html, /Drinks &amp; Nightlife/)
  assert.match(html, /Participation requires host approval/)
  assert.match(html, /Cost information from the host/)
  assert.match(html, /Without an end time, registrations close at the start/)
  assert.match(html, /Public Meetup/)
  assert.ok(html.indexOf('Shared activity cost') < html.indexOf('>About</'))
  assert.doesNotMatch(html, /id="event-note"|Cost details/)
  const withEnd = renderToStaticMarkup(await pageModule({ ...event, end_date: base.end_date }).default({ params: Promise.resolve({ slug: base.seo_slug }) }))
  assert.doesNotMatch(withEnd, /registrations close at the start/)
  assert.doesNotMatch(html, /Get tickets|wa.me|whatsapp|conversation_id/)
})

test('Event Detail public sections appear in native order, with real counts, contacts, profile actions and related cards', async () => {
  const gallery = [0,1].map(index => `https://myevy.app/events/${base.seo_slug}/media/gallery-${index}`)
  const event = { ...base, start_date:'2030-10-23T21:30:00Z',end_date:'2030-10-24T02:00:00Z',
    series_id:'40000000-0000-0000-0000-000000000001',note:'Doors at 20:00',gallery_image_urls:gallery }
  const related = { ...event,id:'10000000-0000-0000-0000-000000000003',seo_slug:'related-public',name:'Another public event' }
  const extras = {...emptyEventDetailExtras(),commentsCount:7,organizerPro:true,contacts:[{label:'Website',href:'https://organizer.example/'}],related:[related],participantPhotos:[{thumbnail:`/events/${base.seo_slug}/participant-media/thumb-0`,image:`/events/${base.seo_slug}/participant-media/photo-0`,authorName:'public_author'}]}
  const html = renderToStaticMarkup(await pageModule(event,[related],extras).default({ params:Promise.resolve({slug:event.seo_slug}) }))
  const order=['event-community','event-participation','artists','event-note','participants-title','event-location','organizer-contacts','event-photos','participant-photos','comments-title','other-dates','related-events']
  let last = -1
  for (const section of order) {
    const position=html.indexOf(`id="${section}"`)
    assert.ok(position>last,`Missing or out-of-order section: ${section}`);last=position
  }
  for(const label of ['Organizer Pro','Follow in Evy','Add to calendar in Evy','Join Group in Evy','Participate in Evy','Participants · 0','Comments (7)','Report event in Evy','View map','You might also like']) assert.ok(html.includes(label),label)
  assert.match(html,/href="https:\/\/app.myevy.app\/user\/organizer"/)
  assert.match(html,/href="https:\/\/organizer.example\/"/)
  assert.match(html,/href="https:\/\/myevy.app\/events\/related-public"/)
  assert.match(html,/aria-roledescription="carousel"/)
  assert.match(html,/<dialog[^>]*aria-label="Event photo viewer"/)
  assert.doesNotMatch(html,/whatsapp|wa.me|participant_photo|conversation_id|\.ics|token=/i)
})
test('Claim matches the existing importer/non-recurring contract, without new app routes', async () => {
  const event={...base,creator_id:jsonLd.EVY_SWITZERLAND_CREATOR_ID}
  const html=renderToStaticMarkup(await pageModule(event).default({params:Promise.resolve({slug:event.seo_slug})}))
  assert.match(html,/Claim this event/)
  const recurring=renderToStaticMarkup(await pageModule({...event,series_id:'40000000-0000-0000-0000-000000000001'}).default({params:Promise.resolve({slug:event.seo_slug})}))
  assert.doesNotMatch(recurring,/Claim this event/)
  assert.doesNotMatch(html,/\/event\/[^"<>]+\?(?:action|intent)=/)
})
test('cancelled detail keeps community access in Evy, disables calendar and has no participation/ticket action', async () => {
  const html=renderToStaticMarkup(await pageModule({...base,status:'cancelled'}).default({params:Promise.resolve({slug:base.seo_slug})}))
  assert.match(html,/Join Group in Evy/)
  assert.match(html,/Calendar unavailable/)
  assert.doesNotMatch(html,/Add to calendar in Evy|>Participate in Evy<|>Get tickets</)
})

test('legacy published organizer usernames retain their encoded profile URL', async () => {
  const username='Legacy-Organisateur'
  const event={...base,users:{...base.users!,username}}
  const html=renderToStaticMarkup(await pageModule(event).default({params:Promise.resolve({slug:base.seo_slug})}))
  assert.match(html,/href="https:\/\/app.myevy.app\/user\/Legacy-Organisateur"/)
})

test('Meetup illustrations use the native bundled covers through the existing _next asset proxy', async () => {
  const event={...base,event_type:'meetup',meetup_subcategory:'outdoor_nature',image_url:null,gallery_image_urls:null}
  const page=pageModule(event)
  const html=renderToStaticMarkup(await page.default({params:Promise.resolve({slug:base.seo_slug})}))
  assert.match(html,/src="\/_next\/static\/media\/outdoor_nature-[1-5]\.webp"/)
  assert.doesNotMatch(html,/src="\/meetups\//)
  const metadata=await page.generateMetadata({params:Promise.resolve({slug:base.seo_slug})}) as unknown as {openGraph:{images:unknown[]}}
  assert.deepEqual(metadata.openGraph.images,[])
})
