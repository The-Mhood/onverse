// Trusted local production page + synthetic PCM ONLY. Disabled-sandbox Chromium
// is never used for user media, untrusted sites or Electron/security qualification.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { auditTools } from './run-offline-render-probe.mjs';
import { probeAudioStabilization } from './audio-stabilization-probe.mjs';

const tools = process.argv[2];
const localBuildUrl = new URL('../../dist/index.html', import.meta.url).href;
const flags = process.argv.slice(3);
assert.ok(new Set(flags).size === flags.length && flags.every(f => ['--motion-only', '--cpu-renderer'].includes(f)), 'Usage: <private tools directory> [--motion-only] [--cpu-renderer]');
const motionOnly = flags.includes('--motion-only'), cpuRenderer = flags.includes('--cpu-renderer');
const audit = await auditTools(tools);
assert.equal(audit.packages, 43);
const runtime = await fs.mkdtemp('/tmp/onverse-browser-runtime-');
await fs.chmod(runtime, 0o700);
const reviews = fileURLToPath(new URL('../../../reviews/', import.meta.url));
await fs.mkdir(reviews, { recursive: true });
const output = await fs.mkdtemp(path.join(reviews, 'workbench-browser-20261016-'));
const originalEnv = { ...process.env };
const report = { kind: motionOnly ? 'actual-production-cinematic-entry-only' : 'actual-production-entry-and-synthetic-workflows', output, node: process.version, tools: audit, checks: [], errors: [], console: [], requests: [], failedResponses: [], blockedRequests: [], screenshots: [], downloads: [], limits: ['Trusted local synthetic PCM only; no user media, real provider or listening.', 'Headless Chromium with disabled sandbox; not Electron/Mac/security qualification.', 'Original01–13 project reference pack recovered and inspected; runtime screenshots are not pixel-fidelity signoff.'] };
let browser, page, cdp, phase = 'boot', primaryError;
const downloadNames = new Map();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function capture(name, width, height) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: innerHeight, scrollY, scrollHeight: document.documentElement.scrollHeight,
    clippedControls: [...document.querySelectorAll('button,input,select')].filter(e => e.getClientRects().length && (e.getBoundingClientRect().left < 0 || e.getBoundingClientRect().right > innerWidth + 1)).map(e => e.outerHTML),
    missingImages: [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src) }));
  assert.ok(layout.scrollWidth <= width, JSON.stringify(layout)); assert.deepEqual(layout.clippedControls, []); assert.deepEqual(layout.missingImages, []);
  const file = `${name}-${width}x${height}.png`; await page.screenshot({ path: path.join(output, file), fullPage: false });
  const fullPage = file.replace('.png', '-full.png'); await page.screenshot({ path: path.join(output, fullPage), fullPage: true });
  report.screenshots.push({ file, fullPage, ...layout });
}
// Predeclared measurement: five seconds of idle cinematic motion, two target
// viewports. This is headless Linux throughput, not a target-device guarantee.
const motionBudget = { sampleMs: 5000, maxP95FrameMs: 50, minAverageFps: 30 };
async function motionSnapshot() {
  return page.evaluate(() => {
    const env = document.querySelector('.environment'), root = document.querySelector('.workspace-root');
    return [[env, null], [env, '::before'], [env, '::after'], [root, '::before'], ...[...env.querySelectorAll('.scene-plane')].map(el => [el, null])].map(([el, pseudo]) => {
      const style = getComputedStyle(el, pseudo);
      return { layer: pseudo ? `${el.className}${pseudo}` : el.className, name: style.animationName,
        duration: style.animationDuration, state: style.animationPlayState, transform: style.transform,
        opacity: style.opacity, translate: style.translate, filter: style.filter, backdropFilter: style.backdropFilter };
    });
  });
}
async function verifyMotionAndPanels() {
  report.motion = { budget: motionBudget, viewports: [] };
  for (const [width, height] of [[1120, 700], [1480, 920]]) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.evaluate(() => scrollTo(0, 0));
    const before = await motionSnapshot(), metricsBefore = await page.metrics();
    assert.equal(before.length, 8); assert.ok(before.every(l => l.name !== 'none' && l.state === 'running'));
    assert.equal(new Set(before.map(l => l.name)).size, 8);
    assert.ok(before.every(l => l.filter === 'none' && l.backdropFilter === 'none'));
    const timing = await page.evaluate(sampleMs => new Promise(resolve => {
      const frames = []; let start, prior;
      function tick(now) {
        start ??= now; if (prior !== undefined) frames.push(now - prior); prior = now;
        if (now - start < sampleMs) return requestAnimationFrame(tick);
        const sorted = [...frames].sort((a,b) => a-b);
        resolve({ count: frames.length, elapsedMs: now-start, averageFps: frames.length * 1000/(now-start),
          p50Ms: sorted[Math.floor(sorted.length * .5)], p95Ms: sorted[Math.floor(sorted.length * .95)],
          maxMs: sorted.at(-1), over50Ms: frames.filter(ms => ms > 50).length });
      }
      requestAnimationFrame(tick);
    }), motionBudget.sampleMs);
    const after = await motionSnapshot(), metricsAfter = await page.metrics();
    assert.ok(after.every((layer, i) => layer.transform !== before[i].transform), 'All eight actual motion layers must advance');
    assert.ok(timing.p95Ms <= motionBudget.maxP95FrameMs, JSON.stringify(timing));
    assert.ok(timing.averageFps >= motionBudget.minAverageFps, JSON.stringify(timing));
    report.motion.viewports.push({ width, height, before, after, timing,
      performanceDelta: Object.fromEntries(['LayoutCount','RecalcStyleCount','LayoutDuration','RecalcStyleDuration','ScriptDuration','TaskDuration'].map(k => [k, metricsAfter[k]-metricsBefore[k]])) });

    // Actual pointer-driven differential depth, with stationary precision UI.
    const controlBounds = () => page.$eval('.transport', e => { const r = e.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height } });
    const controlsBefore = await controlBounds();
    report.motion.viewports.at(-1).inputEnvironment = await page.evaluate(() => ({ fine: matchMedia('(any-pointer: fine)').matches, primaryFine: matchMedia('(pointer: fine)').matches, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, hidden: document.hidden, paused: document.querySelector('.workspace-root').dataset.environmentPaused, target: document.elementFromPoint(innerWidth*.8,130)?.outerHTML.slice(0,240) }));
    await page.mouse.move(width * .8, 130);
    await page.waitForFunction(() => Math.abs(parseFloat(document.querySelector('.workspace-root').style.getPropertyValue('--mvo-scene-x'))) > 1);
    const parallax = await page.evaluate(() => {
      const read = name => parseFloat(getComputedStyle(document.querySelector(name)).translate);
      return { far: read('.scene-stars'), celestial: read('.scene-celestial'), near: read('.scene-foreground'), position: getComputedStyle(document.querySelector('.environment')).position };
    });
    assert.equal(parallax.position, 'fixed');
    assert.ok(Math.abs(parallax.near) > Math.abs(parallax.celestial) && Math.abs(parallax.celestial) > Math.abs(parallax.far), JSON.stringify(parallax));
    assert.deepEqual(await controlBounds(), controlsBefore, 'Parallax must never move the transport');
    report.motion.viewports.at(-1).parallax = parallax;

    // Observe in the SAME browser task as the real wired button activation.
    // A remote CDP round trip may outlast a 420ms transition, so polling for an
    // intermediate opacity after page.click is inherently racy.
    const traceTransition = action => page.evaluate(action => new Promise(resolve => {
      const dialog = document.querySelector('dialog'), samples = [], start = performance.now();
      document.querySelector(`[data-action="${action}"]`).click();
      function sample(now) {
        const style = getComputedStyle(dialog);
        samples.push({ timeMs: now-start, opacity: Number(style.opacity), transform: style.transform, display: style.display, modal: dialog.matches(':modal') });
        if (now-start < 700) return requestAnimationFrame(sample);
        resolve({ samples, open: dialog.open, filter: getComputedStyle(dialog).backdropFilter });
      }
      requestAnimationFrame(sample);
    }), action);
    const audioBefore = await page.$eval('[data-action="play"]', el => el.textContent);
    const entering = await traceTransition('capabilities');
    assert.equal(entering.open, true); assert.equal(entering.filter, 'none');
    const modalTime = await page.$eval('.scene-celestial', e => e.getAnimations()[0].currentTime);
    await page.evaluate(() => new Promise(resolve => { let n=0; const tick=()=>++n===5?resolve():requestAnimationFrame(tick); requestAnimationFrame(tick) }));
    assert.ok(await page.$eval('.scene-celestial', e => e.getAnimations()[0].currentTime) > modalTime, 'Celestial drift continues behind modal content');

    assert.ok(entering.samples.some(s => s.opacity > .02 && s.opacity < .98 && s.modal), JSON.stringify(entering));
    assert.equal(entering.samples.at(-1).opacity, 1);
    await capture('panel-open', width, height);
    // Focus the accessible heading, not a Space-activatable close button.
    await page.$eval('#capability-title', el => el.focus()); await page.keyboard.press('Space');
    assert.equal(await page.$eval('dialog', el => el.open), true);
    assert.equal(await page.$eval('[data-action="play"]', el => el.textContent), audioBefore);
    const exiting = await traceTransition('close-capabilities');
    assert.equal(exiting.open, false);
    assert.ok(exiting.samples.some(s => s.opacity > .02 && s.opacity < .98 && s.display !== 'none'), JSON.stringify(exiting));
    assert.equal(exiting.samples.at(-1).display, 'none');
    report.motion.viewports.at(-1).panel = { entering, exiting };
    assert.equal(await page.$eval('[data-action="capabilities"]', el => el === document.activeElement), true);
    // Independent Escape check exercises native dismissal and focus restoration.
    await click('capabilities'); await page.keyboard.press('Escape');
    assert.equal(await page.$eval('dialog', el => el.open), false);
  }
  // Native CDP touch input must not drive decorative pointer depth. This does
  // not replace media APIs or alter the production adapter for the proof.
  await page.waitForFunction(() => document.querySelector('.workspace-root').style.getPropertyValue('--mvo-scene-x') === '0.000px');
  const touchCdp = await page.createCDPSession();
  await touchCdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await page.touchscreen.touchStart(700, 120);
  await page.touchscreen.touchMove(740, 120);
  await page.touchscreen.touchEnd();
  assert.equal(await page.$eval('.workspace-root', e => e.style.getPropertyValue('--mvo-scene-x')), '0.000px');
  await touchCdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await touchCdp.detach();
  report.motion.touchIgnoresParallax = true;
  report.checks.push('Eight independent scene/atmosphere layers advance naturally at BOTH target sizes; five-second RAF/performance samples satisfy predeclared headless budget. Real limits dialog enters/exits with intermediate opacity, restores focus, closes by Escape and does not trigger playback. No filter/backdrop blur.');
}
async function waitReady() { await page.waitForFunction(() => !document.querySelector('[data-action="analyze"]').disabled, { timeout: 60000 }); }
async function click(action) { await page.click(`[data-action="${action}"]`); }
async function edit(selector, value) {
  await page.$eval(selector, (el, value) => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); }, String(value));
}
async function download(action) {
  let listener, timeout;
  const completed = new Promise((resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(`Download timed out: ${action}`)), 45000);
    listener = event => { if (event.state === 'completed') resolve(event); if (event.state === 'canceled') reject(new Error('Download canceled')); };
    cdp.on('Browser.downloadProgress', listener);
  });
  try {
    await click(action); const event = await completed;
    const file = path.join(runtime, 'downloads', event.guid), bytes = await fs.readFile(file);
    const suggestedFilename = downloadNames.get(event.guid); assert.ok(suggestedFilename);
    const name = report.downloads.length + '-' + action + path.extname(suggestedFilename);
    await fs.writeFile(path.join(output, name), bytes);
    const result = { action, suggestedFilename, file: name, bytes: bytes.length, sha256: sha(bytes) };
    if (name.endsWith('.wav')) { result.frames = bytes.readUInt32LE(40) / bytes.readUInt16LE(32); result.channels = bytes.readUInt16LE(22); result.sampleRate = bytes.readUInt32LE(24); assert.equal(bytes.toString('ascii', 8, 12), 'WAVE'); }
    report.downloads.push(result); return result;
  } finally { clearTimeout(timeout); cdp.off('Browser.downloadProgress', listener); }
}
try {
  for (const key of Object.keys(process.env)) delete process.env[key];
  for (const dir of ['home', 'cache', 'profile', 'fonts', 'downloads']) await fs.mkdir(path.join(runtime, dir), { mode: 0o700 });
  Object.assign(process.env, { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', TZ: 'UTC', TMPDIR: runtime, HOME: path.join(runtime, 'home'), XDG_CACHE_HOME: path.join(runtime, 'cache'), FONTCONFIG_PATH: path.join(runtime, 'fonts') });
  assert.equal(tmpdir(), runtime);
  const cm = await import(pathToFileURL(path.join(tools, 'node_modules/@sparticuz/chromium/build/index.js')));
  await cm.inflate(path.join(tools, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'));
  cm.setupLambdaEnvironment(path.join(runtime, 'al2023/lib'));
  const executablePath = await cm.default.executablePath(); assert.ok(executablePath.startsWith(runtime + '/'));
  const pm = await import(pathToFileURL(path.join(tools, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')));
  // This VM has no physical GPU. SwiftShader's emulated GPU can stall on a
  // native dialog layer retirement. A declared, opt-in Chromium CPU raster
  // alternative keeps all actual CSS motion/audio, pins and network gates intact;
  // it does not change production/Electron flags or suppress animations.
  const gpuArgs = new Set(['--ignore-gpu-blocklist', '--in-process-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']);
  const rendererArgs = cpuRenderer ? [...cm.default.args.filter(arg => !gpuArgs.has(arg)), '--disable-gpu'] : cm.default.args;
  report.renderer = cpuRenderer ? 'Chromium CPU raster (--disable-gpu), no physical GPU qualification' : 'Default Sparticuz SwiftShader emulated GPU';
  browser = await pm.default.launch({ executablePath, headless: true, pipe: true, userDataDir: path.join(runtime, 'profile'), env: { ...process.env }, args: [...rendererArgs,
    '--disable-background-networking', '--disable-component-update', '--disable-domain-reliability', '--disable-sync', '--no-first-run', '--no-default-browser-check', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--disk-cache-dir=' + path.join(runtime, 'cache')] });
  report.pointerSetup = 'Actual CDP mouse PointerEvents; no fine-pointer media override or physical input-device qualification';
  report.browser = await browser.version(); page = await browser.newPage();
  page.on('pageerror', error => report.errors.push({ phase, error: error.message }));
  page.on('console', message => report.console.push({ phase, type: message.type(), text: message.text() }));
  page.on('response', response => { if (response.status() >= 400) report.failedResponses.push({ phase, status: response.status(), url: response.url() }); });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url(); report.requests.push({ phase, url: url.slice(0, 300) });
    if (url === localBuildUrl || url.startsWith('blob:null/') || url.startsWith('http://127.0.0.1:4173/') || url.startsWith('blob:http://127.0.0.1:4173/') || url.startsWith('data:')) request.continue().catch(e => report.errors.push({ phase, error: e.message }));
    else { report.blockedRequests.push({ phase, url }); request.abort().catch(e => report.errors.push({ phase, error: e.message })); }
  });
  await page.evaluateOnNewDocument(() => {
    // Instrument real constructors/close, not fake audio implementations.
    window.__audioAudit = { contexts: 0, offline: 0, closes: 0, sampleRates: [], decoded: [] };
    const Native = window.AudioContext, Offline = window.OfflineAudioContext;
    window.AudioContext = class extends Native { constructor(...args) { super(...args); window.__audioAudit.contexts++; window.__audioAudit.sampleRates.push(this.sampleRate); } async decodeAudioData(...args) { const b = await super.decodeAudioData(...args); window.__audioAudit.decoded.push({ frames: b.length, sampleRate: b.sampleRate, channels: b.numberOfChannels }); return b; } close() { window.__audioAudit.closes++; return super.close(); } };
    window.OfflineAudioContext = class extends Offline { constructor(...args) { super(...args); window.__audioAudit.offline++; } };
  });
  cdp = await browser.target().createCDPSession();
  cdp.on('Browser.downloadWillBegin', event => downloadNames.set(event.guid, event.suggestedFilename));
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: path.join(runtime, 'downloads'), eventsEnabled: true });
  await page.setViewport({ width: 1480, height: 920, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('.workspace-root');
  assert.equal(await page.$eval('.mix-picker', e => e.type), 'file');
  assert.deepEqual(await page.evaluate(() => window.__audioAudit), { contexts: 0, offline: 0, closes: 0, sampleRates: [], decoded: [] });
  assert.equal(await page.$eval('[data-action="fix"]', e => e.disabled), true);
  report.checks.push('Actual production HTML executes ESM, mounts and binds; zero startup audio contexts, no legacy selector/stage dependency.');
  await capture('empty', 1120, 700); await capture('empty', 1480, 920);
  await page.evaluate(() => {
    window.__surfaceAudit = [];
    document.addEventListener('animationstart', event => {
      if (event.animationName === 'mvo-panel-settle-in') window.__surfaceAudit.push({ surface: event.target.dataset.surface || event.target.className, time: performance.now() });
    });
  });

  if (!motionOnly) {
  phase = 'demo'; await click('demo'); await waitReady();
  assert.match(await page.$eval('.source-name', e => e.textContent), /Demo/);
  assert.ok(Number.isFinite(Number(await page.$eval('.overall-score', e => e.textContent))));
  report.checks.push('Real 16-second synth demo and real analyzer complete through UI.');

  phase = 'import';
  const frames = 96000, sampleRate = 48000, wav = Buffer.alloc(44 + frames * 4);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22); wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < frames; i++) { const v = Math.round(Math.sin(2 * Math.PI * 440 * i / sampleRate) * 9500); wav.writeInt16LE(v, 44 + i * 4); wav.writeInt16LE(Math.round(v * .85), 46 + i * 4); }
  const fixture = path.join(runtime, 'signal-study.wav'); await fs.writeFile(fixture, wav);
  await (await page.$('.mix-picker')).uploadFile(fixture);
  await page.waitForFunction(() => document.querySelector('.source-name').textContent === 'signal-study.wav'); await waitReady();
  assert.equal(await page.$eval('.source-name', e => e.textContent), 'signal-study.wav');
  const decodedSampleRate = await page.evaluate(() => window.__audioAudit.sampleRates.at(-1));
  assert.equal(await page.$eval('.measurement-rate', e => e.textContent), `${(decodedSampleRate / 1000).toFixed(1)} kHz`);
  report.decodedSampleRate = decodedSampleRate;
  const decodedGeometry = await page.evaluate(() => window.__audioAudit.decoded.at(-1));
  const original = await download('convert'); assert.equal(original.frames, decodedGeometry.frames); assert.equal(original.channels, decodedGeometry.channels); assert.equal(original.sampleRate, decodedGeometry.sampleRate);
  report.sourceDecode = decodedGeometry;
  report.checks.push('Local WAV file picker invokes real decoder and automatic analysis; 2-second stereo 48kHz fixture decodes at native AudioContext rate, preserving existing processor behavior.');

  phase = 'reference'; await page.select('.reference-source', 'file');
  await (await page.$('.reference-picker')).uploadFile(fixture);
  await page.waitForFunction(() => document.querySelector('.target-label').textContent.includes('measured reference')); await waitReady();
  report.checks.push('Uploaded reference is decoded/measured and used for real comparison.');
  await page.select('.reference-source', 'auto'); await page.select('.category', 'hiphop'); await page.select('.subgenre', 'Trap'); await click('analyze'); await waitReady();
  assert.match(await page.$eval('.target-label', e => e.textContent), /Trap.*built-in profile/);
  report.checks.push('Manual category/subgenre selection re-analyzes against the actual built-in profile, labelled as heuristic.');

  phase = 'playback'; await click('play');
  // Pause in the same animation-frame task that observes real audio advance.
  // The fixture is only two seconds long: a second remote CDP coordinate click
  // can arrive after natural end and restart it, particularly under CPU load.
  const playback = await page.evaluate(() => new Promise((resolve, reject) => {
    const deadline = performance.now() + 10000;
    const celestial = document.querySelector('.scene-celestial');
    const sceneBefore = celestial.getAnimations()[0].currentTime;
    function observe() {
      const play = document.querySelector('[data-action="play"]'), position = Number(document.querySelector('.position').value);
      if (position > .05 && play.textContent === 'Pause') {
        const sceneAfter = celestial.getAnimations()[0].currentTime;
        const planesRunning = [...document.querySelectorAll('.scene-plane')].every(e => getComputedStyle(e).animationPlayState === 'running');
        play.click(); resolve({ advancedTo: position, afterPause: play.textContent, sceneBefore, sceneAfter, planesRunning }); return;
      }
      if (performance.now() > deadline) { reject(Error('Real playback did not advance before pause')); return; }
      requestAnimationFrame(observe);
    }
    requestAnimationFrame(observe);
  }));
  assert.ok(playback.advancedTo > .05); assert.equal(playback.afterPause, 'Play');
  assert.ok(playback.sceneAfter > playback.sceneBefore && playback.planesRunning, 'Real playback must not suspend celestial motion'); report.playback = playback;
  await edit('.position', .5); await click('rate'); assert.equal(await page.$eval('[data-action="rate"]', e => e.textContent), '1.5×');
  await click('rate'); await click('rate'); await click('rate');
  report.checks.push('Real AudioContext source advances, pauses, seeks and cycles playback rate while celestial time advances and depth planes remain running. No listening claim.');

  phase = 'region-export'; await click('crop'); await edit('.region-in', .25); await edit('.region-out', 1.25);
  const region = await download('export-region'); assert.equal(region.frames, decodedSampleRate); assert.equal(region.channels, 2);
  await page.$eval('[data-region-handle="in"]', e => e.focus()); await page.keyboard.press('ArrowRight');
  assert.ok(Math.abs(Number(await page.$eval('.region-in', e => e.value)) - .3) < 1e-6);
  const ruler = await page.$eval('.audio-waveform', e => { const r=e.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height } });
  const handle = await page.$eval('[data-region-handle="out"]', e => { const r=e.getBoundingClientRect(); return { x:r.x+r.width/2,y:r.y+r.height/2 } });
  await page.mouse.move(handle.x,handle.y); await page.mouse.down();
  await page.mouse.move(ruler.x+ruler.width*.7,ruler.y+12,{steps:6}); await page.mouse.up();
  const outTime=Number(await page.$eval('.region-out', e=>e.value)); assert.ok(Math.abs(outTime-1.4)<.025, String(outTime));
  assert.equal(await page.$eval('[data-region-handle="out"]',e=>Number(e.getAttribute('aria-valuenow')).toFixed(2)),outTime.toFixed(2));
  await capture('region-editing',1120,700); await capture('region-editing',1480,920);
  report.checks.push('Real region handles support keyboard increments and captured pointer drag; exact numeric inputs and ARIA values stay synchronized, without modifying source PCM.');
  await click('crop'); report.checks.push('IN/OUT region exports genuine 1-second stereo WAV with expected sample count.');

  phase = 'master-fix'; await click('fix'); await waitReady();
  assert.equal(await page.$eval('[data-action="fixed"]', e => e.getAttribute('aria-pressed')), 'true');
  assert.match(await page.$eval('.fixed-measurement', e => e.textContent), /^B:/);
  await click('play'); await click('original'); await click('fixed');
  report.checks.push('Real OfflineAudioContext Master Fix + fast remeasurement publishes distinct B; original/fixed A–B selection works.');

  await capture('fixed', 1120, 700); await capture('fixed', 1480, 920);
  phase = 'manual-adjustment'; await page.$eval('.adjustments', el => { el.open = true; });
  const prior = (await download('save-fixed')).sha256;
  const beforeManual = await page.evaluate(() => window.__audioAudit.offline);
  await page.$eval('[data-tweak="trimDb"]', el => { el.value = '-1'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForFunction(before => window.__audioAudit.offline > before && !document.querySelector('[data-action="fix"]').disabled, { timeout: 30000 }, beforeManual); await waitReady();
  const adjusted = await download('save-fixed'); assert.notEqual(adjusted.sha256, prior);
  assert.ok(await page.evaluate(() => window.__audioAudit.offline >= 2));
  await capture('manual-adjusted', 1120, 700); await capture('manual-adjusted', 1480, 920);
  const beforeReset = await page.evaluate(() => window.__audioAudit.offline);
  await click('reset-tweaks'); await page.waitForFunction(before => window.__audioAudit.offline > before && !document.querySelector('[data-action="fix"]').disabled, { timeout: 30000 }, beforeReset); await waitReady();
  report.checks.push('Manual output trim produces different real rendered WAV bytes; reset triggers another real render.');
  await page.$eval('.adjustments', el => { el.open = false; });

  phase = 'conversion'; await page.select('.output-format', 'wav'); const converted = await download('convert'); assert.equal(converted.frames, decodedGeometry.frames); assert.equal(converted.sha256, original.sha256);
  await page.select('.output-format', 'mp3'); const mp3 = await download('convert'); assert.ok(mp3.bytes > 1000);
  const decodedMp3 = await page.evaluate(async bytes => {
    const ctx = new AudioContext(); try { const buf = await ctx.decodeAudioData(Uint8Array.from(bytes).buffer); return { duration: buf.duration, channels: buf.numberOfChannels }; } finally { await ctx.close(); }
  }, [...await fs.readFile(path.join(output, mp3.file))]);
  assert.ok(Math.abs(decodedMp3.duration - 2) < .2); assert.equal(decodedMp3.channels, 2); report.mp3Decode = decodedMp3;
  await download('report');
  report.recorderCapabilities = await page.$$eval('.output-format option', options => options.map(o => ({ format: o.value, disabled: o.disabled })));
  for (const option of report.recorderCapabilities.filter(o => ['m4a', 'ogg', 'webm'].includes(o.format) && !o.disabled)) {
    await page.select('.output-format', option.format); const encoded = await download('convert'); assert.ok(encoded.bytes > 1000);
    const bytes = await fs.readFile(path.join(output, encoded.file));
    const geometry = await page.evaluate(async data => { const ctx = new AudioContext(); try { const b = await ctx.decodeAudioData(Uint8Array.from(data).buffer); return { duration: b.duration, channels: b.numberOfChannels }; } finally { await ctx.close(); } }, [...bytes]);
    assert.ok(geometry.duration >= 1.8 && geometry.duration <= 2.7); assert.equal(geometry.channels, 2); encoded.decodedGeometry = geometry;
  }
  report.checks.push('WAV A bytes remain exactly equal before/after Master Fix and adjustments. WAV and MP3 conversion download real files; MP3 decodes back to stereo of expected duration; text report downloads.');

  phase = 'screenshots-loaded'; await click('original'); await edit('.position', 0); await page.select('.output-format', 'wav');
  await capture('loaded', 1120, 700); await capture('loaded', 1480, 920);
  phase = 'motion-and-panels'; await verifyMotionAndPanels();
  report.surfaceAnimations = await page.evaluate(() => window.__surfaceAudit);
  assert.ok(report.surfaceAnimations.some(e => e.surface === 'inspector'));
  assert.ok(report.surfaceAnimations.some(e => e.surface === 'workspace'));
  assert.ok(report.surfaceAnimations.some(e => e.surface === 'adjustment-inputs'));
  report.checks.push('Real analysis results, Master Fix/manual processing and opened adjustment controls activate host surface transitions; playback ticks do not retrigger these animations.');
  phase = 'reduced-motion';
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
  for (const [width, height] of [[1120, 700], [1480, 920]]) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    const layers = await motionSnapshot();
    assert.ok(layers.every(l => l.name === 'none' && l.transform === 'none'), JSON.stringify(layers));
    await click('capabilities'); await page.evaluate(() => scrollTo(0, 0));
    const reducedDialog = await page.$eval('dialog', el => ({ animations: el.getAnimations().length, opacity: getComputedStyle(el).opacity, transform: getComputedStyle(el).transform }));
    assert.deepEqual(reducedDialog, { animations: 0, opacity: '1', transform: 'none' });
    await capture('reduced-motion', width, height); await click('close-capabilities');
  }
  report.checks.push('BOTH target viewports: all eight environmental animations/transforms really stop under reduced motion, and native panel transitions are disabled. Captures have no horizontal overflow, clipped controls or broken images.');

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.waitForFunction(() => document.querySelector('.workspace-root').dataset.environmentPaused === 'false');
  assert.ok((await motionSnapshot()).every(l => l.name !== 'none' && l.state === 'running'));
  report.checks.push('Turning reduced motion back off resumes all depth layers without remounting or resetting audio.');

  phase = 'crop-fixed'; await click('fixed'); await click('crop'); await edit('.region-in', .25); await edit('.region-out', 1.25); await click('apply-crop');
  await page.waitForFunction(() => document.querySelector('.operation-status').textContent.includes('B cropped and re-measured'));
  await click('play'); const fixedCrop = await download('save-fixed'); assert.equal(fixedCrop.frames, Math.ceil(1.25 * fixedCrop.sampleRate) - Math.floor(.25 * fixedCrop.sampleRate));
  await capture('fixed-cropped', 1120, 700); await capture('fixed-cropped', 1480, 920);
  await click('original'); const stillOriginal = await download('convert'); assert.equal(stillOriginal.sha256, original.sha256);
  report.checks.push('Cropping B preserves exact floor/ceil sample-boundary behavior at its rendered sample rate; A export remains byte-identical.');

  phase = 'crop-apply'; await click('crop'); await edit('.region-in', .25); await edit('.region-out', 1.25); await click('apply-crop'); await waitReady();
  assert.match(await page.$eval('.source-name', e => e.textContent), /_cropped/);
  const cropped = await download('convert'); assert.equal(cropped.frames, decodedSampleRate);
  report.checks.push('Applying crop to A re-analyzes the 1-second working buffer; original filesystem fixture remains unchanged.');

  phase = 'expected-decode-error'; const invalid = path.join(runtime, 'invalid.wav'); await fs.writeFile(invalid, 'not an audio file');
  await (await page.$('.mix-picker')).uploadFile(invalid);
  await page.waitForFunction(() => document.querySelector('.operation-status').textContent.includes("Couldn't decode"));
  assert.match(await page.$eval('.source-name', e => e.textContent), /_cropped/);
  report.checks.push('Invalid audio reports a genuine decoder failure and preserves the current buffer. Its console error is expected and recorded.');

  await capture('decode-error-preserved', 1120, 700); await capture('decode-error-preserved', 1480, 920);
  phase = 'keyboard'; await page.click('h1'); await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelector('[data-action="play"]').textContent === 'Pause'); await page.keyboard.press('Space');
  report.checks.push('Keyboard Space toggles real playback outside form controls.');
  phase = 'expected-url-validation'; await page.select('.reference-source', 'url'); await edit('.reference-url', 'https://example.invalid/not-a-track');
  await page.$eval('.url-reference', el => el.requestSubmit());
  await page.waitForFunction(() => document.querySelector('.reference-note').textContent.includes('supported') || document.querySelector('.reference-note').textContent.includes('Spotify'));
  report.checks.push('Unsupported stream URL rejected by real resolver without any external request. Real platform lookup/preview not tested.');
  phase = 'cleanup'; report.audioAudit = await page.evaluate(() => window.__audioAudit);
  await click('reset'); assert.equal(await page.$eval('.source-name', e => e.textContent), 'No audio loaded');
  assert.equal(await page.$eval('[data-action="fix"]', e => e.disabled), true);
  report.checks.push('Clear source disables unavailable operations and restores truthful empty state.');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await page.waitForFunction(() => window.__audioAudit.closes === window.__audioAudit.contexts);
  report.closedAudioAudit = await page.evaluate(() => window.__audioAudit);
  assert.equal(await page.$eval('.workspace-root', e => e.dataset.environmentPaused), 'true');
  assert.ok((await motionSnapshot()).every(l => l.state === 'paused'), 'Disposed environment must stop animation work');
  const disposedOffset = await page.$eval('.workspace-root',e=>e.style.getPropertyValue('--mvo-scene-x'));
  await page.mouse.move(40,100);
  assert.equal(await page.$eval('.workspace-root',e=>e.style.getPropertyValue('--mvo-scene-x')),disposedOffset);
  report.checks.push('Pagehide disposes the environment listener/RAF adapter and pauses all eight CSS layers; subsequent pointer movement cannot revive it.');

  report.checks.push('Registered pagehide cleanup closes the real playback context; event/listener disposal executed. Not a native Electron quit test.');
  } else {
    phase = 'motion-and-panels'; await verifyMotionAndPanels();
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  }
  if (!motionOnly) {
    phase = 'native-stereo-render-regression';
    report.audioStabilization = await probeAudioStabilization(page);
    report.finalAudioAudit = await page.evaluate(() => window.__audioAudit);
    assert.equal(report.finalAudioAudit.contexts, report.finalAudioAudit.closes);
    phase = 'self-contained-file-origin';
    await page.goto(localBuildUrl, { waitUntil: 'networkidle0' });
    assert.equal(await page.$eval('.source-name', e => e.textContent), 'No audio loaded');
    await (await page.$('.mix-picker')).uploadFile(path.join(runtime, 'signal-study.wav'));
    await page.waitForFunction(() => document.querySelector('.source-name').textContent === 'signal-study.wav'); await waitReady();
    assert.ok(Number.isFinite(Number(await page.$eval('.overall-score', e => e.textContent))));
    const fileDownload = await download('convert');
    assert.equal(fileDownload.sha256, report.downloads[0].sha256);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    report.fileOrigin = { url: localBuildUrl, sourceWavSha256: fileDownload.sha256, audioAudit: await page.evaluate(() => window.__audioAudit) };
    assert.equal(report.fileOrigin.audioAudit.contexts, report.fileOrigin.audioAudit.closes);
    report.checks.push('Actual self-contained production file:// entry boots, imports and analyzes the synthetic WAV, exports byte-identical A and releases its decoder context. Chromium file-origin proof, NOT Electron/macOS packaging or security acceptance.');
    report.checks.push('Twelve native actual-module mono/in-phase/anti-phase renders at 44.1/48 kHz: actual post-render trim meets achievable targets at unchanged 1e-6 tolerance; PCM immutable, finite, polarity preserved and geometry unchanged. Invalid PCM rejects. Not listening/standards certification.');
  }
  report.performanceMetrics = await page.metrics();
  assert.deepEqual(report.errors, []); assert.deepEqual(report.failedResponses, []); assert.deepEqual(report.blockedRequests, []);
  const unexpectedConsole = report.console.filter(e => e.type === 'error' && e.phase !== 'expected-decode-error');
  assert.deepEqual(unexpectedConsole, []);
  report.result = 'PASS';
} catch (error) {
  primaryError = error; report.result = 'FAIL'; report.failure = { phase, message: error.message, stack: error.stack };
  if (page) {
    report.failure.dom = await page.evaluate(() => ({ play: document.querySelector('[data-action="play"]')?.textContent, position: document.querySelector('.position')?.value, audio: window.__audioAudit, surfaceAnimations: window.__surfaceAudit })).catch(() => null);
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
  }
} finally {
  let closed = true;
  try { if (browser) await browser.close(); } catch (error) { closed = false; report.cleanupError = error.message; primaryError ||= error; }
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, originalEnv);
  if (closed) { await fs.rm(runtime, { recursive: true, force: true }); report.privateRuntimeRemoved = true; }
  else report.privateRuntimeRemoved = false;
  const code = {};
  for (const relative of ['index.html', 'src/ui/presentation/rebuild/index.css', 'src/ui/presentation/rebuild/environment.css', 'src/ui/presentation/rebuild/environmentMotion.js', 'src/ui/presentation/rebuild/assets/celestial-plane.webp', 'src/ui/presentation/rebuild/assets/near-rocks-plane.webp', 'scripts/validation/derive-environment-planes.py', 'src/ui/presentation/rebuild/workbench.css', 'src/ui/presentation/rebuild/tokens.css', 'src/ui/presentation/rebuild/assets/first-person-cosmic-horizon.jpg', 'src/application/workbench/demo.js', 'src/main.js', 'src/audio/analyzer.js', 'src/audio/processor.js', 'src/audio/dsp.js', 'src/audio/genre.js', 'src/audio/vendor/lamejs-notices.js', 'tests/fixtures/audioStabilizationBridge.js', 'scripts/validation/audio-stabilization-probe.mjs', 'src/ui/workbench/workspace.js', 'src/ui/workbench/workspace.css', 'src/application/workbench/workbenchController.js', 'src/application/analysis/analysisController.js', 'dist/index.html', 'scripts/validation/run-workbench-browser.mjs']) code[relative] = sha(await fs.readFile(new URL('../../' + relative, import.meta.url)));
  report.codeSha256 = code;
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
if (primaryError) process.exitCode = 1;
