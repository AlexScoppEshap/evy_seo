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
}

export type StructuredDataEvent = {
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

function creatorDisplayName(event: StructuredDataEvent) {
  const externalName = cleanText(event.external_organizer_name)
  if (
    event.creator_id?.trim() === EVY_SWITZERLAND_CREATOR_ID &&
    externalName
  ) {
    return externalName
  }

  return cleanText(event.users?.fullname) ?? cleanText(event.users?.username)
}

function eventStatus(event: StructuredDataEvent) {
  if (event.status === 'cancelled') {
    return 'https://schema.org/EventCancelled'
  }
  if (event.status === 'postponed') {
    const previousStart = cleanText(event.previous_start_at)
    const currentStart = cleanText(event.start_date)
    if (previousStart && currentStart && previousStart !== currentStart) {
      return 'https://schema.org/EventRescheduled'
    }
    return 'https://schema.org/EventPostponed'
  }
  return 'https://schema.org/EventScheduled'
}

function ticketOffers(event: StructuredDataEvent): JsonLdObject[] | undefined {
  const fallbackCurrency = cleanText(event.currency_code)?.toUpperCase()
  const fallbackUrl = cleanText(event.ticketing_url)
  const offers = (event.event_ticket_types ?? [])
    .map((ticket, index) => ({ ticket, index }))
    .sort(
      (a, b) =>
        (a.ticket.sort_order ?? 0) - (b.ticket.sort_order ?? 0) ||
        a.index - b.index,
    )
    .flatMap(({ ticket }) => {
      const name = cleanText(ticket.name)
      const parsedPrice =
        typeof ticket.price === 'number'
          ? ticket.price
          : Number(ticket.price?.trim().replace(',', '.'))
      const currency =
        cleanText(ticket.currency)?.toUpperCase() ?? fallbackCurrency

      if (!name || !Number.isFinite(parsedPrice) || parsedPrice < 0 || !currency) {
        return []
      }

      return [
        {
          '@type': 'Offer',
          name,
          price: parsedPrice,
          priceCurrency: currency,
          url: fallbackUrl,
          availability: 'https://schema.org/InStock',
        },
      ]
    })

  if (offers.length > 0) return offers
  if (event.price === null || !Number.isFinite(event.price) || event.price < 0) {
    return undefined
  }

  return [
    {
      '@type': 'Offer',
      price: event.price,
      priceCurrency: fallbackCurrency,
      url: fallbackUrl,
      availability: 'https://schema.org/InStock',
    },
  ]
}

export function buildEventJsonLd(event: StructuredDataEvent): JsonLdObject {
  const title = cleanText(event.name) ?? 'Untitled event'
  const venue = cleanText(event.venue_name)
  const performers = (event.artists ?? [])
    .map((artist) => artist.trim())
    .filter(Boolean)
    .map((name) => ({ '@type': 'Person', name }))
  const organizerName = creatorDisplayName(event)
  const status = eventStatus(event)

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: title,
    description: cleanText(event.description),
    startDate: cleanText(event.start_date),
    endDate: cleanText(event.end_date),
    image:
      event.image_url && !event.image_url.includes('token=')
        ? [event.image_url]
        : undefined,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: status,
    previousStartDate:
      status === 'https://schema.org/EventRescheduled'
        ? cleanText(event.previous_start_at)
        : undefined,
    location: {
      '@type': 'Place',
      name: venue ?? cleanText(event.city) ?? title,
      address: {
        '@type': 'PostalAddress',
        streetAddress: cleanText(event.address),
        postalCode: cleanText(event.npa),
        addressLocality: cleanText(event.city),
        addressRegion: cleanText(event.region_code),
        addressCountry: cleanText(event.country_code),
      },
    },
    performer: performers.length > 0 ? performers : undefined,
    organizer: organizerName
      ? { '@type': 'Organization', name: organizerName }
      : undefined,
    offers: ticketOffers(event),
  }
}

export function serializeJsonLd(value: JsonLdObject) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
