// Deterministic risk model of the read-only schema snapshot, NOT a DB test or
// an SEO slug generator. Never imported by application code.
import assert from 'node:assert/strict'
import test from 'node:test'

const legacyCandidate = (name: string, city: string, id: string) =>
  `${name}-${city}-ch-2026-${id.replaceAll('-', '').slice(0,6)}`.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')

test('snapshot risk model: distinct UUIDs can produce the same six-hex slug after normalization', () => {
  const a='abcdef00-0000-0000-0000-000000000001'
  const b='abcdef00-0000-0000-0000-000000000002'
  assert.notEqual(a,b)
  assert.equal(legacyCandidate('Friday Live','Lausanne',a),legacyCandidate('FRIDAY---LIVE','LAUSANNE',b))
  assert.notEqual(a.replaceAll('-',''),b.replaceAll('-',''))
})
test('snapshot birthday model applies per identical readable-stem group, not the whole event table', () => {
  const probability = (n: number) => 1-Math.exp(-n*(n-1)/(2*16**6))
  assert.equal(probability(1),0)
  assert.ok(probability(100)>0.00029 && probability(100)<0.00030)
  assert.ok(probability(5000)>0.52 && probability(5000)<0.53)
})
