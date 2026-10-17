# MusicOnVerse — implementation architecture

Updated2026-10-17. The owner's Logic Pro–like DAW is active product scope. This
record separates actual runtime, the incremental DAW implementation and preserved
experimental research. Exact prior755-line draft/provenance remains recoverable
through [cleanup](engineering/CLEANUP_20261017.md); its proposals are not lost or
silently represented as installed APIs.

## Existing production entry

`src/main.js` mounts `src/ui/workbench/workspace.js`, then binds
`src/application/workbench/workbenchController.js` to the existing processor and
reference ports. Analysis uses the shared analysis controller/service. The view
is an effects/intent adapter, not an audio execution authority. Existing A/B
buffers, analysis, render and lifecycle safeguards remain protected.

`src/ui/presentation/rebuild/**` provides shared tokens, materials, environment
assets/motion. Its current layered2.5D implementation is not a true3D camera,
volumetric renderer or accepted cinematic completion. P owns its correction.

## DAW implementation boundary

Implement real stable-ID tracks/clips/assets, non-destructive frame-based placement/
trim/split, track gain/pan/mute/solo, synchronized transport, mixdown and explicit
project save/open. One authoritative application-owned project; immutable metadata
snapshots flow to presentation, validated commands return to application. PCM assets
are private and immutable, not duplicated in UI state or localStorage. View zoom/
selection are presentation state only. Preserve independent workbench functionality;
bridge a rendered DAW mix through the existing workbench audio import/analysis path.

Native WebAudio scheduling and offline rendering must share graph construction,
so audible track inclusion, source offsets, durations and gain/pan policy agree.
No fabricated meters, recording, plugins, MIDI, buses or assistant operations.
A portable project file is explicit file persistence, not autosave/native crash
recovery, an authenticated project service or a migration of the experimental store.

## Preserved experimental core — inactive

- `src/domain/linkedSessions/**`: bounded stable-ID snapshot/selection/dependency
  closure and currentness, trusted fixed/range rendering profiles.
- `src/audio/linkedSessions/**`: bounded PCM/selected-source/destination render
  helpers. Not connected to the current renderer's audio processing path.
- `src/application/linkedSessions/**`: opaque review/approval, render/prepare/
  promotion and cancellation/uncertainty barriers behind injected ports.
- `src/infrastructure/linkedSessions/**`: Linux-only generation/media repository
  and kernel flock adapter. Not production Mac storage or a new live DAW authority.
- `src/application/sessions/**`: trusted host facade and strict bounded wire
  validation. No Electron registration or authenticated sender boundary is installed.
- `scripts/validation/**`: opt-in synthetic/native-candidate diagnostics. The
  packaged probe preparation emits a hash-guarded review patch only; it does not
  modify Electron. Standalone SQLite feasibility is not packaged qualification.

These mechanisms and their tests are now preserved as reviewed inactive work,
not discarded or activated by cleanup. See [foundation status](engineering/EXPERIMENTAL_FOUNDATIONS.md),
[Linked update contract](engineering/LINKED_UPDATE_SERVICE.md),
[target session IPC](engineering/SESSION_APPLICATION_IPC.md),
[proposed production storage](engineering/PRODUCTION_SESSION_STORAGE.md) and
[core integration risks](engineering/CORE_INTEGRATION_REVIEW.md).

## Non-negotiable integration rules

Validate schemas, IDs, media geometry/budgets and units before active-state change.
Use exact dependency/provenance and last-valid audio; no display-name rebinding,
second authoritative UI store, generated code execution or automatic linked update.
Keep history/recovery/cancellation outcomes honest. Imported originals remain
unchanged. No silent uploads, arbitrary filesystem access or AI bypass of approval.

Native Mac packaging/storage/recovery/update, device listening and standards-grade
metering/true-peak/surround/gain policy remain separately unqualified. Security
findings require remediation or explicit risk acceptance; browser tests do not
prove these gates. See [AGENTS](../AGENTS.md) for current authority.
