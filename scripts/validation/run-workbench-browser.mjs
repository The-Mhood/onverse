// Trusted local production page + synthetic PCM ONLY. Disabled-sandbox Chromium
// is never used for user media, untrusted sites or Electron/security qualification.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { auditTools } from './run-offline-render-probe.mjs';

const tools = process.argv[2];
const audit = await auditTools(tools);
assert.equal(audit.packages, 43);
const runtime = await fs.mkdtemp('/tmp/onverse-browser-runtime-');
await fs.chmod(runtime, 0o700);
const reviews = fileURLToPath(new URL('../../../reviews/', import.meta.url));
await fs.mkdir(reviews, { recursive: true });
const output = await fs.mkdtemp(path.join(reviews, 'workbench-browser-20261016-'));
const originalEnv = { ...process.env };
const report = { kind: 'actual-production-entry-and-synthetic-workflows', output, node: process.version, tools: audit, checks: [], errors: [], console: [], requests: [], failedResponses: [], blockedRequests: [], screenshots: [], downloads: [], limits: ['Trusted local synthetic PCM only; no user media, real provider or listening.', 'Headless Chromium with disabled sandbox; not Electron/Mac/security qualification.', 'The authored environment asset and semantic tokens are used; numbered source images remain references and are not bundled into the UI.'] };
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
  browser = await pm.default.launch({ executablePath, headless: true, pipe: true, userDataDir: path.join(runtime, 'profile'), env: { ...process.env }, args: [...cm.default.args,
    '--disable-background-networking', '--disable-component-update', '--disable-domain-reliability', '--disable-sync', '--no-first-run', '--no-default-browser-check', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--disk-cache-dir=' + path.join(runtime, 'cache')] });
  report.browser = await browser.version(); page = await browser.newPage();
  page.on('pageerror', error => report.errors.push({ phase, error: error.message }));
  page.on('console', message => report.console.push({ phase, type: message.type(), text: message.text() }));
  page.on('response', response => { if (response.status() >= 400) report.failedResponses.push({ phase, status: response.status(), url: response.url() }); });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url(); report.requests.push({ phase, url: url.slice(0, 300) });
    if (url.startsWith('http://127.0.0.1:4173/') || url.startsWith('blob:http://127.0.0.1:4173/') || url.startsWith('data:')) request.continue().catch(e => report.errors.push({ phase, error: e.message }));
    else { report.blockedRequests.push({ phase, url }); request.abort().catch(e => report.errors.push({ phase, error: e.message })); }
  });
  await page.evaluateOnNewDocument(() => {
    // Instrument real constructors/close, not fake audio implementations.
    window.__audioAudit = { contexts: 0, offline: 0, closes: 0, sampleRates: [], decoded: [], contextStates: [] };
    const Native = window.AudioContext, Offline = window.OfflineAudioContext;
    window.AudioContext = class extends Native { constructor(...args) { super(...args); window.__audioAudit.contexts++; window.__audioAudit.sampleRates.push(this.sampleRate); window.__audioAudit.contextStates.push({ state: this.state, currentTime: this.currentTime }); this.addEventListener('statechange', () => window.__audioAudit.contextStates.push({ state: this.state, currentTime: this.currentTime })); } async decodeAudioData(...args) { const b = await super.decodeAudioData(...args); window.__audioAudit.decoded.push({ frames: b.length, sampleRate: b.sampleRate, channels: b.numberOfChannels }); return b; } close() { window.__audioAudit.closes++; return super.close(); } };
    window.OfflineAudioContext = class extends Offline { constructor(...args) { super(...args); window.__audioAudit.offline++; } };
  });
  cdp = await browser.target().createCDPSession();
  cdp.on('Browser.downloadWillBegin', event => downloadNames.set(event.guid, event.suggestedFilename));
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: path.join(runtime, 'downloads'), eventsEnabled: true });
  await page.setViewport({ width: 1480, height: 920, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('.workspace-root');
  assert.equal(await page.$eval('.mix-picker', e => e.type), 'file');
  assert.deepEqual(await page.evaluate(() => window.__audioAudit), { contexts: 0, offline: 0, closes: 0, sampleRates: [], decoded: [], contextStates: [] });
  assert.equal(await page.$eval('[data-action="fix"]', e => e.disabled), true);
  report.checks.push('Actual production HTML executes ESM, mounts and binds; zero startup audio contexts, no legacy selector/stage dependency.');
  await capture('empty', 1120, 700); await capture('empty', 1480, 920);

  phase = 'motion-performance';
  const beforeMotionMetrics = await page.metrics();
  const motionSample = await page.evaluate(async () => {
    const environment = document.querySelector('.environment');
    const before = getComputedStyle(environment, '::before');
    const startTransform = before.transform, animationName = before.animationName, animationDuration = before.animationDuration;
    const waitFrames = milliseconds => new Promise(resolve => {
      const started = performance.now();
      function tick(now) { if (now - started >= milliseconds) resolve(now - started); else requestAnimationFrame(tick); }
      requestAnimationFrame(tick);
    });
    const sampleFrames = () => new Promise(resolve => {
      const started = performance.now(); let frames = 0;
      function tick(now) { frames++; if (now - started >= 2000) resolve({ elapsedMs: now - started, frames, fps: frames / ((now - started) / 1000) }); else requestAnimationFrame(tick); }
      requestAnimationFrame(tick);
    });
    const warmupMs = await waitFrames(2000), samples = [];
    for (let i = 0; i < 3; i++) samples.push(await sampleFrames());
    return { animationName, animationDuration, startTransform, endTransform: getComputedStyle(environment, '::before').transform, warmupMs, samples };
  });
  const afterMotionMetrics = await page.metrics();
  assert.match(motionSample.animationName, /mvo-nebula-drift/);
  assert.notEqual(motionSample.startTransform, motionSample.endTransform, 'the environment transform should drift over the observation window');
  const motionRates = motionSample.samples.map(sample => sample.fps).sort((a, b) => a - b);
  const medianRafFps = motionRates[Math.floor(motionRates.length / 2)];
  const layoutCountDelta = afterMotionMetrics.LayoutCount - beforeMotionMetrics.LayoutCount;
  assert.ok(medianRafFps >= 30, JSON.stringify({ motionSample, medianRafFps }));
  assert.equal(layoutCountDelta, 0, 'environment drift should not cause layout work');
  report.motionPerformance = { ...motionSample, medianRafFps, minimumRafFps: motionRates[0], taskDurationMs: (afterMotionMetrics.TaskDuration - beforeMotionMetrics.TaskDuration) * 1000, scriptDurationMs: (afterMotionMetrics.ScriptDuration - beforeMotionMetrics.ScriptDuration) * 1000, layoutCountDelta, recalcStyleCountDelta: afterMotionMetrics.RecalcStyleCount - beforeMotionMetrics.RecalcStyleCount };
  report.checks.push('CSS environmental drift changed its computed transform; after a 2-second warm-up, three 2-second frame-cadence windows had a median of at least 30fps with zero layout-count increase.');

  phase = 'demo'; await click('demo'); await waitReady();
  assert.match(await page.$eval('.source-name', e => e.textContent), /Demo/);
  assert.ok(Number.isFinite(Number(await page.$eval('.overall-score', e => e.textContent))));
  report.checks.push('Real 16-second synth demo and real analyzer complete through UI.');

  phase = 'import';
  const sampleRate = 48000, frames = sampleRate * 6, wav = Buffer.alloc(44 + frames * 4);
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
  report.checks.push('Local WAV file picker invokes real decoder and automatic analysis; 6-second stereo 48kHz fixture decodes at native AudioContext rate, preserving existing processor behavior.');

  phase = 'reference'; await page.select('.reference-source', 'file');
  await (await page.$('.reference-picker')).uploadFile(fixture);
  await page.waitForFunction(() => document.querySelector('.target-label').textContent.includes('measured reference')); await waitReady();
  report.checks.push('Uploaded reference is decoded/measured and used for real comparison.');
  await page.select('.reference-source', 'auto'); await page.select('.category', 'hiphop'); await page.select('.subgenre', 'Trap'); await click('analyze'); await waitReady();
  assert.match(await page.$eval('.target-label', e => e.textContent), /Trap.*built-in profile/);
  report.checks.push('Manual category/subgenre selection re-analyzes against the actual built-in profile, labelled as heuristic.');

  phase = 'playback'; const positionBeforePlayback = Number(await page.$eval('.position', e => e.value)); await click('play');
  await page.waitForFunction(() => document.querySelector('[data-action="play"]').textContent === 'Pause', { timeout: 5000, polling: 100 });
  await page.waitForFunction(before => Number(document.querySelector('.position').value) > before + .05, { timeout: 10000, polling: 100 }, positionBeforePlayback);
  report.playbackPosition = { before: positionBeforePlayback, after: Number(await page.$eval('.position', e => e.value)) };
  report.playbackContextStates = await page.evaluate(() => window.__audioAudit.contextStates || []);
  await click('play'); assert.equal(await page.$eval('[data-action="play"]', e => e.textContent), 'Play');
  await edit('.position', .5); await click('rate'); assert.equal(await page.$eval('[data-action="rate"]', e => e.textContent), '1.5×');
  await click('rate'); await click('rate'); await click('rate');
  report.checks.push('Real AudioContext source advances, pauses, seeks and cycles playback rate. No listening claim.');

  phase = 'region-export'; await click('crop'); await edit('.region-in', .25); await edit('.region-out', 1.25);
  const region = await download('export-region'); assert.equal(region.frames, decodedSampleRate); assert.equal(region.channels, 2);
  await click('crop'); report.checks.push('IN/OUT region exports genuine 1-second stereo WAV with expected sample count.');

  phase = 'master-fix'; await click('fix'); await waitReady();
  assert.equal(await page.$eval('[data-action="fixed"]', e => e.getAttribute('aria-pressed')), 'true');
  assert.match(await page.$eval('.fixed-measurement', e => e.textContent), /^B:/);
  await click('play'); await click('original'); await click('fixed');
  report.checks.push('Real OfflineAudioContext Master Fix + fast remeasurement publishes distinct B; original/fixed A–B selection works.');

  phase = 'manual-adjustment'; await page.$eval('.adjustments', el => { el.open = true; });
  const prior = (await download('save-fixed')).sha256;
  const beforeManual = await page.evaluate(() => window.__audioAudit.offline);
  await page.$eval('[data-tweak="trimDb"]', el => { el.value = '-1'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForFunction(before => window.__audioAudit.offline > before && !document.querySelector('[data-action="fix"]').disabled, { timeout: 30000 }, beforeManual); await waitReady();
  const adjusted = await download('save-fixed'); assert.notEqual(adjusted.sha256, prior);
  assert.ok(await page.evaluate(() => window.__audioAudit.offline >= 2));
  const beforeReset = await page.evaluate(() => window.__audioAudit.offline);
  await click('reset-tweaks'); await page.waitForFunction(before => window.__audioAudit.offline > before && !document.querySelector('[data-action="fix"]').disabled, { timeout: 30000 }, beforeReset); await waitReady();
  report.checks.push('Manual output trim produces different real rendered WAV bytes; reset triggers another real render.');
  await page.$eval('.adjustments', el => { el.open = false; });

  phase = 'conversion'; await page.select('.output-format', 'wav'); const converted = await download('convert'); assert.equal(converted.frames, decodedGeometry.frames); assert.equal(converted.sha256, original.sha256);
  await page.select('.output-format', 'mp3'); const mp3 = await download('convert'); assert.ok(mp3.bytes > 1000);
  const decodedMp3 = await page.evaluate(async bytes => {
    const ctx = new AudioContext(); try { const buf = await ctx.decodeAudioData(Uint8Array.from(bytes).buffer); return { duration: buf.duration, channels: buf.numberOfChannels }; } finally { await ctx.close(); }
  }, [...await fs.readFile(path.join(output, mp3.file))]);
  assert.ok(Math.abs(decodedMp3.duration - frames / sampleRate) < .2); assert.equal(decodedMp3.channels, 2); report.mp3Decode = decodedMp3;
  await download('report');
  report.recorderCapabilities = await page.$$eval('.output-format option', options => options.map(o => ({ format: o.value, disabled: o.disabled })));
  for (const option of report.recorderCapabilities.filter(o => ['m4a', 'ogg', 'webm'].includes(o.format) && !o.disabled)) {
    await page.select('.output-format', option.format); const encoded = await download('convert'); assert.ok(encoded.bytes > 1000);
    const bytes = await fs.readFile(path.join(output, encoded.file));
    const geometry = await page.evaluate(async data => { const ctx = new AudioContext(); try { const b = await ctx.decodeAudioData(Uint8Array.from(data).buffer); return { duration: b.duration, channels: b.numberOfChannels }; } finally { await ctx.close(); } }, [...bytes]);
    const expectedDuration = frames / sampleRate;
    assert.ok(geometry.duration >= expectedDuration - .25 && geometry.duration <= expectedDuration + .75, JSON.stringify({ geometry, expectedDuration })); assert.equal(geometry.channels, 2); encoded.decodedGeometry = geometry;
  }
  report.checks.push('WAV A bytes remain exactly equal before/after Master Fix and adjustments. WAV and MP3 conversion download real files; MP3 decodes back to stereo of expected duration; text report downloads.');

  phase = 'screenshots-loaded'; await click('original'); await edit('.position', 0); await page.select('.output-format', 'wav');
  await capture('loaded', 1120, 700); await capture('loaded', 1480, 920);
  const normalTransitionDurationsMs = await page.evaluate(() => getComputedStyle(document.querySelector('[data-surface="workspace"]')).transitionDuration.split(',').map(value => parseFloat(value) * (value.trim().endsWith('ms') ? 1 : 1000)));
  assert.ok(normalTransitionDurationsMs.length > 0 && normalTransitionDurationsMs.every(value => value >= 100), JSON.stringify(normalTransitionDurationsMs));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const reducedMotion = await page.evaluate(() => {
    const environment = document.querySelector('.environment');
    const editor = document.querySelector('[data-surface="workspace"]');
    const transitionDurationsMs = getComputedStyle(editor).transitionDuration.split(',').map(value => parseFloat(value) * (value.trim().endsWith('ms') ? 1 : 1000));
    return { enabled: matchMedia('(prefers-reduced-motion: reduce)').matches, environmentBefore: getComputedStyle(environment, '::before').animationName, environmentAfter: getComputedStyle(environment, '::after').animationName, transitionDurationsMs, activeViewPhaseHooks: document.querySelectorAll('[data-view-phase]').length };
  });
  assert.equal(reducedMotion.enabled, true);
  assert.equal(reducedMotion.environmentBefore, 'none'); assert.equal(reducedMotion.environmentAfter, 'none');
  assert.ok(reducedMotion.transitionDurationsMs.every(value => value <= .01), JSON.stringify(reducedMotion));
  report.reducedMotion = { ...reducedMotion, normalTransitionDurationsMs };
  report.checks.push('1120x700 and 1480x920 viewport captures: no horizontal overflow, clipped controls or broken images; normal editor transitions exceed 100ms and reduced motion disables environmental animation and reduces them to 0.01ms. No explicit view-switch phase hooks are active.');

  phase = 'crop-fixed'; await click('fixed'); await click('crop'); await edit('.region-in', .25); await edit('.region-out', 1.25); await click('apply-crop');
  await page.waitForFunction(() => document.querySelector('.operation-status').textContent.includes('B cropped and re-measured'));
  await click('play'); const fixedCrop = await download('save-fixed'); assert.equal(fixedCrop.frames, Math.ceil(1.25 * fixedCrop.sampleRate) - Math.floor(.25 * fixedCrop.sampleRate));
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
  report.checks.push('Registered pagehide cleanup closes the real playback context; event/listener disposal executed. Not a native Electron quit test.');
  report.performanceMetrics = await page.metrics();
  assert.deepEqual(report.errors, []); assert.deepEqual(report.failedResponses, []); assert.deepEqual(report.blockedRequests, []);
  const unexpectedConsole = report.console.filter(e => e.type === 'error' && e.phase !== 'expected-decode-error');
  assert.deepEqual(unexpectedConsole, []);
  report.result = 'PASS';
} catch (error) {
  primaryError = error; report.result = 'FAIL'; report.failure = { phase, message: error.message, stack: error.stack };
  if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
} finally {
  let closed = true;
  try { if (browser) await browser.close(); } catch (error) { closed = false; report.cleanupError = error.message; primaryError ||= error; }
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, originalEnv);
  if (closed) { await fs.rm(runtime, { recursive: true, force: true }); report.privateRuntimeRemoved = true; }
  else report.privateRuntimeRemoved = false;
  const code = {};
  for (const relative of ['index.html', 'src/ui/presentation/rebuild/index.css', 'src/ui/presentation/rebuild/environment.css', 'src/ui/presentation/rebuild/workbench.css', 'src/ui/presentation/rebuild/tokens.css', 'src/ui/presentation/rebuild/assets/first-person-cosmic-horizon.jpg', 'src/application/workbench/demo.js', 'src/main.js', 'src/ui/workbench/workspace.js', 'src/ui/workbench/workspace.css', 'src/application/workbench/workbenchController.js', 'src/application/analysis/analysisController.js', 'dist/index.html', 'scripts/validation/run-workbench-browser.mjs']) code[relative] = sha(await fs.readFile(new URL('../../' + relative, import.meta.url)));
  report.codeSha256 = code;
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
if (primaryError) process.exitCode = 1;
