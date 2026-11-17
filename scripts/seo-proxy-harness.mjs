// Isolated contract model, NOT a WordPress/Apache implementation or live proof.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { spawnSync } from 'node:child_process'
import { escapeXml } from '../lib/event-sitemap.ts'

const publicOrigin = 'https://myevy.app'
const namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9'
const locs = xml => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1].replaceAll('&amp;', '&'))
const indexXml = urls => `<?xml version="1.0"?><sitemapindex xmlns="${namespace}">${[...new Set(urls)].map(url => `<sitemap><loc>${escapeXml(url)}</loc></sitemap>`).join('')}</sitemapindex>`

export async function runProxyChecks({ appOrigin, check }) {
  const eventIndex = await (await fetch(`${appOrigin}/events-sitemap.xml`)).text()
  const eventChildren = locs(eventIndex)
  const wpLeaf = `${publicOrigin}/wp-pages-sitemap.xml`
  const wpXml = `<?xml version="1.0"?><urlset xmlns="${namespace}"><url><loc>${publicOrigin}/about/</loc></url></urlset>`
  let mode = 'pass'
  const forwarded = []
  const proxy = createServer(async (request, response) => {
    try {
      const parsed = new URL(request.url, appOrigin)
      if (parsed.origin !== appOrigin || !['GET','HEAD'].includes(request.method)) {
        response.writeHead(400); response.end('Invalid fixture request'); return
      }
      if (parsed.pathname === '/sitemap.xml') {
        response.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control':'no-store' })
        const roots = mode === 'nested' ? [`${publicOrigin}/events-sitemap.xml`,wpLeaf] : [wpLeaf,wpLeaf,...eventChildren]
        response.end(indexXml(roots)); return
      }
      if (parsed.pathname === '/wp-pages-sitemap.xml') {
        response.writeHead(200, {'Content-Type':'application/xml'}); response.end(wpXml); return
      }
      if (mode === 'upstream502') { response.writeHead(502,{'Cache-Control':'no-store'}); response.end('Upstream unavailable'); return }
      if (mode === 'missingChild' && parsed.searchParams.get('partition') === 'ff') { response.writeHead(404); response.end('Not found'); return }
      if (mode === 'loop') { response.writeHead(302,{Location:request.url}); response.end(); return }
      const path = mode === 'dropQuery' ? parsed.pathname : request.url
      forwarded.push(path)
      const upstream = await fetch(`${appOrigin}${path}`, { method:request.method, redirect:'manual' })
      for (const name of ['content-type','cache-control','location','retry-after']) {
        if (upstream.headers.has(name)) response.setHeader(name,upstream.headers.get(name))
      }
      response.statusCode=upstream.status
      response.end(request.method === 'HEAD' ? undefined : Buffer.from(await upstream.arrayBuffer()))
    } catch { response.writeHead(502,{'Cache-Control':'no-store'}); response.end('Upstream unavailable') }
  })
  proxy.listen(0,'127.0.0.1'); await once(proxy,'listening')
  const origin=`http://127.0.0.1:${proxy.address().port}`
  const documents=[]
  try {
    const merged=await(await fetch(`${origin}/sitemap.xml`)).text()
    const leaves=locs(merged)
    check(()=>assert.equal(leaves.length,257))
    check(()=>assert.equal(new Set(leaves).size,257))
    check(()=>assert.equal(leaves.includes(wpLeaf),true))
    check(()=>assert.equal(leaves.includes(`${publicOrigin}/events-sitemap.xml`),false))
    documents.push({kind:'sitemapindex',xml:merged})
    const seenEventUrls=new Set()
    let childCount=0
    for (const loc of leaves) {
      const child=new URL(loc)
      check(()=>assert.equal(child.origin,publicOrigin))
      const response=await fetch(origin+child.pathname+child.search)
      const xml=await response.text()
      check(()=>assert.equal(response.status,200))
      check(()=>assert.match(response.headers.get('content-type'),/xml/))
      check(()=>assert.match(xml,/<urlset\b/))
      if (child.pathname === '/events-sitemap.xml') {
        childCount++
        check(()=>assert.equal(response.headers.get('cache-control'),'no-store'))
        for (const eventUrl of locs(xml)) {
          check(()=>assert.equal(seenEventUrls.has(eventUrl),false));seenEventUrls.add(eventUrl)
        }
      }
      documents.push({kind:'urlset',xml})
    }
    check(()=>assert.equal(childCount,256))
    check(()=>assert.ok(seenEventUrls.has(`${publicOrigin}/events/scheduled`)))
    const parsed=spawnSync('python3',['-c',`import json,sys,xml.etree.ElementTree as ET
ns='http://www.sitemaps.org/schemas/sitemap/0.9'
for doc in json.load(sys.stdin):
 root=ET.fromstring(doc['xml']);assert root.tag=='{'+ns+'}'+doc['kind']
 tag='sitemap' if doc['kind']=='sitemapindex' else 'url'
 for child in root:
  assert child.tag=='{'+ns+'}'+tag
  loc=child.find('{'+ns+'}loc');assert loc is not None and loc.text.startswith('https://myevy.app/')
print('XML documents validated')`],{input:JSON.stringify(documents),encoding:'utf8'})
    check(()=>assert.equal(parsed.status,0))
    for (const [query,status] of [
      ['partition=00',200],['partition=ff',200],['partition=%30%30',200],
      ['partition=00&partition=ff',400],['partition=00&partition=00',400],
      ['partition=%2530%2530',400],['partition=invalid',400],
      ['partition=00&unexpected=1',400],['partition=00&next=https%3A%2F%2Fevil.invalid',400],
    ]) {
      const path=`/events-sitemap.xml?${query}`
      const response=await fetch(origin+path,{redirect:'manual'})
      check(()=>assert.equal(response.status,status))
      check(()=>assert.equal(response.headers.get('location'),null))
      check(()=>assert.equal(forwarded.at(-1),path))
    }
    const zero=await(await fetch(`${origin}/events-sitemap.xml?partition=00`)).text()
    const ten=await(await fetch(`${origin}/events-sitemap.xml?partition=10`)).text()
    check(()=>assert.notEqual(zero,ten))
    const robots=await(await fetch(`${origin}/robots.txt`)).text()
    check(()=>assert.match(robots,/Sitemap: https:\/\/myevy.app\/sitemap.xml/))
    mode='dropQuery'
    const awaitedDropped=await(await fetch(`${origin}/events-sitemap.xml?partition=00`)).text()
    check(()=>assert.match(awaitedDropped,/<sitemapindex\b/))
    mode='missingChild'
    const missing=await fetch(`${origin}/events-sitemap.xml?partition=ff`)
    check(()=>assert.equal(missing.status,404))
    mode='upstream502'
    const failed=await fetch(`${origin}/events-sitemap.xml?partition=00`)
    check(()=>assert.equal(failed.status,502))
    mode='loop'
    const loop=await fetch(`${origin}/events-sitemap.xml?partition=00`,{redirect:'manual'})
    check(()=>assert.equal(loop.status,302))
    check(()=>assert.equal(loop.headers.get('location'),'/events-sitemap.xml?partition=00'))
    mode='nested'
    const nested=locs(await(await fetch(`${origin}/sitemap.xml`)).text())
    check(()=>assert.ok(nested.includes(`${publicOrigin}/events-sitemap.xml`)))
    // This deliberately incompatible root is recognized, never counted as leaf coverage.
    return {model:'local proxy only',children:childCount,xmlDocuments:documents.length,uniqueEventUrls:seenEventUrls.size,
      negativeModes:['dropQuery','missingChild','upstream502','redirectLoop','nestedIndex']}
  } finally {
    proxy.closeAllConnections()
    await new Promise(resolve=>proxy.close(resolve))
  }
}
