import { NextResponse, type NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { readPublicEvent } from '@/lib/public-event-data'

// Flight/prefetch can stream before the render lookup resolves. Check these
// requests before routing so inaccessible occurrences retain a real HTTP 404.
// The page still checks eligibility; no records are passed in headers/cookies.
export async function proxy(request: NextRequest) {
  let slug: string
  try { slug = decodeURIComponent(request.nextUrl.pathname.split('/')[2] ?? '') } catch {
    return unavailable(404)
  }
  try {
    const event = await readPublicEvent(supabase, slug)
    return event ? NextResponse.next() : unavailable(404)
  } catch { return unavailable(503) }
}

function unavailable(status: 404 | 503) {
  return new NextResponse(status === 404 ? 'Not found' : 'Event temporarily unavailable', {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export const config = {
  matcher: [{ source: '/events/:slug', has: [{ type: 'header', key: 'rsc', value: '1' }] }],
}
