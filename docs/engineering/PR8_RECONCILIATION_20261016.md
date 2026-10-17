# PR8 reconciliation — 16 October 2026

## Disposition

Keep verified delivery **704fafdd3ba4c25fb62a14c775eb40624b951b60** as the production baseline. **Do not merge PR8 at 295e0d31716ceb9d8e7cd978381b46450ceb73ea wholesale.** Reconciliation selects only its three additional lifecycle tests and their deterministic timer fixture. All production code, visuals, native shell, dependency manifests, six existing regressions and original LUFS assertions remain byte-identical to704fafd.

This reconciliation commit is a direct child of704fafd on `arena/14df8ffa-onverse` (PR4), not a merge or rewrite of PR8. Its only changed paths are the workbench test file, this report, and the machine-readable [verification summary](evidence/pr8-reconciliation-20261016.json). PR8 remains open and unmerged; its unselected work remains in its own history. No release readiness or acknowledgement/start by another agent is implied.

## Exact ancestry and origin of the failures

Pinned endpoints:

- Verified delivery: **704fafdd3ba4c25fb62a14c775eb40624b951b60**.
- Reviewed PR8: **295e0d31716ceb9d8e7cd978381b46450ceb73ea**, parent **052e8ecd84908aa4dc8021a4d1b59d65364329e1**.
- Merge base: **6a9369ad28239513158b87aa5467304222c093dc**.
- At review start: **7 delivery-only / 7 PR8-only commits**. Neither endpoint contains the other.

Delivery-only commits: `b9def81`, `deb5b2c`, `2c1ab8f`, `fffa979`, **`f92fe04`**, `5a1e10d`, `704fafd`. PR8-only commits: `995306c`, `9f7eef`, `a965e18`, `7e105a0`, `52cd540`, `052e8ec`, `295e0d3`. PR8's `52cd540` merged6199230; `052e8ec` merged6a9369a. The full fixes in **f92fe04609cce2a007ee2f9535e14ea8eb221c87** are absent from PR8's ancestry.

**Important attribution correction:** 295e0d3 did not newly introduce all six bugs into PR8. They are inherited controller paths introduced in **61992304043b39aa6ec85a64cf5a3bd447388094**, where these workbench/controller files first appeared. Git blame and independent negative controls confirm this.295e0d3 partially handles conversion/tweak disposal, but leaves those six paths unfixed. Replacing704fafd's versions with PR8's would *reintroduce* them relative to the verified delivery.

| Regression | Inherited introducing change in6199230; still present in295e0d3 | Fix retained fromf92fe04/704fafd |
|---|---|---|
| Dispose during render promotes B/recreates playback | `runFix` awaits `audio.masterFix`, then measures/publishes/plays without a lifecycle check; `playBuffer` has no disposed guard | Check immediately after render, plus guarded playback/context creation and side effects |
| Dispose during fast remeasurement promotes B | `runFix` publishes after `analysis.analyzeFast` without a lifecycle check | Check immediately after measurement, before B promotion |
| Dispose during full analysis publishes late effects | `analysisController.runAnalysis` has no host-active port; progress, state/report and finally callbacks publish after awaits | `isActive` host port; guarded progress and checks after reference preparation/analysis; suppressed late error/finally effects |
| Dispose during decode replaces source | `openFile` awaits decode then calls `loadBuffer` unconditionally | Guard after decode and at load/entry boundaries |
| Failed B-crop replaces last-valid B | `applyCrop` assigns `state.fixed = trimmed`, resets position/crop and renders **before** awaiting measurement | Measure first, then atomically promote B/measurement/position/crop only on success |
| Dispose during reference lookup publishes success or failure | `resolveReferenceUrl` mutates URL state after resolve or reject without a disposed check | Guard after await and before catch publication; preserve prior reference/view state |

Reproduction with the same retained six tests:

| Source tested | Pass | Fail |
|---|---:|---:|
| Introducing6199230 controller paths | 0 | **6** |
| PR8 at295e0d3 | 0 | **6** |
| Reconciled704fafd-based result | **6** | 0 |

The six assertion bodies remain unchanged. Reference resolution includes both rejection and resolution scenarios. No TODO/skip or weakened tolerance conceals a failure.

## Smallest defensible selection

**Selected, byte-for-byte from295e0d3's test block:**

1. Disposal cancels a queued manual render before processing starts.
2. Disposal suppresses late manual-render progress/results **without aborting the active render promise**.
3. Disposal suppresses late conversion publication/download **without aborting the active conversion promise**.

The only fixture changes are PR8's deterministic timer map and exposing it to those tests. These add useful coverage to the retained implementation; the original20 workbench cases, including all six reproduced regressions, remain intact. Total workbench cases: **23**. Production changes required: **zero**.

**Not selected:**

- Competing loudness implementation:704fafd already has independent channel-energy semantics, non-finite PCM/energy rejection and the original `1e-6` assertions. Do not replace these with PR8's reorganized fixtures or looser added checks.
- Partial conversion/tweak-only disposal code:704fafd already supplies broader suppression across decode, reference preparation/resolution, full analysis, render, fast measurement, crop and playback, with idempotent context-close ownership.
- Lazy full-raw MP3 loading, async `encodeMp3`, chunk relocation and relative build base: these change API/distribution behavior unnecessarily. Keep704fafd's same-package minified inline encoder, original synchronous API, notice retention and proven file-origin output.
- Restored icons / `packaging-resources`: not necessary to preserve verified workflows; would reverse an approved retirement decision without native acceptance. Existing local icons are nevertheless preserved untouched.
- Broader inlining, packaging, Electron-title or preview-host changes: not required by the selected tests. The exact endpoint diff includes the earlier Electron title and Vite host/preview differences; this is not falsely described as a five-file-only PR8 diff. Configuration, cancellation documentation and reference-provenance wording remain available in PR8 for separately scoped review, not silently discarded or accepted.

Production source and the original LUFS assertion file were compared against704fafd after selection: **identical**. The immutable reference source remains900f07330f463d26bde0cc1d4bd731945c4fffec, indexed by `docs/design/REFERENCE_PACK_SOURCE.json`; original references are not bundled or modified by this reconciliation.

## Checkout discrepancy: resolved metadata, preserved dirty files

Before reconciliation:

- Actual local HEAD: **2faa3939b9e109e5a9ed2e0d53130dc51c5abc9e**, on the fixed branch.
- Remote fixed-branch / PR4 head: **704fafdd3ba4c25fb62a14c775eb40624b951b60**.
- PR8 head: **295e0d31716ceb9d8e7cd978381b46450ceb73ea**.
- Index clean relative to the old HEAD, but worktree dirty/untracked with restored published source, eight held documents, other held work and old icons. Matching source bytes did **not** make this a checkout of704fafd.

A **normal `git merge --ff-only 704fafdd...`** was executed on the fixed branch with `GIT_WORK_TREE` pointing at a separately populated clean file view. Git advanced the actual branch HEAD and actual index normally, without checking out over the dirty root files. No reset, forced update, branch switch, new recovery commit, stash, clean, history rewrite or protected-file overwrite occurred. All **202 initial present files were hash-identical immediately after the fast-forward**. Reconciliation then modifies only the authorized workbench tests:201 originals remain byte-identical, including all68 held/non-published files and12 old icons.

The reconciliation commit advances this same branch normally from704fafd; its immutable committed tree is the tested publication state. The actual root intentionally remains **dirty** with the eight held document bodies and other held/untracked work. It must not be advertised as a clean checkout or used to stage all files indiscriminately. Final exact HEAD/remote/PR IDs and detailed clean/dirty status are recorded in the publication readback sidecar and PR handoff, because a report cannot embed its own commit hash.

### Reappeared icons

All **12** root `build/icon.*` files:

- Are present before and after reconciliation, untouched and separately backed up.
- Match the old2faa3939 base **and**295e0d3's restoration byte-for-byte.
- Are absent from704fafd and from the selected committed result; after the fast-forward they are visible as untracked `build/` files, not secretly staged.
- Have history showing retirement in the reset/recovered delivery and restoration by295e0d3. Their local presence predates this reconciliation; bytes/timestamps do not establish which process restored the local copies.

Consequently the actual root's entry-shell retirement assertion still fails. This is explicitly reported, not fixed by deleting icons or weakening tests. A separate clean published-source view and a preserved-work review overlay keep that local discrepancy distinct from the intended committed source.

## Fresh verification

| Verification | Result |
|---|---|
| Six retained failures on the selected result | **6/6 PASS** |
| Published-source result, strict regressions | **368/368 PASS**,0 fail/cancelled/skip/TODO |
| Preserved-work review view | **558/558 PASS**,0 fail/cancelled/skip/TODO |
| Actual dirty root, icons retained | **557/558 PASS;1 FAIL**, icon-retirement assertion at `tests/ui/entryShell.test.js:55` |
| Focused loudness/normalization/recorder/encoder/workbench suite | **156/156 PASS** |
| Sanity script | PASS |
| Production build | PASS; no chunk warning |
| Synthetic production browser replay | **22 groups PASS;13 downloads;32 genuine PNGs** |

The clean source is704fafd plus the selected tests; after committing, every published path is byte-checked against the final Git tree and the full suites/build/sanity are rerun. The overlay copies all68 held files unchanged into a separate review view, without adding the12 retired base icons. It does not delete or alter their originals and is **not** a claim that the real root is fully passing. Added tests explain the change from365/555 to368/558.

### Audio and codec recheck

- Full/fast/quick loudness: independent copied-channel filtering/energy sum; mono calibration and original1e-6 assertions retained. Still ungated approximate loudness, not BS.1770 integrated qualification.
- Recorder ownership: **8 tests**, plus a fresh real unsupported-codec constructor failure with context close and tracks ended. Primary encode errors survive cleanup failures. No assertion of every OS/codec failure path.
- Normalization evidence: **8 tests**; short/silent/floor-only/non-finite target evidence rejects; native invalid cases reject before offline rendering. No new gain policy or manufactured success.
- Disposal is late-publication suppression, **not aborting computation or general request freshness**. Both the six retained cases and PR8's three added lifecycle cases pass.
- Failed B-crop retains previous B and measurement; A stays unchanged. Native UI crop/export and decoder-error preservation also pass.
- MP3: **six mono/stereo ×128/192/320 byte-parity cases plus upstream notice/LICENSE check pass**. Actual exported MP3 is81,502B, SHA-256 `9ed582c9d48a11bff0adc5cf4c4605ad08e1db2cec00921883a9c2e9d6886100`, identical to verified delivery.
- Native trim: **12** mono/aligned/inverted cases at44.1/48kHz, targets−18/−24; max gain error **7.436004728633705e-9**, max target error **2.8320332390308067e-7**, below unchanged1e-6. These are achievable-target/self-consistency checks, not absolute standards calibration.

### Build and browser

Output is **byte-identical to704fafd**: JS243,228B, CSS179,986B, HTML423,837B; HTML SHA-256 **b316b5ab6328c9b7f65716ff4166cab18ef768e937d0416ec3d448ed7185cb83**. The verified59.971% JS reduction is retained; no threshold, dependency or distribution change was introduced here.

Pinned external Chromium153/Puppeteer25.14, scripts-disabled43-package toolkit; private allowlisted synthetic-only runtime, CPU raster. The unchanged browser harness exercised actual production import/demo/analysis/reference/playback/A–B/Master Fix/manual adjustments/crop/region export/conversion/download/error preservation and file-origin import/export. Both1120×700 and1480×920, live motion/transitions and reduced motion passed; no unexpected page errors, failed responses or blocked requests. Main flow closes10/10 realtime contexts; separate file-origin flow1/1. Browser runtime cleanup succeeded. No user audio, live provider, physical listening, native Electron or target-device GPU acceptance is claimed.

## Evidence and remaining conflicts/gates

Fresh raw logs, exact endpoint/subsequent diffs, full ancestry/blame, initial/end inventories, icon hashes, backups and browser report/captures reside at:

`/home/user/reviews/pr8-reconciliation-20261016/`

The committed JSON summary binds fresh browser evidence by SHA-256. Full-resolution capture evidence is not duplicated into Git. Key logs: `six-inherited-619.log`, `six-pr8-295.log`, `six-reconciled.log`, `candidate-tests.log`, `preserved-work-tests.log`, `actual-root-tests.log`, `focused-verification.log`, `candidate-build.log`, `candidate-sanity.log`, `browser-replay.log`; final-tree verification/publication logs are additional sidecars. No CI pass is inferred from local verification.

**Remaining conflicts:** PR8's unfixed paths, competing encoder/API/distribution and packaging/icon changes are **not merged**; only the selected test contribution is reconciled. Held work stays dirty/unpublished. Original local icons still cause the explicitly reported root-only test failure. These are not hidden by the isolated passing suites.

**Release gates remain OPEN:** independently calibrated/gated loudness, channel-aware reconstructed true peak/surround and gain/limiter policy; physical listening; supported native Mac/Electron launch/app/DMG/ZIP/ownership/recovery/migration/storage/update; signing/notarization/Gatekeeper/security. Full npm audit remains **13 advisories (4 high,9 moderate)**; production-only npm audit **0**. No advisory has been remediated or accepted by this reconciliation. All13 require remediation or explicit documented risk acceptance; production-only classification is not application/build-chain security certification. No Electron download, native packaging retry, unrelated dependency upgrade or UI rebuild was attempted.
