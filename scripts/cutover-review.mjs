// Local-only HTTP verification; redirects are never followed into recovery/OAuth.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SaxesParser } from 'saxes';
const origin=process.env.CUTOVER_REVIEW_ORIGIN || 'http://127.0.0.1:3214';
assert.equal(new URL(origin).hostname,'127.0.0.1');
const enabled=process.env.CUTOVER_EXPECT_INDEXING==='1';
const get=path=>fetch(origin+path,{redirect:'manual'});
let checks=0;
for(const name of ['apple-app-site-association','assetlinks.json']) {
 const r=await get('/.well-known/'+name);assert.equal(r.status,200);assert.equal(r.headers.get('location'),null);assert.match(r.headers.get('content-type'),/application\/json/);
 assert.deepEqual(await r.json(),JSON.parse(fs.readFileSync('content/associations/'+(name.endsWith('.json')?name:name+'.json'),'utf8')));
 const head=await fetch(origin+'/.well-known/'+name,{method:'HEAD',redirect:'manual'});assert.equal(head.status,200);checks+=5;
}
const query='?token=synthetic%2B%2f%3D&token=second&blank=&space=+&space=%20';
for(const path of ['/event/006e014a-b20b-40c6-b5c3-85e8907bbe92','/user/Fran%C3%A7ois','/account-recovery','/account-recovery/']) {
 for(const method of ['GET','HEAD']) {
 const r=await fetch(origin+path+query,{method,redirect:'manual'});assert.equal(r.status,307);assert.equal(r.headers.get('location'),'https://app.myevy.app'+path+query);
 assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.match(r.headers.get('x-robots-tag'),/noindex/);checks+=5;
 }
}
assert.equal((await fetch(origin+'/account-recovery',{method:'POST',redirect:'manual',body:'synthetic'})).status,405);
for(const path of ['/sitemap_index.xml','/wp-sitemap.xml']) {const r=await get(path);assert.equal(r.status,301);assert.equal(new URL(r.headers.get('location'),origin).pathname,'/sitemap.xml');checks+=2;}
const root=await get('/sitemap.xml');assert.equal(root.status,200);const xml=await root.text();new SaxesParser().write(xml).close();
assert.equal((xml.match(/<loc>/g)||[]).length,257);
for(let i=0;i<256;i++)assert.ok(xml.includes('?partition='+i.toString(16).padStart(2,'0')+'</loc>'));
const pagesResponse=await get('/page-sitemap.xml');assert.equal(pagesResponse.status,200);const pages=await pagesResponse.text();new SaxesParser().write(pages).close();assert.equal((pages.match(/<url>/g)||[]).length,enabled?34:0);checks+=261;
const locales=['fr','en','de','it','es'];const path=(l,p)=>l==='fr'&&p==='download'?'/download/':`${l==='fr'?'':'/'+l}${p?'/'+p:''}`||'/';
for(const l of locales)for(const p of ['','events','meetups','organizers','download']) {
 const url=path(l,p);const r=await get(url);assert.equal(r.status,200);assert.match(r.headers.get('x-robots-tag'),/noindex/,'loopback never indexable');const html=await r.text();
 assert.ok(html.includes(`rel="canonical" href="https://myevy.app${url}"`));
 assert.match(html,new RegExp(`<html[^>]*lang="${l}"`));assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.ok(html.includes(`<meta name="robots" content="${enabled?'index':'noindex'}, follow"`));
 for(const lang of locales)assert.ok(html.includes(`hrefLang="${lang}" href="https://myevy.app${path(lang,p)}"`));
 assert.ok(html.includes(`hrefLang="x-default" href="https://myevy.app${path('fr',p)}"`));
 for(const tag of ['og:title','og:description','og:url','og:image','og:locale'])assert.ok(html.includes(`property="${tag}"`));
 assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));checks+=18;
}
for(const slug of ['privacy','terms','legal','cookies','community-guidelines','child-safety','support','contact-us','account-deletion']) {
 const r=await get('/'+slug+'/');assert.equal(r.status,200);const html=await r.text();assert.ok(html.includes(`rel="canonical" href="https://myevy.app/${slug}/"`));assert.match(html,/<html[^>]*lang="en"/);
 assert.ok(html.includes(`<meta name="robots" content="${enabled?'index':'noindex'}, follow"`));assert.doesNotMatch(html,/<link[^>]+hrefLang=/);const slashless=await get('/'+slug);assert.equal(slashless.status,301);checks+=6;
}
const robots=await (await get('/robots.txt')).text();assert.ok(robots.includes(enabled?'Allow: /':'Disallow: /'));
const invalid=await get('/events/not-a-real-event');assert.equal(invalid.status,404);
console.log(JSON.stringify({mode:enabled?'production configuration on loopback':'preview/default',associationFiles:2,deepLinkCases:8,rootLeaves:257,pageUrls:enabled?34:0,marketingPages:25,legalPages:9,checks,result:'PASS',realRecoveryOrOAuth:false},null,2));
