// Read-only HEAD counts. No private rows, SQL, writes or credential logging.
// Run with environment loaded securely; no keys/tokens in command history.
import { createClient } from '@supabase/supabase-js'
import { assertAnonymousKey, createPublicFetch } from '../lib/public-backend.ts'

const key=process.env.SUPABASE_ANON_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
assertAnonymousKey(key)
const db=createClient(process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL,key,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  db:{retry:false},global:{fetch:createPublicFetch()},
})
const results=[]
for(const[check,filter]of [
  ['public',q=>q.eq('is_public',true)],['private',q=>q.or('is_public.eq.false,is_public.is.null')],
  ['publication-null',q=>q.is('is_public',null)],
  ['excluded',q=>q.eq('recurrence_state','excluded')],
  ['public-null-slugs',q=>q.eq('is_public',true).is('seo_slug',null)],
  ['public-empty-slugs',q=>q.eq('is_public',true).eq('seo_slug','')],
]) {
  const response=await filter(db.from('events').select('id',{count:'exact',head:true}))
  results.push({check,status:response.status,count:response.count,failed:!!response.error})
}
console.log(JSON.stringify({mode:'read-only anonymous HEAD',rowsExported:0,checks:results},null,2))
if(results.some(result=>result.failed || !Number.isSafeInteger(result.count) || result.count < 0)) process.exitCode=1
// Exposure is a security audit outcome, not a silently successful release gate.
else if(results.find(result=>result.check==='private').count>0) process.exitCode=2
