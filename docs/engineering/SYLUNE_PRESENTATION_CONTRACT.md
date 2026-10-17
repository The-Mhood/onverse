# SYLUNE presentation integration — v1 / COORD-007 / UI-006

**2026-10-16 product integration target:** [authoritative session/IPC contract](SESSION_APPLICATION_IPC.md) now defines the shared host, real render-review-approval workflow, constrained SYLUNE tools and read-only save-state DTO. These are specified, **not implemented Electron exports**. No fabricated saved/executed state; visual authority follows the latest owner resolution below. [Production storage direction and platform gate](PRODUCTION_SESSION_STORAGE.md); [review concerns](CORE_INTEGRATION_REVIEW.md).

**Current ownership ([published resolution](https://github.com/The-Mhood/onverse/pull/5#issuecomment-6213314954)):** [COORD-010 owner resolution](UNIVERSE_VISUAL_HANDOFF.md)
now governs the shared universe/main-stage and limited Orbit camera/motion scope;
older broad renderer permissions below are historical where inconsistent. Studio/
SYLUNE approved presentation work continues without unrelated engine blocking.
Lead keeps real execution/models/IPC/storage; unchanged public stage contract and
honest capability states remain. See handoff section13; lead freezes shared UI
source and does not edit concurrently.


**2026-10-15, owner-directed lead decision.** SYLUNE is MusicOnVerse's intended
producer and sound engineer, not merely advice/chat. The user directs the creative
vision; SYLUNE will inspect, plan, audition, execute supported validated operations
and refine results. Watching it work means observing real operation/parameter
changes, not fabricated knob animation. This defines a small UI port, **not an
implemented AI executor, provider, session engine or public persisted schema**.

[Architecture](../ARCHITECTURE.md) owns core semantics. The existing
[UI handoff](UI_IMPLEMENTATION_HANDOFF.md) plus its COORD-007 amendment owns paths.
[Design brief](../design/DESIGN_BRIEF.md) remains the visual source of truth.

## 1. Historical UI-006 issuance (visual restrictions superseded by COORD-010)

Agent B may implement the collapsible SYLUNE panel, header icon and contextual
Ask SYLUNE, including **presentation/templates/event wiring only** in `src/main.js`
and new files under `src/ui/presentation/sylune/**`. Lead freezes those UI paths.
The existing reservation is continued/extended, not revoked or concurrently shared.

Exact initial new-file plan, to acknowledge before implementation:

- `src/ui/presentation/sylune/panel.js`
- `src/ui/presentation/sylune/contextActions.js`
- `src/ui/styles/sylune.css`
- `tests/ui/sylunePresentation.test.js`
- presentation-only edits in `src/main.js` and `src/style.css` as needed.

COORD-008 reconfirms this reservation as active; after the worker's own
preservation/file-plan report no additional approval reply is required. The
[handoff section 9](UI_IMPLEMENTATION_HANDOFF.md) also authorizes UI-007's exact
`src/ui/presentation/cosmicEnvironment.js`, `src/ui/styles/cosmic.css` and
`tests/ui/cosmicEnvironment.test.js` plus presentation main/style wiring. That
shared-shell alternative does not open scene.js/draw.js or engine paths.

Existing Slice A paths remain reserved to Agent B. Alternative filenames inside
these allowed prefixes need a published file plan, not another product decision.
Agent B may also revise the already-published, non-canonical
`docs/design/proposals/agent-b-daw-sylune-proposal.md` to reflect these decisions;
this exact-file proposal exception does not grant canonical design/queue edits.

No editing core state schema, reducers, DSP, services, processors, repositories,
Electron/IPC, dependencies/configuration, existing core tests or coordinator docs.
`src/ui/draw.js`, `src/scene.js` and `src/scene/**` remain outside UI-006.
**Separate UI-008 / COORD-009 exception:** Agent B exclusively reserves colour-only
edits to draw.js/scene.js, optional `src/ui/presentation/canvasPalette.js` and
`tests/ui/canvasPalette.test.js`; lead freezes both shared files until release.
The [handoff section 10](UI_IMPLEMENTATION_HANDOFF.md) preserves all APIs/math/
camera/alpha/lifecycle. This does not grant functionality or src/scene/**.
Existing Orbit files have the separate UI-005 reservation in the handoff amendment.

Lead owns SYLUNE application/context adapters, validation, capabilities, execution,
history/storage and actual audio semantics. Later core exports are wired by
Agent B inside its reserved controller path; lead does not concurrently edit it.
A genuine required core/controller-state change needs an exact separate re-handoff.
No framework/dependency/provider/network service is authorized by this UI grant.

## 2. Complete DAW intent, honest capability surfaces

Logic Pro is the structural/workflow reference for the intended full professional
DAW: multitrack timeline, headers, transport, arrangement, mixer/channel strips,
buses/routing, processors/plugins and automation. Reference 1 remains appearance;
Reference 2 can aid shell layout where compatible, not limit the DAW to three lanes.
Project/Reference/Master are present prototype/Orbit labels, not canonical track,
bus or session identities and not a permanent model.

Agent B may design that complete structure now. Future functional areas must be
clearly labelled concepts, disabled with explanations, or explicit preview mode.
Never show dummy faders/routing/plugins/recording as operational. Preserve working
single-buffer workflows; do not replace them with a functioning-looking empty DAW.
Source/domain/application/audio/storage remain core-owned; presentation consumes
one authoritative model and a capability registry, not component-local projects.

Current: one-buffer import/analysis, experimental meters/reference comparison,
playback/A-B/rate/seek, crop, built-in processing/manual adjustments and conversion.
Under implementation: minimum Linked Sessions metadata/currentness contracts;
next is actual media joined to journal/recovery with approved manual updates.
Future: the multitrack engine, persistent timeline/routing/mixer/automation,
recording, external plugin host, and SYLUNE planning/execution/research adapters.
The isolated storage/native proofs do not implement these product capabilities.

## 3. Approved presentation prototypes

UI-only states are explicitly authorized: idle, analyzing, proposing,
awaiting-approval, executing, completed, cancelled, unsupported and error.

- Explicit prototype mode displays **"Prototype — no audio changes"** throughout,
  including completion and error views. Use a deliberate demo state selector or
  test fixture, never automatic simulated progress suggesting a real job.
- Prototype knobs/operations never call real processing, providers, commits, undo
  or uploads. No hidden costs/network, and no AI/session-awareness claims.
- In normal mode with no host adapter: show SYLUNE execution as not connected;
  explain/disable execution. Ask SYLUNE may open the panel with descriptive context.
- Existing manual app controls remain real and separate. Do not route them through
  a fake SYLUNE controller or invent a second authoritative processing state.
- Once connected, only actual application events may indicate measured analysis,
  proposal, execution/progress, result or failure. Promise resolution alone is not
  a committed operation. Cancellation-requested is not yet cancelled. The host
  reports cancellation availability/too-late separately from operation failure;
  a denied late cancellation must not show the still-running operation as failed.
- Any eventual knob highlighting follows actual parameter-change events. No
  animation may stand in for a missing command or imply an unheard audition.

## 4. Small presentation port (plain JavaScript, no new dependencies)

Agent B exports from `panel.js`:

```js
mountSylunePanel({ root, onRequest, onOpenChange })
// returns:
{ setOpen(open), setContext(contextOrNull), render(view), dispose() }
```

`root` is the host's mount element. `onOpenChange(boolean)` keeps header
aria-expanded/focus consistent. `setOpen` is idempotent; opening never initiates
analysis/provider work. `setContext` receives a read-only DTO, not the mutable
controller state or an AudioBuffer. Contextual Ask SYLUNE calls setContext then
setOpen(true). `dispose` removes owned listeners/resources and is idempotent.
Panel collapse/focus/draft text are presentation state; operation truth is host-owned.
No global command/event bus, localStorage project store or raw state reference.

`onRequest(request)` is an injected asynchronous host callback. Missing host means
explicit not-connected feedback. Rejections are surfaced; never swallow them or
turn them into success. Actual operation lifecycle arrives separately via render.

### Context DTO

```js
{
  schemaVersion: 1,
  contextId: null,          // host-issued opaque freshness token when connected
  sessionId: null,          // real stable IDs only; never names or invented IDs
  snapshotRevisionId: null,
  selectionRevisionId: null,
  workspace: "analysis",   // semantic view key, not an engine session/track ID
  target: {
    kind: "workspace",     // workspace|buffer|reference|track|clip|group|bus|processor|parameter|waveform
    id: null,
    parentId: null,
    parameterKey: null      // registered parameter key, not arbitrary object path
  },
  range: null,              // or { startFrame, endFrame, sampleRate } from host
  capabilities: []          // host-provided display of supported operations
}
```

The host projects current workspace/selection and supported scope. Other workspace
keys may describe arrangement/mix/master/reference views without claiming an engine.
A track/processor/parameter target is executable only with real IDs, valid parent
ownership and current host context. Current single-buffer UI has no stable DAW
session/track IDs: leave those null and use descriptive workspace context until
core provides handles. Do not reuse tweakEpoch or file names as durable revisions.
Prototype context may use clearly namespaced demo IDs but never enters execution.
Do not pass file paths, audio/PCM, entire manifests, DOM nodes, functions or secrets.

### Request DTO

```js
{
  schemaVersion: 1,
  requestId: "ui-correlation-id", // correlation only, not authorization
  origin: "context-menu",        // or panel
  intent: "ask",                 // ask|approve|discard|cancel|undo
  text: "Explain this selection", // bounded plain text, max 4096 characters
  context: contextDTO,
  planId: null,                   // required for approve/discard; from real host view
  operationId: null               // required for cancel/undo; from real host view
}
```

UI sends intent, not arbitrary commands/JS, processor graphs or approved=true.
The application resolves authoritative context afresh, validates schema, units,
IDs, capability/permission and relevant revisions, and rejects stale/unsupported
requests before mutation. UI context/capability values are hints, never authority.
Approve asks the application to approve a specific reviewed plan; UI cannot issue
its own approval receipt or bypass explicit linked-update review. Discard asks
the host to invalidate a pending proposal; it cannot undo a committed operation
or merely hide a live approval behind a changed UI. Cancel is a
request; the application decides before/after-promotion outcome. Undo is supported
only when a real retained-history operation is available.

### Host-to-presentation view / lifecycle events

`render(view)` receives a complete read-only projection of an actual host event:

```js
{
  schemaVersion: 1,
  mode: "application",      // or prototype, visibly labelled
  requestId: null,
  operationId: null,
  contextId: null,
  sequence: 0,              // monotonic per operation; discard stale/out-of-order views
  event: "state",          // state|progress|result|error
  phase: "unsupported",    // idle|analyzing|proposing|awaiting-approval|executing|completed|cancelled|unsupported|error
  cancellation: "unsupported", // available|requested|too-late|unsupported; host-owned
  progress: null,           // or { completed, total, unit }; finite, total > 0, 0 <= completed <= total
  plan: null,               // reviewed plan ID, summary and affected targets, not code
  result: null,             // actual summary, affected IDs, optional committed revision
  error: null               // safe code/message/retryability, not secrets/raw stack
}
```

Correlate request, operation, context and sequence. Context changes must not let
late results select/mutate a different object; any old result shown must retain its
original attribution. Unknown IDs/malformed events fail visibly, not crash the app.
Progress is actual reported work; when unknown show indeterminate, not fabricated
percentages. Result/commit success is emitted after the appropriate validated
operation/persistence boundary. Receipt/rendering of a UI event does not prove an
audio change. Real controls update from shared authoritative parameter state or
operation diffs; this panel port is not a DOM-command channel for turning knobs.
Host owns capability changes; UI cannot enable execution itself.

## 5. Acceptance checks and coordination

Before edits, Agent B posts current HEAD, own preservation/isolation preflight,
exact file plan and UI-006 boundary acknowledgment on PR #5, then may proceed
without another owner/lead decision round-trip. Publishing the grant is not proof
of receipt or start. Continue in the same session/branch; preserve all existing work.

UI tests using existing tools: panel open/close/focus/Escape/keyboard, safe metadata
text, context payloads/null IDs, visibly labelled prototypes without engine calls,
not-connected/error handling, stale-event isolation, and dispose/re-mount listener
cleanup. Text entry/context menus must not trigger transport/Orbit shortcuts.
Preserve existing import/reference/analyze/processing/playback/crop/export flows.
Supply real viewport results and unsupported states, not screenshots alone.

Lead will continue Linked Sessions contracts and actual render-to-journal
integration independently. SYLUNE's future action orchestration will use those same
validated operations; it does not justify another backend or deferring the core loop.


## Functional track/mixer boundary

The inert professional DAW design is authorized, including multitrack timeline
and mixer; older blanket no-invented-mixer language is superseded only for honest
presentation. Functional session snapshots, typed commands, relevant revisions,
validated routing/parameters, review/approval/commit and real history remain
lead-owned as defined in [Architecture section 17](../ARCHITECTURE.md). They are
requirements, not currently available exports. Do not enable controls or invent
a local authoritative session to fill the gap. UI-005 remains submitted/partial;
recorded 36 tests do not establish the outstanding 1480x920 visual acceptance.
