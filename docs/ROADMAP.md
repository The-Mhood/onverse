# MusicOnVerse — Roadmap

**Reconciled working draft for review — CORE-007, 2026-10-15.** Evolves the existing [PR #1 roadmap](https://github.com/The-Mhood/onverse/blob/eedc24cb38c21d1a4be6186593c7ae7fcb8c6f85/docs/ROADMAP.md), preserving the broader ambition while bringing the minimum Linked Sessions identity/render/storage spine forward. This is an outcome/gate plan, not implementation acceptance, task dispatch, a calendar commitment, or a merge of PR #1. [Architecture](ARCHITECTURE.md) owns technical semantics; [product vision](PRODUCT_VISION.md) owns the user promise; [design brief](design/DESIGN_BRIEF.md) owns UI direction.

This roadmap prioritizes a product people can trust and pay for, while preserving the long-term AI DAW ambition. Dates should be assigned after a short code-and-user validation sprint; the milestones are outcome-based rather than calendar promises.

## North star

A creator can import a real song, understand what is wrong, request one specific improvement in plain language, preview it, approve it, undo it, and export a better result without losing the original.

## Stage 0 — Stabilize the foundation

**Goal:** make the current prototype repeatable, testable and safe to extend.

Deliverables:
- Document supported Node/Electron/macOS versions and a clean install/build path.
- Fix repository hygiene: secrets/env patterns, release outputs, logs and generated files ignored appropriately.
- Replace the placeholder update URL or disable production update checks until the feed exists.
- Add CI for install, lint/type checks where available, tests and build.
- Establish audio test fixtures and baseline behavior for import, analysis, master fix, A/B playback and export.
- Validate measurement claims and add confidence/provenance to reference profiles.
- Record known limitations and a bug-triage process.

Exit criteria:
- A clean clone can install and build on a documented Mac environment.
- CI catches broken imports/builds.
- The primary audio workflow has repeatable regression coverage.
- No secrets or real customer audio are required to run tests.

## Stage 1 — Turn the prototype into a product

**Goal:** a reliable single-track analysis and correction workspace.

Deliverables:
- Clear project/session state with stable IDs.
- Non-destructive processing history, undo/redo, reset and comparison snapshots.
- Level-matched A/B playback and clear before/after metrics.
- Improved reference selection: distinguish real audio analysis from genre-profile approximation.
- Export presets, metadata, peak checks and clear progress/cancel/error states.
- Basic preferences and local project save/open.
- Instrument the product's funnel locally/opt-in: import, analysis completion, preview, export, failure.

Exit criteria:
- Users can complete the workflow without losing their source or becoming confused about what was actually changed.
- Crashes, slow renders and unsupported formats fail gracefully.

## Linked Sessions spine — minimum proof before feature expansion

This spine is **not** a mix-to-master product restriction. It brings only enough multitrack/session/render/storage support forward to prove the mechanism; it does not require completing recording, a native engine, every mixer feature, AI or the whole Stage 4 DAW first. Existing app workflows stay intact behind the reviewed service boundaries. Proposed POC conditions are fixed-range 48 kHz L/R stereo, source gains/sum, no unsupported FX/automation/returns/sidechains/latency/tails/resampling, and commit while stopped. See the architecture for audibility and incompatibility rules; broader support follows real tests, not unchecked assumptions.

| Gate | Bounded work | Required evidence / stop condition |
| --- | --- | --- |
| L0 — review | Reconcile this draft, source dependencies, immutable media/version rules, approval/compatibility policy and test plan | Owner/lead review recorded; no self-acceptance; recover/crosswalk the original 20 scenarios before claiming exact coverage |
| L1 — minimum contracts | Stable IDs and immutable snapshots; selected group/membership; one linked-item version; relevant dependency projection; typed prepare/commit operation and compatibility validation | Pure Node tests for relevant/irrelevant edits, identity replacement, invalid data, deterministic projection and no active-state mutation during parsing/planning; no new dependency or large domain framework |
| L2 — critical mechanisms | Real OfflineAudioContext sum at declared alignment; transparent finite Float32 managed media; actual granted filesystem staging/generation/journal adapter | Analytic PCM checks (including unclipped over-range float), metadata/hash checks, reload; injected failure at every commit boundary; prove available runtime/permissions or report blocked. Mocks alone do not satisfy this gate |
| L3 — minimal real end-to-end | Persist source A (Conga + other drum + independent Vocal) and destination B (gain/EQ + unrelated item), transfer selected Drums group internally, edit source, explicitly update, reopen and undo/redo | Source edits do not replace B; unrelated Vocal does not stale Drums; Conga does; explicit update changes only its linked version, preserves B's processing and unrelated audio; actual output chain, restart and last-valid recovery verified |
| L4 — expand kinds/graph | Single track; actual routed bus; full stereo mix; independent items; selected/all batches; shared dependencies; chains/branches/cycle guards; supported format/timing policies | Each capability passes real render + relevant persistence tests before advertised. Compare track sum vs bus print with different known processing; strict missing/rerouted/member/sidechain cases. No guessed routing or unsupported fallback |
| L5 — operational presentation | Accepted application/state/command contracts exposed to agent-b through a reviewed, exclusive slice | Reviewed audit/design, exact main base/path reservation, functional states and regression/browser evidence; no fake mixer/session or second authoritative UI model |
| L6 — AI planner | Same operation registry and affected-item approval UI, strict imported/model validation; mock planner for contract tests then a real integration proof if approved | No approval/manual-update bypass, wrong-target application, arbitrary code/path tools, silent upload or paid job; no claim mock planner proves provider integration |

Each gate is a small reviewed unit or a sequence of explicitly scoped units, not authorization to implement the table. Next proposed lead task after L0 acceptance is the smallest L1 contract test unit, followed immediately by the real-mechanism L2 proof before expanding dependent abstractions. Announce exact filenames, base, permissions and checks for each unit. Keep `src/main.js` and presentation untouched during isolated proof work; later integration needs a separate handoff.

### Test plan — proposed 20-case crosswalk

**These are planning cases, not implemented tests and not a verbatim recovered copy of the owner's original 20 scenarios.** Those originals are not stored in this checkout; retrieve/confirm them and record the crosswalk before declaring coverage. IDs below are newly assigned planning IDs, not invented source IDs. Existing 145 Node tests do not exercise these missing Linked Sessions mechanisms.

U = pure unit/domain; R = real renderer; P = real persistence/recovery; I = UI integration. A unit mock passing does not satisfy an R/P/I cell. Later-capability cases stay unsupported, not silently counted as green in the first proof.

| Planning ID | Scenario and observable result | Required layers | Earliest gate |
| --- | --- | --- | --- |
| LS-P01 | Single identified track transfer owns valid rendered media and truthful provenance | U/R/P/I | L4/L5 |
| LS-P02 | Selected tracks combine into one reusable named group/item; analytic PCM/alignment, IDs and snapshot persist | U/R/P/I | L3/L5 |
| LS-P03 | Routed bus print differs from selected sum when bus/return processing differs; no semantic substitution | U/R/P/I | L4/L5 |
| LS-P04 | Full stereo source output includes supported routing/master processing and declared audibility rules | U/R/P/I | L4/L5 |
| LS-P05 | Multiple independent linked items keep separate versions even if asset content is shared | U/R/P/I | L4/L5 |
| LS-P06 | Independent Vocal edit neither stales nor changes Drums; shared-context exception is explainable | U/R/P/I | L3; shared case L4 |
| LS-P07 | Conga edit flags relevant Drums, leaving committed destination bytes/version unchanged until approval | U/R/P/I | L3/L5 |
| LS-P08 | Explicit one-item update preserves destination gain/EQ, automation/routing/placement and unrelated media; process new audio through actual retained chain | U/R/P/I | L3; advanced state L4 |
| LS-P09 | Update selected items touches exactly the reviewed bindings/usages; unselected items stay unchanged | U/R/P/I | L4/L5 |
| LS-P10 | Update all within one destination is all-or-nothing; one failed item leaves every prior binding/history valid | U/R/P/I | L4/L5 |
| LS-P11 | Deleted/recreated same-name source never rebinds automatically; missing/asset-replaced input is explicit | U/R/P/I | L3/L5 |
| LS-P12 | Rename alone does not stale; group membership/deletion/reroute creates the correct explicit review/conflict | U/R/P/I | L1/L4/L5 |
| LS-P13 | Processing/parameters/order, gain/pan, automation/timebase and declared mute/solo/bypass semantics participate correctly | U/R/I | L4/L5 |
| LS-P14 | Sends/returns/buses/sidechains/shared state and newly added contributors affect the right closures, not unrelated items | U/R/I | L4/L5 |
| LS-P15 | Rate/layout/duration/range/latency/tail incompatibility blocks replacement; later approved conversions preserve explicit alignment | U/R/P/I | Reject L3; support L4 |
| LS-P16 | Relevant source or targeted destination changes during render require replan; unrelated edits are preserved; no false latest label | U/R/P/I | L3/L5 |
| LS-P17 | Invalid output, missing engine/plugin, cancellation, budget limit and retry retain old asset; no duplicate or late cancelled commit | U/R/P/I | Supported subset L3; plugins later |
| LS-P18 | Restart and injected interruptions at staging/journal/head/history boundaries recover one complete valid generation; undo/redo retain assets | U/R/P/I | L2/L3/L5 |
| LS-P19 | Branch/chain provenance distinguishes direct currentness from stale ancestry; explicit immediate revisions/cascades, cycle/unknown-graph rejection | U/R/P/I | L4/L5 |
| LS-P20 | AI/manual operations obey identical target/capability/range/permission/approval rules; malformed imports never mutate state; no upload/cost/code/path bypass | U/R/P/I | L1 validation; L6 integration |

Use small deterministic recipes generated in tests, not committed user audio/large PCM. Fixtures need exact rate/layout/frame/placement/gain metadata, finite values, silence/impulse/tones, analytic expectations and declared numeric tolerances. Native/reference tools and official vectors are separate evidence; synthetic agreement is not certification. Bound memory/native concurrency; profile realistic full tracks and target platforms before lifting proof limits or making latency/quality claims.

### Release/merge and UI coordination

At the source audit main was `ce02cf9`, lead `38484e8`; main had neither the service/plan refactors nor these drafts. [PR #3](https://github.com/The-Mhood/onverse/pull/3) remains draft review, not accepted/merged; GitHub checks/reviews were empty. No merge is performed in this architecture unit. Existing default tests have 142 passes / 3 known TODOs; strict loudness failures, dangerous gain, updater/security and user-side checks remain open. No clean-install/build/desktop/renderer/recovery result is inferred from writing this roadmap.

agent-b can continue its authorized read-only audit of `370190c` plus the later [UI decision](engineering/UI_BASELINE_DECISION.md). This draft is supplemental requirements context, not a retarget, acknowledgment, file reservation or implementation dispatch. The selected main-based wait strategy remains. Current-capability shell proposals do not wait for a full DAW; functional linking/mixer/plugin features do wait for their actual contracts. Keep independent metering/gain hardening separately scoped; do not use Linked Sessions as a reason to wire an unaccepted research API.

## Stage 2 — AI Sound Engineer v1

**Goal:** make conversational control useful before building a full DAW.

Deliverables:
- A chat panel grounded in the loaded audio's analysis and explicit user goals.
- Structured intent schema and operation allow-list.
- Initial supported intents: explain analysis, adjust master EQ within limits, set loudness target, adjust stereo width within safe bounds, create a render plan, compare/undo.
- The agent proposes a plan and explains its assumptions.
- Preview first; approval before commit; every accepted action is undoable.
- Local/mock planner for development, then provider adapter with server-side credentials and quota controls.
- Conversation history attached to the project, with clear privacy controls.

Exit criteria:
- Unsupported or ambiguous instructions do not produce silent or fabricated edits.
- Every accepted suggestion maps to a validated command.
- User can compare, reject, tweak, and undo.
- A small evaluation set measures intent parsing and action correctness.

## Stage 3 — Timeline-aware region processing

**Goal:** allow precise edits at a requested time range.

Deliverables:
- Project timeline with waveform, playhead, selection, markers and region boundaries.
- Region effects and automation lanes using the shared command system.
- Requests such as "increase reverb between 1:05 and 1:35" target the selected track/region.
- Preview render for selected regions and crossfades at boundaries.
- Track/source awareness: when only a stereo master exists, explain that processing affects the mix or offer optional stem separation.
- Region boundary tests to prevent clicks and unintended edits.

Exit criteria:
- Region edits preserve timing, are repeatable, and can be undone.
- UI clearly shows the affected source and exact range.
- No claim of drum-only manipulation is made when no drum source exists.

## Stage 4 — A focused DAW core

**Goal:** record and mix real audio sessions, with a deliberately limited first scope.

Deliverables:
- Versioned project format, autosave, crash recovery and media relinking.
- Multitrack audio timeline, recording, device selection and take management.
- Mixer: gain, pan, mute/solo, inserts, sends, bus/master routing and meters.
- Built-in processor registry: EQ, compressor, reverb, delay, saturation, limiter, utility.
- Automation for volume, pan and processor parameters.
- Export of stereo mix and individual stems.
- Audio engine proof of concept for latency, monitoring, glitches and offline/live parity.

Exit criteria:
- A user can record, save, close, reopen, edit, mix and export a multitrack session.
- No unsupported claim of professional low-latency monitoring until measured on target hardware.

## Stage 5 — Source-aware AI and premium workflows

**Goal:** make AI act on meaningful musical sources.

Deliverables:
- Optional stem separation job for vocal/drums/bass/other.
- Source confidence and artifact warnings.
- Source-aware AI actions and multitrack masking diagnosis.
- Vocal cleanup and selected timing/pitch workflows only after quality evaluation.
- Cloud render queue with explicit cost, cancellation, retry and retention policies.
- Creator subscription and credit metering based on real operating costs.

Exit criteria:
- Blind listening tests show improvements for target tasks.
- The user understands cloud processing, data retention and billing before submitting audio.

## Stage 6 — Pro DAW and ecosystem

**Goal:** expand only after the core product has repeat users and willingness to pay.

Potential deliverables:
- Native plugin hosting proof of concept, then supported VST3/AU where technically and legally feasible.
- Plugin capability registry so AI can control supported parameters safely.
- Advanced routing, MIDI/instruments, comping, time-stretching and performance tools.
- Collaboration, client comments, version history and team billing.
- Preset/template marketplace and partner SDK.
- Cloud sync and team workspaces.

Exit criteria:
- Each major investment is justified by user demand, support burden and margin.
- Plugin compatibility, licensing, security and cross-platform support are documented.

## Reconciled first engineering checkpoints (proposed, not dispatched)

1. Review CORE-007's draft contracts/POC restrictions and recover the original scenario crosswalk (L0).
2. Record exact minimal L1 files/checks and test identity, selection, relevant revisions, approval and compatibility rules.
3. Verify available runtime/permissions and prove real render + transparent managed media + journal/recovery (L2).
4. Demonstrate the complete selected-group -> edit -> manual update -> preserved destination -> reopen/undo loop (L3).
5. Review evidence and integration/security/performance limits before any operational UI or broader render kinds.
6. Complete the main-based UI baseline review separately; agent-b audits/proposes first, then receives an exact exclusive implementation scope.
7. Expand routing/bus/mix/batch/chain semantics only behind their real tests (L4).
8. Integrate accepted state/application operations with presentation, preserving current import/analyze/fix/compare/export workflows (L5).
9. Build the mock planner only as contract coverage, then prove any separately approved real provider path through the same operations (L6).
10. Continue independent gain/measurement, release/update/security, full-track/device/listening and clean-install/CI hardening with actual evidence and no new dependency without approval.

## Metrics

### Product
- Import-to-first-result completion rate
- Time to first useful preview
- Preview-to-approval rate
- Undo/rejection rate by action type
- Export success rate
- 7-day and 30-day creator retention

### Quality
- Audio render regression rate
- Playback glitches per session
- Analysis latency by file duration
- Crash-free sessions and memory ceiling
- AI command validation failures and wrong-target incidents

### Business
- Activation-to-paid conversion
- Paid retention and monthly churn
- Cost per AI/cloud job and gross margin per tier
- Support time per paid account
- Share of users who return to a second project

Do not optimize for AI messages sent. Optimize for useful musical outcomes and retained customers.
