# agent-b proposal: MusicOnVerse DAW structure, cosmic environment and SYLUNE

Status: **proposal for lead review. Not canonical. Not an implementation grant.**
Author: agent-b. Branch: `arena/ced77c2a-onverse`. Draft PR #5 carries the coordination request.
Sources: the approved cosmic mockup (primary composition), Reference 1 (secondary: lighting, atmosphere, colour), and the Logic Pro structural screenshot (2026-10-15 14:04).

## 1. What exists today (verified in `src/main.js`)

MusicOnVerse is a **single-buffer analysis and mastering studio**, not a multitrack DAW. Current functions:

| Function | Control (id / action) | Status |
| --- | --- | --- |
| Load a file or demo | `btnUpload`, `btnIdleUpload`, `btnIdleDemo`, `data-action` upload/demo | exists |
| Analyze | `btnAnalyze`, `data-action="analyze"` | exists |
| Reference track and stream reference | `refAreaFile`, `refAreaAnalysis`, `ensureReferenceReady` | exists |
| Master fix (one-click) and fine-tune | `btnFix`, `fixTweakPanel`, `btnTweakReset` | exists |
| A/B playback | `abToggle`, `btnPlay`, `btnPlayRegion` | exists |
| Rate, seek, transport reset | `btnRate`, `seekBar`, `btnTransportReset` | exists |
| Crop with in/out markers | `btnCrop`, `btnApplyCrop`, `btnSaveCrop`, `cropIn`, `cropOut` | exists |
| Export (download, fixed copy, report) | `btnDownload`, `btnDownloadFixed`, `btnDownloadReport` | exists |
| Format conversion | `btnConvert`, `btnConvertGo`, `convKbps`, `convWav` | exists |
| Mode switch | `modeSwitch` (SCAN / CONVERT) | exists |
| Master's report rail | `reportRail`, `btnReportToggle` | exists |
| Orbit Mode (`?orbit=1`) | stage swap and HUD, landmark keys 1–3 | exists, flag-gated |
| Licence dialog | `btnLicences` | exists |

Not present, and therefore **not to be shown as working**: multiple tracks, track headers, arrangement regions, a channel mixer, buses, sends, routing, plugin slots, automation, MIDI, recording, and project files.

## 2. Logic Pro as structural reference: a target, not a clone

The DAW layout below maps the Logic structure onto real MusicOnVerse objects first. Each element is labelled one of three ways:

- **EXISTS**: wired to current behaviour.
- **PROTOTYPE**: UI shape only, no engine behind it. Must show "not implemented" and must not change audio.
- **FUTURE**: requires an engine capability the lead has not committed to.

Target layout, top to bottom:

1. **Transport bar** (EXISTS: play, region play, reset, rate, seek. PROTOTYPE: record, cycle, metronome, tempo, key). The tempo and key readouts stay PROTOTYPE until analysis supplies them.
2. **Track headers and arrangement** (EXISTS: Project, Reference and Master lanes as the three real objects. PROTOTYPE: additional track rows, drawn only to show the target shape).
3. **Playhead, ruler and region** (EXISTS: seek and crop markers on the Project lane).
4. **Automation lane** under a selected lane (PROTOTYPE).
5. **Mixer strip row** (PROTOTYPE, one strip per lane): level, pan, mute, solo, insert slots, sends, output. Each control is shown disabled with a "not implemented" label. None of them move audio. This is the only place a mixer appears, and it does not invent a multitrack engine.
6. **Inspector** (EXISTS for the selected lane's analysis summary, which already lives in `panelAnalysis`).
7. **SYLUNE panel** (see section 4).

A design rule: **no control may look live unless it is.** Disabled controls carry the label "Not implemented" in text, not only in a tooltip.

## 3. Cosmic environment across workspaces

- One environment for every workspace: DAW, Orbit, analysis, mastering, reference, conversion and future workspaces. It is a shared backdrop, not per-screen decoration.
- Composition follows the approved mockup: a ringed or banded planet in the upper left, moons on the right, a ring arc in the lower right, a blue planetary limb along the bottom. Reference 1 supplies lighting, atmosphere and colour only.
- Panels stay opaque enough for readable text. Contrast must meet WCAG AA on every workspace, and the environment must never sit behind body text at full strength.
- Motion is restrained. With `prefers-reduced-motion`, the environment is static and camera work is limited to deliberate user input. No auto-rotation.
- The 3D stage (`scene.js` for DAW, `orbit/` for Orbit) stays behind the UI. Lead-owned `scene.js` is not changed by this proposal.
- Validation: screenshots of every workspace at 1120×700 and 1480×920, plus a narrow web layout. A static image is not presented as a functional 3D environment.

## 4. SYLUNE: producer and sound-engineer assistant

SYLUNE is an agent that works on the session. It is not a chat box. The UI proposal:

- **Entry point:** a SYLUNE icon in the main header opens and closes a collapsible panel. This replaces the permanent oversized AI Fix sidebar concept. Existing master-fix behaviour moves into the panel's actions and is not removed.
- **Ask SYLUNE** can be opened from any inspectable object: a lane, a region, a waveform, a mixer strip, a plugin slot, a knob, or a parameter. The panel opens with that object's context (type, name, current value, source) attached as a visible context chip.
- **States (UI only):** idle, thinking, analyzing, proposing, awaiting approval, executing, previewing, completing, error. These are driven by an integration interface and show nothing else.
  - Prototype states must say "prototype" and "nothing is applied".
  - No state may imply live analysis, real knob movement or successful execution before the lead connects the interface to the engine.
- **Approval rule (UI requirement):** a proposal shows its exact change, then waits. Approve and discard are the only actions. An approved change goes through the lead's operations, never directly through the UI.

### Integration points for the lead (interface, not implemented)

The UI consumes these and emits these. The lead decides names and data contracts.

- Input: selected object descriptor `{ kind, id, label, value, unit, source }`, and session state summary.
- Input: SYLUNE status `{ state, message, proposal?, error? }`.
- Output: `askSylune(objectDescriptor)` when the user opens a context.
- Output: `respondToProposal(proposalId, 'approve' | 'discard')`.

These are proposals for review. No engine or contract is changed by them.

## 5. Ownership and what is needed to proceed

| Work | Files | Current status |
| --- | --- | --- |
| Cosmic backdrop and layout | `src/style.css`, `src/ui/styles/**`, `index.html` | Visual grant exists from UI-004 Slice A; new workspace-wide work needs review |
| SYLUNE panel and header icon | `src/main.js` (exclusive, lead-assigned), `src/ui/presentation/sylune/**` | **No grant. Not started.** |
| Mixer and track structure | `src/main.js`, possibly `src/domain/**` | **No grant. Owner rule forbids inventing a multitrack mixer unless the owner decides otherwise. Not started.** |
| Orbit reconciliation | `src/orbit/**`, `tests/orbit/**`, `main.js` hooks | Built under owner direction. Queue status requested on PR #5. |

## 6. Validation plan

- Unit tests for any pure state or view-model code (`tests/ui/**`).
- Browser checks at 1120×700 and 1480×920 for each workspace, with screenshots next to the approved mockup.
- Contrast, focus and reduced-motion checks.
- Confirm that every EXISTS control still produces its current behaviour, and that every PROTOTYPE control is labelled and inert.

## 7. Open questions for the lead and owner

1. Is a SYLUNE panel and its prototype states allowed, given UI-004's "no future DAW/AI facade" acceptance?
2. Does the owner accept a track-and-mixer structure whose controls are PROTOTYPE-only until an engine exists? The owner brief currently forbids inventing a multitrack mixer.
3. Which files should agent-b be granted for the header icon and the panel?
