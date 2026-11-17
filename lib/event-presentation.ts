import type { PublicEvent } from './event-seo.ts'
import type { StructuredDataEvent } from './event-json-ld.ts'
import { publicHttpsUrl } from './event-seo.ts'
import { eventLabels } from './event-labels.ts'

export function eventLabel(code: string | null, kind: 'category' | 'style' = 'category') {
  if (!code?.trim()) return kind === 'category' ? 'Event' : ''
  return eventLabels[`${kind}_${code}`] ?? code.replace(/[_-]/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase())
}

const meetupLabels: Record<string, string> = {
  drinks_nightlife: 'meetupDrinksNightlife', restaurants_coffee: 'meetupRestaurantsCoffee',
  sports_fitness: 'meetupSportsFitness', games_gaming: 'meetupGamesGaming',
  outdoor_nature: 'meetupOutdoorNature', networking: 'meetupNetworking',
  culture_activities: 'meetupCultureActivities', other: 'meetupOther',
}
export function meetupLabel(code: string | null) {
  return code ? eventLabels[meetupLabels[code]] ?? 'Meetup' : 'Meetup'
}

export function meetupCoverFileName(eventId: string, subcategory: string | null) {
  const category = subcategory && Object.hasOwn(meetupLabels, subcategory) ? subcategory : 'other'
  // Same bounded UTF-16 hash as MeetupVisual.assetFor in the native release.
  let hash = 0
  for (let index = 0; index < eventId.length; index++) hash = (hash * 31 + eventId.charCodeAt(index)) % 2147483647
  return `${category}-${hash % 5 + 1}.webp`
}

// CurrencyUtils overrides plus the English region defaults of the app's pinned
// intl 0.20.3 number_symbols_data.dart. Unknown en_REGION locales fall back to USD.
const regionCurrencies: Record<string, string> = {"AU": "AUD", "CA": "CAD", "CH": "CHF", "CN": "CNY", "GB": "GBP", "IE": "EUR", "IN": "INR", "JP": "JPY", "MY": "MYR", "NZ": "NZD", "SG": "SGD", "US": "USD", "ZA": "ZAR"}
export function eventCurrency(event: Pick<PublicEvent, 'currency_code' | 'country_code'>) {
  const value = event.currency_code?.trim().toUpperCase()
  if (value) return validCurrency(value) ? value : undefined
  return regionCurrencies[event.country_code?.trim().toUpperCase() ?? ''] ?? 'USD'
}
function validCurrency(value: string | null) {
  return !!value && Intl.supportedValuesOf('currency').includes(value)
}
export function ticketPrice(value: string | number | null) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : undefined
  if (typeof value !== 'string' || !/^\d+(?:[.,]\d+)?$/.test(value.trim())) return undefined
  const amount = Number(value.trim().replace(',', '.'))
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined
}
type PricingEvent = Pick<StructuredDataEvent, 'event_type' | 'price' | 'currency_code' | 'country_code' | 'ticketing_url' | 'event_ticket_types'>

export function eventTickets(event: PricingEvent) {
  if (event.event_type === 'meetup') return []
  return (event.event_ticket_types ?? []).flatMap(ticket => {
    const price = ticketPrice(ticket.price), name = ticket.name?.trim()
    const currency = ticket.currency?.trim().toUpperCase() || eventCurrency(event)
    return name && price !== undefined && validCurrency(currency ?? null)
      ? [{ name, price, currency: currency!, sortOrder: ticket.sort_order ?? 0 }] : []
  }).sort((a, b) => a.sortOrder - b.sortOrder || a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'en'))
}
export function amountLabel(price: number, currency: string) {
  return `${Number.isInteger(price) ? price.toFixed(0) : price.toFixed(2)} ${currency}`
}
export function eventPricing(event: PricingEvent) {
  const tickets = eventTickets(event)
  let label: string, free: boolean
  if (tickets.length) {
    free = tickets.every(ticket => ticket.price === 0)
    if (new Set(tickets.map(ticket => ticket.currency)).size > 1) label = `${tickets.length} prices available`
    else {
      const lowest = tickets.reduce((a, b) => a.price <= b.price ? a : b)
      label = `${tickets.length > 1 ? 'From ' : ''}${amountLabel(lowest.price, lowest.currency)}`
    }
  } else if (event.event_type !== 'meetup' && event.event_ticket_types?.length) {
    label = 'Price unavailable'; free = false
  } else {
    free = event.price === null || event.price === 0
    const currency = eventCurrency(event)
    label = free ? 'Free admission' : event.price !== null && Number.isFinite(event.price) && event.price > 0 && currency
      ? amountLabel(event.price, currency) : 'Price unavailable'
  }
  return { tickets, label, free, bookingUrl: event.event_type !== 'meetup' && !free ? ticketingUrl(event.ticketing_url) : undefined }
}
export function ticketingUrl(value: string | null) {
  const safe = publicHttpsUrl(value)
  if (!safe || safe.length > 500) return undefined
  const host = new URL(safe).hostname
  if (host === 'localhost' || host.endsWith('.localhost') || host === 'local' || host.endsWith('.local') ||
      /^\d+(?:\.\d+){3}$/.test(host) || host.includes(':')) return undefined
  return safe
}
