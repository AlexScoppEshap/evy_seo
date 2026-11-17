import { supabase, publicBackendUrl } from '@/lib/supabase'
import { readPublicEvent } from '@/lib/public-event-data'
import { fetchEventMedia, readPublicEventGallery, mediaSlots, MEDIA_HEADERS } from '@/lib/event-media'

export async function GET(request: Request, { params }: { params: Promise<{ slug: string; slot: string }> }) {
  const { slug, slot } = await params
  if (!mediaSlots.test(slot) || new URL(request.url).search) {
    return new Response('Image not found', { status: 404, headers: { ...MEDIA_HEADERS, 'X-Robots-Tag': 'noindex' } })
  }
  try {
    const event = await readPublicEvent(supabase, slug)
    if (!event) return new Response('Image not found', { status: 404, headers: { ...MEDIA_HEADERS, 'X-Robots-Tag': 'noindex' } })
    const images = slot === 'avatar' ? event : await readPublicEventGallery(supabase, event, publicBackendUrl)
    return await fetchEventMedia(images, slot, publicBackendUrl)
  } catch {
    return new Response('Image temporarily unavailable', { status: 503, headers: { ...MEDIA_HEADERS, 'X-Robots-Tag': 'noindex' } })
  }
}
