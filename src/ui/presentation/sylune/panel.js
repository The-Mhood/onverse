// SYLUNE collapsible panel: presentation only (COORD-007 / COORD-008 v1 port).
//
// mountSylunePanel({ root, onRequest, onOpenChange }) -> { setOpen, setContext, render, dispose }
//
// - Opening never starts analysis or provider work.
// - Without onRequest the panel reports "not connected" and sends nothing.
// - onRequest rejections are shown as visible errors. They are never turned into success.
// - Prototype mode is selected deliberately and labelled "Prototype — no audio changes" throughout.
//   Its states are local display fixtures. They make no host call and change no audio.
// - All host and user text is written with textContent. Nothing is injected as HTML.

import {
  MAX_REQUEST_TEXT,
  NOT_CONNECTED_TEXT,
  PROTOTYPE_LABEL,
  PHASE_LABEL,
  buildAskRequest,
  cancellationText,
  contextProblem,
  reduceView,
  validateView,
} from "./contextActions.js"

const PROTOTYPE_STATES = Object.freeze([
  "idle", "analyzing", "proposing", "awaiting-approval", "executing", "completed", "cancelled", "unsupported", "error",
])

let instanceCounter = 0

// Local prototype fixtures. Each one is labelled and is not a real operation.
function prototypeView(phase, sequence) {
  const base = {
    schemaVersion: 1,
    mode: "prototype",
    requestId: null,
    operationId: "prototype-op",
    contextId: null,
    sequence,
    event: "state",
    phase,
    cancellation: "unsupported",
    progress: null,
    plan: null,
    result: null,
    error: null,
  }
  switch (phase) {
    case "analyzing":
      return { ...base, cancellation: "available" }
    case "proposing":
      return { ...base, plan: { id: "prototype-plan", summary: "Prototype proposal. No change is computed.", targets: [] } }
    case "awaiting-approval":
      return { ...base, plan: { id: "prototype-plan", summary: "Prototype proposal waiting for approval. Nothing is applied.", targets: [] } }
    case "executing":
      return { ...base, cancellation: "available", event: "progress" }
    case "completed":
      return { ...base, event: "result", result: { summary: "Prototype completion. Nothing was applied.", affectedIds: [], committedRevisionId: null } }
    case "cancelled":
      return { ...base, event: "result" }
    case "error":
      return { ...base, event: "error", error: { code: "prototype-error", message: "Prototype error state. No operation ran.", retryable: true } }
    default:
      return base
  }
}

// Bind "Ask SYLUNE" affordances anywhere in the document. Any element with data-sylune-kind
// calls onAsk({ kind, label, workspace }). Returns a dispose function.
export function bindAskTargets(doc, onAsk) {
  if (!doc || typeof onAsk !== "function") throw new TypeError("bindAskTargets needs a document and a handler")
  const handler = (event) => {
    const el = event.target instanceof Element ? event.target.closest("[data-sylune-kind]") : null
    if (!el) return
    onAsk({
      kind: el.getAttribute("data-sylune-kind"),
      label: el.getAttribute("data-sylune-label") || el.getAttribute("data-sylune-kind"),
      workspace: el.getAttribute("data-sylune-workspace") || null,
    })
  }
  doc.addEventListener("click", handler)
  return () => doc.removeEventListener("click", handler)
}

export function mountSylunePanel({ root, onRequest, onOpenChange } = {}) {
  if (!root || typeof root.appendChild !== "function") throw new TypeError("mountSylunePanel needs a root element")
  if (onRequest !== undefined && typeof onRequest !== "function") throw new TypeError("onRequest must be a function")
  if (onOpenChange !== undefined && typeof onOpenChange !== "function") throw new TypeError("onOpenChange must be a function")

  const doc = root.ownerDocument
  const uid = `sylune-${++instanceCounter}`
  const listeners = []
  let disposed = false
  let open = false
  let context = null
  let contextLabel = ""
  let contextRejected = null
  let prototypeActive = false
  let prototypeSequence = 0
  let requestCounter = 0
  let model = { lastSequence: {}, view: null, notice: null }

  const el = (tag, attrs = {}, text) => {
    const node = doc.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
    if (text !== undefined) node.textContent = text
    return node
  }
  const on = (node, type, fn) => {
    node.addEventListener(type, fn)
    listeners.push(() => node.removeEventListener(type, fn))
  }

  // ---- DOM ------------------------------------------------------------------
  const section = el("section", { class: "sylune-panel", id: `${uid}-panel`, role: "region", "aria-labelledby": `${uid}-title`, "data-sylune": "panel" })
  section.hidden = true
  const head = el("header", { class: "sylune-head" })
  const title = el("h2", { id: `${uid}-title`, tabindex: "-1", class: "sylune-title" }, "SYLUNE")
  const modeBadge = el("span", { class: "sylune-mode", "data-sylune-mode": "" }, "Not connected")
  const closeBtn = el("button", { type: "button", class: "sylune-close", "aria-label": "Close SYLUNE panel" }, "×")
  head.append(title, modeBadge, closeBtn)

  const notice = el("p", { class: "sylune-notice", "data-sylune-notice": "", role: "note" }, NOT_CONNECTED_TEXT)

  const ctxSection = el("section", { class: "sylune-block", "aria-labelledby": `${uid}-ctx` })
  const ctxHeading = el("h3", { id: `${uid}-ctx`, class: "sylune-heading" }, "Context")
  const ctxText = el("p", { class: "sylune-context", "data-sylune-context": "" }, "Nothing selected. Ask SYLUNE from a track, waveform, parameter or workspace.")
  ctxSection.append(ctxHeading, ctxText)

  const statusSection = el("section", { class: "sylune-block", "aria-labelledby": `${uid}-status` })
  const statusHeading = el("h3", { id: `${uid}-status`, class: "sylune-heading" }, "Status")
  const phaseText = el("p", { class: "sylune-phase", role: "status", "aria-live": "polite", "data-sylune-phase": "" }, PHASE_LABEL.idle)
  const progress = el("progress", { class: "sylune-progress", "data-sylune-progress": "" })
  progress.hidden = true
  const cancelText = el("p", { class: "sylune-cancel", "data-sylune-cancel": "" })
  cancelText.hidden = true
  const resultText = el("p", { class: "sylune-result", "data-sylune-result": "" })
  resultText.hidden = true
  const errorText = el("p", { class: "sylune-error", role: "alert", "data-sylune-error": "" })
  errorText.hidden = true
  const cancelBtn = el("button", { type: "button", class: "sylune-btn", "data-sylune-cancel-btn": "" }, "Request cancel")
  cancelBtn.hidden = true
  statusSection.append(statusHeading, phaseText, progress, cancelText, resultText, errorText, cancelBtn)

  const form = el("form", { class: "sylune-ask", "data-sylune-form": "" })
  const askLabel = el("label", { class: "sylune-heading", for: `${uid}-text` }, "Ask SYLUNE")
  const textarea = el("textarea", { id: `${uid}-text`, class: "sylune-text", rows: "3", maxlength: String(MAX_REQUEST_TEXT), "data-sylune-text": "" })
  const askBtn = el("button", { type: "submit", class: "sylune-btn sylune-btn-primary", "data-sylune-ask-btn": "" }, "Ask")
  form.append(askLabel, textarea, askBtn)

  const planSection = el("div", { class: "sylune-plan", "data-sylune-plan": "" })
  planSection.hidden = true
  const planSummary = el("p", { class: "sylune-plan-summary", "data-sylune-plan-summary": "" })
  const approveBtn = el("button", { type: "button", class: "sylune-btn sylune-btn-primary", "data-sylune-approve": "" }, "Approve plan")
  const discardBtn = el("button", { type: "button", class: "sylune-btn", "data-sylune-discard": "" }, "Discard plan")
  planSection.append(planSummary, approveBtn, discardBtn)

  const protoSection = el("section", { class: "sylune-block sylune-proto", "aria-labelledby": `${uid}-proto` })
  const protoHeading = el("h3", { id: `${uid}-proto`, class: "sylune-heading" }, "Prototype states")
  const protoToggle = el("button", { type: "button", class: "sylune-btn", "aria-pressed": "false", "data-sylune-proto-toggle": "" }, "Use prototype states")
  const protoControls = el("div", { class: "sylune-proto-controls", "data-sylune-proto-controls": "" })
  protoControls.hidden = true
  for (const phase of PROTOTYPE_STATES) {
    const b = el("button", { type: "button", class: "sylune-btn sylune-btn-small", "data-sylune-proto-state": phase, "aria-pressed": "false" }, PHASE_LABEL[phase])
    protoControls.append(b)
  }
  const protoNote = el("p", { class: "sylune-proto-note" }, PROTOTYPE_LABEL)
  protoSection.append(protoHeading, protoToggle, protoNote, protoControls)

  const foot = el("p", { class: "sylune-foot" }, "Ask sends an intent to the host only. Operation status comes from the host, never from this panel.")

  section.append(head, notice, ctxSection, statusSection, form, planSection, protoSection, foot)
  root.appendChild(section)

  // ---- rendering ------------------------------------------------------------
  function setNotice(text, tone = "info") {
    notice.textContent = text
    notice.setAttribute("data-tone", tone)
  }

  function modeLine() {
    if (prototypeActive) {
      modeBadge.textContent = "Prototype"
      setNotice(PROTOTYPE_LABEL, "prototype")
    } else if (!onRequest) {
      modeBadge.textContent = "Not connected"
      setNotice(NOT_CONNECTED_TEXT, "info")
    } else {
      modeBadge.textContent = "Connected"
      setNotice("Connected to the host. Status below comes only from host events.", "info")
    }
  }

  function renderContext() {
    if (contextRejected) {
      ctxText.textContent = `Context rejected: ${contextRejected}`
      return
    }
    if (!context) {
      ctxText.textContent = "Nothing selected. Ask SYLUNE from a track, waveform, parameter or workspace."
      return
    }
    const parts = [
      contextLabel ? `Object: ${contextLabel}` : null,
      `Workspace: ${context.workspace}`,
      `Target: ${context.target.kind}`,
      `Session: ${context.sessionId ?? "none (no host IDs)"}`,
    ].filter(Boolean)
    ctxText.textContent = parts.join(" · ")
  }

  function renderView() {
    const view = model.view
    const phase = view ? view.phase : "idle"
    phaseText.textContent = PHASE_LABEL[phase] ?? String(phase)

    if (view && view.progress) {
      progress.hidden = false
      progress.max = view.progress.total
      progress.value = view.progress.completed
      progress.setAttribute("aria-label", `${view.progress.completed} of ${view.progress.total} ${view.progress.unit}`)
    } else {
      // Unknown progress is shown as indeterminate, never as a made-up percentage.
      progress.hidden = !(view && phase === "executing")
      progress.removeAttribute("value")
      progress.max = 1
      progress.setAttribute("aria-label", "Progress unknown")
    }

    const showCancel = view && view.cancellation !== "unsupported"
    cancelText.hidden = !showCancel
    cancelText.textContent = showCancel ? cancellationText(view.cancellation) : ""
    cancelBtn.hidden = !(view && view.cancellation === "available" && !prototypeActive && onRequest)

    resultText.hidden = !(view && view.result)
    resultText.textContent = view && view.result ? String(view.result.summary) : ""

    errorText.hidden = !(view && view.error)
    errorText.textContent = view && view.error ? `${view.error.message} (${view.error.code}${view.error.retryable ? ", retryable" : ""})` : ""

    const hasPlan = view && view.plan && phase === "awaiting-approval"
    planSection.hidden = !hasPlan
    if (hasPlan) planSummary.textContent = String(view.plan.summary)
    approveBtn.disabled = !hasPlan
    discardBtn.disabled = !hasPlan

    if (view && view.attribution === "earlier-context") {
      phaseText.textContent += " (for an earlier context)"
    }
  }

  function renderAll() {
    modeLine()
    renderContext()
    renderView()
    protoControls.hidden = !prototypeActive
    protoToggle.setAttribute("aria-pressed", String(prototypeActive))
    protoToggle.textContent = prototypeActive ? "Leave prototype states" : "Use prototype states"
    for (const b of protoControls.querySelectorAll("[data-sylune-proto-state]")) {
      b.setAttribute("aria-pressed", String(model.view?.phase === b.getAttribute("data-sylune-proto-state") && prototypeActive))
    }
  }

  // ---- host requests --------------------------------------------------------
  function sendRequest(intent, extra = {}) {
    if (!onRequest) {
      setNotice(`${NOT_CONNECTED_TEXT} Your request was not sent.`, "info")
      return
    }
    requestCounter += 1
    const requestId = `${uid}-req-${requestCounter}`
    let request
    if (intent === "ask") {
      request = buildAskRequest({ requestId, origin: "panel", text: textarea.value, context })
    } else {
      request = {
        schemaVersion: 1,
        requestId,
        origin: "panel",
        intent,
        text: "",
        context,
        planId: extra.planId ?? null,
        operationId: extra.operationId ?? null,
      }
    }
    // Rejections are surfaced, not swallowed and not converted into success.
    Promise.resolve()
      .then(() => onRequest(request))
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error)
        console.error("SYLUNE host request rejected:", error)
        errorText.hidden = false
        errorText.textContent = `Request rejected by the host: ${message}`
      })
  }

  // ---- public API -----------------------------------------------------------
  function setOpen(next) {
    if (disposed) return
    const want = Boolean(next)
    if (want === open) return
    open = want
    section.hidden = !open
    if (open) title.focus({ preventScroll: true })
    if (onOpenChange) onOpenChange(open)
  }

  // setContext(contextOrNull, { label }) — label is presentation text only and is never sent to the host.
  function setContext(next, { label = "" } = {}) {
    if (disposed) return
    contextRejected = null
    contextLabel = String(label ?? "")
    if (next === null || next === undefined) {
      context = null
    } else {
      const problem = contextProblem(next)
      if (problem) {
        context = null
        contextRejected = problem
      } else {
        context = next
      }
    }
    renderAll()
  }

  function render(view) {
    if (disposed) return
    if (prototypeActive) {
      model = { ...model, notice: { tone: "info", text: "Leave prototype states to show host events." } }
      renderAll()
      return
    }
    model = reduceView(model, view, context?.contextId ?? null)
    renderAll()
  }

  function applyPrototype(phase) {
    prototypeSequence += 1
    model = { ...model, view: prototypeView(phase, prototypeSequence), notice: null }
    renderAll()
  }

  // ---- listeners ------------------------------------------------------------
  on(closeBtn, "click", () => setOpen(false))
  on(section, "keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault()
      setOpen(false)
    }
  })
  on(form, "submit", (event) => {
    event.preventDefault()
    if (!context) {
      setNotice("Select an object or workspace before asking SYLUNE.", "info")
      return
    }
    if (prototypeActive) {
      applyPrototype("analyzing")
      setNotice(`${PROTOTYPE_LABEL}. No analysis runs.`, "prototype")
      return
    }
    try {
      sendRequest("ask")
    } catch (error) {
      errorText.hidden = false
      errorText.textContent = error instanceof Error ? error.message : String(error)
    }
  })
  on(approveBtn, "click", () => {
    if (prototypeActive) {
      applyPrototype("completed")
      return
    }
    sendRequest("approve", { planId: model.view?.plan?.id ?? null })
  })
  on(discardBtn, "click", () => {
    if (prototypeActive) {
      applyPrototype("idle")
      return
    }
    sendRequest("discard", { planId: model.view?.plan?.id ?? null })
  })
  on(cancelBtn, "click", () => {
    sendRequest("cancel", { operationId: model.view?.operationId ?? null })
  })
  on(protoToggle, "click", () => {
    prototypeActive = !prototypeActive
    model = { lastSequence: {}, view: null, notice: null }
    renderAll()
  })
  for (const b of protoControls.querySelectorAll("[data-sylune-proto-state]")) {
    on(b, "click", () => applyPrototype(b.getAttribute("data-sylune-proto-state")))
  }

  renderAll()

  return {
    setOpen,
    setContext,
    render,
    dispose() {
      if (disposed) return
      disposed = true
      for (const off of listeners.splice(0)) off()
      section.remove()
    },
  }
}
