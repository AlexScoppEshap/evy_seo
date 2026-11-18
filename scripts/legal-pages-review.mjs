// Read-only checks against a local production build. No emails or external mutations.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.LEGAL_REVIEW_ORIGIN || 'http://127.0.0.1:3214';
assert.equal(new URL(origin).hostname, '127.0.0.1');
const evidence = JSON.parse(fs.readFileSync('docs/website-v2-mission4-3/content-evidence.json','utf8'));
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage();
const results=[];
try {
for (const [slug, source] of Object.entries(evidence)) {
  const redirect = await fetch(origin+'/'+slug+'?review=1',{redirect:'manual'});
  assert.equal(redirect.status,301,slug);
  assert.equal(new URL(redirect.headers.get('location'), origin).pathname,'/'+slug+'/');
  assert.equal(new URL(redirect.headers.get('location'), origin).search,'?review=1');
  const r=await page.goto(origin+'/'+slug+'/');assert.equal(r.status(),200,slug);
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),source.url);
  assert.equal(await page.locator('link[hreflang]').count(),0);
  assert.equal(await page.locator('h1').count(),1);
  const content=page.locator('.legal-document');
  const text=(await content.textContent()).replace(/\s+/g,' ').trim();
  assert.equal(crypto.createHash('sha256').update(text).digest('hex'),source.textSha256,slug+' full text');
  assert.deepEqual(await content.locator('a').evaluateAll(xs=>xs.map(x=>x.getAttribute('href'))),source.links);
  assert.equal(await content.locator('script,style,iframe,form,[onclick],[style]').count(),0);
  for(const href of source.links){
    if(href.startsWith('#')) assert.equal(await page.locator(`[id="${href.slice(1)}"]`).count(),1,slug+href);
    else if(href.startsWith('/')) assert.equal((await fetch(origin+href)).status,200,href);
  }
  for(const width of [390,1280]) {
    await page.setViewportSize({width,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),slug+' overflow '+width);
    assert.ok(await content.locator('h1').isVisible());
    if(slug==='privacy' && process.env.LEGAL_SCREENSHOT_DIR) await page.screenshot({path:`${process.env.LEGAL_SCREENSHOT_DIR}/privacy-${width}.png`,fullPage:false});
  }
  await page.keyboard.press('Control+Home');await page.goto(origin+'/'+slug+'/');await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'#main');
  results.push({slug,status:200,exactText:true,links:true,viewports:[390,1280]});
}
const download=await fetch(origin+'/download',{redirect:'manual'});assert.equal(download.status,301);
assert.equal((await fetch(origin+'/download/')).status,200);
assert.equal((await fetch(origin+'/events/not-a-real-event',{headers:{rsc:'1'}})).status,404);
assert.equal((await fetch(origin+'/events/test/',{redirect:'manual'})).status,308);
for(const lang of ['en','de','it','es']) assert.equal((await fetch(origin+'/'+lang+'/privacy')).status,404);
await page.goto(origin+'/contact-us/');assert.equal(await page.locator('form').count(),0);
assert.ok(await page.getByRole('link',{name:'Email info@myevy.app',exact:true}).isVisible());
console.log(JSON.stringify({results,contact:'Explicit email fallback; no sending endpoint or fake form',eventRsc404:true},null,2));
} finally {await browser.close();}
