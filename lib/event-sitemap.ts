import { directPageEligible, eventUrl, isoInstant, PUBLIC_ORIGIN, type PublicEligibility } from './event-seo.ts'

export const SITEMAP_BATCH_SIZE = 500
export const SITEMAP_MAX_URLS = 50_000
export const SITEMAP_MAX_BYTES = 50 * 1024 * 1024
export const SITEMAP_DEADLINE_MS = 20_000
export const SITEMAP_PARTITIONS = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'))
export type SitemapEvent = PublicEligibility & { id: string; status: string | null; start_date: string | null }
export type SitemapWindow = { from: string; to: string }

export function sitemapWindow(now: Date): SitemapWindow {
  const from = new Date(now.getTime() - 30 * 86400_000)
  const to = new Date(now)
  const month = to.getUTCMonth()
  to.setUTCFullYear(to.getUTCFullYear() + 1)
  if (to.getUTCMonth() !== month) to.setUTCDate(0)
  return { from: from.toISOString(), to: to.toISOString() }
}

export function sitemapEligible(event: SitemapEvent, window: SitemapWindow, meetupsEnabled = false) {
  const start = isoInstant(event.start_date)
  return directPageEligible(event) && (event.event_type !== 'meetup' || meetupsEnabled) && ['scheduled', 'postponed'].includes(event.status ?? '') &&
    !!start && start >= window.from && start <= window.to
}

export function partitionBounds(key: string) {
  if (!/^[0-9a-f]{2}$/.test(key)) throw new Error('Invalid sitemap partition')
  const min = `${key}000000-0000-0000-0000-000000000000`
  const next = Number.parseInt(key, 16) + 1
  const max = next < 256 ? `${next.toString(16).padStart(2, '0')}000000-0000-0000-0000-000000000000` : null
  return { min, max }
}

export function escapeXml(value: string) {
  if (/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/u.test(value)) {
    throw new Error('Invalid XML character')
  }
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

export function sitemapPartitionKey(query: URLSearchParams) {
  if ([...query.keys()].some(key => key !== 'partition')) throw new Error('Invalid sitemap query')
  const values = query.getAll('partition')
  if (values.length === 0) return null
  if (values.length !== 1 || !/^[0-9a-f]{2}$/.test(values[0])) throw new Error('Invalid sitemap partition')
  return values[0]
}

const declaration = '<?xml version="1.0" encoding="UTF-8"?>\n'
const namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9'

export function sitemapIndexXml() {
  // Keep sitemap discovery on the canonical host. Release requires WP query forwarding verification.
  return `${declaration}<sitemapindex xmlns="${namespace}">\n` +
    SITEMAP_PARTITIONS.map(key => `  <sitemap><loc>${escapeXml(`${PUBLIC_ORIGIN}/events-sitemap.xml?partition=${key}`)}</loc></sitemap>`).join('\n') +
    '\n</sitemapindex>'
}

export type SitemapPageReader = (cursor: string | null, limit: number) => Promise<SitemapEvent[]>

export async function sitemapPartitionXml(key: string, window: SitemapWindow, read: SitemapPageReader, meetupsEnabled = false) {
  const { min, max } = partitionBounds(key)
  const parts = [`${declaration}<urlset xmlns="${namespace}">`]
  let bytes = Buffer.byteLength(parts[0] + '\n</urlset>')
  let cursor: string | null = null
  let count = 0
  let scanned = 0
  const slugs = new Set<string>()
  for (;;) {
    const rows = await read(cursor, SITEMAP_BATCH_SIZE)
    if (!rows.length) break
    if (rows.length > SITEMAP_BATCH_SIZE) throw new Error('Sitemap read bound exceeded')
    for (const row of rows) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(row.id) ||
          row.id < min || (max && row.id >= max) || (cursor && row.id <= cursor)) {
        throw new Error('Invalid sitemap ordering')
      }
      cursor = row.id
      if (++scanned > SITEMAP_MAX_URLS) throw new Error('Sitemap partition capacity exceeded')
      if (!sitemapEligible(row, window, meetupsEnabled)) continue
      if (slugs.has(row.seo_slug!)) throw new Error('Duplicate sitemap identity')
      slugs.add(row.seo_slug!)
      const entry = `\n  <url><loc>${escapeXml(eventUrl(row.seo_slug!))}</loc></url>`
      bytes += Buffer.byteLength(entry)
      if (bytes > SITEMAP_MAX_BYTES) throw new Error('Sitemap XML size exceeded')
      parts.push(entry)
      count++
    }
    // Continue until empty; PostgREST may cap below the requested batch size.
  }
  parts.push('\n</urlset>')
  return { xml: parts.join(''), count, bytes }
}
