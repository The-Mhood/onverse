## CURRENT OWNER UPDATE — UI-RESET-003 / 2026-10-16

Owner explicitly assigns main/controller startup repair to lead and authorizes
new reference direction13/02/05/09/04; former design WAIT/shared-main pause is
superseded. Lead-owned working tree now boots and exercises real local workflows;
P's a965e189 presentation is integrated byte-identically. See
[actual result, exact boundaries and remaining limits](UI_REBUILD_STARTUP_REPORT.md).
455tests/452pass/3knownTODO, production build and actual browser proof/screenshots.
This is LOCAL uncommitted/unpushed work, not a PR8 merge or release acceptance.
P's routine visual work remains unblocked. Existing protected contracts/core held
work stay preserved; historical authority/inventory below is not overwritten.

# UI-RESET-001 — complete visual reset / P authority

2026-10-16. Owner-authorized **complete frontend reset**, not a restyle. P replaces
B as UI agent; B is retired from this workflow. This record supersedes conflicting
B grants, file reservations, Orbit rollback requirements, old boards, palette,
font/fallback directions and visual acceptance targets. It does NOT revoke core
protection or authorize Git history/ref destruction. New design stays ON HOLD until
the owner supplies new media references. The AI music engineer remains **SYLUNE**.

## 1. Verified GitHub baseline — not a local-branch assumption

Read live GitHub repo/branches/PR APIs and fetched only named commit objects for
inspection. No checkout switch, branch creation/reset/rebase, merge or push.

| State | Exact baseline / consequence |
| --- | --- |
| Default `main` | `2faa3939b9e109e5a9ed2e0d53130dc51c5abc9e`; PR3 merged2026-10-15. Original main/style/scene/draw/interface and committed font assets remain. |
| Merged core branch | `arena/b25c318e-onverse` at `1924ef117027943c64e50d06ee03207bef426e4b`, included by PR3/main. |
| Current lead session | Fixed `arena/14df8ffa-onverse`, local HEAD2faa3939; remote tip8051fe0c. Do NOT reset/realign this dirty session. |
| Core PR4 OPEN | `8051fe0c495c8c18a696007891935e69966e2c9f`; seven committed proof files beyond main, not all newer Linked/host/range services. |
| Later held core |61changed/new local paths preserved before this audit; full local pre-audit tree131files. Linked render/update/history/recovery/host/range/storage diagnostics are partly uncommitted. Prior PR4 comment patches are review evidence, NOT reachable implementation commits. |
| Retired B PR5 CLOSED, NOT MERGED | Head `b17f2aa4004192ef95c60c34ad67bd7ccf4a6e6c`;15commits beyond main,43changed/new paths. Closure2026-10-16T14:24:30Z; head-ref deletion14:24:31Z recorded in GitHub timeline. Head remains retrievable. No assumption of rollback or vanished code. |
| Other live branch | `architecture/product-foundation` at `eedc24cb38c21d1a4be6186593c7ae7fcb8c6f85`; inventory only, no mutation. |

**P's canonical reset baseline is GitHub main2faa3939, not PR5's closed head.** Do
not merge/cherry-pick B just to delete it. Main's original interface must actually
be removed; B-only paths already absent are recorded as absent, not fake deletions.
If P's own fixed session has additional/committed/untracked UI, inventory/preserve it
and reconcile that actual state before writes. P must identify its own fixed branch,
HEAD, GitHub base/ancestry and unpublished work; coordinator does not invent them.
No reset, stash, clean, ref resurrection, force push, main deletion or branch wipe.

## 2. Pre-deletion inventory (published BEFORE UI deletion)

[Complete168path human inventory](ui-reset/PREDELETE_INVENTORY.md) and machine
`ui-reset/PREDELETE_INVENTORY.json` cover all four live GitHub branch tips, closed
PR5 head and the preserved local tree. Each record includes Git blob/size/mode per
snapshot, local SHA256/size, ownership category and disposition.131local files were
snapshotted outside Git before coordinator edits. This is NOT a removal log.

Old frontend includes original Analyze/Convert/AI Fix/report/reference/player/crop/
tweak/export screens and all B shell/header/studio/daw prototypes/SYLUNE panel,
cosmic/universe/Orbit scenes, camera/shader/procedural texture code, palette/drawers,
inline SVG/icon definitions, CSS/fonts/favicon and packaged app-icon art/generator.
Inventory includes fonts already merged in PR3, not just B's later Sora files.

No standalone screenshots, photos, external textures, 3D models, audio assets or
extra backgrounds were found in these Git trees/local tree beyond the explicitly
listed fonts/favicon/app icons. B's universe manifest says procedural-only and
lists no shipped external assets; shaders/procedural art are still old UI to remove.
No ignored files were reported in this lead checkout. This does NOT prove a retired
worker's external/ignored/unpublished screenshots/downloads don't exist. P must scan
its own checkout/ignored outputs and report any additional assets before deletion;
do not fetch, upload or use old media as the new design foundation. Never scan or
remove user project/audio directories outside the agreed repository scope.

Historical source in Git, PRs or external audit snapshots is not an active runtime
fallback. Preserve history/review/legal evidence; no old visual code/assets may
remain imported, reachable via flags/URLs, copied as a template or shipped unused
inside dist/electron/static assets. Documentation's old design directions are
superseded, not authority for the new design.

## 3. P ownership and deletion authority

P may comprehensively remove/restructure/replace **presentation-only** portions of:

- `src/style.css`, `src/scene.js`, `src/ui/draw.js`;
- `src/ui/presentation/**`, `src/ui/styles/**`, `src/orbit/**` where present;
- `index.html` visual theme/font/favicon metadata and frontend mount/entry wiring;
- `src/assets/fonts/**`, `public/favicon.svg`, old UI-specific assets elsewhere
  explicitly identified by the inventory/preflight (no wildcard `public/` wipe);
- obsolete `tests/ui/**` / `tests/orbit/**` layout/palette/scene tests, while porting
  applicable behavioral/a11y/error/contract coverage rather than hiding failures.

This includes retiring old internal presentation APIs such as createStage and
removing both original/classic and later cosmic/universe/Orbit alternatives. **No
hidden fallback or old layout foundation.** Prior narrow Orbit/camera reservations
are superseded for genuinely presentation-only reset changes. No new assets/styles/
components/design direction until new owner references arrive. P may prepare the
removal patch and a minimal non-designed, accessible pending-reference shell; not
an invented new dashboard or a working-looking simulated DAW/SYLUNE engine.

Font license/notices may leave the active tree only after all corresponding shipped
font bytes/references are removed. Keep required third-party notices for retained
code. New reference/media provenance/licensing will be handled after references.

P is NOT assigned by a directory's name to its hidden core logic. Any unclassified,
mixed or apparently functional file is inspect/propose-first, not delete-first.
Do not install new libraries/frameworks/runtimes or change dependencies/build/IPC.

## 4. Shared gates / protected functionality

### `src/main.js` — whole-file deletion is NOT authorized

Original main and B main both contain real functionality intertwined with markup.
Exact original anchors (line numbers describe main2faa3939, not future stable IDs):

- state12+, AudioContext/analyser/source lifetime53+, activeBuffer70,
  stopPlayback91/playBuffer106, seekTo237/cycleRate264/togglePlay276;
- crop state296+, cropBuffer349/exportCropRegion364/applyCrop377;
- loadBuffer743/openFile1697 and busy/result/reset invalidation;
- ensureReferenceReady800/makeTarget856, real runAnalysis903;
- runFix1105, runConvert1199, downloadOutput1222/downloadReport1238;
- pickReferenceFile1455/resolveReferenceUrl1469; tweak currentPlan1569 and
  rerenderFixed1580 with epoch/queue handling; functional keyboard/file/reset wiring;
- update subscription1858+ and the existing Electron API's event/install semantics.

P may propose exact UI-only hunks. Lead owns a behavior-preserving extraction/review
of these mixed functional seams before their markup/callers disappear. No concurrent
writes to main. Do not leave old HTML/CSS/render functions inside an unmounted
"legacy controller" as the alleged extraction. Retain real operations and replace
view coupling, not the engine/state with stubs or a duplicate session model.

The nine controller-boundary cases in `tests/unit/analysisErrorFlow.test.js` currently
parse main.js. Lead must explicitly migrate their seam with unchanged success,
reference-decline/rejection, sync/async engine failure, progress/setup failure,
non-Error rejection and busy/cleanup assertions. No test deletion or tolerance change
to accommodate removing the UI. The exact extraction/new internal paths are a
separate reviewed diff, not an implicit new architecture approved by this record.

### SYLUNE presentation contracts

`src/ui/presentation/sylune/contextActions.js` and
`tests/ui/sylunePresentation.test.js` (B-only) include DTO/validation as well as view
reducers/prototypes. P may retire panel/prototype visuals, but lead reviews contract
and safety assertions before whole-file retirement. Keep backend plan/approval/
execute/cancellation/currentness/identity and same-service operation semantics.
If a public contract or protected behavior must change, identify exact old/new
fields/consumers/tests and obtain owner approval BEFORE applying it.

### Icon/build boundary — no silent obsolete-asset exemption

`build/icon.icns`, `build/icon.iconset/**`, `build/icon_1024.png` and
`scripts/make-icon.mjs` are old visual assets, not exempt from the reset. P inventories
and prepares removal. Lead must first review the exact coupled `package.json`
`build.mac.icon` (currently `build/icon.icns`) and `scripts.icon` reference removal/
replacement. No P-wide package/Electron/build authority. Do not delete the art and
leave broken packaging, silently retain it, or introduce a new custom icon before
references. Any remaining icon/config blocker must appear in the residual report;
"clean slate complete" cannot be claimed while old branded icons still ship.

### Core deny-list (retain regardless of current GitHub/local availability)

`src/audio/**`, `src/application/**`, `src/domain/**`, `src/infrastructure/**`, actual
session/project data, immutable media/provenance, undo/redo/history, Linked update/
recovery/currentness, analysis/mastering/conversion/reference logic, all core tests/
fixtures and `scripts/validation/**`. Do not remove working services from mixed UI
files. Existing `electron/**` lifecycle/security/preload/IPC/updater, package/lock,
Vite/inlining/legacy builder and core public contracts remain lead-owned/protected.
Packaging's build/ directory is not all disposable just because it contains icons.

Protect working implementation, not invented features: B's DAW is explicitly a
nonworking prototype; actual general multitrack recording/plugin/automation/SYLUNE
provider, production persistence and authenticated session IPC are not established.
Keep real code; don't claim the reset preserves a fully integrated DAW that wasn't
there. Linux prototype persistence is not packaged Mac acceptance.

## 5. Execution order / no new design until references

1. **P receipt/preflight:** acknowledge this superseding decision and all inventory;
   report fixed branch/HEAD/base, own pending work/additional assets and exact file
   plan. No old boards, screenshots or palette as design brief. Publication alone
   is not receipt/start; no launch runtime or P GitHub account mapping is verified.
2. **Shared extraction gate:** lead/P review exact main/DTO/test/icon crossings.
   P can inspect and prepare owned removal patches now; don't land/apply a broken
   half-reset while functional markup/import consumers still require them. Ordinary
   UI-only deletion inside the stated scope needs no further design approval.
3. **Clean neutral frontend:** remove old interface/visual code/assets/imports and
   obsolete visual-only tests once mixed seams are safe. Minimal unstyled pending-
   references notice, no fake controls, no hidden original/Orbit/classic theme.
   Frontend workflows will temporarily be unavailable, explicitly listed; preserved
   backend code passing tests is not proof of new UI operation. Never erase data.
4. **Evidence/review:** publish exact diff/removal+retention+residual inventories,
   core-hash/seam comparisons, test/build results and honest unavailable workflows.
   No reset completion while old active assets or blocked shared work remain.
5. **WAIT FOR OWNER MEDIA.** Only then create a new design from those references;
   no inherited shell/layout/iconography/font/color assumptions. SYLUNE name stays.

No blanket commit/push/merge/release permission is granted to this lead session by
publishing coordination. Preserve its held work; P must follow its fixed session
and existing publication authority, report a patch if authority is unestablished.
No main deletion, unrelated branch mutation, force/history rewrite or B-branch reuse.

## 6. Required post-deletion evidence (not yet executed)

- removed/replaced/retained/absent-by-baseline paths; old visual assets count and
  leftover CSS/imports/URLs/flags/procedural renderers/fonts/icons/screenshots;
- exact name-status/stat/full diff, including untracked files and shared hunks;
- existing audio/application/domain/Linked/store/history/recovery/host/contract tests
  and migrated controller-boundary cases; same3LUFS TODO/strict failures explicit;
- supported frontend build, static asset/bundle reachability/dead imports, no old
  artifacts in emitted/packaged output; no new dependency without approval;
- actual neutral-shell boot, console/network errors, keyboard/focus/a11y/reduced
  motion,1120x700 and1480x920 evidence when an authorized browser exists;
- later new-frontend import/analysis/reference/manual processing/playback/A-B/seek/
  crop/conversion/export and real Linked approval/update/history/session-reopen
  checks as applicable. State which cannot run until frontend/production integration
  exists; no fake UI success, listening, Mac/build/provider certification.

## 7. Fresh pre-deletion checks

Actual isolated GitHub main:154tests/151pass/0fail/3known LUFS TODOs.
Actual preserved local core:404/401pass/0fail/3known TODOs.
Closed B head in isolated source archive:231tests/226pass/2fail/3known TODOs,
actual exit1: `orbitStage.test.js` cannot import uninstalled `three`; stale
`presentation.test.js` assumes a Git checkout and now-deleted
`origin/arena/ced77c2a-onverse`. These are environment/ref-precondition failures;
no assertion weakening/install/ref resurrection done, no complete B validation
claimed. No application build/browser/GUI/listening/Mac checks in this audit.

**Current removal status: zero UI files deleted; old main UI remains active.** This
is the required published pre-deletion baseline/authority, not completed cleanup
or proof P has received/started. Local preservation includes every pre-audit file.

## 8. Published handoff / delivery truth

- [GitHub authority + complete human inventory, issue6](https://github.com/The-Mhood/onverse/issues/6).
- [P execution packet + exact149635byte machine inventory, issue7](https://github.com/The-Mhood/onverse/issues/7).
- Both issue bodies were read back via GitHub API and verified byte-exact against
  submitted bodies. Compressed machine JSON decoded byte-exact; its SHA256 is
  `c07e3b2c3d8a251c4e7b66cddf96d98ff7f51e85e17da547fb32a342134cab73`.
- Publication metadata is in `ui-reset/GITHUB_PUBLICATION.json`; comments/updates
  to existing issues returned HTTP403. No PR4/PR5/issue2 notification is claimed.
  Issue creation was the verified capability; no bypass or credentials requested.
  GitHub connection permissions need attention/reconnection in Arena for those
  blocked comment/update operations. Do not send credentials in chat.
- P's GitHub identity/fixed session/receipt/start remain unverified. This is an
  actionable published assignment, not evidence of an agent launch. Copyable
  handoff is `P_UI_RESET_HANDOFF.md`. No UI deletion occurred in this audit.

## 9. New submission reviewed — PR8, not integrated

Actual reset PR8 at995306c927c6d0e71fb6483013f141ffd31ecb4b appeared after the
pre-deletion audit. Its six-path proposal removes3old UI modules but remains
unmerged; main still2faa3939, local held core unchanged. The old manifest is the
historical before snapshot; new submitted delta/evidence is ui-reset/PR8_REVIEW.json.

[Lead review](https://github.com/The-Mhood/onverse/pull/8#issuecomment-6218369703)
and [exact reproduction](https://github.com/The-Mhood/onverse/pull/8#issuecomment-6218384660)
are API-readback verified. CHANGES REQUIRED: null DOM binding atmain1477, unbound
stage breaks stopPlayback, retained old markup/fonts/favicon/icons prevent complete
reset. Fresh tests alone don't boot entry. See P_UI_RESET_PR8_REVIEW.md for exact
head/lines, positive math-copy review and P correction scope. Formal request-changes
was rejected as self-review; published comments are not that formal event.

Lead main extraction paused before edits to avoid collision. No P-branch write or
merge, source adoption or protected contract change. P may continue approved pure
UI cleanup and coordinate the functional split; design still held for references.
