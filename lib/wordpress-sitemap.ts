import { SaxesParser } from 'saxes'
import { escapeXml, SITEMAP_PARTITIONS } from './event-sitemap.ts'
import { PUBLIC_ORIGIN } from './event-seo.ts'

const namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9'
export const WORDPRESS_INDEX_URL = `${PUBLIC_ORIGIN}/sitemap_index.xml`
export const MAX_WORDPRESS_XML_BYTES = 1024 * 1024
type Leaf = { loc: string; lastmod?: string }

function leafUrl(value: string) {
  const url = new URL(value)
  if (url.origin !== PUBLIC_ORIGIN || url.username || url.password || url.hash ||
      !/^\/[a-zA-Z0-9_./%-]+\.xml(?:\.gz)?$/.test(url.pathname) ||
      ['/sitemap.xml','/sitemap_index.xml','/wp-sitemap.xml'].includes(url.pathname)) throw Error('Invalid WordPress leaf')
  if (url.pathname === '/events-sitemap.xml') {
    if ([...url.searchParams.keys()].length !== 1 || !/^[0-9a-f]{2}$/.test(url.searchParams.get('partition') ?? '')) throw Error('Nested event index')
  } else if (url.search) throw Error('Unexpected WordPress leaf query')
  return url.href
}

export function parseWordPressIndex(xml: string): Leaf[] {
  if (Buffer.byteLength(xml) > MAX_WORDPRESS_XML_BYTES) throw Error('WordPress index too large')
  const parser = new SaxesParser({ xmlns: true })
  const stack: string[] = [], leaves: Leaf[] = []
  let entry: Record<string,string> = {}, field = '', text = '', rootSeen = false
  parser.on('doctype', () => { throw Error('DTD not allowed') })
  parser.on('opentag', tag => {
    if (tag.uri !== namespace) throw Error('Invalid sitemap namespace')
    stack.push(tag.local)
    if (stack.length === 1) {
      if (rootSeen || tag.local !== 'sitemapindex') throw Error('Expected WordPress sitemap index')
      rootSeen = true
    } else if (stack.length === 2 && tag.local === 'sitemap') entry = {}
    else if (stack.length === 3 && stack[1] === 'sitemap' && ['loc','lastmod'].includes(tag.local)) {
      if (Object.hasOwn(entry, tag.local)) throw Error('Duplicate sitemap field')
      field = tag.local; text = ''; entry[field] = ''
    } else throw Error('Invalid sitemap structure')
  })
  const content = (value: string) => {
    if (stack.length === 3 && field) text += value
    else if (value.trim()) throw Error('Unexpected sitemap content')
  }
  parser.on('text', content); parser.on('cdata', content)
  parser.on('closetag', () => {
    if (stack.length === 3) { entry[field] = text.trim(); field = ''; text = '' }
    if (stack.length === 2) {
      const loc = leafUrl(entry.loc)
      const lastmod = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(entry.lastmod ?? '') && Number.isFinite(Date.parse(entry.lastmod)) ? entry.lastmod : undefined
      leaves.push({ loc, ...(lastmod ? { lastmod } : {}) })
      if (leaves.length > 50_000 - SITEMAP_PARTITIONS.length) throw Error('Too many WordPress sitemaps')
    }
    stack.pop()
  })
  parser.write(xml).close()
  if (!rootSeen || !leaves.length) throw Error('Empty WordPress sitemap index')
  return leaves
}

export function mergedSitemapXml(leaves: Leaf[]) {
  const entries = new Map(leaves.map(leaf => [leaf.loc, leaf]))
  for (const key of SITEMAP_PARTITIONS) {
    const loc = `${PUBLIC_ORIGIN}/events-sitemap.xml?partition=${key}`
    entries.set(loc, { loc })
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="${namespace}">\n` +
    [...entries.values()].map(leaf => `  <sitemap><loc>${escapeXml(leaf.loc)}</loc>${leaf.lastmod ? `<lastmod>${escapeXml(leaf.lastmod)}</lastmod>` : ''}</sitemap>`).join('\n') + '\n</sitemapindex>'
}

export async function readMergedSitemap(source = WORDPRESS_INDEX_URL, upstream: typeof fetch = fetch) {
  // An explicit loopback override supports isolated tests. No request parameter
  // selects a source; production always reads the canonical Yoast endpoint.
  const url = new URL(source)
  if (source !== WORDPRESS_INDEX_URL && !(url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.pathname === '/sitemap_index.xml' && !url.search && !url.username && !url.password && !url.hash)) throw Error('Invalid WordPress index source')
  const response = await upstream(url, { cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(5_000), headers: { Accept: 'application/xml, text/xml' } })
  if (response.status !== 200 || !/^(?:application|text)\/xml(?:;|$)/i.test(response.headers.get('content-type') ?? '') || Number(response.headers.get('content-length')) > MAX_WORDPRESS_XML_BYTES) {
    await response.body?.cancel(); throw Error('WordPress sitemap unavailable')
  }
  const reader = response.body?.getReader()
  if (!reader) throw Error('Missing WordPress XML')
  const chunks: Uint8Array[] = []; let length = 0
  for (;;) {
    const { value, done } = await reader.read(); if (done) break
    length += value.byteLength
    if (length > MAX_WORDPRESS_XML_BYTES) { await reader.cancel(); throw Error('WordPress index too large') }
    chunks.push(value)
  }
  return mergedSitemapXml(parseWordPressIndex(Buffer.concat(chunks).toString('utf8')))
}
