# MusicOnVerse — current collaboration authority

Updated2026-10-17. This document replaces the accumulated contradictory operating
notices. Exact prior documents and original retired icons are preserved in the
[cleanup inventory](docs/engineering/CLEANUP_20261017.md), not discarded.

## Product and active work

The owner's Logic Pro–like multitrack DAW is **current implementation scope**,
not a deferred requirement. Preserve and reuse the working single-file audio
workflows while implementing real track/clip/transport/mix/project operations.
No mock controls or disconnected demonstration. Cinematic references01–13 and
later owner corrections govern the presentation; functional tests alone do not
establish visual acceptance. Current visual result is owner-rejected.

## Ownership and coordination

- Lead delivery is fixed to `arena/14df8ffa-onverse`, PR4. P works on
  `arena/31c3346b-onverse`, PR8. B is retired. Never switch/create another lead branch.
- Lead owns application/domain/audio, project data/history, integration, tests,
  `src/ui/workbench/**`, `src/ui/daw/**` and `src/main.js`.
- P owns `src/ui/presentation/rebuild/**`, including environment/motion/assets.
  The former lead reservation on those environment paths is released. Do not
  concurrently edit P's presentation. Coordinate exact shared-host changes directly.
- Inspect actual heads and dirty work before integration. Publication is not
  worker receipt/start, private-worktree cleanliness or visual acceptance.
- Preserve active/unpublished work and original references/assets/evidence. No
  reset/clean/stash, force/history rewrite, blind divergent merge or repo wipe.
  Archive exact valuable originals before removing confirmed redundant copies.
- No PR/main merge or PR closure without separate owner authorization. Commit/push
  coherent reviewed work only to the fixed delivery branch; never overwrite P.

## Engineering invariants

- Keep real import/demo/analysis/reference/playback/A–B/crop/export/MasterFix/manual/
  conversion/download, late-result suppression and last-valid B behavior intact.
- One authoritative project model per project. UI receives projections and issues
  validated operations; no duplicate component/localStorage project authority.
- Stable track/clip/asset IDs, exact source dependencies, non-destructive media,
  bounded validation, explicit history and atomic publication. Failed/cancelled
  operations preserve the last valid project/audio. No rebinding by display name.
- Linked transfers remain explicit review/approval operations, preserving destination
  processing/unrelated audio and exact provenance. No silent cascading updates.
- Imported/project/AI data is untrusted. No generated code/shell execution, secret
  capture, silent network uploads, paid operations or mutation of original files.
- Existing Linux linked-session/session foundations are inactive experimental
  reference/test mechanisms, not the live DAW store or authenticated Electron IPC.
- New DAW functionality is authorized; dependencies/native/IPC/security crossings
  still require exact scoped review, not routine approval for ordinary implementation.

## Evidence and release

Run relevant unchanged regression assertions, new mechanism tests and production
build. Inspect actual screenshots and runtime motion against the original images.
Do not fabricate listening, Mac/Electron, security or standards-conformance results.
Original three LUFS regressions were fixed without assertion/tolerance relaxation;
P295's six protected-controller negative failures do not authorize replacing the
stronger delivery runtime. Native packaging/recovery/update/signing/notarization/
Gatekeeper, physical listening, standards-grade metering/true peak/surround/gain
policy and security remediation or explicit risk acceptance remain release gates.
See [current work](docs/engineering/WORK_QUEUE.md) and dated implementation evidence.
