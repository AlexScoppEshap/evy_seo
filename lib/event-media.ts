import type { SupabaseClient } from '@supabase/supabase-js'
import { directPageEligible, eventUrl, publicImageUrl, type PublicEvent } from './event-seo.ts'

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
export const mediaSlots = /^(cover|avatar|gallery-[0-5])$/
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MEDIA_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox",
}

export function mediaSource(event: PublicEvent, slot: string) {
  if (slot === 'cover') return event.image_url
  if (slot === 'avatar') return event.users?.profileimageurl
  if (/^gallery-[0-5]$/.test(slot)) return event.gallery_image_urls?.[Number(slot.slice(-1))]
}

// Sources come only from a freshly anonymous-readable event, never a request
// URL parameter. Lock remote requests to this backend and documented image APIs.
export function allowedMediaSource(value: string | null | undefined, backendOrigin: string, event: PublicEvent, slot: string) {
  if (!value || value.length > 4096 || !mediaSlots.test(slot)) return undefined
  try {
    const url = new URL(value), backend = new URL(backendOrigin)
    if (url.origin !== backend.origin || url.username || url.password || url.hash) return undefined
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname))) return undefined
    if (publicImageUrl(value) && url.pathname.startsWith('/storage/v1/object/public/')) return value
    if (url.pathname !== '/functions/v1/ik-storage') return undefined
    const params = url.searchParams, action = params.get('action')
    if ([...params.keys()].some(key => params.getAll(key).length !== 1)) return undefined
    if (!/^[A-Za-z0-9_-]{16,256}$/.test(params.get('token') ?? '')) return undefined
    if (action === 'image_public') {
      if ([...params.keys()].some(key => !['action', 'id', 'token', 'published'].includes(key))) return undefined
      if (!new RegExp(`^${uuid}$`, 'i').test(params.get('id') ?? '') ||
          (params.has('published') && !/^[1-9]\d*$/.test(params.get('published')!))) return undefined
      return url.href
    }
    if (action !== 'proxy' || [...params.keys()].some(key => !['action', 'bucket_kind', 'key', 'token'].includes(key))) return undefined
    const key = params.get('key') ?? ''
    if (/[\\%\u0000-\u001f\u007f]/.test(key) || key.includes('/participants/') || key.split('/').some(part => !part || part === '.' || part === '..')) return undefined
    if (slot === 'avatar') {
      if (params.get('bucket_kind') !== 'avatar' || !event.creator_id || !key.startsWith(`avatars/${event.creator_id}/`)) return undefined
    } else {
      // Legacy series copy the published cover/gallery reference between
      // concrete occurrences. The approved public row is the reference authority;
      // the source can belong to a previous occurrence, never chat/participant media.
      if (params.get('bucket_kind') !== 'event' || !new RegExp(`^events/${uuid}/`, 'i').test(key)) return undefined
    }
    return url.href
  } catch { return undefined }
}

export function seoMediaUrl(slug: string, slot: string) {
  if (!mediaSlots.test(slot)) throw new Error('Invalid image slot')
  return `${eventUrl(slug)}/media/${slot}`
}

// The native detail gallery merges approved managed slots with legacy event
// references. Use the same public RPC; never enumerate a storage prefix.
export async function readPublicEventGallery(db: SupabaseClient, event: PublicEvent, backendOrigin: string): Promise<PublicEvent> {
  if (!directPageEligible(event)) return event
  const slots = new Map<number, string>()
  const addLegacy = (value: string | null | undefined, fallback: number) => {
    const safe = allowedMediaSource(value, backendOrigin, event, 'cover')
    if (!safe) return
    const key = new URL(safe).searchParams.get('key') ?? ''
    const filename = key.split('/').at(-1) ?? ''
    const gallery = /^gallery_(\d+)\./.exec(filename)
    const slot = /^(main|cover)\./.test(filename) ? 0 : gallery ? Number(gallery[1]) : fallback
    if (slot >= 0 && slot <= 5 && !slots.has(slot)) slots.set(slot, safe)
  }
  addLegacy(event.image_url, 0)
  ;(event.gallery_image_urls ?? []).slice(0, 6).forEach((url, index) => addLegacy(url, index))
  try {
    const { data, error } = await db.rpc('image_event_gallery', { p_event: event.id }).abortSignal(AbortSignal.timeout(5_000))
    if (!error && Array.isArray(data)) {
      const seen = new Set<number>()
      for (const row of data.slice(0, 24)) {
        if (!row || typeof row.key !== 'string' || typeof row.url !== 'string') continue
        const name = row.key.startsWith(`events/${event.id}/`) ? row.key.slice(`events/${event.id}/`.length) : ''
        const slot = /^(main|cover)\.jpg$/.test(name) ? 0 : /^gallery_[0-5]\.jpg$/.test(name) ? Number(name.match(/\d/)![0]) : -1
        if (slot < 0 || seen.has(slot)) continue
        const safe = allowedMediaSource(row.url, backendOrigin, event, 'cover')
        if (!safe || new URL(safe).searchParams.get('action') !== 'image_public') continue
        seen.add(slot)
        // Keep the concrete occurrence's explicit cover (including overrides).
        // Supplemental managed slots must not replace it with a series cover.
        if (slot !== 0 || !allowedMediaSource(event.image_url, backendOrigin, event, 'cover')) slots.set(slot, safe)
      }
    }
  } catch { /* Supplemental gallery failure keeps approved legacy references. */ }
  const urls = [...new Set([...slots.entries()].sort(([a], [b]) => a - b).map(([, url]) => url))].slice(0, 6)
  return { ...event, image_url: slots.get(0) ?? urls[0] ?? null, gallery_image_urls: urls }
}

// Only this projection enters HTML, metadata and Flight. Source tokens stay on
// the server, including legacy public image links and moderated image revisions.
export function presentPublicEvent(event: PublicEvent, backendOrigin: string): PublicEvent {
  const image = (slot: string) => allowedMediaSource(mediaSource(event, slot), backendOrigin, event, slot)
    ? seoMediaUrl(event.seo_slug!, slot) : null
  return {
    ...event, image_url: image('cover'),
    gallery_image_urls: (event.gallery_image_urls ?? []).slice(0, 6).flatMap((_, index) => image(`gallery-${index}`) ?? []),
    users: event.users ? { ...event.users, profileimageurl: image('avatar') } : null,
  }
}

export async function fetchEventMedia(event: PublicEvent, slot: string, backendOrigin: string, upstream: typeof fetch = fetch) {
  let source = allowedMediaSource(mediaSource(event, slot), backendOrigin, event, slot)
  if (!source) return new Response('Image not found', { status: 404, headers: { ...MEDIA_HEADERS, 'X-Robots-Tag': 'noindex' } })
  try {
    const signal = AbortSignal.timeout(5_000)
    for (let redirects = 0; redirects <= 2; redirects++) {
      const response: Response = await upstream(source, { cache: 'no-store', redirect: 'manual', signal })
      if ([301,302,303,307,308].includes(response.status)) {
        const location: string | null = response.headers.get('location')
        await response.body?.cancel()
        source = location ? allowedMediaSource(new URL(location, source).href, backendOrigin, event, slot) : undefined
        if (!source) break
        continue
      }
      const type = response.headers.get('content-type')?.split(';')[0].toLowerCase()
      if (!response.ok || !type || !['image/jpeg','image/png','image/webp','image/gif','image/avif'].includes(type) ||
          Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) {
        await response.body?.cancel(); break
      }
      const reader = response.body?.getReader()
      if (!reader) break
      const chunks: Uint8Array[] = []
      let size = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > MAX_IMAGE_BYTES) { await reader.cancel(); throw new Error('Image too large') }
        chunks.push(value)
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      if (!size) break
      return new Response(bytes, { headers: { ...MEDIA_HEADERS, 'Content-Type': type } })
    }
  } catch { /* Never return remote URLs, signed tokens or backend diagnostics. */ }
  return new Response('Image temporarily unavailable', { status: 502, headers: { ...MEDIA_HEADERS, 'X-Robots-Tag': 'noindex' } })
}
