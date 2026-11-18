// Local browser checks. Mocked city switches; no account or database writes.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.CITY_REVIEW_ORIGIN||'http://127.0.0.1:3214';
assert.equal(new URL(origin).hostname,'127.0.0.1');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
const fixtures=(city)=>Array.from({length:12},(_,i)=>({id:`fixture-${i}`,title:`Fixture ${city} ${i}`,url:`https://myevy.app/events/fixture-${i}`,image:null,start:'2027-01-01T20:00:00Z',timezone:'Europe/Zurich',city,category:null,price:null,multipleCurrencies:false}));
let requests=0,mode='normal';
await page.route('**/api/marketing/events?*',async route=>{
 requests++;const city=new URL(route.request().url()).searchParams.get('city');
 if(mode==='race'&&city==='ch-geneve')await new Promise(r=>setTimeout(r,400));
 if(mode==='empty'){await route.fulfill({json:{state:'empty',events:[]}});return;}
 if(mode==='error'){await route.fulfill({status:503,json:{state:'unavailable',events:[]}});return;}
 await route.fulfill({json:{state:'ready',events:fixtures(city==='ch-geneve'?'Genève':city==='ch-zurich'?'Zürich':'Lausanne')}});
});
try {
 await page.goto(origin);const pills=page.locator('.city-pills');await pills.waitFor();
 assert.equal(await pills.locator('button[aria-pressed=true]').innerText(),'Lausanne');assert.equal(requests,0);
 await pills.getByRole('button',{name:'Genève',exact:true}).click();await page.locator('.event-card h3').first().filter({hasText:'Genève'}).waitFor();
 assert.equal(requests,1);assert.equal(await pills.locator('button[aria-pressed=true]').innerText(),'Genève');
 const track=page.locator('.event-track');await track.scrollIntoViewIfNeeded();
 const rect=await track.boundingBox();const beforeURL=page.url();
 await page.mouse.move(rect.x+rect.width*.75,rect.y+100);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.2,rect.y+100,{steps:12});await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('.event-track').scrollLeft>100);
 assert.equal(page.url(),beforeURL,'drag must not navigate');assert.equal(requests,1);
 assert.equal(await track.evaluate(e=>e.hasAttribute('data-dragging')),false);
 await track.focus();await page.keyboard.press('Home');await page.waitForFunction(()=>document.querySelector('.event-track').scrollLeft<2);
 await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('.event-track').scrollLeft>100);
 await page.keyboard.press('End');await page.waitForFunction(()=>{const e=document.querySelector('.event-track');return e.scrollLeft>=e.scrollWidth-e.clientWidth-2;});
 await page.keyboard.press('Home');await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement.classList.contains('event-card')));
 assert.equal(await track.evaluate(e=>getComputedStyle(e).scrollBehavior),'auto');
 // A fresh ordinary click remains a link after the suppressed drag click.
 let clicked=false;await page.route('https://myevy.app/events/fixture-*',async r=>{clicked=true;await r.fulfill({body:'ordinary link navigation'});});
 await page.locator('.event-card').first().click();assert.ok(clicked);
 await page.goto(origin);await page.locator('.city-pills').waitFor();mode='race';
 await page.getByRole('button',{name:'Genève',exact:true}).click();await page.getByRole('button',{name:'Zürich',exact:true}).click();
 await page.locator('.event-card h3').first().filter({hasText:'Zürich'}).waitFor();
 await page.waitForTimeout(500);assert.match(await page.locator('.event-card h3').first().innerText(),/Zürich/);
 mode='error';await page.getByRole('button',{name:'Genève',exact:true}).click();await page.getByText('Les événements sont momentanément indisponibles.',{exact:false}).waitFor();assert.equal(await page.locator('.event-card').count(),0);
 mode='empty';await page.getByRole('button',{name:'Genève',exact:true}).click();await page.waitForFunction(()=>!Array.from(document.querySelectorAll('.city-pills button')).some(e=>e.textContent==='Genève'));
 assert.ok(await page.evaluate(()=>document.activeElement.hasAttribute('aria-busy')),'focus retained on results when city disappears');
 for(const [locale,label] of [['fr','Choisir une ville'],['en','Choose a city'],['de','Stadt auswählen'],['it','Scegli una città'],['es','Elige una ciudad']]){
   await page.goto(origin+(locale==='fr'?'/':'/'+locale));await page.getByRole('group',{name:label}).waitFor();
   await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 // Real Chromium touch scroll via DevTools input, with no custom touch handler.
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const touchPage=await mobile.newPage();await touchPage.goto(origin);const touchTrack=touchPage.locator('.event-track');await touchTrack.scrollIntoViewIfNeeded();
 const touchBox=await touchTrack.boundingBox();const cdp=await mobile.newCDPSession(touchPage);
 const y=Math.max(30,Math.min(700,touchBox.y+120));const initial=await touchTrack.evaluate(e=>e.scrollLeft);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:340,y}]});
 for(let x=320;x>=60;x-=20)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await touchPage.waitForFunction(start=>document.querySelector('.event-track').scrollLeft>start+50,initial);
 await mobile.close();
 console.log(JSON.stringify({result:'PASS',mouseDrag:true,dragClickSuppressed:true,ordinaryClick:true,keyboard:true,reducedMotion:true,touchScroll:true,citySwitch:true,requestRace:true,emptyAndError:true,languages:5,mobileWidth:390,scrollDataRequests:0},null,2));
}finally{await browser.close();}
