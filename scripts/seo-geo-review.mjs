// Read-only checks against a local production build. No auth/recovery flows.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const origin=process.env.WEBSITE_REVIEW_ORIGIN??'http://127.0.0.1:3214';
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const unescape=s=>s.replaceAll('&amp;','&').replaceAll('&#x27;',"'").replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>');
const paths=['','meetups','organizers','download','events'];let checked=0;
for(const locale of ['fr','en','de','it','es']){
 const d=JSON.parse(await readFile(new URL(`../content/i18n/${locale}.json`,import.meta.url),'utf8'));
 for(const [i,page] of paths.entries()){
  const path=locale==='fr'?(page==='download'?'/download/':'/'+page):'/'+locale+(page?'/'+page:'');
  const r=await fetch(origin+path);assert.equal(r.status,200,path);assert.match(r.headers.get('x-robots-tag')??'',/noindex/);
  const html=await r.text();assert.equal(unescape(html.match(/<title>(.*?)<\/title>/s)?.[1]??''),d.metaTitles[i]);
  assert.equal(unescape(html.match(/<meta name="description" content="([^"]*)"/)?.[1]??''),d.meta[i]);
  assert.ok(html.includes(`rel="canonical" href="https://myevy.app${path}"`));
  assert.equal((html.match(/<h1\b/g)??[]).length,1);
  const schemas=[...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m=>JSON.parse(m[1]));
  const apps=schemas.flatMap(s=>s['@graph']??[s]).filter(s=>s['@type']==='MobileApplication');assert.equal(apps.length,page==='download'?2:0,path);
  if(page==='download')for(const app of apps){assert.equal(app.identifier,'com.eshap.evy');assert.doesNotMatch(JSON.stringify(app),/aggregateRating|offers|ratingValue|downloadCount/);}
  if(page==='meetups'){const steps=html.match(/<ol class="meetup-steps[^>]*>(.*?)<\/ol>/s)?.[1]??'';assert.equal((steps.match(/<h2\b/g)??[]).length,3);assert.doesNotMatch(steps,/<h3/);}
  assert.ok(!schemas.some(s=>s['@type']==='FAQPage'));
  checked++;
 }
}
const path='/events/jeudi-oui-neuchatel-neuchatel-ch-2026-e3ad19';
const r=await fetch(origin+path);assert.equal(r.status,200);const html=await r.text();
const event=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
assert.equal(event['@type'],'Event');assert.equal(event.organizer,undefined);assert.equal(event.url,'https://myevy.app'+path);
// This occurrence belongs to a series; it was not claimable before this change.
assert.ok(html.includes('Other dates'));assert.ok(!html.includes('Claim this event'));
assert.ok(!html.includes('>Evy Switzerland</'));
assert.ok(html.includes('Jeudi-Oui est une manifestation festive'));
assert.doesNotMatch(html,/ik-storage|private-token/);
const claimPage=await fetch(origin+'/events/english-stand-up-comedy-odd-wednesday-open-mic-lausanne-ch-2026-ebd910');
assert.equal(claimPage.status,200);const claimHtml=await claimPage.text();
assert.ok(claimHtml.includes('Claim this event'));assert.ok(claimHtml.includes('Publisher in Evy'));
console.log(JSON.stringify({claimCtaPreserved:true,result:'PASS',marketingRoutes:checked,downloadOnlySchema:true,meetupHeadingHierarchy:true,unverifiedOrganizerOmitted:true,recurringClaimRestrictionPreserved:true,importedDescriptionUntranslated:true,descriptionLanguage:'No reliable language field in current public contract; no inferred lang added.'},null,2));
