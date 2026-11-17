import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { readPublicEvent, readOtherDates, PublicDataUnavailable } from './public-event-data.ts'
import { publicEventFixture as base } from './seo-fixtures.ts'

const now = new Date('2026-10-12T12:00:00Z')
export function fixtureDb(responses: unknown[], status = 200) {
  const calls: { url: URL; body: unknown }[] = []
  const db = createClient('https://fixture.supabase.co', 'anonymous-fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      calls.push({ url: new URL(String(input)), body: init?.body ? JSON.parse(String(init.body)) : undefined })
      const response = responses.shift() ?? []
      return response instanceof Response ? response : new Response(JSON.stringify(response), { status, headers: { 'Content-Type': 'application/json' } })
    } },
  })
  return { db, calls }
}
test('accessor selects minimal fields with explicit public/recurrence filters', async () => {
  const { db, calls } = fixtureDb([[base]])
  assert.deepEqual(await readPublicEvent(db, base.seo_slug!), base)
  const params = calls[0].url.searchParams
  assert.equal(params.get('is_public'), 'eq.true')
  assert.equal(params.get('or'), '(recurrence_state.is.null,recurrence_state.eq.active)')
  assert.doesNotMatch(params.get('select')!, /email|phone|subscription|template|\*/)
})
for (const [name, rows] of [
  ['missing', []], ['moderation/RLS denied', []], ['private', [{ ...base, is_public: false }]],
  ['excluded', [{ ...base, recurrence_state: 'excluded' }]],
] as const) {
  test(`${name} accessor returns absence without metadata`, async () => {
    assert.equal(await readPublicEvent(fixtureDb([rows]).db, base.seo_slug!), null)
  })
}
test('invalid slug performs zero queries; backend failure is a safe temporary error', async () => {
  const { db, calls } = fixtureDb([])
  assert.equal(await readPublicEvent(db, '../bad'), null)
  assert.equal(calls.length, 0)
  await assert.rejects(readPublicEvent(fixtureDb([{ code: 'SQL_SECRET', message: 'sensitive' }], 400).db, base.seo_slug!), PublicDataUnavailable)
})
test('cancelled anchor offers at most six public current candidates via one RPC and one RLS read', async () => {
  const anchor = { ...base, recurrence_state: 'active', status: 'cancelled' }
  const siblings = Array.from({ length: 10 }, (_, i) => ({ ...base,
    id: `10000000-0000-0000-0000-${String(i + 2).padStart(12, '0')}`,
    seo_slug: `edition-${i}`, recurrence_state: 'active', status: i === 0 ? 'postponed' : 'scheduled',
  }))
  const { db, calls } = fixtureDb([{ entries: siblings.map(s => ({ event_id: s.id, title: 'Untrusted private text' })) }, siblings])
  const rows = await readOtherDates(db, anchor, now)
  assert.equal(rows.length, 6)
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0].body, { p_event_id: anchor.id, p_from: null, p_to: null, p_limit: 12, p_cursor: null })
  assert.equal(calls[1].url.searchParams.get('is_public'), 'eq.true')
  assert.equal(rows[0].name, base.name)
  assert.equal(rows[0].status, 'postponed')
})
test('Other Dates rejects private/excluded/cancelled/missing slug/past/self and RLS-hidden candidates', async () => {
  const anchor = { ...base, recurrence_state: 'active' }
  const rows = [
    { ...anchor, id: '10000000-0000-0000-0000-000000000002', is_public: false },
    { ...anchor, id: '10000000-0000-0000-0000-000000000003', recurrence_state: 'excluded' },
    { ...anchor, id: '10000000-0000-0000-0000-000000000004', status: 'cancelled' },
    { ...anchor, id: '10000000-0000-0000-0000-000000000005', seo_slug: null },
    { ...anchor, id: '10000000-0000-0000-0000-000000000006', end_date: '2020-01-01T00:00:00Z' },
    anchor,
  ]
  const { db } = fixtureDb([{ entries: rows.map(s => ({ event_id: s.id })) }, rows])
  assert.deepEqual(await readOtherDates(db, anchor, now), [])
  assert.deepEqual(await readOtherDates(fixtureDb([{ entries: [{ event_id: rows[0].id }] }, []]).db, anchor, now), [])
})
test('RPC outage, malformed payload, RLS failure and independent anchor do not break page', async () => {
  const anchor = { ...base, recurrence_state: 'active' }
  assert.deepEqual(await readOtherDates(fixtureDb([{}], 503).db, anchor, now), [])
  assert.deepEqual(await readOtherDates(fixtureDb([{ entries: 'invalid' }]).db, anchor, now), [])
  assert.deepEqual(await readOtherDates(fixtureDb([{ entries: [null, {}] }]).db, anchor, now), [])
  const failure = new Response(JSON.stringify({ message: 'sensitive' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  assert.deepEqual(await readOtherDates(fixtureDb([{ entries: [{ event_id: '10000000-0000-0000-0000-000000000002' }] }, failure]).db, anchor, now), [])
  const { db, calls } = fixtureDb([])
  assert.deepEqual(await readOtherDates(db, base, now), [])
  assert.equal(calls.length, 0)
})

test('malformed successful backend event snapshots are temporary failures, not missing/private records', async () => {
  for (const patch of [{ id: 'invalid' }, { description: { private: 'content' } }, { artists: [1] },
    { users: { fullname: 7, username: 'name' } }, { event_ticket_types: [{ price: 5 }] }]) {
    await assert.rejects(readPublicEvent(fixtureDb([[{ ...base, ...patch }]]).db, base.seo_slug!), PublicDataUnavailable)
  }
})
test('malformed Other Dates rows never turn an otherwise valid page into a 500', async () => {
  const candidate = { ...base, id: '10000000-0000-0000-0000-000000000002', recurrence_state: 'active', name: { private: 'name' } }
  const { db } = fixtureDb([{ entries: [{ event_id: candidate.id }] }, [candidate, null]])
  assert.deepEqual(await readOtherDates(db, { ...base, recurrence_state: 'active' }, now), [])
})

test('release moderation and creator privacy are explicit even if a backend returns ineligible rows', async () => {
  for (const patch of [
    { ai_moderation_status: 'pending' }, { ai_moderation_status: 'rejected' }, { ai_moderation_status: null },
    { users: { ...base.users, account_status: 'pending_deletion' } }, { users: null }, { event_type: 'unknown' },
  ]) assert.equal(await readPublicEvent(fixtureDb([[{ ...base, ...patch }]]).db, base.seo_slug!), null)
  const { db, calls } = fixtureDb([[base]])
  await readPublicEvent(db, base.seo_slug!)
  assert.equal(calls[0].url.searchParams.get('ai_moderation_status'), 'eq.approved')
  assert.equal(calls[0].url.searchParams.get('users.account_status'), 'eq.active')
  assert.match(calls[0].url.searchParams.get('select')!, /users!inner/)
})
test('anonymous Meetup discovery follows the deployed capability contract, without enabling rollout', async () => {
  const event = { ...base, event_type: 'meetup', meetup_subcategory: 'drinks_nightlife' }
  for (const capabilities of [null, {}, { contract_version: 2, discover_enabled: true }, { contract_version: 1, discover_enabled: false }]) {
    const { db } = fixtureDb([[event], capabilities])
    assert.equal(await readPublicEvent(db, base.seo_slug!), null)
  }
  const { db, calls } = fixtureDb([[event], { contract_version: 1, discover_enabled: true }])
  assert.equal((await readPublicEvent(db, base.seo_slug!))?.event_type, 'meetup')
  assert.match(calls[1].url.pathname, /rpc\/get_meetup_capabilities$/)
})
