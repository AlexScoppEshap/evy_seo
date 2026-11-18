import { NextResponse, type NextRequest } from 'next/server'
import { deepLinkDestination } from './lib/deep-link-compat'
import { requestIndexingEnabled } from './lib/seo-launch'
import { legacySlashRedirect } from './lib/legacy-slash'
import { supabase } from '@/lib/supabase'
import { readPublicEvent } from '@/lib/public-event-data'

// Flight/prefetch can stream before the render lookup resolves. Check these
// requests before routing so inaccessible occurrences retain a real HTTP 404.
// The page still checks eligibility; no records are passed in headers/cookies.
export async function proxy(request: NextRequest) {
  const destination = deepLinkDestination(request.url);
  if (destination && !['GET', 'HEAD'].includes(request.method)) return new NextResponse(null, {
    status: 405, headers: { Allow: 'GET, HEAD', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' },
  });
  if (destination) return new NextResponse(null, {
    status: 307,
    headers: { Location: destination, 'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' },
  });
  const next = () => {
    const response = NextResponse.next();
    if (!requestIndexingEnabled(request.url)) response.headers.set('X-Robots-Tag', 'noindex');
    return response;
  };
  const redirect = legacySlashRedirect(request.nextUrl.pathname);
  if (redirect) {
    const url = new URL(request.url);
    url.pathname = redirect.path;
    return NextResponse.redirect(url, redirect.status);
  }
  if (request.headers.get('rsc') !== '1' || !/^\/events\/[^/]+$/.test(request.nextUrl.pathname)) return next();
  let slug: string
  try { slug = decodeURIComponent(request.nextUrl.pathname.split('/')[2] ?? '') } catch {
    return unavailable(404)
  }
  try {
    const event = await readPublicEvent(supabase, slug)
    return event ? next() : unavailable(404)
  } catch { return unavailable(503) }
}

function unavailable(status: 404 | 503) {
  return new NextResponse(status === 404 ? 'Not found' : 'Event temporarily unavailable', {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export const config = {
  matcher: '/:path*',
}
