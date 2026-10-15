// SYLUNE presentation contract tests (COORD-007 / COORD-008 v1). Pure logic, no DOM.
// DOM behaviour (focus, Escape, keyboard, listeners) is verified in browser checks.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  PROTOTYPE_LABEL,
  buildAskRequest,
  buildContext,
  cancellationText,
  contextProblem,
  reduceView,
  validateView,
} from "../../src/ui/presentation/sylune/contextActions.js"

const goodContext = () => buildContext({ workspace: "analysis", target: { kind: "waveform" } })

const view = (over = {}) => ({
  schemaVersion: 1,
  mode: "application",
  requestId: null,
  operationId: "op-1",
  contextId: null,
  sequence: 1,
  event: "state",
  phase: "idle",
  cancellation: "unsupported",
  progress: null,
  plan: null,
  result: null,
  error: null,
  ...over,
})

test("buildContext leaves every real ID null and rejects unknown keys", () => {
  const ctx = goodContext()
  assert.equal(ctx.schemaVersion, 1)
  for (const k of ["contextId", "sessionId", "snapshotRevisionId", "selectionRevisionId"]) assert.equal(ctx[k], null, k)
  assert.equal(ctx.target.id, null)
  assert.equal(ctx.target.parameterKey, null)
  assert.deepEqual(ctx.capabilities, [])
  assert.throws(() => buildContext({ workspace: "mixer" }), TypeError)
  assert.throws(() => buildContext({ workspace: "daw", target: { kind: "plugin" } }), TypeError)
})

test("contextProblem accepts null and valid context, rejects malformed context", () => {
  assert.equal(contextProblem(null), null)
  assert.equal(contextProblem(goodContext()), null)
  assert.match(contextProblem({ ...goodContext(), schemaVersion: 2 }), /schemaVersion/)
  assert.match(contextProblem({ ...goodContext(), workspace: "x" }), /workspace/)
  assert.match(contextProblem({ ...goodContext(), target: { kind: "nope" } }), /target/)
  assert.match(contextProblem("text"), /not an object/)
})

test("buildAskRequest sends intent and bounded text only, never approval or commands", () => {
  const req = buildAskRequest({ requestId: "r1", origin: "panel", text: "  make it warmer  ", context: goodContext() })
  assert.equal(req.intent, "ask")
  assert.equal(req.text, "make it warmer")
  assert.equal(req.planId, null)
  assert.equal(req.operationId, null)
  assert.equal("approved" in req, false)
  assert.equal("command" in req, false)
  assert.throws(() => buildAskRequest({ requestId: "r2", text: "   ", context: goodContext() }), RangeError)
  assert.throws(() => buildAskRequest({ requestId: "r3", text: "x".repeat(4097), context: goodContext() }), RangeError)
  assert.doesNotThrow(() => buildAskRequest({ requestId: "r4", text: "x".repeat(4096), context: goodContext() }))
  assert.throws(() => buildAskRequest({ requestId: "r5", text: "hi", context: null }), TypeError)
  assert.throws(() => buildAskRequest({ requestId: "", text: "hi", context: goodContext() }), TypeError)
  assert.throws(() => buildAskRequest({ requestId: "r6", origin: "menu", text: "hi", context: goodContext() }), TypeError)
})

test("validateView fails visibly for malformed host events", () => {
  assert.equal(validateView(view()).ok, true)
  assert.equal(validateView(null).ok, false)
  assert.equal(validateView(view({ phase: "done" })).ok, false)
  assert.equal(validateView(view({ mode: "live" })).ok, false)
  assert.equal(validateView(view({ sequence: -1 })).ok, false)
  assert.equal(validateView(view({ progress: { completed: 2, total: 1, unit: "step" } })).ok, false)
  assert.equal(validateView(view({ progress: { completed: 0, total: 0, unit: "step" } })).ok, false)
  assert.equal(validateView(view({ progress: { completed: NaN, total: 1, unit: "step" } })).ok, false)
  assert.equal(validateView(view({ progress: { completed: 1, total: 2, unit: "step" } })).ok, true)
  assert.equal(validateView(view({ error: { code: "x" } })).ok, false)
  assert.equal(validateView(view({ cancellation: "maybe" })).ok, false)
})

test("reduceView drops stale and out-of-order events per operation", () => {
  let s = { lastSequence: {}, view: null, notice: null }
  s = reduceView(s, view({ sequence: 2, phase: "analyzing" }))
  assert.equal(s.view.phase, "analyzing")
  s = reduceView(s, view({ sequence: 1, phase: "idle" }))
  assert.equal(s.view.phase, "analyzing", "older sequence must not overwrite")
  assert.match(s.notice.text, /Stale/)
  s = reduceView(s, view({ sequence: 3, phase: "completed", event: "result" }))
  assert.equal(s.view.phase, "completed")
})

test("reduceView keeps a view from an earlier context attributed to that context", () => {
  let s = { lastSequence: {}, view: null, notice: null }
  s = reduceView(s, view({ contextId: "old-ctx", sequence: 1, phase: "completed" }), "new-ctx")
  assert.equal(s.view.attribution, "earlier-context")
  s = reduceView(s, view({ contextId: null, sequence: 2, phase: "idle" }), "new-ctx")
  assert.equal(s.view.attribution, "current")
})

test("reduceView reports malformed events without throwing", () => {
  const s = reduceView({ lastSequence: {}, view: null, notice: null }, view({ phase: "??" }))
  assert.equal(s.notice.tone, "error")
  assert.match(s.notice.text, /ignored/)
})

test("cancellation text keeps too-late separate from failure", () => {
  assert.match(cancellationText("too-late"), /has not failed/)
  assert.match(cancellationText("requested"), /Not yet cancelled/)
  assert.equal(cancellationText("unsupported").length > 0, true)
})

test("prototype label is the exact approved wording", () => {
  assert.equal(PROTOTYPE_LABEL, "Prototype — no audio changes")
})

test("panel source cannot inject HTML, simulate progress, or import core modules", () => {
  const src = readFileSync(new URL("../../src/ui/presentation/sylune/panel.js", import.meta.url), "utf8")
  assert.equal(/innerHTML|insertAdjacentHTML|outerHTML/.test(src), false, "no HTML injection")
  assert.equal(/setInterval|requestAnimationFrame|setTimeout/.test(src), false, "no timers or simulated progress")
  assert.equal(/from\s+["'][^"']*(audio|application|domain|scene|storage|electron)/.test(src), false, "no core imports")
  assert.equal(/fetch\(|XMLHttpRequest|WebSocket/.test(src), false, "no network")
})
