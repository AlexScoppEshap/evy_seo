import assert from 'node:assert/strict'
import test from 'node:test'
import { publicEventFixture as base } from './seo-fixtures.ts'
import { buildEventMetadata, directPageEligible, eventUrl, formatEventDate, formatDateRange,
  getDateParts, getHasEnded, occurrenceStatus, publicImageUrl, validSlug } from './event-seo.ts'
import { buildEventJsonLd, serializeJsonLd } from './event-json-ld.ts'

for (const timezone of ['Europe/Zurich', 'Europe/Paris']) {
  test(`DST civil Fridays stay 23:30 in ${timezone}`, () => {
    for (const instant of ['2026-10-23T21:30:00Z', '2026-10-30T22:30:00Z']) {
      assert.match(formatEventDate(instant, timezone), /^Fri.*23:30$/)
      assert.equal(getDateParts(instant, timezone)?.weekday, 'Fri')
    }
  })
}
test('overnight, multi-day and year crossing dates use both local endpoints', () => {
  assert.match(formatDateRange(base.start_date, base.end_date, base.timezone), /Fri.*23:30.*Sat.*04:00/)
  assert.match(formatDateRange('2026-12-31T22:30:00Z', '2027-01-02T02:00:00Z', base.timezone), /2026.*2027/)
  assert.equal(buildEventJsonLd(base).endDate, '2026-10-24T02:00:00.000Z')
})
test('invalid/missing timezone uses UTC, invalid/missing date never throws', () => {
  assert.match(formatEventDate(base.start_date, 'bad/zone'), /21:30/)
  assert.match(formatEventDate(base.start_date, null), /21:30/)
  assert.equal(formatEventDate('bad-date', base.timezone), 'Date to be announced')
  assert.equal(getDateParts(null, null), null)
})
for (const [label, overrides, eligible] of [
  ['independent', {}, true], ['recurring', { recurrence_state: 'active' }, true],
  ['cancelled', { status: 'cancelled' }, true], ['past', { start_date: '2020-01-01T00:00:00Z' }, true],
  ['private/draft', { is_public: false }, false], ['excluded', { recurrence_state: 'excluded' }, false],
  ['missing slug', { seo_slug: null }, false], ['unknown recurrence', { recurrence_state: 'unknown' }, false],
] as const) {
  test(`direct eligibility: ${label}`, () => {
    const event = { ...base, ...overrides }
    assert.equal(directPageEligible(event), eligible)
    if (!eligible) assert.throws(() => buildEventMetadata(event), /Ineligible/)
    else assert.equal(buildEventMetadata(event).alternates.canonical, eventUrl(base.seo_slug!))
  })
}
test('occurrences distinguish metadata, preserve text, and align OG/Twitter with canonical', () => {
  const first = buildEventMetadata(base)
  const next = buildEventMetadata({ ...base, seo_slug: 'custom-edition', name: 'Custom title', start_date: '2026-10-30T22:30:00Z' })
  assert.notEqual(first.title, next.title)
  assert.match(next.title, /Custom title.*Oct 30, 2026.*Lausanne.*Evy/)
  assert.match(first.description, /Original organizer description/)
  assert.equal(first.openGraph.url, first.alternates.canonical)
  assert.equal(first.twitter.title, first.openGraph.title)
  assert.equal(first.twitter.description, first.openGraph.description)
  assert.deepEqual(first.twitter.images, [])
})
test('metadata sanitizes HTML, bounds excerpts and keeps cancellation', () => {
  const result = buildEventMetadata({ ...base, status: 'cancelled', description: '<script>bad()</script><b>Hello</b>' + 'x'.repeat(500) })
  assert.ok(result.description.length <= 160)
  assert.match(result.description, /Cancelled.*Hello/)
  assert.doesNotMatch(result.description, /bad\(\)|<|>/)
})
test('safe slug encoding preserves identity and rejects malformed URL paths', () => {
  assert.equal(eventUrl('édition&"<>'), 'https://myevy.app/events/%C3%A9dition%26%22%3C%3E')
  for (const slug of ['', 'a/b', '..', 'a?x', 'a#x', 'a\\b', ' a', 'a\n', 'x'.repeat(513)]) {
    assert.equal(validSlug(slug), false)
    assert.throws(() => eventUrl(slug))
  }
})
test('private proxies, signed URLs and unverified media are omitted everywhere', () => {
  for (const image_url of [
    'https://project.supabase.co/functions/v1/ik-storage?action=proxy&key=private&token=secret',
    'https://project.supabase.co/storage/v1/object/sign/events/a?token=secret',
    'https://project.supabase.co/storage/v1/object/public/events/a?X-Amz-Signature=secret',
    'https://user:secret@example.com/a.jpg', 'javascript:alert(1)', 'https://unverified.example/a.jpg',
  ]) {
    const event = { ...base, image_url }
    assert.equal(publicImageUrl(image_url), undefined)
    assert.deepEqual(buildEventMetadata(event).openGraph.images, [])
    assert.equal(buildEventJsonLd(event).image, undefined)
  }
  const image = 'https://project.supabase.co/storage/v1/object/public/events/a.jpg'
  assert.equal(publicImageUrl(image), image)
  assert.deepEqual(buildEventMetadata({ ...base, image_url: image }).twitter.images, [image])
})
test('statuses compare instants rather than timestamp strings; scheduled edits stay scheduled', () => {
  assert.equal(occurrenceStatus({ ...base, status: 'postponed', previous_start_at: '2026-10-23T23:30:00+02:00' }).schema, 'EventPostponed')
  assert.equal(occurrenceStatus({ ...base, previous_start_at: '2026-10-16T21:30:00Z' }).schema, 'EventScheduled')
  assert.equal(occurrenceStatus({ ...base, status: 'postponed', previous_start_at: 'invalid' }).schema, 'EventPostponed')
})
test('JSON-LD omits unknown offers, missing organizer/location, unsafe ticket URLs and false availability', () => {
  const json = buildEventJsonLd({ ...base, users: null, venue_name: null, city: null, country_code: null,
    ticketing_url: 'javascript:alert(1)', event_ticket_types: [
      { name: 'Unknown', price: '', currency: 'CHF', sort_order: 0 },
      { name: 'Unknown', price: null, currency: 'CHF', sort_order: 1 },
      { name: 'Bad currency', price: 5, currency: 'not-currency', sort_order: 2 },
    ], currency_code: null })
  assert.equal(json.offers, undefined)
  assert.equal(json.organizer, undefined)
  assert.equal(json.location, undefined)
  const free = buildEventJsonLd({ ...base, price: 0, ticketing_url: 'javascript:alert(1)' })
  const offer = (free.offers as Record<string, unknown>[])[0]
  assert.equal(offer.price, 0)
  assert.equal(offer.url, undefined)
  assert.equal(offer.availability, undefined)
  assert.equal(offer.validFrom, undefined)
  assert.equal(buildEventJsonLd({ ...base, price: 5, currency_code: 'ZZZ' }).offers, undefined)
  assert.deepEqual(buildEventJsonLd({ ...base, users: { fullname: ' ', username: 'fallback-name' } }).organizer,
    { '@type': 'Organization', name: 'fallback-name' })
})
test('serializer prevents script termination and preserves hostile content as data', () => {
  const json = buildEventJsonLd({ ...base, name: '</script><script>alert(1)</script>\u2028\u2029' }, eventUrl(base.seo_slug!))
  const serialized = serializeJsonLd(json)
  assert.doesNotMatch(serialized, /<|\u2028|\u2029/)
  assert.equal(JSON.parse(serialized).name, json.name)
  assert.equal(JSON.parse(serialized).url, eventUrl(base.seo_slug!))
})
test('past state uses injected clock', () => {
  assert.equal(getHasEnded(base.end_date, new Date('2026-10-24T01:59:59Z')), false)
  assert.equal(getHasEnded(base.end_date, new Date('2026-10-24T02:00:01Z')), true)
})

test('malformed Unicode slugs cannot turn sitemap encoding into a backend error', () => {
  for (const slug of ['a\ud800', '\udc00b']) {
    assert.equal(validSlug(slug), false)
    assert.throws(() => eventUrl(slug), /Invalid event URL/)
  }
  assert.equal(validSlug('édition-😀'), true)
})
test('encoded private media traversal, separators, tokens and invalid escapes are omitted', () => {
  for (const path of [
    '/storage/v1/object/public/events/a%3Ftoken%3Dprivate',
    '/storage/v1/object/public/events/%252e%252e/private',
    '/storage/v1/object/public/events/a%2fb.jpg',
    '/storage/v1/object/public/events/a%5Cb.jpg',
    '/storage/v1/object/public/events/a%00.jpg',
    '/storage/v1/object/public/events/a%ZZ.jpg',
  ]) assert.equal(publicImageUrl(`https://fixture.supabase.co${path}`), undefined)
  assert.equal(publicImageUrl('https://fixture.supabase.co/storage/v1/object/public/events/%C3%A9dition.jpg'),
    'https://fixture.supabase.co/storage/v1/object/public/events/%C3%A9dition.jpg')
})


test('title/city/date changes leave an existing published canonical untouched, including casing', () => {
  const original = { ...base, seo_slug: 'Existing-Published-Slug' }
  const edited = { ...original, name: 'Edited name', city: 'Genève', start_date: '2026-10-30T22:30:00Z' }
  assert.equal(buildEventMetadata(original).alternates.canonical, buildEventMetadata(edited).alternates.canonical)
  assert.equal(buildEventMetadata(edited).alternates.canonical, 'https://myevy.app/events/Existing-Published-Slug')
})


test('nullable publication status fails closed like a private draft', () => {
  assert.equal(directPageEligible({ ...base, is_public: null }), false)
  assert.throws(() => buildEventMetadata({ ...base, is_public: null }), /Ineligible/)
})
