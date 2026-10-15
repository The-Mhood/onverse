# MusicOnVerse — Roadmap

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

## Suggested first 10 engineering tickets

1. Add root-level `.env*` and release-output ignore rules, without ignoring example env templates.
2. Document the real build matrix; remove or clearly gate placeholder auto-update configuration.
3. Add CI for clean install and `npm run build`.
4. Extract audio-analysis/processing entry points into service adapters without changing behavior.
5. Add fixture-based tests for WAV encoding, duration, channels and clipping behavior.
6. Define versioned `Project`, `Track`, `Asset` and `AudioCommand` schemas.
7. Add a local project repository with atomic save and reopen.
8. Implement an undoable operation/history abstraction for existing master-fix changes.
9. Add a mocked AI planner that returns schema-valid plans; do not connect arbitrary tool execution.
10. Ship one conversational action end-to-end: explain a finding → propose a bounded EQ move → render preview → approve/reject → undo.

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
