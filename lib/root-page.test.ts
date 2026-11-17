import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { PUBLIC_ORIGIN } from './event-seo.ts'

const require = createRequire(import.meta.url)
const compiled = ts.transpileModule(readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exports: { default?: () => ReactNode; metadata?: { robots: unknown; alternates: unknown; title: string } } = {}
new Function('require', 'exports', compiled)((id: string) => {
  if (id === '@/lib/event-seo') return { PUBLIC_ORIGIN }
  if (id.includes('supabase')) throw new Error('Root attempted a database dependency')
  return require(id)
}, exports)

test('root is safe public product navigation with no event/data dependency', () => {
  const html = renderToStaticMarkup(exports.default!())
  assert.match(html, /<h1[^>]*>Evy<\/h1>/)
  assert.match(html, /href="https:\/\/myevy.app"/)
  assert.doesNotMatch(html, /<pre|SEO test|SUPABASE|postgres|token|diagnostic|project|localhost|Friday live/i)
})
test('root metadata is non-indexed and follows the WordPress canonical homepage without a redirect', () => {
  assert.equal(exports.metadata!.title, 'Evy')
  assert.deepEqual(exports.metadata!.robots, { index: false, follow: true })
  assert.deepEqual(exports.metadata!.alternates, { canonical: `${PUBLIC_ORIGIN}/` })
})
