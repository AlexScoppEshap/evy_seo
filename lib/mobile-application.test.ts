import test from 'node:test';
import assert from 'node:assert/strict';
import {mobileApplicationJsonLd} from './mobile-application.ts';
import {locales,STORE_URLS,marketingPath} from './i18n/config.ts';
test('download schema uses verified platform identities and store links without invented commercial claims',()=>{
 for(const locale of locales){
  const graph=mobileApplicationJsonLd(locale)['@graph'];
  assert.equal(graph.length,2);
  assert.deepEqual(graph.map(a=>a.operatingSystem),['iOS','Android']);
  assert.deepEqual(graph.map(a=>a.installUrl),[STORE_URLS.ios,STORE_URLS.android]);
  assert.equal(new Set(graph.map(a=>a['@id'])).size,2);
  for(const app of graph){assert.equal(app.identifier,'com.eshap.evy');assert.equal(app.url,'https://myevy.app'+marketingPath(locale,'download'));}
  assert.doesNotMatch(JSON.stringify(graph),/aggregateRating|review|offers|price|downloadCount/);
 }
});
