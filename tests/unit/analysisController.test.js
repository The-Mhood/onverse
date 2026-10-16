import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createAnalysisController } from "../../src/application/analysis/analysisController.js"
import { analysisService } from "../../src/application/analysis/analysisService.js"
import { scoreAnalysis, buildIssues, buildFixPlan } from "../../src/audio/analyzer.js"
import { createToneBuffer } from "../fixtures/audioBuffers.js"

// These nine assertions match the existing controller boundary suite. That
// original main.js/VM suite stays untouched until the actual shared-file cutover.
// No DOM, browser, decoder, player, provider or measurement-quality certification.
function setup(overrides = {}) {
  const calls = []
  const analysis = { measured: true }
  const prior = { existing: true }
  const state = { buffer: {}, busy: false, analysis: prior, fixed: {}, ref: {} }
  const record = name => (...args) => calls.push([name, ...args])
  const context = {
    state,
    stopPlayback: record("stop"), updateAbUI: record("ab"), renderRefAreas: record("refs"),
    ensureReferenceReady: async () => ({ ok: true, kind: "file" }),
    showProgress: record("progress"), setProgress: record("value"), setProgressLabel: record("label"),
    analysisService: { async analyze(buffer, onProgress) { onProgress(0.5); return analysis } },
    makeTarget: (kind, result) => {
      assert.equal(kind, "file"); assert.equal(result, analysis)
      return { g: { name: "Reference" }, meta: { title: "Measured reference" } }
    },
    scoreAnalysis: () => ({ overall: 80 }),
    buildIssues: () => ({ issues: [], positives: [] }), buildFixPlan: () => ({ eq: [] }),
    renderAnalysis: record("analysisView"), renderReport: record("report"),
    renderTweakPanel: record("tweaks"), showPanel: record("panel"), toast: record("toast"),
    console: { error: record("error") },
    ...overrides,
  }
  const controller = createAnalysisController(context)
  return { run: controller.runAnalysis, controller, ports: context, state: context.state, calls, analysis, prior }
}

function cleaned(test) {
  assert.equal(test.state.busy, false)
  assert.ok(test.calls.some(([kind, visible]) => kind === "progress" && visible === false))
  assert.equal(test.calls.at(-1)[0], "refs")
}
function failed(test, error, message) {
  cleaned(test)
  assert.equal(test.state.analysis, test.prior, "failed measurement must not publish a new result")
  assert.ok(test.calls.some(([kind, received]) => kind === "error" && received === error))
  assert.ok(test.calls.some(([kind, value]) => kind === "toast" && value === `Analysis failed: ${message}`))
  assert.ok(!test.calls.some(([kind]) => kind === "analysisView"))
}

describe("DOM-free candidate: original nine controller failure cases", () => {
  it("commits successful analysis through the existing view path and releases busy state", async () => {
    const test = setup()
    await test.run()
    cleaned(test)
    assert.equal(test.state.analysis, test.analysis)
    assert.equal(test.state.scores.overall, 80)
    assert.equal(test.state.fixed, null)
    assert.ok(test.calls.some(([kind, panel]) => kind === "panel" && panel === "Analysis"))
    assert.ok(!test.calls.some(([kind]) => kind === "error"))
  })

  it("handles rejected reference preparation inside the same cleanup boundary", async () => {
    const error = new Error("Reference preparation failed")
    const test = setup({ ensureReferenceReady: async () => { throw error } })
    await test.run()
    failed(test, error, error.message)
  })

  it("cleans up a declined reference without starting analysis or reporting success", async () => {
    let measured = false
    const test = setup({ ensureReferenceReady: async () => ({ ok: false }),
      analysisService: { async analyze() { measured = true } } })
    await test.run()
    cleaned(test)
    assert.equal(measured, false)
    assert.equal(test.state.analysis, test.prior)
    assert.ok(!test.calls.some(([kind]) => kind === "toast"))
  })

  it("handles an engine rejection without replacing its error identity", async () => {
    const error = new Error("Engine rejected")
    const test = setup({ analysisService: { analyze: () => Promise.reject(error) } })
    await test.run()
    failed(test, error, error.message)
  })

  it("handles a progress-consumer exception and releases busy state", async () => {
    const error = new Error("Progress view failed")
    const test = setup({ setProgress() { throw error } })
    await test.run()
    failed(test, error, error.message)
  })

  it("handles setup failure after acquiring busy state", async () => {
    const error = new Error("Control view failed")
    const test = setup({ updateAbUI() { throw error } })
    await test.run()
    failed(test, error, error.message)
  })

  it("reports non-Error rejection values without throwing while formatting them", async () => {
    for (const error of [null, undefined, "Reference unavailable"]) {
      const test = setup({ ensureReferenceReady: () => Promise.reject(error) })
      await test.run()
      failed(test, error, String(error))
    }
  })

  it("handles a synchronous analyzer throw", async () => {
    const error = new Error("Analyzer threw")
    const test = setup({ analysisService: { analyze() { throw error } } })
    await test.run()
    failed(test, error, error.message)
  })

  it("does not start work without a buffer or while already busy", async () => {
    for (const state of [{ buffer: null, busy: false }, { buffer: {}, busy: true }]) {
      const test = setup({ state })
      await test.run()
      assert.equal(test.state.busy, state.busy)
      assert.deepEqual(test.calls, [])
    }
  })
})

const features = () => ({ lufs: -12, crestDb: 10, centroid: 1200, stereo: { corr: .5, widthDb: -4 },
  bands: { sub: -10, bass: -2, low: -4, mid: -3, high: -5, presence: -8, air: -12 } })
const defaultReference = (ref, overrides = {}) => setup({ state: { buffer: {}, busy: false, ref },
  ensureReferenceReady: undefined, makeTarget: undefined, ...overrides })

describe("candidate construction and state/operation effects", () => {
  it("constructs without calls or state mutation and freezes only its API, not a duplicate store", () => {
    const state = { buffer: {}, busy: false, ref: { src: "auto" } }, before = structuredClone(state)
    const t = setup({ state }); assert.deepEqual(state, before); assert.deepEqual(t.calls, [])
    assert.ok(Object.isFrozen(t.controller)); assert.equal(t.state, state); assert.equal(Object.isFrozen(state), false)
    assert.deepEqual(Object.keys(t.controller), ["runAnalysis", "ensureReferenceReady", "makeTarget"])
  })
  it("refuses incomplete collaborators rather than installing successful-looking no-op effects", () => {
    assert.throws(() => createAnalysisController({}), TypeError)
    const t = setup()
    for (const key of ["stopPlayback", "updateAbUI", "renderRefAreas", "showProgress", "setProgress", "setProgressLabel", "renderAnalysis", "renderReport", "renderTweakPanel", "showPanel", "toast"])
      assert.throws(() => createAnalysisController({ ...t.ports, [key]: undefined }), TypeError)
    for (const override of [{ analysisService: {} }, { console: {} }, { makeTarget: null }, { ensureReferenceReady: false }, { scoreAnalysis: false }])
      assert.throws(() => createAnalysisController({ ...t.ports, ...override }), TypeError)
    assert.deepEqual(t.calls, [])
  })
  it("forwards exact state/buffer/result/plan identity and preserves the visible event order", async () => {
    const analysis = {}, target = { g: { name: "Reference" }, meta: { title: "Measured reference" } }, plan = {}, scores = { overall: 80 }, issues = [], positives = []
    let received
    const t = setup({ analysisService: { async analyze(buffer, cb) { received = buffer; cb(0); cb(.5); cb(1); return analysis } },
      makeTarget: () => target, scoreAnalysis: () => scores, buildIssues: () => ({ issues, positives }), buildFixPlan: () => plan })
    const buffer = t.state.buffer; await t.run()
    assert.equal(received, buffer); assert.equal(t.state.buffer, buffer); assert.equal(t.state.analysis, analysis)
    assert.equal(t.state.autoPlan, plan); assert.equal(t.state.fixPlan, plan); assert.equal(t.state.scores, scores)
    assert.equal(t.state.targetUsed, target); assert.equal(t.state.issues.issues, issues); assert.equal(t.state.issues.positives, positives)
    assert.equal(t.state.fixedFast, null); assert.equal(t.state.hasCustomTweaks, false); assert.equal(t.state.ab, "orig")
    assert.deepEqual(t.calls.map(c => c[0]), ["stop", "ab", "refs", "progress", "value", "label", "value", "label", "value", "label", "analysisView", "report", "refs", "tweaks", "panel", "toast", "progress", "refs"])
    assert.deepEqual(t.calls.filter(c => c[0] === "label").map(c => c[1]), ["Reading waveform…", "Checking pitch…", "Finalizing…"])
  })
  it("reuses the caller's busy guard across two factories; never creates separate operation authority", async () => {
    let release, entered, count = 0
    const waiting = new Promise(r => { entered = r })
    const t = setup({ analysisService: { analyze() { count++; entered(); return new Promise(r => { release = r }) } } })
    const second = createAnalysisController(t.ports), first = t.run(); await waiting
    await second.runAnalysis(); assert.equal(count, 1); assert.equal(t.state.busy, true)
    release(t.analysis); await first; assert.equal(t.state.busy, false); assert.equal(t.state.analysis, t.analysis)
  })
  for (const key of ["scoreAnalysis", "buildIssues", "buildFixPlan"]) {
    it(`does not publish a result if ${key} throws`, async () => {
      const error = new Error(key), t = setup({ [key]: () => { throw error } })
      await t.run(); failed(t, error, error.message)
    })
  }
  it("retains existing post-publication view-error behavior, without inventing atomic rollback", async () => {
    const error = new Error("render failed"), t = setup({ renderAnalysis: () => { throw error } })
    await t.run(); cleaned(t); assert.equal(t.state.analysis, t.analysis)
    assert.ok(t.calls.some(([kind, value]) => kind === "error" && value === error))
    assert.ok(!t.calls.some(([kind, value]) => kind === "toast" && value.startsWith("Analysis complete")))
  })
  it("does not swallow a finally-consumer failure; busy is released before that error propagates", async () => {
    const error = new Error("cleanup failed"), t = setup({ showProgress: visible => { if (!visible) throw error } })
    await assert.rejects(t.run(), received => received === error); assert.equal(t.state.busy, false)
  })
})

describe("reference preparation without DOM/network startup", () => {
  it("returns auto immediately without invoking effects or measurement", async () => {
    const t = defaultReference({ src: "auto" }); assert.deepEqual(await t.controller.ensureReferenceReady(), { ok: true, kind: "auto" }); assert.deepEqual(t.calls, [])
  })
  it("declines a missing uploaded reference without measuring anything", async () => {
    const t = defaultReference({ src: "file", file: null }); assert.deepEqual(await t.controller.ensureReferenceReady(), { ok: false }); assert.ok(t.calls.some(c => c[1] === "Upload a reference track first."))
  })
  it("measures the exact uploaded buffer once and keeps reference features on the same ref object", async () => {
    const ref = { src: "file", file: { buf: {}, name: "reference.wav" } }, feat = features(); let count = 0
    const t = defaultReference(ref, { analysisService: { async analyze(buffer, cb) { assert.equal(buffer, ref.file.buf); count++; cb(.1); cb(.8); return feat } } })
    assert.deepEqual(await t.controller.ensureReferenceReady(), { ok: true, kind: "file" }); assert.equal(ref.file.feat, feat)
    await t.controller.ensureReferenceReady(); assert.equal(count, 1); assert.equal(t.state.ref, ref)
    assert.deepEqual(t.calls.filter(c => c[0] === "label").map(c => c[1]), ["Analyzing your reference track…", "Scanning reference spectrum…"])
  })
  it("declines failed uploaded measurement and does not analyze the main buffer", async () => {
    const error = new Error("reference failed"); let count = 0
    const t = defaultReference({ src: "file", file: { buf: {}, name: "bad.wav" } }, { analysisService: { async analyze() { count++; throw error } } })
    await t.run(); assert.equal(count, 1); assert.equal(t.state.analysis, undefined); assert.equal(t.state.busy, false)
    assert.ok(t.calls.some(c => c[0] === "error" && c[1] === error)); assert.ok(!t.calls.some(c => c[0] === "analysisView"))
  })
  it("declines missing, failed and unidentified URL references without an invented measurement", async () => {
    for (const url of [null, { error: "unresolved" }, { meta: { identityKnown: false } }]) {
      const t = defaultReference({ src: "url", url }); assert.deepEqual(await t.controller.ensureReferenceReady(), { ok: false })
      assert.ok(!t.calls.some(c => c[0] === "analysisView")); assert.ok(!url?.prepared)
    }
  })
  it("accepts identified metadata-only references as profile, never measured streamed audio", async () => {
    const url = { meta: { identityKnown: true, cat: "hiphop" } }, t = defaultReference({ src: "url", url })
    assert.deepEqual(await t.controller.ensureReferenceReady(), { ok: true, kind: "profile" }); assert.equal(url.prepared, true); assert.equal(url.feat, undefined)
    assert.deepEqual(await t.controller.ensureReferenceReady(), { ok: true, kind: "profile" }); assert.deepEqual(t.calls, [])
  })
  it("forwards an explicitly requested preview to injected fetch/measure ports once with original progress mapping", async () => {
    const url = { meta: { previewUrl: "https://preview.example.invalid/fixture" } }, buffer = {}, feat = features(); let fetched = 0, measured = 0
    const t = defaultReference({ src: "url", url }, { fetchPreviewBuffer: async received => { assert.equal(received, url.meta.previewUrl); fetched++; return buffer },
      analysisService: { async analyze(received, cb) { assert.equal(received, buffer); measured++; cb(0); cb(1); return feat } } })
    assert.deepEqual(await t.controller.ensureReferenceReady(), { ok: true, kind: "url" }); assert.equal(url.buf, buffer); assert.equal(url.feat, feat)
    await t.controller.ensureReferenceReady(); assert.equal(fetched, 1); assert.equal(measured, 1)
    assert.deepEqual(t.calls.filter(c => c[0] === "value").map(c => c[1]), [.35, .35, 1])
  })
  it("preserves profile fallback when preview fetch fails, without retrying or fabricating features", async () => {
    const error = new Error("offline"), url = { meta: { previewUrl: "https://preview.example.invalid/fixture" } }; let fetched = 0
    const t = defaultReference({ src: "url", url }, { fetchPreviewBuffer: async () => { fetched++; throw error } })
    assert.deepEqual(await t.controller.ensureReferenceReady(), { ok: true, kind: "profile" }); assert.equal(url.feat, undefined); assert.equal(url.prepared, true)
    await t.controller.ensureReferenceReady(); assert.equal(fetched, 1); assert.ok(t.calls.some(c => c[0] === "error" && c[1] === error))
  })
  it("preserves the existing partial preview-buffer cache if preview measurement fails", async () => {
    const buffer = {}, url = { meta: { previewUrl: "https://preview.example.invalid/fixture" } }
    const t = defaultReference({ src: "url", url }, { fetchPreviewBuffer: async () => buffer, analysisService: { async analyze() { throw Error("measurement") } } })
    assert.deepEqual(await t.controller.ensureReferenceReady(), { ok: true, kind: "profile" }); assert.equal(url.buf, buffer); assert.equal(url.feat, undefined); assert.equal(url.prepared, true)
  })
})

describe("unchanged reference target construction", () => {
  it("keeps uploaded and measured-preview targets distinct from metadata profiles", () => {
    const feat = features(), t = defaultReference({ src: "file", file: { name: "mine.wav", feat } })
    const target = t.controller.makeTarget("file", {}); assert.equal(target.g.measured, true); assert.equal(target.g.lufs, feat.lufs)
    assert.deepEqual(target.g.bands, feat.bands); assert.notEqual(target.g.bands, feat.bands)
    const u = defaultReference({ src: "url", url: { feat, meta: { title: "preview", artist: "fixture", platform: "apple" } } })
    const preview = u.controller.makeTarget("url", {}); assert.equal(preview.g.measured, true); assert.equal(preview.meta.platform, "apple")
    const p = defaultReference({ src: "url", url: { meta: { cat: "hiphop", title: "metadata" } } })
    const profile = p.controller.makeTarget("profile", {}); assert.equal(profile.g.urlTarget, true); assert.notEqual(profile.g.measured, true)
  })
  it("keeps a valid manual subgenre and uses the category's first when the requested subgenre is invalid", () => {
    const ref = { src: "auto", cat: "hiphop", sub: "Trap" }, t = defaultReference(ref)
    assert.equal(t.controller.makeTarget("auto", {}).g.name, "Trap"); ref.sub = "not-a-subgenre"
    const fallback = t.controller.makeTarget("auto", {}); assert.equal(fallback.g.name, "Hip-Hop"); assert.equal(fallback.gm.manual, true)
  })
  it("marks unusable URL metadata as auto fallback rather than measured audio", () => {
    const t = defaultReference({ src: "url", cat: "hiphop", url: { meta: {} } })
    const target = t.controller.makeTarget("profile", {}); assert.equal(target.meta.fallback, true); assert.equal(target.kind, "auto"); assert.notEqual(target.g.measured, true)
  })
})

it("runs the SAME real analyzer/scoring/issue/plan path on synthetic PCM without a DOM or any network", async () => {
  const buffer = createToneBuffer(), before = [buffer.getChannelData(0).slice(), buffer.getChannelData(1).slice()]
  let fetches = 0
  const t = defaultReference({ src: "auto", cat: "hiphop" }, { state: { buffer, busy: false, ref: { src: "auto", cat: "hiphop" } },
    fetchPreviewBuffer: () => { fetches++; throw Error("Network not permitted in this test") } })
  const ports = { ...t.ports }
  for (const key of ["analysisService", "scoreAnalysis", "buildIssues", "buildFixPlan"]) delete ports[key]
  // Deliberately use production defaults, not the harness's synthetic engine.
  await createAnalysisController(ports).runAnalysis()
  assert.equal(fetches, 0); assert.deepEqual(t.state.analysis, await analysisService.analyze(buffer))
  assert.equal(t.state.busy, false); assert.ok(t.state.analysis?.bands); assert.ok(Number.isFinite(t.state.scores?.overall))
  assert.ok(t.state.autoPlan); assert.equal(t.state.autoPlan, t.state.fixPlan); assert.equal(t.state.targetUsed.gm.manual, true)
  assert.deepEqual(t.state.scores, scoreAnalysis(t.state.analysis, t.state.targetUsed.g))
  assert.deepEqual(t.state.issues, buildIssues(t.state.analysis, t.state.targetUsed.g, t.state.scores))
  assert.deepEqual(t.state.fixPlan, buildFixPlan(t.state.analysis, t.state.targetUsed.g))
  assert.deepEqual(buffer.getChannelData(0), before[0]); assert.deepEqual(buffer.getChannelData(1), before[1])
  assert.ok(t.calls.some(c => c[0] === "toast" && c[1].startsWith("Analysis complete"))); assert.ok(!t.calls.some(c => c[0] === "error"))
})
