// Trusted local app and GENERATED PCM only. Same pinned, scripts-disabled toolkit
// as existing proof. Disabled-sandbox Linux Chromium is not native/security proof.
import * as fs from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { auditTools } from './run-offline-render-probe.mjs'
const tools = process.argv[2], audit = await auditTools(tools)
assert.equal(audit.packages, 43)
const output = path.resolve('docs/engineering/evidence/shell-integration-20261017/shell')
await fs.mkdir(output, { recursive: true })
const runtime = await fs.mkdtemp('/tmp/onverse-browser-runtime-'); await fs.chmod(runtime, 0o700)
const originalEnv = { ...process.env }, sha = bytes => createHash('sha256').update(bytes).digest('hex')
const report = { kind: 'actual-production-shared-shell-navigation-and-lifecycle', tools: audit, checks: [], errors: [], blocked: [], downloads: [], screenshots: [],
  limitations: ['Generated PCM only, no user audio or provider.', 'Disabled-sandbox headless Linux CPU raster, not Mac/Electron/security qualification.', 'Native source graph checked on isolated Vite4174; integrated UI checked on production4173 and file origin.', 'Not listening, metering certification, full DAW or owner cinematic acceptance.', 'Project downloads are not verified filesystem save receipts or autosave.'] }
let browser, page, failure
try {
  for (const key of Object.keys(process.env)) delete process.env[key]
  for (const dir of ['home','cache','profile','fonts','downloads']) await fs.mkdir(path.join(runtime, dir), { mode: 0o700 })
  Object.assign(process.env, { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', TZ: 'UTC', TMPDIR: runtime, HOME: path.join(runtime, 'home'), XDG_CACHE_HOME: path.join(runtime, 'cache'), FONTCONFIG_PATH: path.join(runtime, 'fonts') })
  assert.equal(tmpdir(), runtime)
  const cm = await import(pathToFileURL(path.join(tools, 'node_modules/@sparticuz/chromium/build/index.js')))
  await cm.inflate(path.join(tools, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br')); cm.setupLambdaEnvironment(path.join(runtime, 'al2023/lib'))
  const executablePath = await cm.default.executablePath(); assert.ok(executablePath.startsWith(runtime + '/'))
  const pm = await import(pathToFileURL(path.join(tools, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')))
  const gpu = new Set(['--ignore-gpu-blocklist','--in-process-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  browser = await pm.default.launch({ executablePath, headless: true, pipe: true, userDataDir: path.join(runtime, 'profile'), env: { ...process.env }, args: [...cm.default.args.filter(a => !gpu.has(a)), '--disable-gpu', '--disable-background-networking','--disable-component-update','--disable-domain-reliability','--disable-sync','--no-first-run','--no-default-browser-check','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] })
  report.browser = await browser.version(); page = await browser.newPage()
  page.on('pageerror', error => report.errors.push(error.message)); page.on('dialog', dialog => dialog.accept())
  await page.setRequestInterception(true)
  const fileUrl = new URL('../../dist/index.html', import.meta.url).href
  page.on('request', request => {
    const u = request.url()
    if (u.startsWith('http://127.0.0.1:4173/') || u.startsWith('http://127.0.0.1:4174/') || u === fileUrl || u.startsWith('data:') || u.startsWith('blob:')) void request.continue()
    else { report.blocked.push(u); void request.abort() }
  })
  await page.evaluateOnNewDocument(() => {
    window.__dawAudioAudit = { contexts: 0, closes: 0, offline: 0, starts: [] }
    const Native = AudioContext, Offline = OfflineAudioContext
    window.AudioContext = class extends Native {
      constructor(...args) { super(...args); window.__dawAudioAudit.contexts++ }
      createBufferSource() { const node = super.createBufferSource(), start = node.start.bind(node); node.start = (...args) => { window.__dawAudioAudit.starts.push(args); return start(...args) }; return node }
      close() { window.__dawAudioAudit.closes++; return super.close() }
    }
    window.OfflineAudioContext = class extends Offline { constructor(...args) { super(...args); window.__dawAudioAudit.offline++ } }
  })
  await page.evaluateOnNewDocument(() => {
    const active = new Set(), frames = new Set(), add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      const capture = typeof options === 'boolean' ? options : !!options?.capture
      if (listener && !options?.signal?.aborted && ![...active].some(r => r.target === this && r.type === type && r.listener === listener && r.capture === capture)) {
        const record = { target: this, type, listener, capture }; active.add(record)
        if (options?.signal) add.call(options.signal, 'abort', () => active.delete(record), { once: true })
      }
      return add.call(this, type, listener, options)
    }
    EventTarget.prototype.removeEventListener = function(type, listener, options) {
      for (const r of active) if (r.target === this && r.type === type && r.listener === listener && r.capture === (typeof options === 'boolean' ? options : !!options?.capture)) active.delete(r)
      return remove.call(this, type, listener, options)
    }
    const request = requestAnimationFrame, cancel = cancelAnimationFrame
    window.requestAnimationFrame = callback => { const id = request(time => { frames.delete(id); callback(time) }); frames.add(id); return id }
    window.cancelAnimationFrame = id => { frames.delete(id); return cancel(id) }
    window.__shellAudit = () => ({ listeners: active.size, frames: frames.size, globalListeners: [...active].filter(r => r.target === window || r.target === document).length })
  })
  const nav = async destination => { await page.click(`[data-destination="${destination}"]`); await page.waitForFunction(d => document.querySelector('.workspace-root').dataset.editor === d, {}, destination); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))) }
  async function capture(name, width, height) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 }); await page.evaluate(() => scrollTo(0, 0)); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
    const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, clipped: [...document.querySelectorAll('button,input,select')].filter(el => el.getClientRects().length && !el.closest('.daw-timeline') && (el.getBoundingClientRect().left < 0 || el.getBoundingClientRect().right > innerWidth + 1)).map(el => el.outerHTML), environmentCount: document.querySelectorAll('.environment').length, navigationCount: document.querySelectorAll('nav').length, destination: document.querySelector('.workspace-root').dataset.editor, companion: document.querySelector('#sylune-panel').hidden ? null : { position:getComputedStyle(document.querySelector('#sylune-panel')).position, bottom:document.querySelector('#sylune-panel').getBoundingClientRect().bottom, right:document.querySelector('#sylune-panel').getBoundingClientRect().right } }))
    assert.ok(layout.scrollWidth <= width, JSON.stringify(layout)); assert.deepEqual(layout.clipped, []); assert.equal(layout.environmentCount, 1); assert.equal(layout.navigationCount, 1); if (layout.companion) { assert.equal(layout.companion.position,'fixed'); assert.ok(layout.companion.bottom <= height); assert.ok(layout.companion.right <= width) }
    const file = `${name}-${width}x${height}.png`; await page.screenshot({ path: path.join(output, file.replace('.png', '-viewport.png')), fullPage: false }); await page.screenshot({ path: path.join(output, file), fullPage: true }); report.screenshots.push({ file, ...layout })
  }
  async function performanceProbe(destination) {
    report.performance ??= { budget: { sampleMs:5000,maxP95FrameMs:50,minAverageFps:30 }, samples:[] }
    for (const [width,height] of [[1120,700],[1480,920]]) {
      await page.setViewport({width,height}); await page.mouse.move(0,0)
      const timing = await page.evaluate(sampleMs => new Promise(resolve => {
        const frames=[]; let start,prior
        const tick=now=>{start??=now;if(prior!==undefined)frames.push(now-prior);prior=now;if(now-start<sampleMs)return requestAnimationFrame(tick);const sorted=[...frames].sort((a,b)=>a-b);resolve({count:frames.length,elapsedMs:now-start,averageFps:frames.length*1000/(now-start),p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1),over50Ms:frames.filter(t=>t>50).length})};requestAnimationFrame(tick)
      }),report.performance.budget.sampleMs)
      report.performance.samples.push({destination,width,height,...timing})
      assert.ok(timing.p95Ms<=report.performance.budget.maxP95FrameMs,JSON.stringify(timing));assert.ok(timing.averageFps>=report.performance.budget.minAverageFps,JSON.stringify(timing))
    }
  }
  await page.setViewport({ width: 1480, height: 920 }); await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle0' })
  assert.equal(await page.$eval('.workspace-root', el => el.dataset.editor), 'opening')
  await page.waitForFunction(() => document.querySelector('.workspace-root').dataset.journeyPhase === 'drift')
  await page.evaluate(() => { window.__scene = document.querySelector('.environment'); window.__trackView = document.querySelector('.daw-arrangement'); window.__workbenchView = document.querySelector('.studio-grid') })
  for (const size of [[1480,920],[390,844]]) await capture('opening', ...size)
  assert.equal(await page.evaluate(() => window.__dawAudioAudit.contexts), 0)
  await performanceProbe('opening')
  report.checks.push('Real entry opens Home, settles baseline launch/arrival/drift cue, and creates no startup AudioContext; desktop/mobile responsive opening.')
  await nav('workbench'); await page.click('[data-action="demo"]')
  await page.waitForFunction(() => /Demo/.test(document.querySelector('.source-name').textContent) && !document.querySelector('[data-action="fix"]').disabled, { timeout: 60000 })
  const source = await page.$eval('.source-name', el => el.textContent)
  for (const size of [[1480,920],[390,844]]) await capture('workbench', ...size)
  await nav('daw'); await page.click('[data-daw="demo"]'); await page.waitForFunction(() => document.querySelectorAll('.daw-track-row').length === 3 && !document.querySelector('[data-daw="demo"]').disabled)
  await page.$eval('.daw-project-name', el => { el.value = 'Shared-shell proof'; el.dispatchEvent(new Event('change', { bubbles: true })) })
  await page.$eval('.daw-zoom', el => { el.value = '100'; el.dispatchEvent(new Event('input', { bubbles: true })) })
  for (const size of [[1480,920],[390,844]]) await capture('daw', ...size)
  await performanceProbe('daw')
  await page.click('.sylune-toggle'); assert.match(await page.$eval('#sylune-panel', el => el.textContent), /Not connected/)
  assert.match(await page.$eval('.sylune-context', el => el.textContent), /Shared-shell proof · 3 audio tracks/)
  for (const size of [[1480,920],[390,844]]) await capture('sylune', ...size)
  await page.setViewport({ width: 1120, height: 700 }); await capture('sylune-daw', 1120,700)
  await nav('workbench'); await capture('sylune-workbench',1120,700); assert.match(await page.$eval('.sylune-context', el => el.textContent), /Demo/)
  await page.focus('#sylune-title'); const beforeSpace = await page.evaluate(() => window.__dawAudioAudit.starts.length); await page.keyboard.press('Space'); assert.equal(await page.evaluate(() => window.__dawAudioAudit.starts.length), beforeSpace)
  await page.keyboard.press('Escape'); assert.equal(await page.$eval('.sylune-toggle', el => el.getAttribute('aria-expanded')), 'false'); assert.equal(await page.evaluate(() => document.activeElement.className), 'sylune-toggle')
  report.checks.push('Desktop/mobile Home, loaded workbench, actual3-track DAW and single visibly unconnected Sylune screenshots. Context follows destination; Space in help does not start playback; Escape closes and restores focus.1120px open-panel layouts fit without document overflow.')
  await nav('daw'); await page.click('[data-daw="play"]'); await page.waitForFunction(() => document.querySelector('[data-daw="play"]').getAttribute('aria-label') === 'Pause arrangement')
  await nav('opening'); assert.equal(await page.$eval('[data-daw="play"]',el=>el.getAttribute('aria-label')), 'Play arrangement')
  await page.evaluate(() => document.body.focus()); const beforeHomeSpace = await page.evaluate(() => window.__dawAudioAudit.starts.length); await page.keyboard.press('Space'); assert.equal(await page.evaluate(() => window.__dawAudioAudit.starts.length), beforeHomeSpace)
  await nav('daw'); const baseline = await page.evaluate(() => window.__shellAudit())
  for (let n = 0; n < 6; n++) for (const destination of ['workbench','opening','daw']) await nav(destination)
  const after = await page.evaluate(() => window.__shellAudit()); assert.equal(after.listeners, baseline.listeners); assert.equal(after.globalListeners,baseline.globalListeners)
  assert.equal(await page.$eval('.daw-project-name',el=>el.value),'Shared-shell proof'); assert.equal(await page.$$eval('.daw-track-row', rows=>rows.length),3); assert.equal(await page.$eval('.daw-zoom',el=>el.value),'100'); assert.equal(await page.$eval('.source-name',el=>el.textContent),source)
  assert.equal(await page.evaluate(() => window.__scene === document.querySelector('.environment') && window.__trackView === document.querySelector('.daw-arrangement') && window.__workbenchView === document.querySelector('.studio-grid')),true)
  report.navigation = { baseline, after, transitions:18 }; report.checks.push('18 real navigation transitions retain identical environment and destination DOM, source,3-track project and zoom. Listener count does not grow; navigation pauses outgoing audio; hidden destinations do not receive playback shortcuts.')
  const contexts = await page.evaluate(() => ({...window.__dawAudioAudit}))
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})))
  assert.equal(await page.evaluate(() => window.__dawAudioAudit.closes), contexts.closes)
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})))
  await nav('workbench'); assert.equal(await page.$eval('.source-name',el=>el.textContent),source); await nav('daw'); assert.equal(await page.$$eval('.daw-track-row',rows=>rows.length),3)
  report.checks.push('Synthetic persisted pagehide/pageshow preserves controllers, project and source and does not close retained contexts; this is lifecycle-event proof, not native BFCache qualification.')
  await page.emulateMediaFeatures([{ name:'prefers-reduced-motion',value:'reduce' }]); await nav('opening')
  const reduced = await page.evaluate(() => ({ phase:document.querySelector('.workspace-root').dataset.journeyPhase, animations:document.getAnimations().filter(a=>a.playState==='running').length }))
  assert.equal(reduced.phase,'drift'); assert.equal(reduced.animations,0); report.reducedMotion = reduced
  await page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent('pagehide')); window.dispatchEvent(new PageTransitionEvent('pagehide')) })
  await page.waitForFunction(() => window.__dawAudioAudit.closes === window.__dawAudioAudit.contexts && window.__shellAudit().frames===0)
  report.cleanup = await page.evaluate(() => ({ ...window.__shellAudit(), ...window.__dawAudioAudit, shells:document.querySelectorAll('.application-navigation,#sylune-panel,.cosmic-opening').length }))
  assert.equal(report.cleanup.shells,0); assert.equal(report.cleanup.globalListeners,0); assert.equal(report.cleanup.listeners,0)
  report.checks.push('Reduced motion settles immediately and runs zero CSS animations. Repeated nonpersisted pagehide is idempotent: every created AudioContext closed, all audited listeners and pending rAFs removed, shell nodes removed.')
  assert.deepEqual(report.errors, []); assert.deepEqual(report.blocked, []); report.status = 'PASS'
} catch (error) { failure = error; report.status = 'FAIL'; report.failure = { message: error.message, stack: error.stack } }
finally {
  if (browser) await browser.close()
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, originalEnv)
  report.codeSha256 = {}
  for (const file of ['src/main.js','src/ui/shell/applicationShell.js','src/ui/shell/applicationShell.css','src/application/shell/destinationLifecycle.js','src/ui/daw/arrangement.js','src/ui/workbench/workspace.js','scripts/validation/run-shell-browser.mjs']) report.codeSha256[file] = sha(await fs.readFile(new URL('../../'+file,import.meta.url)))
  report.buildSha256 = sha(await fs.readFile(new URL('../../dist/index.html', import.meta.url)))
  await fs.writeFile(path.join(output, 'browser.json'), JSON.stringify(report, null, 2) + '\n')
}
console.log(JSON.stringify({ status: report.status, checks: report.checks.length, output, failure: report.failure }, null, 2))
if (failure) throw failure
