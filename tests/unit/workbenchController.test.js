import assert from "node:assert/strict"
import { it } from "node:test"
import { createWorkbenchController } from "../../src/application/workbench/workbenchController.js"
import { analysisService } from "../../src/application/analysis/analysisService.js"
import { createToneBuffer, createPcmBuffer } from "../fixtures/audioBuffers.js"

// Controlled collaborator/operation tests ONLY. Real browser decoding, rendering,
// playback and download coverage is in run-workbench-browser.mjs, not these fakes.
const buffer = createToneBuffer(), measured = await analysisService.analyze(buffer)
function setup(overrides = {}) {
  const calls = [], record = name => (...args) => calls.push([name, ...args])
  class Context {
    state = "running"; currentTime = 0; destination = {}
    constructor() { calls.push(["context"]) }
    createAnalyser() { return { connect: record("analyser-connect") } }
    createBufferSource() { return { playbackRate: { value: 1 }, connect: record("source-connect"), start: record("start"), stop: record("stop-source") } }
    async close() { calls.push(["close"]) }
  }
  const platform = { AudioContext: Context, AudioBuffer: class {
    constructor({ length, numberOfChannels, sampleRate }) { return createPcmBuffer(Array.from({ length: numberOfChannels }, () => new Float32Array(length)), sampleRate) }
  }, cancelAnimationFrame: record("cancel-frame"), requestAnimationFrame: () => 1,
  performance: { now: () => 1000 }, setTimeout: record("timer"), clearTimeout: record("clear-timer") }
  const ports = {
    view: { render: record("render"), progress: record("progress"), toast: record("toast"), showPanel: record("panel") },
    audio: { decodeFile: async () => buffer, masterFix: async () => createToneBuffer({ amplitude: .3 }), convert: async () => ({ blob: new Blob(["fixture"]), ext: "wav", label: "fixture" }), encodeWav: b => { calls.push(["encode", b]); return new Blob(["fixture"]) }, saveBlob: record("save"), saveText: record("report") },
    reference: { async resolveStreamUrl() { return { error: "Unsupported track link" } }, async fetchPreviewBuffer() { throw Error("Unexpected synthetic-test network") } },
    analysis: { analyze: async b => { calls.push(["analyze", b]); return measured }, analyzeFast: async b => { calls.push(["fast", b]); return measured } }, platform,
    ...overrides,
  }
  const controller = createWorkbenchController(ports)
  return { controller, ports, calls, state: controller.state }
}
const file = { name: "input.wav", size: 123 }

it("requires real operation/view/reference ports; no default fake successes", () => {
  assert.throws(() => createWorkbenchController({}), TypeError)
  const t = setup()
  assert.throws(() => createWorkbenchController({ ...t.ports, audio: {} }), TypeError)
  assert.throws(() => createWorkbenchController({ ...t.ports, reference: {} }), TypeError)
})
it("construction has no backend calls, audio context, rendering or second authority", () => {
  const t = setup(); assert.deepEqual(t.calls, []); assert.equal(t.state.buffer, null); assert.ok(Object.isFrozen(t.controller))
})
it("import publishes the exact decoded buffer and uses the shared analysis service path", async () => {
  const t = setup(); await t.controller.openFile(file)
  assert.equal(t.state.buffer, buffer); assert.equal(t.state.analysis, measured); assert.equal(t.state.fileName, file.name)
  assert.equal(t.state.fixPlan, t.state.autoPlan); assert.equal(t.state.busy, false)
  assert.equal(t.calls.find(c => c[0] === "analyze")[1], buffer)
})
it("decode failure preserves the last valid buffer and reports the actual error", async t => {
  t.mock.method(console, "error", () => {})
  const f = setup(); await f.controller.openFile(file); const failure = new Error("decode failed")
  f.ports.audio.decodeFile = async () => { throw failure }; await f.controller.openFile(file)
  assert.equal(f.state.buffer, buffer); assert.equal(f.state.analysis, measured)
  assert.ok(f.calls.some(c => c[0] === "toast" && c[1].includes("decode failed")))
})
it("resolver-declined metadata stays an error, never a successful measured reference", async () => {
  const t = setup(); await t.controller.resolveReferenceUrl("https://example.invalid")
  assert.equal(t.state.ref.url.error, "Unsupported track link"); assert.equal(t.state.ref.url.meta, null)
  assert.equal(t.state.ref.url.resolving, false); assert.equal(t.state.analysis, null)
})
it("a rejected reference lookup reports failure and releases the resolving state", async t => {
  t.mock.method(console, "error", () => {})
  const f = setup(); f.ports.reference.resolveStreamUrl = async () => { throw Error("offline") }
  await f.controller.resolveReferenceUrl("https://example.invalid"); assert.equal(f.state.ref.url.resolving, false)
  assert.equal(f.state.ref.url.error, "offline"); assert.equal(f.state.ref.url.feat, undefined)
})
it("failed mastering preserves original and prior fixed copy, clears busy and exposes failure", async t => {
  t.mock.method(console, "error", () => {})
  const f = setup(); await f.controller.openFile(file); const prior = createToneBuffer({ amplitude: .2 }); f.state.fixed = prior
  f.ports.audio.masterFix = async () => { throw Error("render failed") }; await f.controller.runFix()
  assert.equal(f.state.buffer, buffer); assert.equal(f.state.fixed, prior); assert.equal(f.state.busy, false)
  assert.ok(f.calls.some(c => c[0] === "toast" && c[1].includes("render failed")))
})
it("successful mastering publishes separate B only after render/remeasure and uses real playback port", async () => {
  const t = setup(); await t.controller.openFile(file); await t.controller.runFix()
  assert.notEqual(t.state.fixed, buffer); assert.equal(t.state.buffer, buffer); assert.equal(t.state.ab, "fixed")
  assert.equal(t.state.fixedFast, measured); assert.ok(t.calls.some(c => c[0] === "start")); assert.equal(t.state.busy, false)
})
it("region export retains exact floor/ceil sample boundaries without mutating A", async () => {
  const t = setup(), oddRate = createToneBuffer({ sampleRate: 44101, length: 48000 }), before = oddRate.getChannelData(0).slice()
  t.ports.audio.decodeFile = async () => oddRate; await t.controller.openFile(file)
  t.controller.toggleCrop(); t.controller.setCrop("in", .25); t.controller.setCrop("out", .75); t.controller.exportCropRegion()
  const cropped = t.calls.find(c => c[0] === "encode")[1]
  assert.equal(cropped.length, Math.ceil(.75 * 44101) - Math.floor(.25 * 44101))
  assert.equal(cropped.getChannelData(0)[0], before[Math.floor(.25 * 44101)])
  assert.deepEqual(oddRate.getChannelData(0), before); assert.equal(t.state.buffer, oddRate)
})
it("conversion always receives A even with B selected; failed conversion cannot replace the last output", async t => {
  t.mock.method(console, "error", () => {})
  const f = setup(); await f.controller.openFile(file); await f.controller.runFix()
  let received; f.ports.audio.convert = async b => { received = b; return { blob: new Blob(["fixture"]), ext: "wav", label: "fixture" } }
  await f.controller.runConvert({ format: "wav" }); const prior = f.state.converted; assert.equal(received, buffer)
  f.ports.audio.convert = async () => { throw Error("encode failed") }; await f.controller.runConvert({ format: "mp3" })
  assert.equal(f.state.converted, prior); assert.equal(f.state.busy, false)
  assert.ok(f.calls.some(c => c[0] === "toast" && c[1].includes("encode failed")))
})
it("clear invalidates working outputs and creates fresh adjustment values, not aliased nested defaults", async () => {
  const t = setup(); await t.controller.openFile(file); const previous = t.state.tweaks.band
  t.controller.reset(); assert.equal(t.state.buffer, null); assert.equal(t.state.fixed, null); assert.equal(t.state.analysis, null)
  assert.notEqual(t.state.tweaks.band, previous); assert.equal(t.state.ab, "orig")
})
it("dispose closes the playback context and clears pending frame/tweak work", async () => {
  const t = setup(); await t.controller.openFile(file); t.controller.togglePlay(); await t.controller.dispose(); await t.controller.dispose()
  assert.equal(t.calls.filter(c => c[0] === "close").length, 1); assert.equal(t.state.playing, false)
  assert.ok(t.calls.some(c => c[0] === "cancel-frame")); assert.ok(t.calls.some(c => c[0] === "clear-timer"))
})
it("cropping B holds the view busy until remeasurement settles and releases on failure", async t => {
  t.mock.method(console, "error", () => {})
  const f = setup(); await f.controller.openFile(file); await f.controller.runFix(); f.controller.stopPlayback()
  let reject, entered
  const waiting = new Promise(resolve => { entered = resolve })
  f.ports.analysis.analyzeFast = () => { entered(); return new Promise((_, r) => { reject = r }) }
  f.controller.toggleCrop(); f.controller.setCrop("out", .3)
  const crop = f.controller.applyCrop(); await waiting; assert.equal(f.state.busy, true)
  reject(Error("remeasure failed")); await crop; assert.equal(f.state.busy, false)
  assert.ok(f.calls.some(c => c[0] === "toast" && c[1].includes("remeasure failed")))
  assert.equal(f.state.buffer, buffer)
})

function deferred() { let resolve, entered; const started=new Promise(r=>{entered=r}); const promise=new Promise(r=>{resolve=r}); return {resolve,started,wait(){entered();return promise}} }
it('dispose during render cannot promote B or recreate a playback context',async()=>{
  const f=setup();await f.controller.openFile(file);const prior=createToneBuffer({amplitude:.2});f.state.fixed=prior;
  const d=deferred();f.ports.audio.masterFix=()=>d.wait();const job=f.controller.runFix();await d.started;
  await f.controller.dispose();d.resolve(createToneBuffer({amplitude:.3}));await job;
  assert.equal(f.state.fixed,prior);assert.equal(f.state.playing,false);assert.equal(f.calls.filter(c=>c[0]==='context').length,0);
});
it('dispose during fast remeasurement prevents late B promotion',async()=>{
  const f=setup();await f.controller.openFile(file);const prior=createToneBuffer({amplitude:.2});f.state.fixed=prior;
  const d=deferred();f.ports.analysis.analyzeFast=()=>d.wait();const job=f.controller.runFix();await d.started;
  await f.controller.dispose();d.resolve(measured);await job;assert.equal(f.state.fixed,prior);assert.equal(f.state.playing,false);
});
it('dispose during full analysis preserves the last valid analysis and suppresses late effects',async()=>{
  const f=setup();await f.controller.openFile(file);const d=deferred();f.ports.analysis.analyze=()=>d.wait();
  const job=f.controller.runAnalysis();await d.started;await f.controller.dispose();const count=f.calls.length;
  d.resolve({...measured,lufs:-18});await job;assert.equal(f.state.analysis,measured);assert.equal(f.calls.length,count);
});
it('dispose during decode cannot replace the source or restart analysis',async()=>{
  const f=setup();await f.controller.openFile(file);const d=deferred();f.ports.audio.decodeFile=()=>d.wait();
  const job=f.controller.openFile({name:'late.wav',size:42});await d.started;await f.controller.dispose();
  d.resolve(createToneBuffer({amplitude:.2}));await job;assert.equal(f.state.fileName,'input.wav');assert.equal(f.state.buffer,buffer);
});
it('dispose during conversion cannot publish/download a late output',async()=>{
  const f=setup();await f.controller.openFile(file);await f.controller.runConvert({format:'wav'});const prior=f.state.converted;
  const d=deferred();f.ports.audio.convert=()=>d.wait();const job=f.controller.runConvert({format:'mp3'});await d.started;
  await f.controller.dispose();const saves=f.calls.filter(c=>c[0]==='save').length;
  d.resolve({blob:new Blob(['late']),ext:'mp3',label:'late'});await job;
  assert.equal(f.state.converted,prior);assert.equal(f.calls.filter(c=>c[0]==='save').length,saves);
});
it('failed B-crop remeasurement preserves the last valid B and its analysis',async t=>{
  t.mock.method(console,'error',()=>{});const f=setup();await f.controller.openFile(file);await f.controller.runFix();f.controller.stopPlayback();
  const prior=f.state.fixed,fast=f.state.fixedFast;f.ports.analysis.analyzeFast=async()=>{throw Error('crop analysis failed')};
  f.controller.toggleCrop();f.controller.setCrop('out',.3);await f.controller.applyCrop();
  assert.equal(f.state.fixed,prior);assert.equal(f.state.fixedFast,fast);assert.equal(f.state.busy,false);
});
it('dispose during reference lookup cannot publish success or failure afterward',async()=>{
  for(const rejected of [false,true]){
    const f=setup();let resolve,reject;f.ports.reference.resolveStreamUrl=()=>new Promise((r,j)=>{resolve=r;reject=j});
    const job=f.controller.resolveReferenceUrl('https://example.invalid');await f.controller.dispose();const prior=f.state.ref.url,count=f.calls.length;
    if(rejected)reject(Error('late failure'));else resolve({title:'late',identityKnown:true});
    await job;assert.equal(f.state.ref.url,prior);assert.equal(f.calls.length,count);
  }
});
