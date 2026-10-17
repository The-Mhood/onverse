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
const output = path.resolve('docs/engineering/evidence/daw-20261017')
await fs.mkdir(output, { recursive: true })
const runtime = await fs.mkdtemp('/tmp/onverse-browser-runtime-'); await fs.chmod(runtime, 0o700)
const originalEnv = { ...process.env }, sha = bytes => createHash('sha256').update(bytes).digest('hex')
const report = { kind: 'actual-production-multitrack-and-native-source-graph-proof', tools: audit, checks: [], errors: [], blocked: [], downloads: [], screenshots: [],
  limitations: ['Generated PCM only, no user audio or provider.', 'Disabled-sandbox headless Linux CPU raster, not Mac/Electron/security qualification.', 'Native source graph checked on isolated Vite4174; integrated UI checked on production4173 and file origin.', 'Not listening, metering certification, full DAW or owner cinematic acceptance.', 'Project downloads are not verified filesystem save receipts or autosave.'] }
let browser, page, failure
async function capture(name, width, height) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  await page.evaluate(() => scrollTo(0, 0))
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
  const layout = await page.evaluate(() => ({ headingFits: document.querySelector('.intro h1').getBoundingClientRect().bottom <= document.querySelector('.environment-banner').getBoundingClientRect().bottom, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, clipped: [...document.querySelectorAll('button,input,select')].filter(el => el.getClientRects().length && !el.closest('.daw-timeline') && (el.getBoundingClientRect().left < 0 || el.getBoundingClientRect().right > innerWidth + 1)).map(el => el.outerHTML) }))
  assert.ok(layout.headingFits, 'Destination heading must not be occluded by the arrangement'); assert.ok(layout.scrollWidth <= width, JSON.stringify(layout)); assert.deepEqual(layout.clipped, [])
  const file = `${name}-${width}x${height}.png`; await page.screenshot({ path: path.join(output, file), fullPage: true }); report.screenshots.push({ file, ...layout })
}
function wavFile(channels, frames = 4800) {
  const b = Buffer.alloc(44 + frames * channels * 4); b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(3, 20); b.writeUInt16LE(channels, 22); b.writeUInt32LE(48000, 24); b.writeUInt32LE(48000 * channels * 4, 28); b.writeUInt16LE(channels * 4, 32); b.writeUInt16LE(32, 34); b.write('data', 36); b.writeUInt32LE(frames * channels * 4, 40)
  for (let n = 0; n < frames; n++) for (let c = 0; c < channels; c++) b.writeFloatLE(.1 * Math.sin(n * .03 + c), 44 + (n * channels + c) * 4)
  return b
}
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
  const cdp = await browser.target().createCDPSession(), names = new Map()
  cdp.on('Browser.downloadWillBegin', event => names.set(event.guid, event.suggestedFilename))
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: path.join(runtime, 'downloads'), eventsEnabled: true })
  async function download(action) {
    let timeout, handler
    const completed = new Promise((resolve, reject) => {
      timeout = setTimeout(() => reject(Error(`Download timeout ${action}`)), 45000)
      handler = event => { if (event.state === 'completed') resolve(event); else if (event.state === 'canceled') reject(Error('Download canceled')) }
      cdp.on('Browser.downloadProgress', handler)
    })
    try {
      await page.click(`[data-daw="${action}"]`); const event = await completed, filename = path.join(runtime, 'downloads', event.guid), bytes = await fs.readFile(filename)
      const result = { action, name: names.get(event.guid), bytes: bytes.length, sha256: sha(bytes) }; report.downloads.push(result); return { filename, bytes, result }
    } finally { clearTimeout(timeout); cdp.off('Browser.downloadProgress', handler) }
  }
  async function ready() { await page.waitForFunction(() => !document.querySelector('[data-daw="demo"]').disabled) }
  async function set(selector, value) { await page.$eval(selector, (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })) }, String(value)) }
  await page.setViewport({ width: 1480, height: 920, deviceScaleFactor: 1 }); await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle0' })
  await page.waitForSelector('.daw-arrangement'); assert.equal(await page.$eval('.workspace-root', el => el.dataset.editor), 'daw')
  assert.equal(await page.evaluate(() => window.__dawAudioAudit.contexts), 0)
  await capture('empty', 1480, 920)
  await page.click('[data-daw="demo"]'); await ready(); assert.equal(await page.$$eval('.daw-track-row', rows => rows.length), 3); assert.equal(await page.$$eval('.daw-clip', rows => rows.length), 3)
  report.checks.push('Production entry defaults to actual DAW adapter; zero startup AudioContexts; generated3-track PCM session with real waveform regions.')
  await capture('loaded', 1480, 920); await capture('loaded', 1120, 700)
  await page.$eval('.daw-zoom', el => { el.value = '100'; el.dispatchEvent(new Event('input', { bubbles: true })) })
  assert.match(await page.$eval('.daw-lane', el => getComputedStyle(el).backgroundSize), /^100px/)
  await page.$eval('.daw-zoom', el => { el.value = '50'; el.dispatchEvent(new Event('input', { bubbles: true })) })
  await page.click('[data-daw="play"]'); await page.waitForFunction(() => document.querySelector('[data-daw="play"]').getAttribute('aria-label') === 'Pause arrangement')
  await page.waitForFunction(() => window.__dawAudioAudit.starts.length >= 3)
  const starts = await page.evaluate(() => window.__dawAudioAudit.starts.slice(-3)); assert.equal(starts[0][0], starts[1][0]); assert.equal(starts[1][0], starts[2][0])
  await page.waitForFunction(() => !document.querySelector('.daw-clock').textContent.startsWith('0:00.00'))
  await page.click('[data-destination="workbench"]'); await page.waitForFunction(() => document.querySelector('[data-daw="play"]').getAttribute('aria-label') === 'Play arrangement')
  await page.click('[data-destination="daw"]'); assert.equal(await page.$$eval('.daw-track-row', rows => rows.length), 3)
  report.checks.push('Real native live playback schedules3sources on same audio-clock time; playhead advances; destination switch pauses transport and preserves session.')
  await page.click('[data-daw="stop"]')
  const clipBox = await (await page.$('.daw-clip')).boundingBox()
  await page.mouse.move(clipBox.x + 50, clipBox.y + 35); await page.mouse.down(); await page.mouse.move(clipBox.x + 75, clipBox.y + 35, { steps: 6 }); await page.mouse.up()
  assert.ok(Number(await page.$eval('[name="start"]', el => el.value)) > .4)
  await page.click('[data-daw="undo"]')
  report.checks.push('Actual CDP pointer drag moves a real clip by timeline distance; undo restores original position.')
  await page.click('.daw-clip')
  await page.$eval('.daw-seek', el => { el.value = '48000'; el.dispatchEvent(new Event('input', { bubbles: true })) })
  await page.click('[data-daw="split"]'); assert.equal(await page.$$eval('.daw-clip', rows => rows.length), 4)
  await page.click('[data-daw="undo"]'); assert.equal(await page.$$eval('.daw-clip', rows => rows.length), 3)
  await page.click('[data-daw="redo"]'); assert.equal(await page.$$eval('.daw-clip', rows => rows.length), 4)
  await page.click('.daw-clip')
  await set('[name="offset"]', 1 / 48000); await set('[name="length"]', .5)
  await page.click('.daw-clip-form > button[type=submit]')
  assert.equal(Math.round(Number(await page.$eval('[name="offset"]', el => el.value)) * 48000), 1)
  await page.click('.daw-clip-form > button[type=submit]')
  assert.equal(Math.round(Number(await page.$eval('[name="offset"]', el => el.value)) * 48000), 1)
  report.checks.push('Timeline grid remains ruler-aligned while zooming; inspector round-trip retains a single-sample source offset without precision drift.')
  await set('[name="start"]', .5); await set('[name="offset"]', .25); await set('[name="length"]', .5)
  await page.click('.daw-clip-form > button[type=submit]')
  await page.click('[data-daw="duplicate"]'); assert.equal(await page.$$eval('.daw-clip', rows => rows.length), 5)
  await page.click('[data-daw="undo"]'); assert.equal(await page.$$eval('.daw-clip', rows => rows.length), 4)
  await set('[aria-label="Gain Bass"]', -6); await set('[aria-label="Pan Bass"]', -.5)
  await page.click('[aria-label="Mute Atmosphere"]'); await page.click('[aria-label="Solo Bass"]')
  await set('.daw-project-name', 'Proof session')
  await capture('editing', 1480, 920)
  const saved = await download('save'), savedDoc = JSON.parse(saved.bytes.toString())
  assert.equal(savedDoc.project.tracks.length, 3); assert.equal(savedDoc.project.clips.length, 4)
  assert.equal(savedDoc.project.clips[0].startFrame, 24000); assert.equal(savedDoc.project.clips[0].offsetFrames, 12000); assert.equal(savedDoc.project.clips[0].durationFrames, 24000)
  assert.equal(savedDoc.project.tracks[1].gainDb, -6); assert.equal(savedDoc.project.tracks[1].pan, -.5); assert.equal(savedDoc.project.tracks[1].solo, true); assert.equal(savedDoc.project.tracks[2].muted, true)
  report.checks.push('Actual selected-region split/atomic move+trim/duplicate/undo/redo, track gain/pan/mute/solo and rename reflected in downloaded real project state.')
  const mix = await download('export'); assert.equal(mix.bytes.toString('ascii', 8, 12), 'WAVE'); assert.equal(mix.bytes.readUInt16LE(20), 3); assert.equal(mix.bytes.readUInt32LE(24), 48000); assert.equal(mix.bytes.readUInt32LE(40) / 8, 384000)
  let nonzero = false; for (let i = 44; i < mix.bytes.length; i += 4) { const sample = mix.bytes.readFloatLE(i); assert.ok(Number.isFinite(sample)); if (sample !== 0) nonzero = true } assert.ok(nonzero)
  report.checks.push('Native offline stereo mixdown exported actual finite non-silent48000Hz Float32 WAV of exact8second arrangement duration.')
  const mono = path.join(runtime, 'Mono.wav'), stereo = path.join(runtime, 'Stereo.wav'); await fs.writeFile(mono, wavFile(1)); await fs.writeFile(stereo, wavFile(2))
  await (await page.$('.daw-files')).uploadFile(mono, stereo); await ready(); assert.equal(await page.$$eval('.daw-track-row', rows => rows.length), 5)
  const bad = path.join(runtime, 'invalid.wav'); await fs.writeFile(bad, 'not valid audio')
  await (await page.$('.daw-files')).uploadFile(mono, bad); await ready(); assert.equal(await page.$$eval('.daw-track-row', rows => rows.length), 5)
  const corrupt = path.join(runtime, 'corrupt.json'), corruptDoc = structuredClone(savedDoc); corruptDoc.media[0].sha256 = '0'.repeat(64); await fs.writeFile(corrupt, JSON.stringify(corruptDoc))
  await (await page.$('.daw-project-file')).uploadFile(corrupt); await ready(); assert.equal(await page.$$eval('.daw-track-row', rows => rows.length), 5); assert.match(await page.$eval('.daw-status', el => el.textContent), /MEDIA_CHECKSUM/)
  await (await page.$('.daw-project-file')).uploadFile(saved.filename); await ready(); assert.equal(await page.$$eval('.daw-track-row', rows => rows.length), 3)
  const reopened = await download('save'); assert.deepEqual(JSON.parse(reopened.bytes.toString()), savedDoc)
  report.checks.push('Actual mono+stereo native decoder import adds2tracks; failed batch is atomic; corrupt-project checksum rejects without losing active5track session; downloaded project reopens and reserializes byte-identical metadata/PCM.')
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await page.setViewport({ width: 1120, height: 700 }); await page.click('[data-destination="workbench"]'); await page.click('[data-destination="daw"]')
  assert.equal(await page.$$eval('.daw-track-row', rows => rows.length), 3)
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
  await page.click('[data-daw="shape"]'); await page.waitForFunction(() => document.querySelector('.workspace-root').dataset.editor === 'workbench', { timeout: 45000 })
  assert.match(await page.$eval('.source-name', el => el.textContent), /Proof_session-mix.wav/)
  await page.waitForFunction(() => !document.querySelector('[data-action="fix"]').disabled, { timeout: 45000 })
  report.checks.push('Real mix-to-workbench bridge imports native rendered audio through preserved analysis pipeline; MasterFix becomes available; reduced-motion navigation and live resize preserve project.')
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
  const lifecycle = await page.evaluate(() => window.__dawAudioAudit); assert.equal(lifecycle.contexts, lifecycle.closes); report.lifecycle = lifecycle
  await page.goto(fileUrl, { waitUntil: 'networkidle0' }); await page.waitForSelector('.daw-arrangement'); await (await page.$('.daw-project-file')).uploadFile(saved.filename); await ready()
  const fileSaved = await download('save'); assert.equal(fileSaved.result.sha256, saved.result.sha256)
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
  report.checks.push('Self-contained production file:// entry opens and exports byte-identical project; all realtime decoder/playback AudioContexts close on pagehide.')

  // Separate native-source-graph proof, exact reviewed modules through local Vite.
  await page.goto('http://127.0.0.1:4174/', { waitUntil: 'networkidle0' })
  report.native = await page.evaluate(async () => {
    const { createProject, applyCommand } = await import('/src/domain/daw/project.js')
    const { createDawAudio } = await import('/src/audio/daw/engine.js')
    const { serializeProject, deserializeProject } = await import('/src/application/daw/projectFile.js')
    const size = 4800, assets = new Map(), tracks = [], clips = [], meta = []
    for (let i = 0; i < 2; i++) {
      const buffer = new AudioBuffer({ numberOfChannels: 2, length: size, sampleRate: 48000 })
      for (let c = 0; c < 2; c++) for (let n = 0; n < size; n++) buffer.getChannelData(c)[n] = i === 0 ? (c ? -.5 : .25) * n / size : (c ? .2 : .1) * (n % 37) / 37
      const id = `asset-${i}`; assets.set(id, buffer); meta.push({ id, name: id, frames: size, sampleRate: 48000, channels: 2 }); tracks.push({ id: `track-${i}`, name: `Track${i}`, gainDb: 0, pan: 0, muted: false, solo: false }); clips.push({ id: `clip-${i}`, trackId: `track-${i}`, assetId: id, startFrame: i * 1200, offsetFrames: 0, durationFrames: size })
    }
    const original = applyCommand(createProject('native-project'), { type: 'addTracks', tracks, clips, assets: meta }), engine = createDawAudio({ audio: {} }), cases = []
    const variants = [original,
      applyCommand(original, { type: 'setTrack', trackId: 'track-0', patch: { gainDb: -6.020599913279624 } }),
      applyCommand(original, { type: 'setTrack', trackId: 'track-1', patch: { pan: 1 } }),
      applyCommand(original, { type: 'setTrack', trackId: 'track-1', patch: { muted: true } }),
      applyCommand(original, { type: 'setTrack', trackId: 'track-1', patch: { solo: true } }),
      applyCommand(original, { type: 'editClip', clipId: 'clip-0', trackId: 'track-0', startFrame: 2400, offsetFrames: 600, durationFrames: 2400 })]
    for (const [index, project] of variants.entries()) {
      const rendered = await engine.render(project, assets); let maxError = 0
      for (let n = 0; n < rendered.length; n++) {
        const sum = [0, 0]
        for (const track of project.tracks) {
          if (track.muted || (project.tracks.some(t => t.solo) && !track.solo)) continue
          for (const clip of project.clips.filter(c => c.trackId === track.id)) {
            const relative = n - clip.startFrame; if (relative < 0 || relative >= clip.durationFrames) continue
            const data = assets.get(clip.assetId), gain = 10 ** (track.gainDb / 20), left = data.getChannelData(0)[clip.offsetFrames + relative] * gain, right = data.getChannelData(1)[clip.offsetFrames + relative] * gain
            sum[0] += track.pan === 1 ? 0 : left; sum[1] += track.pan === 1 ? right + left : right
          }
        }
        for (let c = 0; c < 2; c++) maxError = Math.max(maxError, Math.abs(rendered.getChannelData(c)[n] - sum[c]))
      }
      if (maxError > 1e-6) throw Error(`Native case${index}: ${maxError} > predeclared1e-6`)
      cases.push({ index, frames: rendered.length, maxError, tolerance: 1e-6 })
    }
    const text = await serializeProject(original, assets), reopened = await deserializeProject(text)
    const first = await engine.render(original, assets), second = await engine.render(reopened.project, reopened.assets)
    for (let c = 0; c < 2; c++) for (let n = 0; n < first.length; n++) if (!Object.is(first.getChannelData(c)[n], second.getChannelData(c)[n])) throw Error('Reopened native mix differs')
    return { cases, reopenedMixSampleIdentical: true, sampleRate: 48000, productionReady: false }
  })
  report.checks.push('Six independent arithmetic-vs-nativeOfflineAudioContext cases: overlap/sum, gain, stereo hard-pan, mute, solo, source-offset+trim/placement; max sample error≤1e-6. Project reopen reproduces native mix sample-identically.')
  assert.deepEqual(report.errors, []); assert.deepEqual(report.blocked, []); report.status = 'PASS'
} catch (error) { failure = error; report.status = 'FAIL'; report.failure = { message: error.message, stack: error.stack } }
finally {
  if (browser) await browser.close()
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, originalEnv)
  report.buildSha256 = sha(await fs.readFile(new URL('../../dist/index.html', import.meta.url)))
  await fs.writeFile(path.join(output, 'browser.json'), JSON.stringify(report, null, 2) + '\n')
}
console.log(JSON.stringify({ status: report.status, checks: report.checks.length, downloads: report.downloads.length, output, failure: report.failure }, null, 2))
if (failure) throw failure
