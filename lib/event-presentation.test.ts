import assert from 'node:assert/strict'
import test from 'node:test'
import { publicEventFixture as base } from './seo-fixtures.ts'
import { eventPricing, eventLabel, meetupLabel, ticketingUrl } from './event-presentation.ts'
import { buildEventJsonLd } from './event-json-ld.ts'

test('release pricing uses sorted ticket tiers before the legacy price', () => {
  const pricing = eventPricing({ ...base, price: 100, event_ticket_types: [
    { name: 'VIP', price: '80.00', currency: 'CHF', sort_order: 2 },
    { name: 'Early bird', price: '20,50', currency: 'CHF', sort_order: 1 },
  ] })
  assert.equal(pricing.label, 'From 20.50 CHF')
  assert.deepEqual(pricing.tickets.map(ticket => ticket.name), ['Early bird', 'VIP'])
  assert.equal(pricing.bookingUrl, base.ticketing_url)
})
test('mixed currencies never produce a misleading cheapest price', () => {
  const pricing = eventPricing({ ...base, event_ticket_types: [
    { name: 'Swiss', price: 15, currency: 'CHF', sort_order: 0 },
    { name: 'European', price: 10, currency: 'EUR', sort_order: 1 },
  ] })
  assert.equal(pricing.label, '2 prices available')
})
test('free admission has no booking action, invalid categories are unknown', () => {
  assert.equal(eventPricing(base).label, 'Free admission')
  assert.equal(eventPricing(base).bookingUrl, undefined)
  const event = { ...base, price: 30, event_ticket_types: [{ name: 'Invalid', price: '', currency: 'CHF', sort_order: 0 }] }
  assert.equal(eventPricing(event).label, 'Price unavailable')
  for (const price of ['', 'Infinity', '0x10', '1e2', -5, NaN]) {
    assert.equal(eventPricing({ ...event, event_ticket_types: [{ ...event.event_ticket_types[0], price }] }).tickets.length, 0)
  }
})
test('Meetups expose informational costs, never inherited ticket tiers or ticket offers', () => {
  const event = { ...base, event_type: 'meetup', price: 12, event_ticket_types: [{ name: 'Old ticket', price: 90, currency: 'CHF', sort_order: 0 }] }
  assert.equal(eventPricing(event).label, '12 CHF')
  assert.equal(eventPricing(event).bookingUrl, undefined)
  assert.equal(buildEventJsonLd(event).offers, undefined)
  assert.equal(meetupLabel('drinks_nightlife'), 'Drinks & Nightlife')
  assert.equal(eventLabel('music_party'), 'Music party / Night out')
  assert.equal(eventLabel('all_genres', 'style'), 'All genres')
})
test('ticket links follow app HTTPS, length, credential and local-host restrictions', () => {
  for (const url of ['http://tickets.example/e', 'https://user:pass@tickets.example/e', 'https://localhost/e', 'https://127.0.0.1/e', 'https://[::1]/e', 'https://host.local/e', `https://example.com/${'x'.repeat(500)}`]) assert.equal(ticketingUrl(url), undefined)
  assert.equal(ticketingUrl('https://tickets.example/e'), 'https://tickets.example/e')
})

test('JSON-LD and visible prices share tier validation, tie order and booking eligibility', () => {
  const event = { ...base, price: 40, event_ticket_types: [
    { name: 'Z tier', price: 15, currency: 'CHF', sort_order: 0 },
    { name: 'A tier', price: 12, currency: 'CHF', sort_order: 0 },
    { name: 'Malformed', price: '0x10', currency: 'CHF', sort_order: 0 },
  ] }
  const offers = buildEventJsonLd(event).offers as {name:string;price:number;priceCurrency:string}[]
  assert.deepEqual(offers.map(offer => [offer.name,offer.price,offer.priceCurrency]), eventPricing(event).tickets.map(ticket => [ticket.name,ticket.price,ticket.currency]))
  const free = buildEventJsonLd({ ...base, price: 0 }).offers as {url?:string}[]
  assert.equal(free[0].url, undefined)
  const cancelled = buildEventJsonLd({ ...event, status: 'cancelled' }).offers as {url?:string}[]
  assert.equal(cancelled[0].url, undefined)
})
