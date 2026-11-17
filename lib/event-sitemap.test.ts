import assert from 'node:assert/strict'
import test from 'node:test'
import { performance } from 'node:perf_hooks'
import { sitemapWindow, sitemapEligible, sitemapPartitionXml, sitemapIndexXml, partitionBounds,
  escapeXml, sitemapPartitionKey, SITEMAP_PARTITIONS, type SitemapEvent, type SitemapPageReader } from './event-sitemap.ts'

const now = new Date('2026-10-12T12:00:00Z')
const window = sitemapWindow(now)
function row(i: number, key = '10'): SitemapEvent {
  return { id: `${key}000000-0000-0000-0000-${i.toString(16).padStart(12, '0')}`,
    seo_slug: `edition-${key}-${i}`, is_public: true, recurrence_state: 'active', status: 'scheduled',
    event_type: 'standard', ai_moderation_status: 'approved', users: { account_status: 'active' },
    start_date: '2026-10-23T21:30:00Z' }
}
function reader(rows: SitemapEvent[], cap = 500): SitemapPageReader {
  return async (cursor, limit) => {
    const index = cursor ? rows.findIndex(r => r.id === cursor) + 1 : 0
    return rows.slice(index, index + Math.min(limit, cap))
  }
}
test('sitemap policy has inclusive 30-day/12-calendar-month edges and leap-year clamp', () => {
  assert.deepEqual(window, { from: '2026-09-12T12:00:00.000Z', to: '2027-10-12T12:00:00.000Z' })
  assert.equal(sitemapWindow(new Date('2028-02-29T12:00:00Z')).to, '2029-02-28T12:00:00.000Z')
  for (const date of [window.from, window.to]) assert.equal(sitemapEligible({ ...row(1), start_date: date }, window), true)
  for (const date of ['2026-09-12T11:59:59Z', '2027-10-12T12:00:01Z', 'invalid']) {
    assert.equal(sitemapEligible({ ...row(1), start_date: date }, window), false)
  }
})
test('direct-only cancelled/historical pages and private/excluded/slugless are omitted', () => {
  for (const patch of [ { is_public: false }, { recurrence_state: 'excluded' }, { seo_slug: null },
    { seo_slug: '' }, { status: 'cancelled' }, { status: 'draft' }, { start_date: '2020-01-01T00:00:00Z' } ]) {
    assert.equal(sitemapEligible({ ...row(1), ...patch }, window), false)
  }
  assert.equal(sitemapEligible({ ...row(1), status: 'postponed' }, window), true)
})
test('stable UUID bounds cover all 256 keys with neither overlap nor gaps', () => {
  assert.equal(SITEMAP_PARTITIONS.length, 256)
  for (let i = 0; i < 255; i++) {
    assert.equal(partitionBounds(SITEMAP_PARTITIONS[i]).max, partitionBounds(SITEMAP_PARTITIONS[i+1]).min)
  }
  assert.equal(partitionBounds('ff').max, null)
  assert.throws(() => partitionBounds('../bad'))
  const index = sitemapIndexXml()
  assert.equal((index.match(/<sitemap>/g) ?? []).length, 256)
  assert.match(index, /https:\/\/myevy.app\/events-sitemap.xml\?partition=00/)
  assert.doesNotMatch(index, /<lastmod>|<priority>/)
})
test('1,203 rows survive a PostgREST cap of 97 and produce each URL exactly once', async () => {
  const rows = Array.from({ length: 1203 }, (_, i) => row(i+1))
  let calls = 0
  const read = reader(rows, 97)
  const result = await sitemapPartitionXml('10', window, async (cursor, limit) => {
    assert.ok(limit <= 500); calls++; return read(cursor, limit)
  })
  assert.equal(result.count, rows.length)
  assert.equal(new Set(result.xml.match(/<loc>[^<]+<\/loc>/g)).size, rows.length)
  assert.equal(calls, 14)
})
test('50,123 URLs are complete across stable partitions with date/month boundary fixtures', async () => {
  const groups = new Map<string, SitemapEvent[]>()
  for (let i = 1; i <= 50123; i++) {
    const key = SITEMAP_PARTITIONS[i % 256]
    const rows = groups.get(key) ?? []
    rows.push({ ...row(i, key), start_date: i % 2 ? window.from : window.to })
    groups.set(key, rows)
  }
  const urls = new Set<string>()
  let total = 0
  for (const key of SITEMAP_PARTITIONS) {
    const result = await sitemapPartitionXml(key, window, reader(groups.get(key) ?? [], 97))
    for (const loc of result.xml.match(/<loc>[^<]+<\/loc>/g) ?? []) {
      assert.equal(urls.has(loc), false); urls.add(loc)
    }
    total += result.count
  }
  assert.equal(total, 50123)
  assert.equal(urls.size, 50123)
})
test('empty sitemap is valid, XML escapes all reserved characters, unsafe slugs never appear', async () => {
  assert.equal(escapeXml('&<>"\''), '&amp;&lt;&gt;&quot;&apos;')
  const empty = await sitemapPartitionXml('10', window, reader([]))
  assert.match(empty.xml, /<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">\n<\/urlset>/)
  const result = await sitemapPartitionXml('10', window, reader([
    { ...row(1), seo_slug: 'édition&<>"' }, { ...row(2), seo_slug: 'broken/link' },
  ]))
  assert.equal(result.count, 1)
  assert.match(result.xml, /%C3%A9dition%26%3C%3E%22/)
  assert.doesNotMatch(result.xml, /<lastmod>|<priority>|broken/)
  assert.equal(Buffer.byteLength(result.xml), result.bytes)
})
test('overflow, duplicate identity, bad cursor/order and backend errors fail without truncated XML', async () => {
  await assert.rejects(sitemapPartitionXml('10', window, reader(Array.from({ length: 50001 }, (_, i) => row(i+1)))), /capacity/)
  await assert.rejects(sitemapPartitionXml('10', window, reader([row(1), { ...row(2), seo_slug: row(1).seo_slug }])), /Duplicate/)
  await assert.rejects(sitemapPartitionXml('10', window, reader([row(2), row(1)])), /ordering/)
  await assert.rejects(sitemapPartitionXml('10', window, reader([row(1, '11')])), /ordering/)
  await assert.rejects(sitemapPartitionXml('10', window, async () => { throw new Error('backend') }), /backend/)
})
for (const size of [5000, 50000]) {
  test(`fixture benchmark: ${size} URLs in one child`, async () => {
    const rows = Array.from({ length: size }, (_, i) => row(i+1))
    const start = performance.now()
    const heap = process.memoryUsage().heapUsed
    const result = await sitemapPartitionXml('10', window, reader(rows))
    const elapsed = performance.now() - start
    assert.equal(result.count, size)
    assert.ok(result.bytes < 50 * 1024 * 1024)
    console.log(JSON.stringify({ benchmark: 'sitemap-fixture', rows: size,
      durationMs: Number(elapsed.toFixed(2)), bytes: result.bytes,
      heapDeltaBytes: process.memoryUsage().heapUsed - heap }))
  })
}

test('encoded Unicode URLs exceeding 50 MiB reject before a successful XML response', async () => {
  const rows = Array.from({ length: 20000 }, (_, i) => ({
    ...row(i+1), seo_slug: `${'😀'.repeat(240)}-${i}`,
  }))
  await assert.rejects(sitemapPartitionXml('10', window, reader(rows)), /XML size exceeded/)
})

test('XML rejects forbidden controls and malformed Unicode; legal whitespace/astral text remains safe', () => {
  for (const value of ['a\u0000', '\u0001', '\u000b', '\ufffe', '\ud800', '\udc00']) assert.throws(() => escapeXml(value), /Invalid XML/)
  assert.equal(escapeXml('\t\n\r😀&'), '\t\n\r😀&amp;')
})


test('partition query validates decoded keys, rejects duplicates and never accepts redirect/unknown parameters', () => {
  assert.equal(sitemapPartitionKey(new URLSearchParams()), null)
  assert.equal(sitemapPartitionKey(new URLSearchParams('partition=%30%30')), '00')
  assert.equal(sitemapPartitionKey(new URLSearchParams('partition=ff')), 'ff')
  for (const query of ['partition=', 'partition=FF', 'partition=0', 'partition=000', 'partition=%2530%2530',
    'partition=00&partition=00', 'partition=00&partition=ff', 'partition=00&next=https://evil.example', 'unexpected=1']) {
    assert.throws(() => sitemapPartitionKey(new URLSearchParams(query)))
  }
})

test('release sitemap denies unapproved, deleting creators and disabled Meetups explicitly', async () => {
  for (const patch of [{ ai_moderation_status: 'pending' }, { ai_moderation_status: null }, { users: { account_status: 'pending_deletion' } }, { users: null }]) {
    assert.equal(sitemapEligible({ ...row(1), ...patch }, window), false)
  }
  const meetup = { ...row(1), event_type: 'meetup' }
  assert.equal(sitemapEligible(meetup, window), false)
  assert.equal(sitemapEligible(meetup, window, true), true)
  // Skipped candidates still advance the UUID cursor, including capped pages.
  const mixed = [{ ...row(1), event_type: 'meetup' }, row(2)]
  assert.equal((await sitemapPartitionXml('10', window, reader(mixed, 1))).count, 1)
  assert.equal((await sitemapPartitionXml('10', window, reader(mixed, 1), true)).count, 2)
})
