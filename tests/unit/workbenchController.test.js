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
  const timers = new Map(); let nextTimer = 1
  const platform = { AudioContext: Context, AudioBuffer: class {
    constructor({ length, numberOfChannels, sampleRate }) { return createPcmBuffer(Array.from({ length: numberOfChannels }, () => new Float32Array(length)), sampleRate) }
  }, cancelAnimationFrame: record("cancel-frame"), requestAnimationFrame: () => 1,
  performance: { now: () => 1000 },
  setTimeout(callback, delay) { const id = nextTimer++; timers.set(id, { callback, delay }); calls.push(["timer", id, delay]); return id },
  clearTimeout(id) { timers.delete(id); calls.push(["clear-timer", id]) } }
  const ports = {
    view: { render: record("render"), progress: record("progress"), toast: record("toast"), showPanel: record("panel") },
    audio: { decodeFile: async () => buffer, masterFix: async () => createToneBuffer({ amplitude: .3 }), convert: async () => ({ blob: new Blob(["fixture"]), ext: "wav", label: "fixture" }), encodeWav: b => { calls.push(["encode", b]); return new Blob(["fixture"]) }, saveBlob: record("save"), saveText: record("report") },
    reference: { async resolveStreamUrl() { return { error: "Unsupported track link" } }, async fetchPreviewBuffer() { throw Error("Unexpected synthetic-test network") } },
    analysis: { analyze: async b => { calls.push(["analyze", b]); return measured }, analyzeFast: async b => { calls.push(["fast", b]); return measured } }, platform,
    ...overrides,
  }
  const controller = createWorkbenchController(ports)
  return { controller, ports, calls, timers, state: controller.state }
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
it("dispose cancels a queued manual re-render before processing starts", async () => {
  const t = setup(); await t.controller.openFile(file)
  const render = t.ports.audio.masterFix; let renderCount = 0
  t.ports.audio.masterFix = async (...args) => { renderCount++; return render(...args) }
  await t.controller.runFix(); assert.equal(renderCount, 1)
  t.controller.setTweak("trimDb", 1)
  assert.equal(t.timers.size, 1)
  await t.controller.dispose()
  assert.equal(t.timers.size, 0)
  assert.equal(renderCount, 1)
  assert.equal(t.state.tweakBusy, false)
})
it("dispose suppresses late tweak progress/results without interrupting active render work", async () => {
  const t = setup(); await t.controller.openFile(file); await t.controller.runFix()
  const priorFixed = t.state.fixed
  let beginRender, finishRender, lateProgress
  const entered = new Promise(resolve => { beginRender = resolve })
  t.ports.audio.masterFix = (_buffer, _plan, onStage) => {
    lateProgress = onStage; onStage("render started"); beginRender()
    return new Promise(resolve => { finishRender = resolve })
  }
  let fastCalls = 0
  t.ports.analysis.analyzeFast = async () => { fastCalls++; return measured }
  t.controller.setTweak("trimDb", 1)
  const [timerId, timer] = t.timers.entries().next().value
  t.timers.delete(timerId)
  const activeRender = timer.callback()
  let settled = false
  activeRender.then(() => { settled = true })
  await entered
  await t.controller.dispose()
  assert.equal(settled, false)
  const renderCountAfterDispose = t.calls.filter(([kind]) => kind === "render").length
  const progressCountAfterDispose = t.calls.filter(([kind]) => kind === "progress").length
  lateProgress("late render stage")
  finishRender(createToneBuffer({ amplitude: .1 }))
  await activeRender
  assert.equal(settled, true)
  assert.equal(t.state.fixed, priorFixed)
  assert.equal(t.state.tweakBusy, false)
  assert.equal(fastCalls, 0)
  assert.equal(t.calls.filter(([kind]) => kind === "render").length, renderCountAfterDispose)
  assert.equal(t.calls.filter(([kind]) => kind === "progress").length, progressCountAfterDispose)
})
it("dispose suppresses a late conversion result but does not stop the conversion promise", async () => {
  const t = setup(); await t.controller.openFile(file)
  const priorConverted = { blob: new Blob(["prior"]), ext: "wav", label: "prior" }
  t.state.converted = priorConverted
  let enterConvert, finishConvert, receivedBuffer
  const entered = new Promise(resolve => { enterConvert = resolve })
  t.ports.audio.convert = (source) => {
    receivedBuffer = source; enterConvert()
    return new Promise(resolve => { finishConvert = resolve })
  }
  const converting = t.controller.runConvert({ format: "wav" })
  let settled = false
  converting.then(() => { settled = true })
  await entered
  assert.equal(t.state.busy, true)
  await t.controller.dispose()
  assert.equal(settled, false)
  const renderCountAfterDispose = t.calls.filter(([kind]) => kind === "render").length
  const progressCountAfterDispose = t.calls.filter(([kind]) => kind === "progress").length
  finishConvert({ blob: new Blob(["late"]), ext: "wav", label: "fixture" })
  await converting
  assert.equal(settled, true)
  assert.equal(receivedBuffer, buffer)
  assert.equal(t.state.converted, priorConverted)
  assert.equal(t.state.busy, false)
  assert.equal(t.calls.filter(([kind]) => kind === "save").length, 0)
  assert.equal(t.calls.filter(([type, message]) => type === "toast" && String(message).includes("Converted to")).length, 0)
  assert.equal(t.calls.filter(([kind]) => kind === "render").length, renderCountAfterDispose)
  assert.equal(t.calls.filter(([kind]) => kind === "progress").length, progressCountAfterDispose)
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
