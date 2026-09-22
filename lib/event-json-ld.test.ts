import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildEventJsonLd,
  EVY_SWITZERLAND_CREATOR_ID,
  type StructuredDataEvent,
} from './event-json-ld.ts'

const baseEvent: StructuredDataEvent = {
  name: 'Test event',
  description: null,
  image_url: null,
  venue_name: null,
  address: null,
  npa: null,
  city: 'Lausanne',
  region_code: 'VD',
  country_code: 'CH',
  start_date: '2026-10-20T18:00:00Z',
  end_date: null,
  price: null,
  currency_code: 'CHF',
  ticketing_url: 'https://tickets.example/event',
  artists: [],
  creator_id: 'native-creator',
  external_organizer_name: null,
  users: { fullname: 'Native Organizer', username: 'native' },
  event_ticket_types: [],
  status: 'scheduled',
  previous_start_at: null,
}

test('creates ordered offers from valid ticket types and ignores the legacy price', () => {
  const json = buildEventJsonLd({
    ...baseEvent,
    price: 99,
    event_ticket_types: [
      { name: 'VIP', price: '80.00', currency: 'CHF', sort_order: 2 },
      { name: 'Early Bird', price: 25, currency: 'CHF', sort_order: 1 },
    ],
  })
  assert.deepEqual(json.offers, [
    {
      '@type': 'Offer',
      name: 'Early Bird',
      price: 25,
      priceCurrency: 'CHF',
      url: baseEvent.ticketing_url,
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      name: 'VIP',
      price: 80,
      priceCurrency: 'CHF',
      url: baseEvent.ticketing_url,
      availability: 'https://schema.org/InStock',
    },
  ])
})

test('uses the legacy offer for old and free events', () => {
  const json = buildEventJsonLd({ ...baseEvent, price: 0 })
  assert.equal((json.offers as Array<Record<string, unknown>>)[0].price, 0)
})

test('emits multiple trimmed performers and omits an empty performer list', () => {
  const rich = buildEventJsonLd({
    ...baseEvent,
    artists: [' Bruno Mars ', '', '  ', 'Anderson .Paak'],
  })
  assert.deepEqual(rich.performer, [
    { '@type': 'Person', name: 'Bruno Mars' },
    { '@type': 'Person', name: 'Anderson .Paak' },
  ])
  assert.equal(buildEventJsonLd(baseEvent).performer, undefined)
})

test('uses the external organizer for Evy imports and profile names otherwise', () => {
  const imported = buildEventJsonLd({
    ...baseEvent,
    creator_id: EVY_SWITZERLAND_CREATOR_ID,
    external_organizer_name: 'External Organizer',
  })
  assert.deepEqual(imported.organizer, {
    '@type': 'Organization',
    name: 'External Organizer',
  })
  assert.deepEqual(buildEventJsonLd(baseEvent).organizer, {
    '@type': 'Organization',
    name: 'Native Organizer',
  })
})

test('maps cancelled, postponed, and genuinely rescheduled events', () => {
  assert.equal(
    buildEventJsonLd({ ...baseEvent, status: 'cancelled' }).eventStatus,
    'https://schema.org/EventCancelled',
  )
  assert.equal(
    buildEventJsonLd({ ...baseEvent, status: 'postponed' }).eventStatus,
    'https://schema.org/EventPostponed',
  )
  const rescheduled = buildEventJsonLd({
    ...baseEvent,
    status: 'postponed',
    previous_start_at: '2026-10-17T18:00:00Z',
  })
  assert.equal(rescheduled.eventStatus, 'https://schema.org/EventRescheduled')
  assert.equal(rescheduled.previousStartDate, '2026-10-17T18:00:00Z')
})
