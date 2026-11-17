import type { SupabaseClient } from '@supabase/supabase-js'
import { directPageEligible, getHasEnded, isoInstant, validSlug, type PublicEvent, type PublicEligibility } from './event-seo.ts'

export const EVENT_FIELDS = `id,name,category,description,image_url,venue_name,address,npa,city,
  country_code,region_code,timezone,start_date,end_date,price,currency_code,ticketing_url,
  seo_slug,is_public,recurrence_state,likescount,participantscount,external_organizer_name,
  artists,creator_id,status,previous_start_at,
  note,series_id,gallery_image_urls,event_type,meetup_subcategory,ai_moderation_status,
  participation_mode,participation_capacity,
  users!inner(fullname,username,profileimageurl,account_status),
  event_styles(styles(name)),event_ticket_types(name,price,currency,sort_order)`

export class PublicDataUnavailable extends Error {
  constructor() { super('Public event data temporarily unavailable') }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const nullableText = (value: unknown) => value === null || typeof value === 'string'
const nullableNumber = (value: unknown) => value === null || (typeof value === 'number' && Number.isFinite(value))
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

function isOtherDateRecord(value: unknown): value is OtherDateRecord {
  if (!object(value)) return false
  return typeof value.id === 'string' && uuid.test(value.id) &&
    ['name', 'seo_slug', 'start_date', 'end_date', 'timezone', 'recurrence_state'].every(key => nullableText(value[key])) &&
    (value.is_public === null || typeof value.is_public === 'boolean') &&
    nullableText(value.ai_moderation_status) && nullableText(value.event_type) &&
    (value.users === null || (object(value.users) && nullableText(value.users.account_status))) &&
    ['scheduled', 'postponed', 'cancelled'].includes(String(value.status))
}

export function isPublicEventRecord(value: unknown): value is PublicEvent {
  if (!object(value)) return false
  const record = value
  if (!isOtherDateRecord(value)) return false
  const textFields = ['category', 'description', 'image_url', 'venue_name', 'address', 'npa', 'city',
    'country_code', 'region_code', 'currency_code', 'ticketing_url', 'external_organizer_name', 'creator_id', 'previous_start_at',
    'note', 'series_id', 'meetup_subcategory', 'participation_mode']
  return textFields.every(key => nullableText(record[key])) &&
    ['price', 'likescount', 'participantscount'].every(key => nullableNumber(record[key])) &&
    nullableNumber(record.participation_capacity) &&
    (record.gallery_image_urls === null || (Array.isArray(record.gallery_image_urls) && record.gallery_image_urls.every(url => typeof url === 'string'))) &&
    (record.artists === null || (Array.isArray(record.artists) && record.artists.every(artist => typeof artist === 'string'))) &&
    (record.users === null || (object(record.users) && nullableText(record.users.fullname) && nullableText(record.users.username) && nullableText(record.users.profileimageurl))) &&
    Array.isArray(record.event_styles) && record.event_styles.every(row => object(row) && (row.styles === null || (object(row.styles) && nullableText(row.styles.name)))) &&
    (record.event_ticket_types === null || (Array.isArray(record.event_ticket_types) && record.event_ticket_types.every(ticket =>
      object(ticket) && nullableText(ticket.name) && nullableText(ticket.currency) && nullableNumber(ticket.sort_order) &&
      (nullableNumber(ticket.price) || typeof ticket.price === 'string'))))
}

export async function readPublicEvent(db: SupabaseClient, slug: string): Promise<PublicEvent | null> {
  if (!validSlug(slug)) return null
  try {
    const { data, error } = await db.from('events').select(EVENT_FIELDS)
      .eq('seo_slug', slug).eq('is_public', true)
      .eq('ai_moderation_status', 'approved').eq('users.account_status', 'active')
      .or('recurrence_state.is.null,recurrence_state.eq.active').maybeSingle<PublicEvent>()
    if (error) throw new PublicDataUnavailable()
    if (data === null) return null
    if (!isPublicEventRecord(data)) throw new PublicDataUnavailable()
    if (!directPageEligible(data)) return null
    if (data.event_type === 'meetup' && !await readMeetupDiscoveryEnabled(db)) return null
    return data
  } catch { throw new PublicDataUnavailable() }
}

export async function readMeetupDiscoveryEnabled(db: SupabaseClient, signal?: AbortSignal): Promise<boolean> {
  try {
    let query = db.rpc('get_meetup_capabilities')
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query
    return !error && data?.contract_version === 1 && data?.discover_enabled === true
  } catch { return false }
}

export type OtherDate = Pick<PublicEvent, 'id' | 'name' | 'seo_slug' | 'start_date' | 'end_date' | 'timezone' | 'status'>
type OtherDateRecord = OtherDate & PublicEligibility
export const ELIGIBILITY_FIELDS = 'is_public,recurrence_state,ai_moderation_status,event_type,users!inner(account_status)'
export const OTHER_DATES_FIELDS = `id,name,seo_slug,start_date,end_date,timezone,status,${ELIGIBILITY_FIELDS}`

export async function readOtherDates(db: SupabaseClient, anchor: PublicEvent, now = new Date()): Promise<OtherDate[]> {
  if (!directPageEligible(anchor) || anchor.recurrence_state !== 'active') return []
  try {
    const { data, error } = await db.rpc('get_public_series_occurrences', {
      p_event_id: anchor.id, p_from: null, p_to: null, p_limit: 12, p_cursor: null,
    })
    if (error || !data || !Array.isArray(data.entries)) return []
    const ids = [...new Set<string>(data.entries.slice(0, 12).flatMap((entry: { event_id?: unknown }) =>
      typeof entry?.event_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.event_id) && entry.event_id !== anchor.id
        ? [entry.event_id] : []))]
    if (!ids.length) return []
    // Never render RPC payload fields: SECURITY DEFINER can bypass restrictive RLS.
    // Re-read all candidates together using anon + the direct page predicate.
    const visible = await db.from('events').select(OTHER_DATES_FIELDS).in('id', ids)
      .eq('is_public', true).eq('recurrence_state', 'active').in('status', ['scheduled', 'postponed'])
      .eq('ai_moderation_status', 'approved').eq('users.account_status', 'active').eq('event_type', 'standard')
      .order('start_date').order('id').limit(12).returns<OtherDateRecord[]>()
    if (visible.error) return []
    if (!Array.isArray(visible.data)) return []
    return visible.data.filter(isOtherDateRecord)
      .filter(row => row.id !== anchor.id && directPageEligible(row) &&
        ['scheduled', 'postponed'].includes(row.status ?? '') && isoInstant(row.start_date) &&
        !getHasEnded(row.end_date ?? row.start_date, now))
      .slice(0, 6)
  } catch { return [] }
}
