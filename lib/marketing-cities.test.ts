import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {marketingCities,getMarketingCity,matchesCity,normalizeCity} from './marketing-cities.ts';
import {readCitySelection,readMarketingEvents} from './marketing-events.ts';
import {publicEventFixture as base,FIXTURE_ANON_KEY} from './seo-fixtures.ts';
const now=new Date('2026-10-12T12:00:00Z');
function mock(rows:unknown[]|null) {
 const calls:URL[]=[];
 const db=createClient('https://fixture.supabase.co',FIXTURE_ANON_KEY,{auth:{persistSession:false},db:{retry:false},global:{fetch:async input=>{
   calls.push(new URL(String(input)));return Response.json(rows??{message:'unavailable'},{status:rows?200:503});
 }}});return {db,calls};
}
test('stable country-qualified identities normalize known aliases in all five languages',()=>{
 assert.equal(new Set(marketingCities.map(c=>c.id)).size,4);
 assert.equal(normalizeCity('  ZÜRICH '),'zurich');
 for(const c of marketingCities){for(const alias of c.aliases){assert.ok(matchesCity(c,' '+alias.toUpperCase()+' ','ch'));assert.ok(!matchesCity(c,alias,'FR'));}assert.equal(Object.keys(c.labels).length,5);}
 assert.ok(matchesCity(getMarketingCity('ch-geneve')!,'Genf','CH'));
 assert.ok(matchesCity(getMarketingCity('ch-neuchatel')!,'Neuchatel','CH'));
 assert.equal(getMarketingCity('ch-geneve,or(is_public.eq.false)'),undefined);
});
test('availability uses fixed minimal bounded probes; only selected city loads cards',async()=>{
 const {db,calls}=mock([base,{...base,city:'Genf'},{...base,city:'Geneva',country_code:'US'}]);
 const result=await readCitySelection(db,'https://fixture.supabase.co',now);
 assert.deepEqual(result.cities,['ch-lausanne','ch-geneve']);assert.equal(result.selectedCity,'ch-lausanne');assert.equal(result.events.length,1);
 assert.equal(calls.length,5);
 for(const q of calls.map(u=>u.searchParams)){
   assert.equal(q.get('limit'),q.get('select')?.includes('description')?'60':'12');assert.equal(q.get('country_code'),'ilike.CH');assert.equal(q.get('is_public'),'eq.true');
   assert.equal(q.get('ai_moderation_status'),'eq.approved');assert.equal(q.get('users.account_status'),'eq.active');
   assert.ok(q.getAll('or').some(v=>v.includes('recurrence_state')));assert.ok(q.getAll('or').some(v=>v.includes('city.ilike.')));
   assert.ok(q.getAll('or').some(v=>v.includes('end_date.gt.')));assert.equal(q.get('seo_slug'),'not.is.null');
 }
 for(const q of calls.slice(0,4))assert.doesNotMatch(q.searchParams.get('select')!,/image_url|description|event_ticket_types/);
});
test('empty Lausanne falls back in configured order; foreign names and ineligible cities never display',async()=>{
 const bad=[{...base,city:'Lausanne',country_code:'US'},{...base,is_public:false},{...base,ai_moderation_status:'pending'},{...base,users:{...base.users,account_status:'pending_deletion'}},{...base,recurrence_state:'excluded'},{...base,status:'cancelled'},{...base,end_date:'2020-01-01T00:00:00Z'},{...base,start_date:'2020-01-01T00:00:00Z'},{...base,seo_slug:'invalid/slug'},{...base,event_type:'meetup'}];
 const {db}=mock([...bad,{...base,city:'Zürich'},{...base,city:'Genève'}]);
 const result=await readCitySelection(db,'https://fixture.supabase.co',now);
 assert.deepEqual(result.cities,['ch-geneve','ch-zurich']);assert.equal(result.selectedCity,'ch-geneve');assert.equal(result.events.length,1);assert.equal(result.events[0].city,'Genève');
});
test('city fetch rechecks eligibility and never falls back to global events',async()=>{
 const {db,calls}=mock([base,{...base,city:'Zurich'},{...base,city:'Zurich',is_public:false},{...base,city:'Zurich',country_code:'US'}]);
 const result=await readMarketingEvents(db,'https://fixture.supabase.co',now,getMarketingCity('ch-zurich'));
 assert.equal(calls.length,1);assert.equal(result.events.length,1);assert.equal(result.events[0].city,'Zurich');
 assert.match(result.events[0].image!,/^https:\/\/myevy.app\/events\/[^/]+\/media\/cover$/);
 assert.doesNotMatch(JSON.stringify(result),/token=|ik-storage|creator_id/);
});
test('empty and failed availability remain distinct; no selected-city fetch when nothing is available',async()=>{
 for(const [rows,state] of [[[],'empty'],[null,'unavailable']] as const){const {db,calls}=mock(rows===null?null:[...rows]);const result=await readCitySelection(db,'https://fixture.supabase.co',now);assert.equal(result.state,state);assert.deepEqual(result.cities,[]);assert.equal(result.selectedCity,null);assert.equal(calls.length,4);}
});
