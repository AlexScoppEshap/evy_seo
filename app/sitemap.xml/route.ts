import { readMergedSitemap } from '@/lib/wordpress-sitemap'

// Exact root proxy only; /sitemap_index.xml remains owned by Yoast/WordPress.
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  if (new URL(request.url).search) return new Response('Invalid sitemap query', { status: 400, headers })
  try {
    const xml = await readMergedSitemap(process.env.WORDPRESS_SITEMAP_INDEX_URL)
    return new Response(xml, { headers: { ...headers, 'Content-Type': 'application/xml; charset=utf-8' } })
  } catch {
    return new Response('Sitemap temporarily unavailable', { status: 503, headers: { ...headers, 'Retry-After': '60' } })
  }
}
