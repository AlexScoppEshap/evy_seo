import test from 'node:test';
import assert from 'node:assert/strict';
import { deepLinkDestination } from './deep-link-compat.ts';
import { productionIndexingEnabled, requestIndexingEnabled } from './seo-launch.ts';
import { sitePageUrls, siteIndexXml, sitePagesXml, sitemapResponse, legacySitemapRedirect } from './site-sitemap.ts';
import { SaxesParser } from 'saxes';
const launch: NodeJS.ProcessEnv = {NODE_ENV:'production', VERCEL_ENV:'production', EVY_PUBLIC_INDEXING:'enabled', EVY_SITE_ORIGIN:'https://myevy.app'};
test('launch is explicit and preview/development fail closed even with copied flags', () => {
  assert.equal(productionIndexingEnabled(launch),true);
  for(const env of [{}, {...launch, VERCEL_ENV:'preview'}, {...launch, VERCEL_ENV:'development'}, {...launch, NODE_ENV:'development'}, {...launch, EVY_PUBLIC_INDEXING:undefined}, {...launch, EVY_SITE_ORIGIN:'https://preview.vercel.app'}]) {
    assert.equal(productionIndexingEnabled(env),false);
    assert.deepEqual(sitePageUrls(env),[]);
  }
  for(const host of ['preview.vercel.app','seo.myevy.app','myevy.app.evil.example','localhost']) assert.equal(requestIndexingEnabled('https://'+host,launch),false);
  assert.equal(requestIndexingEnabled('https://myevy.app/',launch),true);
});
test('production inventory has 25 marketing and nine canonical English legal URLs only', () => {
  const urls=sitePageUrls(launch);assert.equal(urls.length,34);assert.equal(new Set(urls).size,34);
  assert.ok(urls.includes('https://myevy.app/download/'));assert.ok(urls.includes('https://myevy.app/privacy/'));
  assert.ok(!urls.some(u=>u.includes('/en/privacy')||u.includes('/account-recovery')||u.includes('vercel.app')));
  for(const xml of [siteIndexXml(),sitePagesXml(launch),sitePagesXml({})]) new SaxesParser().write(xml).close();
  const index=siteIndexXml();assert.equal((index.match(/<loc>/g)||[]).length,257);
  for(let n=0;n<256;n++) assert.ok(index.includes('?partition='+n.toString(16).padStart(2,'0')+'</loc>'));
  assert.doesNotMatch(index, /<loc>[^<]*\/(sitemap_index|wp-sitemap)\.xml/);
  assert.doesNotMatch(sitePagesXml({}), /<url>/);
});
test('legacy sitemap indexes redirect to one authority and reject unsupported queries', () => {
  for(const path of ['sitemap_index.xml','wp-sitemap.xml']) {
    const response=legacySitemapRedirect(new Request('https://myevy.app/'+path));assert.equal(response.status,301);assert.equal(response.headers.get('location'),'/sitemap.xml');
    assert.equal(legacySitemapRedirect(new Request('https://myevy.app/'+path+'?x=1')).status,400);
  }
  assert.equal(sitemapResponse(new Request('https://myevy.app/sitemap.xml?x=1'),siteIndexXml).status,400);
});
test('deep links retain raw escaping, duplicate query parameters and only the fixed Flutter destination', () => {
  const query='?token=synthetic%2B%2f%3D&token=second&empty=&space=+&q=%20&next=https%3A%2F%2Fevil.example';
  for(const path of ['/event/006e014a-b20b-40c6-b5c3-85e8907bbe92','/user/Fran%C3%A7ois','/account-recovery','/account-recovery/']) {
    assert.equal(deepLinkDestination('https://myevy.app'+path+query),'https://app.myevy.app'+path+query);
  }
  for(const path of ['/events/slug','/event/not-a-uuid','/user/','/user/a/extra','//evil.example/account-recovery','/account-recovery/extra']) assert.equal(deepLinkDestination('https://myevy.app'+path),null);
});
