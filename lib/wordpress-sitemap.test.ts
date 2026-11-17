import assert from 'node:assert/strict'
import test from 'node:test'
import { parseWordPressIndex, mergedSitemapXml, readMergedSitemap, MAX_WORDPRESS_XML_BYTES } from './wordpress-sitemap.ts'

const ns = 'http://www.sitemaps.org/schemas/sitemap/0.9'
const index = (entries: string) => `<?xml version="1.0"?><sitemapindex xmlns="${ns}">${entries}</sitemapindex>`
const leaf = (loc = 'https://myevy.app/page-sitemap.xml') => `<sitemap><loc>${loc}</loc><lastmod>2026-11-04T00:00:00Z</lastmod></sitemap>`

test('Yoast XML is namespace-aware, preserves all leaves/lastmod and deduplicates the merged root', () => {
  const leaves = parseWordPressIndex(index(leaf()+leaf()+leaf('https://myevy.app/post-sitemap2.xml')))
  const xml = mergedSitemapXml(leaves)
  assert.equal((xml.match(/<loc>/g) ?? []).length, 258)
  assert.equal((xml.match(/<loc>https:\/\/myevy.app\/page-sitemap.xml<\/loc>/g) ?? []).length, 1)
  assert.match(xml, /<lastmod>2026-11-04T00:00:00Z<\/lastmod>/)
  assert.match(xml, /events-sitemap.xml\?partition=00/)
  assert.match(xml, /events-sitemap.xml\?partition=ff/)
  assert.doesNotMatch(xml, /<loc>[^<]*(?:seo\.myevy|sitemap_index\.xml|events-sitemap\.xml<)/)
  assert.equal(parseWordPressIndex(index(leaf()).replaceAll('sitemapindex','s:sitemapindex').replaceAll('<sitemap>','<s:sitemap>').replaceAll('</sitemap>','</s:sitemap>').replaceAll('<loc>','<s:loc>').replaceAll('</loc>','</s:loc>').replaceAll('<lastmod>','<s:lastmod>').replaceAll('</lastmod>','</s:lastmod>').replace(`xmlns="${ns}"`,`xmlns:s="${ns}"`)).length, 1)
})
test('malformed XML, DTDs, nested indexes, noncanonical hosts and missing/duplicate fields stop the merge', () => {
  for (const xml of [
    index(''), index(leaf('https://myevy.app/sitemap_index.xml')), index(leaf('https://myevy.app/events-sitemap.xml')),
    index(leaf('https://other.example/page-sitemap.xml')), index(leaf('https://myevy.app/page-sitemap.xml?next=bad')),
    index(leaf('http://myevy.app/page-sitemap.xml')), index(leaf('https://user:pass@myevy.app/page-sitemap.xml')),
    index('<sitemap><lastmod>2026-11-04</lastmod></sitemap>'), index('<sitemap><loc>x</loc><loc>y</loc></sitemap>'),
    index(leaf()).replace(ns, 'urn:wrong'), '<!DOCTYPE x [<!ENTITY leak SYSTEM "file:///tmp/private">]>'+index(leaf()),
    index(leaf()).replace('</loc>', ''), index('<sitemap><loc><nested/></loc></sitemap>'), '<urlset xmlns="'+ns+'"/>',
    index(leaf('https://myevy.app/page-sitemap.xml#fragment')),
  ]) assert.throws(() => parseWordPressIndex(xml))
  assert.throws(() => parseWordPressIndex(' '.repeat(MAX_WORDPRESS_XML_BYTES+1)))
})
test('only the fixed public Yoast URL or a deliberate loopback test source can be fetched; caller credentials are absent', async () => {
  let calls = 0
  const upstream: typeof fetch = async (url, init) => {
    calls++; assert.equal(String(url), 'https://myevy.app/sitemap_index.xml')
    assert.equal(init?.cache,'no-store'); assert.equal(init?.redirect,'manual')
    assert.deepEqual(init?.headers,{Accept:'application/xml, text/xml'})
    return new Response(index(leaf()),{headers:{'Content-Type':'text/xml; charset=UTF-8'}})
  }
  assert.match(await readMergedSitemap(undefined,upstream), /partition=ff/)
  for (const source of ['http://169.254.169.254/sitemap_index.xml','https://evil.example/sitemap_index.xml','https://myevy.app/sitemap.xml','http://127.0.0.1:1234/sitemap_index.xml?x=1']) await assert.rejects(() => readMergedSitemap(source,upstream))
  assert.equal(calls, 1)
})
test('Yoast outage, redirect, HTML, truncated XML and oversized chunked responses fail without partial sitemap output', async () => {
  for (const response of [new Response('down',{status:502}),new Response(null,{status:302,headers:{Location:'https://evil.example'}}),new Response(index(leaf()),{headers:{'Content-Type':'text/html'}}),new Response('<sitemapindex>',{headers:{'Content-Type':'application/xml'}}),new Response(' '.repeat(MAX_WORDPRESS_XML_BYTES+1),{headers:{'Content-Type':'application/xml'}})]) {
    await assert.rejects(() => readMergedSitemap(undefined,async()=>response))
  }
})
