import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { assertAnonymousKey, createPublicFetch } from './public-backend.ts'

function jwt(role: unknown) {
  return `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.fixture_signature`
}
test('accepts only anonymous legacy keys or publishable keys, never viewer/service secrets', () => {
  assert.doesNotThrow(() => assertAnonymousKey(jwt('anon')))
  assert.doesNotThrow(() => assertAnonymousKey('sb_publishable_fixture'))
  for (const key of [jwt('service_role'), jwt('authenticated'), jwt(null), 'sb_secret_fixture', 'malformed', undefined, ` ${jwt('anon')}`, 'a.invalid.b']) {
    assert.throws(() => assertAnonymousKey(key), error => error instanceof Error && error.message === 'Public backend configuration is invalid')
  }
})
test('anonymous fetch opts out of caching, preserves status and supports empty responses', async () => {
  const seen: RequestInit[] = []
  const upstream: typeof fetch = async (_input, init) => {
    seen.push(init!)
    return new Response(null, { status: 204 })
  }
  const response = await createPublicFetch(upstream)('https://fixture.invalid', { cache: 'force-cache' })
  assert.equal(response.status, 204)
  assert.equal(seen[0].cache, 'no-store')
  assert.ok(seen[0].signal)
})
test('caller cancellation remains effective through the public deadline wrapper', async () => {
  const controller = new AbortController()
  controller.abort()
  const upstream: typeof fetch = async (_input, init) => {
    init!.signal!.throwIfAborted()
    return new Response('{}')
  }
  await assert.rejects(createPublicFetch(upstream)('https://fixture.invalid', { signal: controller.signal }))
})
for (const mode of ['headers', 'body'] as const) {
  test(`deadline aborts stalled ${mode} without exposing backend response`, async () => {
    const server = createServer((_req, res) => {
      if (mode === 'body') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.flushHeaders(); res.write('{') }
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    try {
      await assert.rejects(createPublicFetch(fetch, 30)(`http://127.0.0.1:${address.port}`))
    } finally {
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })
}
