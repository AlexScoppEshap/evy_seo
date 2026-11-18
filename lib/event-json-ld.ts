import { isoInstant, occurrenceStatus, publicHttpsUrl, publicImageUrl } from './event-seo.ts'
import { eventCurrency, eventPricing } from './event-presentation.ts'

export const EVY_SWITZERLAND_CREATOR_ID =
  '3b271647-4f96-4a95-b788-f6de233d0bba'

export type EventTicketTypeRecord = {
  name: string | null
  price: number | string | null
  currency: string | null
  sort_order: number | null
}

export type EventCreatorRecord = {
  fullname: string | null
  username: string | null
  profileimageurl?: string | null
  account_status?: string | null
}

export type StructuredDataEvent = {
  event_type?: string | null
  name: string | null
  description: string | null
  image_url: string | null
  venue_name: string | null
  address: string | null
  npa: string | null
  city: string | null
  region_code: string | null
  country_code: string | null
  start_date: string | null
  end_date: string | null
  price: number | null
  currency_code: string | null
  ticketing_url: string | null
  artists: string[] | null
  creator_id: string | null
  external_organizer_name: string | null
  users: EventCreatorRecord | null
  event_ticket_types: EventTicketTypeRecord[] | null
  status: string | null
  previous_start_at: string | null
}

type JsonLdValue =
  | string
  | number
  | JsonLdObject
  | JsonLdValue[]
  | undefined

type JsonLdObject = { [key: string]: JsonLdValue }

function cleanText(value: string | null | undefined) {
  const cleaned = value?.trim()
  return cleaned || undefined
}

// Known platform publishing accounts from the existing Hunter ownership contract.
const PLATFORM_PUBLISHER_IDS = new Set([
  EVY_SWITZERLAND_CREATOR_ID,
  '752f1e81-22b1-4ed3-8140-248dbd776e2a',
]);
export function isPlatformPublisher(event: StructuredDataEvent) {
  return PLATFORM_PUBLISHER_IDS.has(event.creator_id?.trim() ?? '');
}
export function creatorDisplayName(event: StructuredDataEvent) {
  const name = isPlatformPublisher(event)
    ? cleanText(event.external_organizer_name)
    : cleanText(event.users?.fullname) ?? cleanText(event.users?.username);
  // Neither a publisher account nor its name establishes that Evy organizes an event.
  return name && !/^evy(?:\s+(?:switzerland|suisse))?$/i.test(name) ? name : undefined;
}

function ticketOffers(event: StructuredDataEvent): JsonLdObject[] | undefined {
  // Meetup costs are informational; the app never treats them as ticket offers.
  if (event.event_type === 'meetup') return undefined
  const fallbackCurrency = eventCurrency(event)
  const pricing = eventPricing(event)
  const fallbackUrl = event.status !== 'cancelled' ? pricing.bookingUrl : undefined
  const offers = pricing.tickets.map(ticket => ({
    '@type': 'Offer', name: ticket.name, price: ticket.price,
    priceCurrency: ticket.currency, url: fallbackUrl,
  }))

  if (offers.length > 0) return offers
  if (event.event_ticket_types?.length) return undefined
  if (event.price === null || !Number.isFinite(event.price) || event.price < 0 || !fallbackCurrency) {
    return undefined
  }

  return [
    {
      '@type': 'Offer',
      price: event.price,
      priceCurrency: fallbackCurrency,
      url: fallbackUrl,
    },
  ]
}

export function buildEventJsonLd(event: StructuredDataEvent, canonicalUrl?: string): JsonLdObject {
  const title = cleanText(event.name) ?? 'Untitled event'
  const venue = cleanText(event.venue_name)
  const performers = (event.artists ?? [])
    .map((artist) => artist.trim())
    .filter(Boolean)
    .map((name) => ({ '@type': 'Person', name }))
  const organizerName = creatorDisplayName(event)
  const status = `https://schema.org/${occurrenceStatus(event).schema}`

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    url: publicHttpsUrl(canonicalUrl),
    name: title,
    description: cleanText(event.description),
    startDate: isoInstant(event.start_date),
    endDate: isoInstant(event.end_date),
    image:
      publicImageUrl(event.image_url)
        ? [publicImageUrl(event.image_url)!]
        : undefined,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: status,
    previousStartDate:
      status === 'https://schema.org/EventRescheduled'
        ? isoInstant(event.previous_start_at)
        : undefined,
    location: [venue, event.address, event.city, event.country_code].some(cleanText) ? {
      '@type': 'Place',
      name: venue ?? cleanText(event.city),
      address: {
        '@type': 'PostalAddress',
        streetAddress: cleanText(event.address),
        postalCode: cleanText(event.npa),
        addressLocality: cleanText(event.city),
        addressRegion: cleanText(event.region_code),
        addressCountry: cleanText(event.country_code),
      },
    } : undefined,
    performer: performers.length > 0 ? performers : undefined,
    organizer: organizerName
      ? { '@type': 'Organization', name: organizerName }
      : undefined,
    offers: ticketOffers(event),
  }
}

export function serializeJsonLd(value: JsonLdObject) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}
