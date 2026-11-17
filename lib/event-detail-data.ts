import type { SupabaseClient } from '@supabase/supabase-js'
import { directPageEligible, getHasEnded, isoInstant, type PublicEvent } from './event-seo.ts'
import { EVENT_FIELDS, isPublicEventRecord, readMeetupDiscoveryEnabled } from './public-event-data.ts'
import { ticketingUrl } from './event-presentation.ts'
import { readPublicParticipantPhotos } from './event-participant-photos.ts'

export type PublicContact = { label: string; href: string }
export type EventDetailExtras = {
  commentsCount: number | null
  organizerPro: boolean
  contacts: PublicContact[]
  related: PublicEvent[]
  participantPhotos: { thumbnail: string; image: string; authorName: string }[]
}
export const emptyEventDetailExtras = (): EventDetailExtras => ({ commentsCount: null, organizerPro: false, contacts: [], related: [], participantPhotos: [] })
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const socialHosts: Record<string, string[]> = {
  instagram: ['instagram.com'], facebook: ['facebook.com', 'fb.com'], tiktok: ['tiktok.com'],
  youtube: ['youtube.com', 'youtu.be'], linkedin: ['linkedin.com'], x: ['x.com', 'twitter.com'],
}
const socialLabels: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn', x: 'X' }

export function publicContact(value: unknown, organizerId: string | null): PublicContact | null {
  if (!record(value) || !organizerId || value.organizer_id !== organizerId || typeof value.value !== 'string') return null
  const raw = value.value.trim()
  if (value.channel_type === 'phone') {
    if (raw.length < 3 || raw.length > 40 || !/^[0-9+(). /-]+$/.test(raw)) return null
    const number = raw.replace(/[^0-9+]/g, '')
    return /^\+?\d{3,30}$/.test(number) ? { label: 'Call organizer', href: `tel:${number}` } : null
  }
  if (!['website','social'].includes(String(value.channel_type))) return null
  // Saved public contacts are normalized to HTTPS by the app. Match its
  // legacy website normalization without accepting arbitrary URI schemes.
  let normalized = raw.includes('://') ? raw : `https://${raw}`
  try {
    const url = new URL(normalized)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    url.protocol = 'https:'; normalized = url.href
    const href = ticketingUrl(normalized)
    if (!href) return null
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    // Event-scoped WhatsApp membership links never become public contacts.
    if (host === 'wa.me' || host === 'whatsapp.com' || host.endsWith('.whatsapp.com')) return null
    if (value.channel_type === 'website') return { label: 'Website', href }
    const platform = String(value.platform)
    if (!socialHosts[platform]?.includes(host) || !url.pathname || url.pathname === '/') return null
    return { label: socialLabels[platform], href }
  } catch { return null }
}

async function readContacts(db: SupabaseClient, anchor: PublicEvent, signal: AbortSignal) {
  if (anchor.event_type === 'meetup') return []
  try {
    const { data, error } = await db.rpc('get_public_event_organizer_contacts', { p_event_id: anchor.id }).abortSignal(signal)
    if (error || !Array.isArray(data)) return []
    const seen = new Set<string>()
    return data.slice(0, 20).flatMap(row => {
      const contact = publicContact(row, anchor.creator_id)
      if (!contact || seen.has(contact.href)) return []
      seen.add(contact.href); return [contact]
    })
  } catch { return [] }
}
async function readOrganizerPro(db: SupabaseClient, anchor: PublicEvent, signal: AbortSignal) {
  if (!anchor.creator_id || !uuid.test(anchor.creator_id)) return false
  try {
    const { data, error } = await db.rpc('get_public_organizer_pro_badges', { p_organizer_ids: [anchor.creator_id] }).abortSignal(signal)
    return !error && Array.isArray(data) && data.some(row => record(row) && row.organizer_id === anchor.creator_id && row.has_pro_badge === true)
  } catch { return false }
}
async function readCommentsCount(db: SupabaseClient, anchor: PublicEvent, signal: AbortSignal) {
  try {
    // Match the guest app's approved count without exporting comment records,
    // identities, bodies, likes or thread structure to a search crawler.
    const { count, error } = await db.from('event_comments').select('id', { count: 'exact', head: true })
      .eq('event_id', anchor.id).eq('moderation_status', 'approved').abortSignal(signal)
    return !error && typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : null
  } catch { return null }
}
export async function readRelatedEvents(db: SupabaseClient, anchor: PublicEvent, signal = AbortSignal.timeout(5_000), now = new Date()) {
  if (!directPageEligible(anchor)) return []
  try {
    const { data, error } = await db.rpc('get_public_related_events', { p_event_id: anchor.id, p_limit: 4 }).abortSignal(signal)
    if (error || !record(data) || !Array.isArray(data.entries)) return []
    const ids = [...new Set(data.entries.slice(0, 4).flatMap(row => record(row) && typeof row.event_id === 'string' && uuid.test(row.event_id) && row.event_id !== anchor.id ? [row.event_id] : []))]
    if (!ids.length) return []
    // Ranking is authoritative, payload metadata is not. Re-read the concrete
    // candidates through anon RLS and every explicit eligibility predicate.
    const visible = await db.from('events').select(EVENT_FIELDS).in('id', ids)
      .eq('is_public', true).eq('ai_moderation_status', 'approved').eq('users.account_status', 'active')
      .or('recurrence_state.is.null,recurrence_state.eq.active').in('status', ['scheduled','postponed'])
      .limit(4).abortSignal(signal).returns<PublicEvent[]>()
    if (visible.error || !Array.isArray(visible.data)) return []
    const meetupsEnabled = visible.data.some(row => record(row) && row.event_type === 'meetup') ? await readMeetupDiscoveryEnabled(db, signal) : false
    const byId = new Map(visible.data.filter(isPublicEventRecord).filter(row => directPageEligible(row) &&
      (row.event_type !== 'meetup' || meetupsEnabled) && ['scheduled','postponed'].includes(row.status ?? '') &&
      isoInstant(row.start_date) && !getHasEnded(row.end_date ?? row.start_date, now)).map(row => [row.id, row]))
    return ids.flatMap(id => byId.get(id) ?? [])
  } catch { return [] }
}
export async function readEventDetailExtras(db: SupabaseClient, anchor: PublicEvent): Promise<EventDetailExtras> {
  if (!directPageEligible(anchor)) return emptyEventDetailExtras()
  const signal = AbortSignal.timeout(5_000)
  const [commentsCount, organizerPro, contacts, related, participantPhotos] = await Promise.all([
    readCommentsCount(db, anchor, signal), readOrganizerPro(db, anchor, signal), readContacts(db, anchor, signal), readRelatedEvents(db, anchor, signal), readPublicParticipantPhotos(db, anchor, signal),
  ])
  const mediaBase = `/events/${encodeURIComponent(anchor.seo_slug!)}/participant-media`
  return { commentsCount, organizerPro, contacts, related, participantPhotos: participantPhotos.map((photo,index)=>({thumbnail:`${mediaBase}/thumb-${index}`,image:`${mediaBase}/photo-${index}`,authorName:photo.authorName})) }
}
