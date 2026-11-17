import type { StructuredDataEvent } from './event-json-ld.ts'

export const PUBLIC_ORIGIN = 'https://myevy.app'
export const SEO_ORIGIN = 'https://seo.myevy.app'

export type PublicEligibility = {
  seo_slug: string | null
  is_public: boolean | null
  recurrence_state: string | null
  ai_moderation_status: string | null
  event_type: string | null
  users: { account_status: string | null } | null
}

export type PublicEvent = StructuredDataEvent & PublicEligibility & {
  id: string
  category: string | null
  timezone: string | null
  likescount: number | null
  participantscount: number | null
  note: string | null
  series_id: string | null
  gallery_image_urls: string[] | null
  meetup_subcategory: string | null
  participation_mode: string | null
  participation_capacity: number | null
  event_styles: { styles: { name: string | null } | null }[]
}

export function validSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && slug.length > 0 && slug.length <= 512 &&
    slug === slug.trim() && !/[\s/\\?#\u0000-\u001f\u007f]/u.test(slug) &&
    slug !== '.' && slug !== '..' && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(slug)
}

// Anonymous RLS remains an additional boundary. Check the current release's
// publication, moderation and creator contracts explicitly as well.
export function directPageEligible(event: PublicEligibility) {
  return event.is_public === true && validSlug(event.seo_slug) &&
    event.ai_moderation_status === 'approved' && event.users?.account_status === 'active' &&
    ['standard', 'meetup'].includes(event.event_type ?? '') &&
    (event.recurrence_state === null || event.recurrence_state === 'active')
}

export function eventUrl(slug: string) {
  if (!validSlug(slug)) throw new Error('Invalid event URL')
  return `${PUBLIC_ORIGIN}/events/${encodeURIComponent(slug)}`
}

export function publicHttpsUrl(value: string | null | undefined) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return undefined
    return url.href
  } catch { return undefined }
}

export function publicImageUrl(value: string | null | undefined) {
  const safe = publicHttpsUrl(value)
  if (!safe) return undefined
  const url = new URL(safe)
  // Only documented public Supabase objects and existing public SEO assets.
  // ik-storage proxies contain bearer-like tokens and private object keys.
  if (url.search || url.hash) return undefined
  // Prevent encoded traversal/separators from switching a public-object path
  // into a private endpoint after a proxy decodes it.
  try {
    const decoded = decodeURIComponent(url.pathname)
    if (/%|[\u0000-\u001f\u007f\\?#]/.test(decoded) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(decoded) ||
        /%2f|%5c/i.test(url.pathname)) return undefined
  } catch { return undefined }
  if (url.origin === SEO_ORIGIN && /^\/(logo|favicon)\.svg$/.test(url.pathname)) return safe
  if (url.origin === PUBLIC_ORIGIN && /^\/events\/[^/]+\/media\/(cover|avatar|gallery-[0-5])$/.test(url.pathname)) return safe
  if (url.origin === PUBLIC_ORIGIN && /^\/events\/[^/]+\/participant-media\/(thumb|photo)-[0-5]$/.test(url.pathname)) return safe
  if (url.hostname.endsWith('.supabase.co') &&
      url.pathname.startsWith('/storage/v1/object/public/')) return safe
  return undefined
}

export function publicImagePath(value: string | null | undefined) {
  const safe = publicImageUrl(value)
  // HTML works on both the SEO origin and the canonical Apache proxy. Metadata
  // retains absolute canonical URLs for crawlers.
  return safe?.startsWith(`${PUBLIC_ORIGIN}/events/`) ? new URL(safe).pathname : safe
}

export function isoInstant(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return undefined
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined
}

export function eventTimezone(timezone: string | null) {
  try {
    if (timezone) {
      new Intl.DateTimeFormat('en', { timeZone: timezone }).format(0)
      return timezone
    }
  } catch { /* Same deterministic UTC fallback as App discovery SQL. */ }
  return 'UTC'
}

export function formatEventDate(value: string | null, timezone: string | null) {
  const instant = isoInstant(value)
  if (!instant) return 'Date to be announced'
  return new Intl.DateTimeFormat('en', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    timeZone: eventTimezone(timezone),
  }).format(new Date(instant))
}

export function formatDateRange(start: string | null, end: string | null, timezone: string | null) {
  const first = formatEventDate(start, timezone)
  return isoInstant(start) && isoInstant(end) ? `${first} – ${formatEventDate(end, timezone)}` : first
}

export function getDateParts(start: string | null, timezone: string | null) {
  const instant = isoInstant(start)
  if (!instant) return null
  const date = new Date(instant)
  const timeZone = eventTimezone(timezone)
  return {
    weekday: new Intl.DateTimeFormat('en', { weekday: 'short', timeZone }).format(date),
    day: new Intl.DateTimeFormat('en', { day: 'numeric', timeZone }).format(date),
    month: new Intl.DateTimeFormat('en', { month: 'short', timeZone }).format(date),
  }
}

export function getHasEnded(date: string | null, now = new Date()) {
  const instant = isoInstant(date)
  return !!instant && Date.parse(instant) < now.getTime()
}

export function occurrenceStatus(event: Pick<StructuredDataEvent, 'status' | 'start_date' | 'previous_start_at'>) {
  if (event.status === 'cancelled') return { schema: 'EventCancelled', label: 'Cancelled' }
  if (event.status === 'postponed') {
    const previous = isoInstant(event.previous_start_at)
    const current = isoInstant(event.start_date)
    return previous && current && previous !== current
      ? { schema: 'EventRescheduled', label: 'Rescheduled' }
      : { schema: 'EventPostponed', label: 'Postponed' }
  }
  return { schema: 'EventScheduled', label: 'Scheduled' }
}

export function plainText(value: string | null | undefined) {
  return (value ?? '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, ' ').replace(/&(?:nbsp|amp|lt|gt|quot);/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function buildEventMetadata(event: PublicEvent) {
  if (!directPageEligible(event)) throw new Error('Ineligible event')
  const name = plainText(event.name) || 'Untitled event'
  const date = formatEventDate(event.start_date, event.timezone)
  const place = [event.venue_name, event.city].map(plainText).filter(Boolean).join(', ')
  const title = [name, date, plainText(event.city), 'Evy'].filter(Boolean).join(' | ')
  const context = [date, place, occurrenceStatus(event).label].filter(Boolean).join(' · ')
  const excerpt = plainText(event.description)
  const description = (excerpt ? `${context}. ${excerpt}` : context).slice(0, 160)
  const url = eventUrl(event.seo_slug!)
  const image = publicImageUrl(event.image_url)
  return {
    title, description, alternates: { canonical: url },
    openGraph: { type: 'website' as const, url, title, description, images: image ? [{ url: image }] : [] },
    twitter: { card: image ? 'summary_large_image' as const : 'summary' as const, title, description, images: image ? [image] : [] },
  }
}
