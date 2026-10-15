# MusicOnVerse — Technical Architecture

**Working draft for review — CORE-007, 2026-10-15.** Reconciles the existing [PR #1 proposal](https://github.com/The-Mhood/onverse/blob/eedc24cb38c21d1a4be6186593c7ae7fcb8c6f85/docs/ARCHITECTURE.md) at `eedc24cb38c21d1a4be6186593c7ae7fcb8c6f85` with the inspected engineering code and the owner's later Linked Sessions requirements. The modular-monolith, validated-command, local-first and incremental-engine direction is retained. This is the canonical working architecture draft on the engineering branch, **not implementation, product acceptance, a final API/schema, or a merge of PR #1**.

Read [AGENTS.md](../AGENTS.md) for authority/ownership, [the project guide](engineering/PROJECT_GUIDE.md) for actual capabilities, [the roadmap](ROADMAP.md) for gates/tests, and [the design brief](design/DESIGN_BRIEF.md) for the sole UI-direction brief. Schema and POC limits below are recommendations requiring review; owner-supplied safety/manual-update constraints are mandatory. Earlier general auto-apply wording never overrides them.

## 1. Current-state assessment

The inspected engineering code is unchanged from `370190c180682eb45edbdd9029a33b7e58c605dd`; later integration decisions are documentation-only at this checkpoint. The repository is a working single-buffer prototype with a useful base:

- `src/main.js` is the main application controller and constructs a large portion of the UI directly in JavaScript.
- `src/audio/analyzer.js` performs custom signal analysis.
- `src/audio/dsp.js` contains shared DSP kernels and buffer utilities.
- `src/audio/genre.js` contains genre profiles and band metadata.
- `src/audio/processor.js` handles decode/encode and a one-click master-fix render.
- `src/audio/reference.js` resolves selected streaming links and catalog metadata.
- `src/application/analysis/analysisService.js` wraps the local full/fast analyzer; it is async-shaped, not a worker, validator or cancellation service.
- `src/domain/processors/buildProcessingPlan.js` extracts pure plan construction; it is not an imported/AI-command validator.
- `src/scene.js` renders the Three.js audio-reactive stage.
- `electron/main.cjs` and `electron/preload.cjs` provide a desktop wrapper and a narrow update bridge.

This is appropriate for a prototype. It is not yet a sound foundation for a full DAW because state, UI, transport, processing and product workflows are coupled in the large main module, the project/session model is not yet the center of the application, and the audio engine has no explicit processor/command contract.

There is no implemented serializable Session/Track/Bus/RenderGroup model, durable media/project store, history/undo, multitrack renderer, linked-item executor, AI command executor or external plugin host. Current state remains in `src/main.js`. The isolated metering research is not wired into production; dangerous automatic-gain/LUFS behavior remains unresolved. See the [metering evidence and limits](engineering/AUDIO_METERING_CONTRACT.md).

### Priority risks to verify and fix

1. **No authoritative project model:** audio buffers and UI state are held in a single in-memory session. A DAW needs serializable project data, stable IDs, snapshots, autosave and recovery.
2. **AI execution boundary is absent:** natural-language requests must never directly execute arbitrary code or unconstrained DSP settings. Introduce a validated command schema and allow-listed operations.
3. **DSP performance and reliability:** long analysis/render loops can block the UI or exhaust memory. Move suitable work to Web Workers/AudioWorklets/WASM incrementally, with cancellation and progress.
4. **Audio measurement claims:** validate LUFS/true-peak calculations and all target-profile assumptions against known fixtures before making professional measurement claims.
5. **Large single-file UI controller:** split features into modules while preserving working behavior. Avoid a risky rewrite.
6. **Desktop update placeholder:** `package.json` has a placeholder generic update URL. Auto-update must remain disabled or clearly non-production until a real feed, signing and release process exist.
7. **Build pipeline coupling:** the build script inlines output assets into a single HTML file. Keep this only if browser portability requires it; test CSP, worker/WASM and large-bundle constraints before relying on it for the future engine.
8. **Secrets and generated output:** ignore local environment files, signing assets, logs, release installers and generated artifacts. Never commit signing credentials or user audio.

## 2. Target architecture

Use a modular monolith first. Keep the product shippable as one desktop application while defining boundaries that could later become separate services. Do not start with microservices.

```text
Desktop App (Electron)
├── Presentation
│   ├── Workspace shell / navigation
│   ├── Timeline + transport
│   ├── Mixer + processor panels
│   ├── AI Engineer conversation + action preview
│   └── Library, export and settings
├── Application layer
│   ├── Project/session commands
│   ├── Transport and recording controller
│   ├── AI intent → typed action plan
│   ├── Undo/redo + history
│   ├── Render/export jobs
│   └── Permissions, quotas and billing gates
├── Domain layer (pure data/rules)
│   ├── Project, Track, Clip, Region, Bus, Plugin, Automation
│   ├── Audio operation and parameter schemas
│   ├── Routing graph and validation
│   ├── Project migrations
│   └── Capability registry
├── Audio engine
│   ├── Real-time graph (AudioWorklet/native engine)
│   ├── Offline render graph
│   ├── Recording and device I/O
│   ├── Metering and analysis
│   ├── Built-in DSP processors
│   └── External plugin host/bridge (later, native)
├── Infrastructure
│   ├── Local project store + media asset store
│   ├── Worker/WASM job runner
│   ├── Optional AI provider adapter
│   ├── Optional cloud render/stem jobs
│   └── Telemetry/error reporting (opt-in)
└── Electron main process
    ├── Window and OS integration
    ├── Safe IPC allow-list
    ├── File dialogs and filesystem access
    ├── Updates
    └── Entitlements/secure credential access
```

The key rule: **UI expresses intent; application commands validate it; domain rules define meaning; the audio engine executes it.** The AI agent is not the audio engine and must not bypass these boundaries.

## 3. Project/session domain model

Design the data model before implementing a timeline.

### Project container and Session aggregate (proposed)

Separate storage ownership from musical identity instead of overloading the original proposal's flat Project:

- Project container: `projectId`, schema version, project metadata, granted storage root, owned immutable assets, manifest generations/history. Proposed first packaging is one session per local project bundle; that does not limit the logical link model to one open session or a mix/master pair.
- Session: globally stable `sessionId`, `revisionId`, label, declared sample rate/layout/timebase, tracks, buses, master output, markers and saved render groups. Tempo maps/instruments remain unsupported until implemented.
- A revision is immutable, identifies an exact serialized snapshot, and retains required media/processor-state references. A session revision is an audit/concurrency identity, **not** the invalidation key for every linked item.
- An authorized locator resolves a Session ID to a project bundle, checks the manifest ID, and validates revisions. Paths/names never substitute for identity. Moving/closing/renaming a source must not break already-owned destination audio; unresolved sources can block refresh. Duplicate IDs with divergent heads require explicit conflict/fork/relink handling, not selection by filename.
- A workspace's link index may be derived from manifests; it is not a new cloud service or a second authoritative state. The first POC assumes a local single writer and explicitly granted, resolvable bundles. Unknown/offline graph closure must not be treated as proof of no cycle.

### Track

- `id`, `name`, `type`: audio | bus | aux | instrument (instrument later)
- `channelLayout`, `gainDb`, `pan`, `mute`, `solo`, `arm`
- `clips[]`, `insertChain[]`, `sendRoutes[]`, `automationLanes[]`
- `color`, `locked`, `metadata`

### Clip / Region

- `id`, `mediaRef`, `timelineStartFrame`, `sourceInFrame`, `sourceOutFrame`
- `mediaRef` is either an immutable asset reference or a stable linked-item reference, never two competing current asset pointers
- `gainDb`, `fadeIn`, `fadeOut`, `timeStretch`, `pitchShift`
- `regionProcessors[]`, `automationOverrides[]`

Use integer sample positions or a clearly specified high-precision time representation internally. Floating-point seconds alone can accumulate boundary ambiguity for editing. The UI may display seconds and bars/beats, but conversions should go through one tested timing service.

### Processor instance

- `id`, `processorType`, `schemaVersion`, `enabled`, `parameters`
- `wetDry`, `presetId`, `automationBindings[]`, `latencySamples`
- `stateBlobRef` only for processor state that cannot be represented as ordinary parameters

### Asset manifest

Store references, checksums, media metadata and relative paths—not raw audio arrays inside project JSON. A portable project package should contain a project manifest and owned immutable media with explicit relink behavior. Never rely on a mutable shared filename. Asset integrity/content identity is distinct from render provenance: two renders can produce identical bytes with different truthful histories. Use atomic writes and recovery journals as specified below.

## 4. Core command contract

Every edit, whether triggered by UI, automation or AI, should go through the same application command system.

A conceptual command:

```ts
type AudioCommand = {
  id: string;
  projectId: string;
  sessionId: string;
  operation:
    | "set-track-gain"
    | "insert-processor"
    | "set-processor-parameter"
    | "create-region-effect"
    | "create-automation"
    | "render-master"
    | "export-audio"
    | "create-linked-transfer"
    | "prepare-linked-update"
    | "commit-linked-update"
    | "cancel-linked-job"
    | "restore-linked-version";
  target: {
    trackId?: string;
    clipId?: string;
    busId?: string;
    region?: { startSample: number; endSample: number };
  };
  parameters: Record<string, number | string | boolean>;
  intent?: string;
  requiresApproval: boolean;
};
```

This is an architectural example, not an instruction to copy an unchecked generic parameter map into production. Implement operation-specific schemas, strict ranges, explicit units, target validation and versioning. Unknown operations or parameters must fail closed. IDs/preconditions, supported operations, approval requirements and permissions are resolved by the application, not trusted because a model sets `requiresApproval: false`. A pure reducer applies only validated commands; UI state/selectors stay outside repositories, reads are awaited, and preferences may use debounced writes. Explicit media/history commits are durable transactions, not fire-and-forget debounced saves.

Every command should return a result with status, diagnostics, affected targets, before/after values, render reference and an undo record. Make repeated submissions idempotent where possible. Long-running jobs need cancellation, progress, timeouts and cleanup.

## 5. AI Sound Engineer design

### Pipeline

1. **Conversation parser:** identifies intent, target, time range, constraints and ambiguity.
2. **Context builder:** supplies only relevant project structure, track names, analysis results and available processor capabilities.
3. **Planner:** returns a structured plan, not executable code.
4. **Validator:** checks schema, permissions, units, processor support, parameter bounds, target existence, cost and destructive effects.
5. **Preview renderer:** creates a short audition or temporary graph; does not overwrite source audio.
6. **Approval UI:** displays affected source/range, proposed settings, audible goal, assumptions and estimated cost.
7. **Command executor:** applies the approved operation through the normal application layer.
8. **History:** records intent, command, model/provider, parameters, result and undo information.

### Safety and trust

- No arbitrary shell, filesystem, JavaScript or network tools exposed to the model.
- The model cannot choose unregistered processor IDs or bypass parameter validation.
- Never upload audio without clear consent and a visible explanation.
- Do not silently replace original assets.
- Linked transfers/updates use the same affected-item review and validated operations as manual UI. Source edits or model output cannot auto-refresh destination audio. Any future trusted auto-apply exception excludes linked creation/update/retarget/restore operations; explicit user initiation and approval remain required.
- Require confirmation for destructive actions, external uploads, purchases/credits and export overwrites.
- Show uncertainty; ask a clarifying question when source or target is ambiguous.
- Offer a manual fallback when a model/provider is unavailable.
- Version prompts, schemas and evaluations. Keep secrets server-side.

## 6. Audio engine strategy

### Audited capability boundary (2026-10-15)

The proposed proof column is a plan, **not executed support**. No public API or product limit is established by this table.

| Concern | Existing implementation | Proposed proof / expansion gate |
| --- | --- | --- |
| Rate | Decode through an AudioContext, potentially at its rate; one-buffer offline render uses supplied buffer rate | Explicit 48 kHz managed inputs/output first; mismatches reject; conversions need declared quality and real tests |
| Format | WAV Float32/PCM16 both clamp; MP3 resamples to 44.1 kHz; available MediaRecorder formats use real-time capture | New transparent finite Float32 managed intermediate; exact rate/layout/frames/hash; no export/reimport or lossy default |
| Layout | Buffer channel count, not a complete layout/mapping contract | L/R stereo only for first proof; reject unknown/unsupported mapping instead of silent fold/downmix |
| Timing | Seek/crop use seconds with sample slicing; no session timeline model | Integer frames with declared rate, source anchor and independent destination placement |
| Duration/tails | Whole buffer in memory; no general preroll/tail policy | Fixed short fixture ranges; explicit reject on changed range/length; later tail/full-track proof |
| Processors/plugins | Built-in one-buffer filters/compressor/gain/width/retune; no external plugin host | Source gain/sum, destination gain/EQ for proof; reject unsupported processing, no mastering side effects |
| Automation | No track/clip automation-lane engine | Unsupported in first proof; later exact curve/timebase rendering/dependency tests |
| Latency | No general graph latency reporting/compensation | Known zero-latency subset first; declared preroll/offset semantics and measured compensation before expansion |
| Mute/solo/bypass | No multitrack audibility model | Recorded selected-source mute / ignore-monitor-solo policy; other policies require explicit dependency/render tests |
| Routing/control | No buses/sends/returns/sidechain graph | Reject unsupported topology; real bus-vs-group/shared-dependency tests before support |
| Cancellation | Existing busy/tweak epochs are not an abortable render-job service | Revoke commit eligibility; native render may finish; test late result cannot commit |
| Memory/performance | Full buffers/copies and significant main-thread work; no proven full-track multi-source budget | Estimate input/output/staged/copy plus engine overhead, bound concurrency, measure limits before allocating/advertising |
| Jobs/storage | No durable job/repository/history/media IPC | Local staged job + actual filesystem generation/journal/restart proof; no new agent orchestrator |

### Phase 1: preserve and harden existing Web Audio/DSP

Keep the current analysis and offline-processing capabilities while introducing stable interfaces such as:

- `AudioAssetRepository`
- `AnalysisService`
- `ProcessorRegistry`
- `OfflineRenderService`
- `TransportService`
- `ProjectRepository` / `SessionRepository`
- `LinkedTransferService` (application pipeline, not an orchestration platform)

Profile first; move CPU-heavy, non-real-time analysis to Web Workers only where the actual runtime/mechanism is supported and proved. Use OfflineAudioContext for supported offline graph renders. Do not put heavy analysis inside the real-time playback path.

### Phase 2: real-time DAW core

- Use AudioWorklet for custom real-time processing and metering.
- Define deterministic sample/block behavior and processor lifecycle.
- Keep UI and audio-thread communication bounded; avoid allocations and heavy work in audio callbacks.
- Add latency reporting and compensation before complex routing is marketed as production-ready.
- Separate the live playback graph from the offline render graph, while sharing processor definitions and parameter semantics.

### Phase 3: advanced processing and native integration

- Evaluate WASM/native DSP for performance-sensitive algorithms.
- Prototype native audio device I/O and plugin hosting behind an adapter.
- Investigate JUCE or another viable licensed technology for VST3/AU hosting; do not assume Electron/Web Audio can load native plugins.
- Establish a compatibility matrix for macOS versions, Apple Silicon and Intel, sample rates, buffer sizes and plugin formats.

Do not select the final native engine solely on theoretical performance. Run a proof of concept: low-latency recording, stable playback under load, offline render parity, plugin hosting feasibility, packaging and code-signing requirements.

## 7. Storage and persistence

Start local-first:

- Project manifest: versioned JSON or a documented equivalent
- Media: files in a project asset directory
- Analysis cache: derived and disposable
- Command history: durable operations with undo metadata
- Autosave: periodic, atomic and recoverable
- Snapshots: user-visible named restore points
- Migrations: tested for every persisted schema version

Do not store multi-minute audio in localStorage. Use filesystem-backed assets in Electron and IndexedDB only for appropriate web-mode caches. No component-localStorage project store. A browser persistence adapter needs its own transactional/recovery proof; desktop filesystem results do not certify IndexedDB/OPFS behavior. Later, cloud sync can store encrypted project packages and media references, but conflict handling must be designed before multi-device collaboration launches.

## 8. AI and cloud boundaries

Create provider-neutral interfaces:

- `IntentPlanner`: structured plan generation
- `AudioAnalysisAdapter`: optional model-assisted interpretation
- `StemSeparationProvider`: async job interface
- `CloudRenderProvider`: job submission/status/download
- `EntitlementService`: plan and quota checks

Local deterministic DSP should handle predictable operations. Cloud models should be used only when they add clear value, such as source separation or heavy inference. Every paid/cloud job needs an estimate, explicit opt-in, progress, retry policy, cancellation behavior and a defined retention policy.

## 9. Security and Electron boundary

- Keep `nodeIntegration: false`, context isolation and sandbox enabled.
- Expose only narrow, typed preload methods; validate every IPC payload in the main process.
- Restrict navigation and external URL handling.
- Use OS secure storage for credentials; never put API keys in renderer code or shipped bundles.
- Validate imported media, filenames, archive paths and project manifests.
- Avoid arbitrary file paths from AI-generated commands.
- Implement a CSP and review the implications of inline bundled scripts before production.
- Do not enable auto-update against the current placeholder feed.
- Maintain dependency audits, signed releases, provenance and a security reporting path.

## 10. Testing and observability

- Unit tests for project schemas, command validation, timing conversion, DSP parameter bounds and undo/redo.
- Audio fixtures with known sample rates, channel layouts, tones, impulses, clipping, silence and reference measurements.
- Golden render tests with tolerances where floating-point variation is expected.
- Integration tests for import → analyze → process → A/B → export.
- Electron smoke tests on clean environments.
- Manual listening evaluation with level-matched blind A/B tests.
- Performance budgets for startup, analysis latency, playback glitches and memory on target Macs.
- Opt-in crash/error diagnostics with audio content excluded by default.

## 11. Recommended module migration

Do not rewrite `src/main.js` in one shot. Migrate behind tests in this order:

1. Define the smallest reviewed state/domain contracts in `src/domain/`; first prove Linked Sessions render/storage mechanisms with a bounded harness rather than building an entire DAW before learning whether they work.
2. Extract project/session persistence into `src/infrastructure/projects/`.
3. Extract transport and playback into `src/application/transport/`.
4. Preserve the already-extracted analysis service and processing-plan helper. Wrap additional processor functions only behind accepted contracts; do not route a transparent transfer through automatic master-fix.
5. Extract UI panels and event bindings into `src/features/`.
6. Introduce the command bus and undo stack.
7. Add the AI plan schema and a mocked planner before connecting a paid model.
8. Add the timeline against the project model.
9. Prove recording and real-time engine requirements before choosing native plugin architecture.

Each step must preserve the existing import/analyze/fix/compare/export path. The goal is a gradual, testable evolution, not a rewrite that throws away the prototype's useful work. The following Linked Sessions spine brings only minimum identity/storage/render prerequisites forward; it does not require the complete timeline, recording, native engine, AI or plugin roadmap first.

## 12. Linked Sessions: selection, provenance and currentness

### 12.1 General transfer semantics

Linked Sessions is an internal reusable render workflow between arbitrary source/destination sessions, not a mix-to-master specialization, export dialog, mutable file link or source-separation service. Support these **distinct future capabilities**, rejecting unsupported kinds until their real render paths exist:

| Selection kind | Meaning |
| --- | --- |
| Track | An explicitly identified track at a declared output boundary, range and audibility policy |
| Selected-track group | Several exact track IDs rendered together as one named reusable item; not separate items unless explicitly requested |
| Bus output | The actual routed bus signal at its declared tap, including the modeled contributors, processing and returns; not a sum of tracks guessed from labels |
| Stereo mix | The source session's full stereo output with modeled master/routing/render rules |
| Multiple linked items | Independent bindings/versions; updating one does not replace others even if their asset bytes happen to deduplicate |

Define pre/post fader/inserts, selected audible contributions, sends/returns, mute/solo/bypass, range, preroll/tails, latency compensation and quality/version in the render request. Never infer them from current playback selection or an unrecorded solo button. A shared nonlinear bus/return cannot generally be separated into attributable per-track wet stems; either render the explicitly defined graph/context or report unsupported. Do not label a selected-track rerender as a routed bus print.

A saved RenderGroup has a stable ID, immutable definition revisions and explicit member IDs. Proposed initial policy freezes membership for the link; normal source audio edits can refresh those members. Group membership/deletion/replacement changes require review and an explicit retain/retarget decision; never silently add/remove tracks. Renaming a group/track changes display metadata, not identity or audio freshness. A recreated track with the old name is a different target. Replacing media within an existing track is a real source edit, visibly included in the affected-item plan.

### 12.2 Minimum proposed records (not installed schemas)

| Record | Required meaning |
| --- | --- |
| `RenderGroup` | ID, definition revision, label, exact member IDs, declared selection semantics; reusable, not a routing bus |
| `RenderRequest` | Job/operation ID, pinned source session/snapshot, resolved selection, exact render range/timebase, audibility/processing/routing policies, rate/layout/format, latency/tail/quality/engine configuration |
| `LinkedItem` | Stable destination-owned ID, source binding/spec revision, placement contract, manual-only update policy, current committed version ID |
| `LinkedItemVersion` | Immutable version ID, asset ID, exact used source snapshot/dependency revisions, resolved selection, render configuration/fingerprint, actual engine/processor versions, lineage references, validation metadata and approval/history operation ID |
| `ManagedAsset` | Immutable asset ID/content hash, owned relative location, codec/version, rate, explicit layout/channel order, frame count, byte length and integrity metadata; no raw PCM arrays in the manifest |
| `UpdatePlan` | Exact chosen immediate-source snapshots, affected item/clip IDs, reasons and used-vs-available revisions, compatibility changes, expected target-binding revisions, estimates, diagnostics and approval token bound to the plan |
| `Job` / history operation | Snapshot/plan ID, stage, cancellation/commit eligibility, idempotency key, result/diagnostics; undo data identifies prior item versions rather than rerendering history from current source |

`Clip.mediaRef = { kind: "linked-item", linkedItemId }` resolves through the item's **one** current-version pointer. Keep destination track/clip processors, automation, routing, placement and view state separate. Do not also maintain an authoritative clip asset pointer that can disagree with the item. If multiple clips intentionally share one item, review **all** affected usages. Independent transfers get independent item IDs; updating only one shared usage needs an explicit fork/rebind operation.

Identifiers are opaque stable values supplied by the application, not names or model-invented IDs. Validate schema versions, safe integer frame counts/positions, finite bounded parameters, known layouts/rates, referenced entities and permissions. IDs/timestamps are injected into pure domain transitions; hashing/storage/decoding remain adapters. This table is not permission to implement arbitrary generic parameter maps.

### 12.3 Relevant dependency projection

Persist the exact source snapshot for audit, plus a versioned audio/control dependency projection and its fingerprint for freshness. **Do not put the whole session revision or display names into that audio fingerprint.** The destination retains the resolved snapshot/dependency/lineage metadata durably (or an immutable integrity-checked copy), not merely a pointer to the source's mutable current head. Its owned printed media guarantees independent playback, not reconstruction of unavailable original tracks/plugins. Rerendering a historical source still requires its actual immutable inputs and supported engine/state; otherwise report unavailable rather than substitute newer material.

The resolver must capture all relevant source media/clip boundaries/timing, processor definitions/order/state/parameters and build versions, gain/pan, automation/timebase/tempo where used, routing adjacency, sends/returns, bus/master processing, sidechains/shared state, and declared mute/solo/bypass/render rules. Include control-only inputs even when not directly audible. Unknown hidden/plugin/external dependencies make freshness unknown or render unsupported, never confidently current.

Compute the latest closure again from the current graph; comparing only the old read-set misses newly added contributors/routes. Per-node route/membership revisions and the new resolved projection must detect additions, removals and rerouting without using an unrelated whole-session routing revision as a blanket invalidator. Ordering is significant for processors/routes where audio semantics require it; canonicalize only genuinely unordered collections. Pin random seeds/state where supported; mark nondeterministic processors honestly and retain actual output hashes rather than promising bit-identical rerenders.

Required examples:

- A vocal edit with no signal/control path into Drums leaves Drums current.
- A conga edit within Drums marks that item update-available but leaves its current asset unchanged.
- A vocal used by a shared return or sidechain feeding Drums may actually be relevant; the plan explains why.
- Missing/deleted/recreated members or changed group definitions cannot silently resolve to different material.
- Renames alone do not stale audio. A current item can truthfully use older session revision S1 when S2 differs only in irrelevant state.

For an early supported subset, conservatively invalidating edits anywhere in an already-relevant track is acceptable only if documented; missing a dependency or invalidating an independent vocal is not. Tight range-aware invalidation can follow measured need. Never rewrite old provenance to pretend the latest session revision was rendered. A no-op update leaves the actual used revision/history truthful.

### 12.4 Separate status axes

Do not overload one `stale` flag:

- **Committed asset:** present/integrity-valid/compatible, or missing/corrupt/incompatible locally.
- **Immediate source:** current to relevant available dependencies, update-available, unresolved/offline, missing target, changed-definition conflict, unsupported dependency, or unknown.
- **Upstream ancestry:** current, known outdated, or unknown at each actually used hop.
- **Job:** preparing/rendering/validating/ready-to-commit/committing/committed, failed, cancellation-requested/cancelled.

An update failure or offline source does not invalidate playable destination-owned PCM. Background observation may update status, never the committed audio pointer. Used revision, observed available revision and observation time must remain distinguishable; do not label an unobserved source "current".

## 13. Linked Sessions: render/update transaction

### 13.1 One reusable pipeline

1. Resolve authorized source/destination IDs and the selected **immutable** source snapshot. Validate graph closure, cycle safety, capabilities, exact selection, range/format and resource estimates before allocations/writes.
2. Prepare the affected-item plan and compatibility report. User explicitly chooses immediate-source revisions and approves this exact scope. AI planning has the same boundary, no special executor or manual-update override.
3. Pin inputs/processor state and render internally using the declared graph. Source imports/originals stay immutable. Do not export/reimport through the UI, apply automatic mastering, normalize, limit, or lossy-convert unless the explicit render definition requests supported processing.
4. Stage new destination-owned immutable media. Validate finite PCM, frame/rate/layout/codec metadata, hash/byte integrity and declared range/tail/latency. Values above full scale in a float intermediate must not be silently clipped; surface them honestly. The existing clamping `encodeWav()` is not a transparent managed intermediate as-is.
5. Recheck cancellation, relevant source dependencies, current destination binding/spec revisions, compatibility-sensitive state, permissions and graph safety. Unrelated source edits need not abort. Relevant changes since a plan advertised as latest require replan; an explicitly approved historical pin stays historical, never relabeled latest.
6. Apply a validated pure replacement transition to the latest compatible destination state; persist new asset/version references, provenance and history in one durable destination transaction. Switch only the intended linked source/version references, not whole-session/buffer state. UI observes the committed result after persistence; no optimistic success that loses audio on restart.
7. Release temporary resources; retain old referenced media/history and report exact success, failure or cancellation. Clean orphan staging safely later; never delete a prior valid asset as speculative cleanup.

Prepare one/selected/all using the same operation. Proposed first batch policy is **all-or-nothing within one destination session**: validate/stage all requested items, then one manifest/history commit, or retain all their old versions. Unselected/unrelated items are untouched. No claim of an atomic transaction across several destination bundles or chain hops.

Destination conflict checks must be item/binding/compatibility scoped, not a blind whole-session reload. Serialize repository writes, compare expected heads, and reapply only when the targeted bindings are unchanged and compatibility still validates. Preserve unrelated concurrent work. If targeted state changed ambiguously, stop/replan rather than overwrite. Stored operation IDs prevent retries from committing twice.

### 13.2 Duration, alignment, layout and playback

Source render range and destination placement are independent, explicitly anchored integer-frame contracts with declared rate. Account for leading latency/preroll and tail frames, rather than inferring alignment from a filename or new duration. Keep clip source-in/out, position, envelopes and downstream processing stable.

**Proposed POC restriction:** same declared 48 kHz L/R stereo, fixed range/length, explicit sample alignment, zero-latency source gain/sum, no returns/sidechains/automation/plugins/tails/rate conversion, and commit only while transport is stopped. These are bounded proof conditions, not a shipped product promise or a restriction of the general model. Use short synthetic fixtures, not a permanent multi-minute product limit. Proposed audibility policy respects selected source-track mute and explicitly ignores transient monitor-solo state. A later respect-solo policy must include every relevant solo/control change, including outside selected tracks, in its dependency projection; no hidden live-solo influence.

A changed duration/range/layout/rate or newly unsupported processor produces a pending incompatibility report and no replacement. Later supported choices (retain fixed range, explicitly extend/trim, convert/remap or retarget) are separately reviewed operations with updated fingerprints/history; never silently stretch, fold channels, move clips, drop automation, reset processors or overwrite unrelated work. Physical DSP history/reverb tails and live graph swaps need a separate click/latency/state-transition proof; retaining settings is not proof of seamless live continuity.

### 13.3 Cancellation, failures, memory and durability

Use bounded concurrency (one native render for the POC), validate allocation sizes and resource budgets, and keep playback independent of analysis/render/AI. OfflineAudioContext does not provide a general immediate abort for `startRendering()`: logical cancellation must revoke commit eligibility even if native work completes. Do not promise CPU stops instantly. A cancelled token cannot later promote an asset. The repository serializes accepted cancellation against a non-cancellable promotion barrier: cancellation accepted before that barrier revokes commit eligibility. Once promotion is granted, report committing/too-late-to-cancel rather than accept a cancellation that cannot be honored; recovery determines the durable outcome. After a durable commit, report committed and offer explicit undo, not a false cancelled status.

Proposed destination transaction protocol, subject to a real filesystem/target-platform proof:

1. Write/flush/verify temporary media inside the granted destination volume, then publish it under a new immutable name. Pin all source inputs and pending outputs against premature deletion.
2. Prepare a new immutable manifest generation including consistent item versions, provenance and history/undo roots. Persist checksums and a journal describing old/new heads and the approved idempotent operation.
3. Flush required files and atomically promote the small current-generation pointer on the same volume; establish and test the necessary directory durability semantics on supported platforms. Never claim rename alone proves power-loss safety.
4. Recovery reads the committed pointer/journal/checksums: open a complete valid generation or retain/recover the previous complete one. A crash before promotion may leave an orphan, not a broken active link; after promotion the asset, provenance and history must agree. Do not resume an old job against newer source/target state without renewed validation/approval.

The POC may defer garbage collection entirely. Later GC must trace active manifests, snapshots, undo/redo, lineage and in-flight jobs; history pruning/asset deletion needs an explicit retention policy. Undo restores retained version references atomically without rerendering current upstream material; redo remains possible while retained. Validate the restored asset against current destination compatibility, do not reset current processors, and distinguish ordered undo/redo from a separately approved selective restore operation. Lost/corrupt assets or schema incompatibility fail visibly without mutating active state. Parsing/import/migration creates a validated candidate, not an automatic overwrite.

Electron filesystem access must use narrowly validated IDs/grants, permitted roots and main-process payload checks; protect traversal/symlink/path and archive boundaries. No arbitrary AI path or unrestricted renderer filesystem bridge. Desktop crash-test results do not certify browser storage or every macOS/filesystem/power-loss behavior.

### 13.4 Arbitrary chains and branches

A session link is a directed source -> destination edge. Before creating/retargeting one, reject a path that makes a cycle (including self-links), checking current known graph heads under a serialized local write/graph guard. Immutable historical assets do not exempt a logical link from cycle rejection. If required graph closure is unavailable, block the new link/update safely; already-owned audio remains usable. A derived catalog is not a substitute for validated manifests, or a distributed-lock solution.

For A -> B -> C, each version records the immediate snapshot and lineage actually used. If A advances after B printed A1, C may be current to B's committed B1 output while its ancestry is known outdated to A. Refreshing C from unchanged B1 does not secretly pull A2. The user explicitly chooses whether to update B, C, or a reviewed ordered cascade. Each hop commits durably on its own; if B succeeds and C fails, report the partial cascade and leave C's old valid asset. No fabricated global rollback/atomicity or automatic chase of latest revisions.

## 14. Minimum real proof and acceptance gates

The [roadmap](ROADMAP.md) owns the staged implementation and proposed 20-case coverage matrix. Nothing in this draft installs a renderer, repository, command executor, API or test.

The smallest end-to-end proof uses real managed media and repositories, a real Web Audio graph and the same validated application operations intended for production:

1. Persist source Session A with separately identified Conga, another drum and an independent Vocal, and a saved exact-member Drums group. Persist destination B with an existing gain/EQ chain and unrelated audio item. Use known short stereo PCM fixtures; no user uploads or fake cloud/AI service.
2. Select the group, render a genuine combined asset internally and commit destination-owned audio plus exact IDs/snapshot/dependencies/config/provenance/history. Validate numeric output/alignment against analytic fixtures within declared tolerances, not just matching metadata.
3. Edit the unrelated Vocal: Drums remains current. Edit Conga through the source operation: Drums becomes update-available while destination bytes/version stay unchanged.
4. Explicitly approve/update Drums. Verify only its linked-version reference changes; destination gain/EQ IDs/settings, routing/automation/placement and unrelated item remain unchanged. Exercise the actual destination processing chain on the new source, not merely compare its JSON.
5. Close/reopen and inject failures/cancellation around render, staging and commit. Verify the last valid asset/history stays recoverable; undo/redo use retained versions. Include source/destination changes during the job, unsupported layout/rate and ID replacement negatives.

A renderer mock, in-memory repository, copied fixture file, exported/reimported WAV, or a UI-only state demonstration does not satisfy this proof. Verify real runtime/permissions before selecting a harness; if Electron/Web Audio/filesystem fault injection cannot run, report the blocker rather than substitute mocks. A browser renderer plus Node filesystem helper alone does not prove the future Electron IPC boundary; target-app integration needs its own executed evidence. Listening/target-Mac tests remain explicit separate gates.

Before expanding transfer kinds or wiring operational UI/AI, review the actual proof, source/domain schema and command contract, failure/recovery evidence, memory/duration limits, destination compatibility policy and security boundary. Keep production metering/gain hardening separate. agent-b's read-only snapshot/branch decision remains unchanged; any later shared-contract or controller change needs a separately scoped exclusive handoff.
