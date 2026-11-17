// Local UI review against scripts/seo-detail-preview.mjs. No production writes.
// Uses an isolated Chrome profile and CDP; no dependency or signed-in browser.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const origin = process.env.SEO_DETAIL_REVIEW_ORIGIN ?? 'http://127.0.0.1:3211'
assert.equal(new URL(origin).hostname, '127.0.0.1', 'Review only the isolated local preview')
const output = resolve(process.env.SEO_DETAIL_REVIEW_OUTPUT ?? '/tmp/evy-seo-browser-review')
await mkdir(output, { recursive: true })
const profile = await mkdtemp(join(tmpdir(), 'evy-seo-browser-review-'))
const chrome = spawn(process.env.CHROME_BINARY ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${profile}`, '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', 'about:blank',
], { stdio: 'ignore' })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const report = { mode: 'local sample data, isolated headless Chrome', assertions: 0, pages: [], interactions: [], errors: [] }
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); report.assertions++ }
let socket
try {
  let port
  for (let attempt = 0; attempt < 100; attempt++) {
    try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break } catch { await delay(100) }
  }
  assert.ok(port, 'Isolated Chrome debug endpoint did not start')
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  let sequence = 0
  const pending = new Map()
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data))
    if (message.id) {
      const task = pending.get(message.id)
      if (task) {
        clearTimeout(task.timeout); pending.delete(message.id)
        if (message.error) task.reject(Error(JSON.stringify(message.error)))
        else task.resolve(message.result)
      }
    } else if (message.method === 'Runtime.exceptionThrown') {
      report.errors.push(message.params.exceptionDetails.text)
    }
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence
    const timeout = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout: ${method}`)) }, 15000)
    pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw Error(result.exceptionDetails.text)
    return result.result.value
  }
  await send('Page.enable'); await send('Runtime.enable')
  const visit = async (slug, width, height) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 640 })
    await send('Page.navigate', { url: `${origin}/events/${slug}` })
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(`document.readyState === 'complete' && !!document.querySelector('h1') && location.pathname === '/events/${slug}'`)) break
      await delay(100)
    }
    await evaluate(`(async()=>{await document.fonts.ready; await Promise.all([...document.images].map(async image=>{image.loading='eager';try{await image.decode()}catch{}}));return true})()`)
    await delay(300)
    const result = await evaluate(`({title:document.querySelector('h1')?.textContent,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,brokenImages:[...document.images].filter(image=>!image.complete||!image.naturalWidth).map(image=>new URL(image.src).pathname),headingCount:document.querySelectorAll('h1').length,canonical:document.querySelector('link[rel="canonical"]')?.href})`)
    check(result.width, width, 'Requested viewport must be the actual CSS viewport')
    check(result.scrollWidth <= width + 1, true, 'No horizontal page overflow')
    check(result.headingCount, 1, 'One H1')
    check(result.brokenImages, [], 'All visible and gallery image sources load')
    check(result.canonical, `https://myevy.app/events/${slug}`, 'Canonical domain preserved')
    if (await evaluate(`!!document.querySelector('[aria-roledescription="carousel"] [aria-live="polite"]')`)) {
      check(await evaluate(`document.querySelector('[aria-roledescription="carousel"] [aria-live="polite"]').getBoundingClientRect().top>document.querySelector('summary[aria-label="More actions"]').getBoundingClientRect().bottom`), true, 'Hero counter does not overlap header actions')
    }
    report.pages.push({ slug, viewport: { width, height }, ...result })
  }
  const screenshot = async name => {
    await evaluate('window.scrollTo(0,0)')
    const { cssContentSize } = await send('Page.getLayoutMetrics')
    const capture = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 } })
    await writeFile(join(output, name), Buffer.from(capture.data, 'base64'))
  }
  await visit('detail-demo', 390, 844)
  await evaluate(`document.querySelector('[data-event-map]').scrollIntoView({block:'center'})`)
  for(let attempt=0;attempt<100;attempt++){
    if(await evaluate(`document.querySelector('[data-event-map]').dataset.eventMap==='ready'`))break
    await delay(100)
  }
  check(await evaluate(`document.querySelector('[data-event-map]').dataset.eventMap`),'ready','Lazy map loads only through same-origin tile routes')
  check(await evaluate(`document.querySelectorAll('[data-event-map] img[src*="/map/tile-"]').length`),8,'Map has eight bounded raster tiles')
  check(await evaluate(`document.querySelector('[data-event-map]').textContent.includes('OpenStreetMap contributors')`),true,'Map attribution remains visible')
  check(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,'Clipped map grid never overflows mobile viewport')
  await screenshot('detail-mobile-390.png')
  check(await evaluate(`(()=>{document.querySelector('button[aria-label="Next photo"]').click();return true})()`), true, 'Hero next button available')
  await delay(600)
  check(await evaluate(`document.querySelector('[aria-roledescription="carousel"] [aria-live="polite"]').textContent`), '2 / 3', 'Hero advances after hydration')
  check(await evaluate(`(()=>{document.querySelector('[aria-labelledby="event-photos"] a').click();return document.querySelector('dialog[open]')!==null})()`), true, 'Gallery opens a modal')
  check(await evaluate(`(()=>{const dialog=document.querySelector('dialog[open]');[...dialog.querySelectorAll('button')].find(button=>button.textContent==='Next').click();return true})()`), true, 'Gallery next button works')
  await delay(100)
  check(await evaluate(`document.querySelector('dialog[open] p').textContent.includes('2 / 3')`), true, 'Gallery advances within current event')
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  check(await evaluate(`document.querySelector('dialog[open]')===null`), true, 'Escape closes gallery')
  check(await evaluate(`(()=>{document.querySelector('[aria-labelledby="participant-photos"] figure a').click();return !!document.querySelector('dialog[open]')})()`), true, 'Public approved participant photo opens viewer')
  await delay(100)
  check(await evaluate(`document.querySelector('dialog[open] img').getAttribute('src').endsWith('/participant-media/photo-0')`), true, 'Participant viewer uses reauthorized full image endpoint')
  await evaluate(`document.querySelector('dialog[open]').close()`)
  check(await evaluate(`(()=>{const details=[...document.querySelectorAll('details')].find(element=>element.querySelector('summary')?.textContent.includes('Read more'));details.querySelector('summary').click();return details.open})()`), true, 'Long description expands')
  check(await evaluate(`(()=>{const summary=document.querySelector('summary[aria-label="Share event"]');summary.click();return summary.parentElement.open})()`), true, 'Share menu opens')
  check(await evaluate(`(()=>{const button=document.querySelector('summary[aria-label="Share event"]').getBoundingClientRect();const menu=document.querySelector('summary[aria-label="Share event"]').nextElementSibling.getBoundingClientRect();return button.right<=innerWidth&&menu.left>=0&&menu.right<=innerWidth})()`), true, 'Share menu fits mobile viewport')
  await evaluate(`document.querySelector('summary[aria-label="Share event"]').click()`)
  check(await evaluate(`(()=>{const link=[...document.querySelectorAll('a')].find(element=>element.textContent.trim()==='Open in Evy'&&getComputedStyle(element.parentElement).position==='fixed');return !!link&&link.getBoundingClientRect().bottom<=innerHeight})()`), true, 'Mobile Open in Evy remains visible')
  report.interactions.push('hero next', 'gallery next and Escape', 'participant photo viewer', 'Read more', 'Share menu mobile fit', 'fixed mobile Open in Evy')
  await visit('series-demo', 430, 932)
  check(await evaluate(`!!document.querySelector('[aria-labelledby="other-dates"] a[href="https://myevy.app/events/next-demo"]')`), true, 'Other dates use concrete canonical slug')
  check(await evaluate(`document.body.textContent.includes('Claim this event')`), false, 'Recurring occurrence cannot be claimed')
  await screenshot('series-mobile-430.png')
  await visit('meetup-demo', 390, 844)
  check(await evaluate(`[...document.images].some(image=>image.src.includes('/_next/static/media/outdoor_nature-')&&image.naturalWidth>0)`), true, 'Original decorative Meetup illustration loads through _next')
  check(await evaluate(`document.body.textContent.includes('Tickets')||document.body.textContent.includes('Get tickets')`), false, 'Meetup has cost, no ticket workflow')
  await screenshot('meetup-mobile-390.png')
  await visit('detail-demo', 1280, 900)
  await screenshot('detail-desktop-1280.png')
  await send('Network.enable')
  await send('Network.setBlockedURLs',{urls:['*/map/tile-*']})
  await visit('meetup-demo',390,844)
  await evaluate(`document.querySelector('[data-event-map]').scrollIntoView({block:'center'})`)
  for(let attempt=0;attempt<100;attempt++){
    if(await evaluate(`document.querySelector('[data-event-map]').dataset.eventMap==='error'`))break
    await delay(100)
  }
  check(await evaluate(`document.querySelector('[data-event-map]').dataset.eventMap`),'error','Tile failure produces the usable fallback')
  check(await evaluate(`!!document.querySelector('[data-event-map] a[aria-label="Open map and directions"]')`),true,'Directions remain available after map failure')
  check(await evaluate(`document.querySelectorAll('[data-event-map] img[src*="/map/tile-"]').length`),0,'Failed map removes incomplete tiles and location pin')
  await send('Network.setBlockedURLs',{urls:[]})
  check(report.errors, [], 'No uncaught browser exceptions')
  await writeFile(join(output, 'browser-review.json'), JSON.stringify(report, null, 2)+'\n')
  console.log(JSON.stringify({ ...report, screenshotDirectory: output }, null, 2))
} finally {
  socket?.close(); chrome.kill('SIGTERM')
  await delay(300)
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {})
}
