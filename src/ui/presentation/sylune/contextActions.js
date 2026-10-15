// SYLUNE presentation helpers: pure DTO builders and validators for the published
// v1 port (COORD-007 / COORD-008). No DOM, no core imports, no network, no state.
// Context and request values are hints for the host. They are never authority.

export const SYLUNE_SCHEMA_VERSION = 1
export const MAX_REQUEST_TEXT = 4096
export const PROTOTYPE_LABEL = "Prototype — no audio changes"
export const NOT_CONNECTED_TEXT =
  "SYLUNE execution is not connected in this build. Nothing was sent and no audio was changed."

// Semantic view keys. These describe where the user is, not an engine session.
export const WORKSPACE_KEYS = Object.freeze(["analysis", "convert", "daw", "orbit"])
export const TARGET_KINDS = Object.freeze([
  "workspace", "buffer", "reference", "track", "clip", "group", "bus", "processor", "parameter", "waveform",
])
export const REQUEST_INTENTS = Object.freeze(["ask", "approve", "discard", "cancel", "undo"])
export const REQUEST_ORIGINS = Object.freeze(["context-menu", "panel"])
export const PHASES = Object.freeze([
  "idle", "analyzing", "proposing", "awaiting-approval", "executing", "completed", "cancelled", "unsupported", "error",
])
export const CANCELLATIONS = Object.freeze(["available", "requested", "too-late", "unsupported"])
export const EVENTS = Object.freeze(["state", "progress", "result", "error"])
export const MODES = Object.freeze(["application", "prototype"])

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v)
const isStr = (v) => typeof v === "string"

// Build a context DTO for the current presentation location. Real IDs are never invented
// here: session, snapshot, selection, and target IDs stay null until the host supplies them.
export function buildContext({ workspace, target = {}, range = null } = {}) {
  if (!WORKSPACE_KEYS.includes(workspace)) throw new TypeError(`unknown SYLUNE workspace key: ${workspace}`)
  const kind = isObj(target) && target.kind !== undefined ? target.kind : "workspace"
  if (!TARGET_KINDS.includes(kind)) throw new TypeError(`unknown SYLUNE target kind: ${kind}`)
  return {
    schemaVersion: SYLUNE_SCHEMA_VERSION,
    contextId: null,
    sessionId: null,
    snapshotRevisionId: null,
    selectionRevisionId: null,
    workspace,
    target: { kind, id: null, parentId: null, parameterKey: null },
    range,
    capabilities: [],
  }
}

// Returns a reason string when the context is malformed, or null when it is acceptable.
export function contextProblem(ctx) {
  if (ctx === null) return null
  if (!isObj(ctx)) return "context is not an object"
  if (ctx.schemaVersion !== SYLUNE_SCHEMA_VERSION) return `unsupported context schemaVersion ${ctx.schemaVersion}`
  if (!WORKSPACE_KEYS.includes(ctx.workspace)) return `unknown workspace ${String(ctx.workspace)}`
  if (!isObj(ctx.target) || !TARGET_KINDS.includes(ctx.target.kind)) return "unknown target kind"
  if (!Array.isArray(ctx.capabilities)) return "capabilities must be an array"
  return null
}

// Build a bounded request DTO. The UI sends intent and text only. It never sends approved=true,
// commands, or processor graphs.
export function buildAskRequest({ requestId, origin = "panel", text, context } = {}) {
  if (!isStr(requestId) || requestId.length === 0) throw new TypeError("requestId is required")
  if (!REQUEST_ORIGINS.includes(origin)) throw new TypeError(`unknown request origin: ${origin}`)
  const trimmed = isStr(text) ? text.trim() : ""
  if (trimmed.length === 0) throw new RangeError("Ask text is empty")
  if (trimmed.length > MAX_REQUEST_TEXT) throw new RangeError(`Ask text exceeds ${MAX_REQUEST_TEXT} characters`)
  const problem = contextProblem(context)
  if (problem !== null || context === null) throw new TypeError(`Ask needs a valid context: ${problem ?? "none selected"}`)
  return {
    schemaVersion: SYLUNE_SCHEMA_VERSION,
    requestId,
    origin,
    intent: "ask",
    text: trimmed,
    context,
    planId: null,
    operationId: null,
  }
}

// Host-to-presentation view validation. Returns { ok: true } or { ok: false, reason }.
// Malformed events fail visibly. They never throw into the host.
export function validateView(view) {
  if (!isObj(view)) return { ok: false, reason: "view is not an object" }
  if (view.schemaVersion !== SYLUNE_SCHEMA_VERSION) return { ok: false, reason: `unsupported schemaVersion ${view.schemaVersion}` }
  if (!MODES.includes(view.mode)) return { ok: false, reason: `unknown mode ${String(view.mode)}` }
  if (!EVENTS.includes(view.event)) return { ok: false, reason: `unknown event ${String(view.event)}` }
  if (!PHASES.includes(view.phase)) return { ok: false, reason: `unknown phase ${String(view.phase)}` }
  if (!CANCELLATIONS.includes(view.cancellation)) return { ok: false, reason: `unknown cancellation ${String(view.cancellation)}` }
  if (!Number.isInteger(view.sequence) || view.sequence < 0) return { ok: false, reason: "sequence must be a non-negative integer" }
  if (view.progress !== null && view.progress !== undefined) {
    const p = view.progress
    if (!isObj(p) || !Number.isFinite(p.completed) || !Number.isFinite(p.total) || !isStr(p.unit)) {
      return { ok: false, reason: "progress must have finite completed and total, and a unit" }
    }
    if (!(p.total > 0) || p.completed < 0 || p.completed > p.total) return { ok: false, reason: "progress out of range" }
  }
  if (view.error !== null && view.error !== undefined) {
    if (!isObj(view.error) || !isStr(view.error.code) || !isStr(view.error.message)) {
      return { ok: false, reason: "error must have code and message" }
    }
  }
  return { ok: true }
}

// Reducer for host views. Stale or out-of-order events for the same operation are dropped.
// Views for an earlier context keep their original attribution and never replace a selection.
export function reduceView(prev, view, currentContextId = null) {
  const check = validateView(view)
  if (!check.ok) {
    return { ...prev, notice: { tone: "error", text: `Host event ignored: ${check.reason}` } }
  }
  const key = view.operationId ?? "no-operation"
  const last = prev.lastSequence[key]
  if (last !== undefined && view.sequence <= last) {
    return { ...prev, notice: { tone: "info", text: "Stale host event ignored" } }
  }
  const attribution = view.contextId === null || view.contextId === currentContextId ? "current" : "earlier-context"
  return {
    ...prev,
    lastSequence: { ...prev.lastSequence, [key]: view.sequence },
    view: { ...view, attribution },
    notice: null,
  }
}

export const PHASE_LABEL = Object.freeze({
  idle: "Idle",
  analyzing: "Analyzing",
  proposing: "Proposing a change",
  "awaiting-approval": "Awaiting your approval",
  executing: "Executing",
  completed: "Completed",
  cancelled: "Cancelled",
  unsupported: "Unsupported",
  error: "Error",
})

// Presentation text for the cancellation line. "too-late" never reads as operation failure.
export function cancellationText(cancellation) {
  switch (cancellation) {
    case "available": return "Cancellation available."
    case "requested": return "Cancellation requested. Not yet cancelled."
    case "too-late": return "Cancellation came too late. The operation continues; it has not failed."
    case "unsupported": return "Cancellation is not supported for this operation."
    default: return ""
  }
}
