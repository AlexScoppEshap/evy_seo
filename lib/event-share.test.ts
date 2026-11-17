import assert from 'node:assert/strict'
import test from 'node:test'
import { sharePublicEvent } from './event-share.ts'
const event={title:'Public event',url:'https://myevy.app/events/existing-slug'}
test('native sharing receives only the public title and canonical URL', async()=>{
  let received:unknown
  assert.equal(await sharePublicEvent(event,{share:async data=>{received=data}}),'shared')
  assert.deepEqual(received,event)
})
test('user cancellation does not copy or launch a second share action',async()=>{
  let copied=false
  const result=await sharePublicEvent(event,{share:async()=>{const error=new Error('cancelled');error.name='AbortError';throw error},clipboard:{writeText:async()=>{copied=true}}})
  assert.equal(result,'cancelled');assert.equal(copied,false)
})
test('unsupported or failed native sharing falls back to explicit canonical link copying',async()=>{
  let copied=''
  assert.equal(await sharePublicEvent(event,{clipboard:{writeText:async text=>{copied=text}}}),'copied')
  assert.equal(copied,event.url)
  assert.equal(await sharePublicEvent(event,{}),'unavailable')
  assert.equal(await sharePublicEvent(event,{clipboard:{writeText:async()=>{throw Error('denied')}}}),'unavailable')
})

test('cross-realm or older-browser AbortError cancellation also has no clipboard side effect',async()=>{
  let copied=false
  const result=await sharePublicEvent(event,{share:async()=>{throw {name:'AbortError'}},clipboard:{writeText:async()=>{copied=true}}})
  assert.equal(result,'cancelled');assert.equal(copied,false)
})
