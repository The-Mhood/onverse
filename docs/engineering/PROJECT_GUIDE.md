# Project guide: actual state and collaboration context

**Snapshot: 2026-10-15.** This is a source map and onboarding guide, not a second target-architecture specification or an implementation assignment. Re-audit live code, Git, queue notices, and PRs before acting. [AGENTS.md](../../AGENTS.md) governs collaboration; [WORK_QUEUE.md](WORK_QUEUE.md) records tasks and evidence.

## 1. Read order and source of truth

1. [README.md](../../README.md): entry point and branch availability.
2. [AGENTS.md](../../AGENTS.md): authority, ownership, safety, and review.
3. This guide and the latest notices/results in [WORK_QUEUE.md](WORK_QUEUE.md).
4. [DESIGN_BRIEF.md](../design/DESIGN_BRIEF.md): canonical UI direction and approval boundaries.
5. Relevant source/tests; [AUDIO_METERING_CONTRACT.md](AUDIO_METERING_CONTRACT.md) when numeric/audio behavior or its presentation is affected.
6. [Architecture](../ARCHITECTURE.md), [product vision](../PRODUCT_VISION.md) and [roadmap](../ROADMAP.md) working drafts for future session/link work; read their explicit proposed-vs-implemented/review status. Source proposals remain pinned below.

Owner instructions govern scope and consequential decisions, subject to the execution environment's higher-priority constraints. For what is implemented, inspect source and tests rather than inferring features from a roadmap, package name, mockup, or passing mock. When code and required behavior differ, report the gap; do not redefine the requirement to fit the implementation.

## 2. Git and collaborator status

- Lead environment: Arena Linux, `/home/user/onverse`, fixed branch `arena/b25c318e-onverse`. Other agents must discover their own paths/runtime; do not assume this filesystem or tool access.
- Published starting point for this onboarding unit: `e5229d8f601423a70fdeb946ab80112f650fa82c`. Onboarding changes come after it; inspect live HEAD rather than pinning future work to this older commit.
- At recovery, `main` was `ce02cf90ecdb0f9729817e2bfe449f0e42969d31`; [PR #3](https://github.com/The-Mhood/onverse/pull/3) was open/draft, engineering branch into `main`. Its check rollup was empty, not green CI.
- The owner explicitly authorized recovery of mismatched local metadata. All 50 non-ignored working files and the complete inventory matched published `e5229d8` before and after fetch plus `git reset --mixed e5229d8f601423a70fdeb946ab80112f650fa82c`; the tree was clean and connectivity passed afterward. No working-file contents were discarded. Cause of the discrepancy was not established. **This one recovery is not blanket reset permission for a future worker.**
- Codex is inactive. The [2026-10-15 UI handoff](UI_IMPLEMENTATION_HANDOFF.md) supersedes COORD-005's read-only wait with the owner-settled Slice A scope and dated exclusive UI reservation. Actual M/merge evidence is published in the COORD-006 result on PR #3, never invented in advance. Agent-b independently checks its fixed branch/cleanliness/collisions/ancestry, fast-forwards only if safe, and publishes ownership acknowledgment before edits. Runtime/checkout/receipt/start remain unverified here. Architecture drafts alone grant no writes or future capability implementation.
- Prior unpublished external work remains unknown. Preserve any work discovered later. Historical Codex records are evidence, not current ownership grants.

If connected to `main` without these documents, inspect the published engineering branch read-only (GitHub or fetched refs) after auditing the checkout. Do not switch over dirty work, treat missing docs as permission to start fresh, or independently select an implementation base.

## 3. Current application and source map

Vanilla JavaScript/DOM with Vite 8, Tailwind 4/daisyUI 5, Three.js, and Electron 44. There is no application framework migration, centralized session store, or project repository installed.

| Path | Actual responsibility / caution |
| --- | --- |
| `src/main.js` | In-memory single-buffer state, DOM templates, events, panel/mode selection, import, analysis, playback/A–B, crop, processing, conversion, references. Shared hotspot: exclusive ownership only. |
| `src/style.css` | Existing theme/tokens, layout, visual states, responsive rules, CSS reduced-motion handling. |
| `src/ui/draw.js` | Waveform peak caching and waveform/radar drawing; preserve time/channel/playback semantics. |
| `src/scene.js` | Three.js celestial background. Reduced motion reduces movement but does not currently stop the render loop. |
| `src/application/analysis/analysisService.js` | Async-shaped local analysis boundary; not a worker, scheduler, validator, or cancellation implementation. |
| `src/domain/processors/buildProcessingPlan.js` | Pure processing-plan construction; not validation of AI/imported commands. |
| `src/audio/analyzer.js`, `dsp.js`, `genre.js` | Production measurement/DSP/classification; unresolved loudness/true-peak/gain limitations. |
| `src/audio/processor.js` | Audio decoding, one-buffer OfflineAudioContext processing, encoders/download helpers; not a multitrack or managed-asset pipeline. |
| `src/audio/reference.js` | Reference resolution/analysis behavior; preserve supported reference workflows and privacy boundaries. |
| `electron/main.cjs`, `preload.cjs` | Isolated desktop shell, external navigation, update bridge. No project/media filesystem repository IPC. |
| `index.html` | Entry; old interface still requests Google fonts. Reviewed local assets under `src/assets/fonts/` are prepared; Slice A wires them/notices and removes CDN requests. |
| `tests/unit/`, `tests/audio/`, `tests/fixtures/` | Built-in Node tests and synthetic fixtures; inspect what each assertion actually proves. |
| `scripts/validation/` | Isolated loudness candidate and pinned native-reference tooling, not production integration. |
| `package.json`, `package-lock.json`, `vite.config.ts` | Scripts, dependencies, and build configuration; lead-approved scope only. |
| `build/`, `public/` | Existing icons/assets; do not delete tracked icon sources as generated clutter. |

### Preserve working interactions

File/drop/demo import; file/catalog/URL reference flows as currently supported; full/fast analysis and reports; waveform/radar/meters; playback, rate, seek, A–B; crop and region export; manual adjustments and single-buffer processing; WAV/MP3/available recorder conversion and downloads.

"Converse" in the present interface does not prove an AI command executor exists. The `design-agent` dependency is not evidence of an integrated agent. Buffer loading resets processing/tweak state: **do not use whole-buffer reload as a linked-item replacement mechanism**.

### Missing capabilities / technical limits

No session/track/bus/group domain aggregates, stable DAW entity/revision graph, durable project/media store, history/undo, multitrack graph renderer, Linked Sessions, hosted plugins, or validated AI operation executor are implemented. Existing reference/catalog identifiers are not a DAW track identity model.

Decoding uses an AudioContext; existing offline processing uses the supplied buffer's length/rate/channels. Timing, resampling, channel meaning, latency/tails, automation, shared returns/sidechains, plugin support, full-track memory budgets, and render cancellation need explicit contracts and real tests. Float WAV export currently clamps samples, so it is not automatically a transparent internal intermediate. Object URLs/downloads do not constitute persistent managed assets.

## 4. Working architecture and required boundaries

CORE-007 explicitly reconciles the original proposal at [docs/ARCHITECTURE.md](../ARCHITECTURE.md), [docs/PRODUCT_VISION.md](../PRODUCT_VISION.md), and [docs/ROADMAP.md](../ROADMAP.md). These are canonical working drafts **for review**, not a deployed model/API or accepted implementation defaults. The architecture owns technical semantics and the roadmap owns the staged proof/proposed test matrix; this guide stays an actual-state/source map rather than a parallel full spec.

Mandatory owner constraints remain: modular monolith/incremental preservation; UI intent through validated application operations and pure state transitions to async repositories; stable identity and relevant dependency provenance; manual-only reviewed linked updates; destination processing/unrelated-item/old-valid-asset preservation; no silent upstream cascade or cycle; AI uses the same approved operations and cannot override manual updates. Parsing/import/model output is untrusted and never mutates active state before validation/review. No component-localStorage project store, arbitrary generated code/path execution, silent upload/cost, or mutable originals.

Architecture sections 12–14 specify the proposed exact selection/currentness/transaction/recovery model and real selected-group -> edit -> explicit update -> preserved destination -> restart proof. The roadmap distinguishes pure, real-render, persistence and UI evidence. Its 20 planning cases are not implemented tests or a recovered verbatim original scenario list; crosswalk the owner's originals before claiming coverage. No source code or existing application contract changes in CORE-007.

## 5. Proposal reconciliation and provenance

[PR #1](https://github.com/The-Mhood/onverse/pull/1), `architecture/product-foundation` at `eedc24cb38c21d1a4be6186593c7ae7fcb8c6f85`, remains open/draft and unmerged at this checkpoint. CORE-007 is a separate explicit lead architecture task, not incidental onboarding adoption. It evolves three same-path documents on the engineering branch and preserves their source attribution:

| Revised working document | Pinned original proposal |
| --- | --- |
| [Architecture](../ARCHITECTURE.md) | [Source](https://github.com/The-Mhood/onverse/blob/eedc24cb38c21d1a4be6186593c7ae7fcb8c6f85/docs/ARCHITECTURE.md) |
| [Product vision](../PRODUCT_VISION.md) | [Source](https://github.com/The-Mhood/onverse/blob/eedc24cb38c21d1a4be6186593c7ae7fcb8c6f85/docs/PRODUCT_VISION.md) |
| [Roadmap](../ROADMAP.md) | [Source](https://github.com/The-Mhood/onverse/blob/eedc24cb38c21d1a4be6186593c7ae7fcb8c6f85/docs/ROADMAP.md) |

Original README and [engineering standards](https://github.com/The-Mhood/onverse/blob/eedc24cb38c21d1a4be6186593c7ae7fcb8c6f85/docs/ENGINEERING_STANDARDS.md) are not adopted. Later PR #1 review must reconcile overlapping paths explicitly, not merge over the working drafts. General trusted-auto-apply wording in the local vision is narrowed so it cannot override manual linked updates. Commercial ideas remain hypotheses; the design brief remains the sole UI-direction brief. New POC restrictions/record/API recommendations need review and real proof before dependent implementation.

## 6. Validation and honest reporting

Run applicable checks, recording exact commands, exit codes, limitations, and skipped work. A read-only audit must not install or build into the checkout. For document-only work, verify links, paths, scope, fences, and whitespace; a build is usually unnecessary.

```bash
# Existing default regression suites:
node --test tests/unit/*.test.js tests/audio/*.test.js
node scripts/test-analyze.mjs

# Strict diagnostic: expected to expose the three known legacy LUFS failures.
MUSICONVERSE_STRICT_AUDIO_REGRESSIONS=1 node --test tests/audio/analyzerRegression.test.js

# When applicable and dependencies are available/authorized:
npm run build
```

COORD-006 review baseline: default 154 tests / 151 passes / 3 explicit known legacy LUFS TODO cases / 0 unexpected failures, including nine actual-controller boundary tests. The earlier 145/142 snapshot is historical. Strict legacy diagnostics remain 47 tests / 44 passes / 3 known loudness failures; do not hide them, loosen tolerances, or promote TODOs to claim correctness. Candidate/reference agreement is isolated synthetic research, not normative certification, full-track performance proof, or a production replacement. Dangerous normalization/gain remains unresolved. See the metering contract and queue for exact evidence.

No test/lint/typecheck/UI-test npm scripts are configured. No new dependencies without owner approval. No browser/listening/macOS/export/packaging/recovery result is implied by Node tests or a build. Owner-side testing remains deferred, not completed.

UI changes require checks appropriate to the diff: import, references, analysis, processing/manual tweaks, A–B/playback/rate/seek, crop/export, conversion; keyboard/focus/contrast, empty/loading/error/disabled states, viewport behavior, and reduced motion. Provide preview/screenshots where tooling supports it; report unavailable checks honestly. Bind remote previews to `0.0.0.0`, allow only the necessary host/origin, and use relative browser-facing service URLs. The Electron minimum window is currently 1120 x 700; web responsiveness must be evaluated separately.

Keep Electron context isolation/sandboxing and Node-disabled rendering intact. Future filesystem IPC must be narrow, validated, and permission-scoped. CSP/link/path/package validation and the placeholder updater feed need release/security review; onboarding is not a security certification. No signing, notarization, updater installation, release, branch deletion, or merge just to make a check look complete.
