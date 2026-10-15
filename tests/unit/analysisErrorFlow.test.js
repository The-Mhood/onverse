import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { describe, it } from "node:test"

// Exercise the actual checked-in controller function without importing its DOM,
// WebGL, decoder or playback boot sequence. Collaborators below are test seams,
// not proof of browser rendering, real decoding, measurement quality or rollback.
const source = readFileSync(new URL("../../src/main.js", import.meta.url), "utf8")
const start = source.indexOf("async function runAnalysis() {")
const end = source.indexOf("\nfunction setProgress(", start)
assert.ok(start >= 0 && end > start, "controller seam must remain identifiable or be explicitly migrated")
const controller = new vm.Script(`${source.slice(start, end)}; globalThis.run = runAnalysis`)

function setup(overrides = {}) {
  const calls = []
  const analysis = { measured: true }
  const prior = { existing: true }
  const state = { buffer: {}, busy: false, analysis: prior, fixed: {}, ref: {} }
  const record = name => (...args) => calls.push([name, ...args])
  const context = vm.createContext({
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
  })
  controller.runInContext(context)
  return { run: context.run, state: context.state, calls, analysis, prior }
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

describe("controller analysis failure boundary", () => {
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
