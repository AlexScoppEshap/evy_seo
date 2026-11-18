import assert from 'node:assert/strict'
import test from 'node:test'
import { publicEventFixture as base } from './seo-fixtures.ts'
import { allowedMediaSource, fetchEventMedia, presentPublicEvent, MAX_IMAGE_BYTES } from './event-media.ts'
import { buildEventMetadata } from './event-seo.ts'
import { buildEventJsonLd } from './event-json-ld.ts'

const backend = 'https://fixture.supabase.co'
const token = 'synthetic_public_signature_123456'
const source = `${backend}/functions/v1/ik-storage?action=proxy&bucket_kind=event&key=events/${base.id}/cover.jpg&token=${token}`
const managed = `${backend}/functions/v1/ik-storage?action=image_public&id=${base.id}&token=${token}&published=2`

test('managed media accepts zero, positive and absent revisions; rejects malformed or duplicate revisions', async () => {
  const withoutRevision = managed.replace('&published=2', '')
  for (const [suffix, accepted] of [
    ['&published=0', true], ['&published=1', true], ['&published=42', true], ['', true],
    ['&published=-1', false], ['&published=1.5', false], ['&published=', false],
    ['&published=0&published=1', false], ['&published=0&published=0', false],
    ['&published=01', false], ['&published=abc', false],
  ] as const) {
    const image_url = withoutRevision + suffix
    assert.equal(allowedMediaSource(image_url, backend, base, 'cover'), accepted ? image_url : undefined)
    let calls = 0
    const response = await fetchEventMedia({ ...base, image_url }, 'cover', backend, async () => {
      calls++
      return new Response(new Uint8Array([255,216,255,217]), { headers: { 'Content-Type': 'image/jpeg' } })
    })
    assert.equal(response.status, accepted ? 200 : 404)
    assert.equal(calls, accepted ? 1 : 0)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
  }
})

test('legacy and moderated covers enter metadata via token-free canonical media routes only', () => {
  for (const image_url of [source, managed, managed.replace('published=2', 'published=0'), `${backend}/storage/v1/object/public/events/a.jpg`]) {
    const event = presentPublicEvent({ ...base, image_url, gallery_image_urls: [image_url] }, backend)
    assert.equal(event.image_url, `https://myevy.app/events/${base.seo_slug}/media/cover`)
    const serialized = JSON.stringify({ event, metadata: buildEventMetadata(event), json: buildEventJsonLd(event) })
    assert.doesNotMatch(serialized, /synthetic_public_signature|ik-storage|token=/)
    assert.match(serialized, /media\/gallery-0/)
  }
})
test('sources reject SSRF, credentials, chat/participant media, duplicate arguments and traversal', () => {
  for (const image_url of [
    source.replace(backend, 'https://other.supabase.co'),
    source.replace('bucket_kind=event', 'bucket_kind=chat'),
    source.replace(`events/${base.id}/cover.jpg`, 'group-chat/private/photo.jpg'),
    source.replace(`events/${base.id}/cover.jpg`, `participants/${base.id}/photo.jpg`),
    source.replace('cover.jpg', '../private.jpg'), source.replace('cover.jpg', '%252e%252e/private.jpg'),
    source + '&token=another', source + '&extra=1', managed.replace('image_public', 'image_review'),
    `https://user:pass@fixture.supabase.co/functions/v1/ik-storage`, 'http://127.0.0.1/private',
  ]) assert.equal(allowedMediaSource(image_url, backend, base, 'cover'), undefined)
})
test('avatars require the current creator namespace and galleries stay bounded', () => {
  const creator = '20000000-0000-0000-0000-000000000001'
  const avatar = source.replace('bucket_kind=event', 'bucket_kind=avatar').replace(`events/${base.id}`, `avatars/${creator}`)
  const event = { ...base, creator_id: creator, users: { ...base.users!, profileimageurl: avatar }, gallery_image_urls: Array(10).fill(source) }
  assert.ok(presentPublicEvent(event, backend).users?.profileimageurl?.endsWith('/media/avatar'))
  assert.equal(allowedMediaSource(avatar, backend, { ...event, creator_id: base.id }, 'avatar'), undefined)
  assert.equal(presentPublicEvent(event, backend).gallery_image_urls?.length, 6)
})
test('media requests forward no viewer credentials and no upstream cache/redirect headers', async () => {
  let calls = 0
  const response = await fetchEventMedia({ ...base, image_url: managed }, 'cover', backend, async (_input, init) => {
    calls++; assert.equal(init?.cache, 'no-store'); assert.equal(init?.redirect, 'manual'); assert.equal(init?.headers, undefined)
    return new Response(new Uint8Array([1,2,3]), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=300', 'Set-Cookie': 'private' } })
  })
  assert.equal(calls, 1); assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(response.headers.get('set-cookie'), null)
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1,2,3])
})
test('redirects are bounded and validated; SVG, oversized or remote errors fail closed', async () => {
  for (const result of [
    new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/private' } }),
    new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } }),
    new Response('secret', { status: 500 }),
    new Response('large', { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(MAX_IMAGE_BYTES + 1) } }),
  ]) {
    const response = await fetchEventMedia({ ...base, image_url: source }, 'cover', backend, async () => result)
    assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /secret|token|127.0.0.1/)
  }
  let count = 0
  const loop = await fetchEventMedia({ ...base, image_url: source }, 'cover', backend, async () => {
    count++; return new Response(null, { status: 302, headers: { Location: source } })
  })
  assert.equal(loop.status, 502); assert.equal(count, 3)
  const streamed = await fetchEventMedia({ ...base, image_url: source }, 'cover', backend, async () => new Response(new ReadableStream({start(c) {c.enqueue(new Uint8Array(MAX_IMAGE_BYTES + 1)); c.close()}}), {headers:{'Content-Type':'image/png'}}))
  assert.equal(streamed.status, 502)
})

test('shared legacy series images keep their published reference without inventing an occurrence or changing IDs', () => {
  const sibling = { ...base, id: '30000000-0000-0000-0000-000000000001', series_id: '40000000-0000-0000-0000-000000000001', image_url: source }
  assert.equal(allowedMediaSource(source, backend, sibling, 'cover'), source)
  assert.equal(presentPublicEvent(sibling, backend).image_url, `https://myevy.app/events/${base.seo_slug}/media/cover`)
})
