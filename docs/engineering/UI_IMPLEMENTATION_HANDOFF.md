# UI implementation handoff — COORD-006 / UI-004

**Historical handoff (decision date: 2026-10-15, Africa/Lagos), superseded for UI direction and file grants by UI-RESET-001 / issue #7 and the PR #8 review.** Its reference images, typography, Slice A/Orbit scope, and old path reservations are not current design authority. The new design is on hold until owner references arrive. Keep the technical measurements, provenance, constraints, and validation history below as historical evidence; do not treat this handoff as current implementation approval. [AGENTS.md](../../AGENTS.md) governs preservation.

**Integration gate:** the lead reviews all of PR #3, fixes substantive findings, and uses the explicitly authorized `gh pr merge 3 --merge` only if review passes. The exact resulting main commit **M**, reviewed PR head, ancestry evidence and activation result are published in the **COORD-006 result comment on [PR #3](https://github.com/The-Mhood/onverse/pull/3)** after the operation. This file cannot contain its own future merge SHA. A proposed merge or this pre-merge document is not proof that M exists. Use the actual full published M, never a guessed SHA or a moving branch tip.

## 1. Settled scope and sequence

- **Reference 1 is the visual target. Reference 2 supplies layout structure only.** Logic Pro informs professional usability, not an extra visual target. Ground-up presentation redesign, not an extension/skin of the old interface; preserve application/audio/domain contracts and real workflows.
- **UI-004 / Slice A first:** current-capability shell, navigation, transport and central workspace; responsive presentation and honest states, reference provenance/copy, reviewed local fonts/notices. Existing single-buffer functions remain accessible. No invented working multitrack mixer, plugin host, Linked Sessions, backend or AI executor.
- **UI-005 / Orbit Mode spike afterward**, after Slice A review/acceptance and a separate source reservation. A separate module behind an explicit feature flag, off by default; proposed module location `src/scene/orbitStage.js`. It is not bundled into the Slice A assignment. Keep the existing `createStage(canvas)` API and returned `setSpectrum(arr)`, `setEnergy(v)`, `setPlaying(v)`, `dispose()` contract unchanged. No framework/new dependency.
- Reduced-motion **camera behavior belongs to that Orbit spike, not Slice A**. Slice A preserves existing CSS reduced-motion/accessibility behavior; it does not refactor the camera to satisfy a later spike.
- Test the ringed planet, moon terminator, atmospheric limb and ring against Reference 1 at **1120×700 and 1480×920** for the spike. Supply actual screenshots and element-by-element matches/gaps; do not claim physical/visual equivalence from API compatibility. Lead has not performed these comparisons or recovered reference image artifacts in this checkout. Agent-b uses the owner's supplied references in its context; report missing reference artifacts rather than substitute imaginary ones.

## 2. Fingerprint wording and actual provenance

This is **copy/wording provenance**, not a clipboard feature, asset identity hash or new measurement API.

Source inspection: `src/audio/genre.js` defines numeric `GENRES`/category profiles directly; no measured chart-track corpus, collection recipe or corpus licence/provenance accompanies them. The pre-reset entry metadata made an unsupported measured-platform-corpus claim; that copy has been removed. Genre comments and UI labels are not evidence of a measured corpus. Do not present platform strings or hard-coded targets as independently measured platform recommendations.

Use these distinctions in Slice A, including entry-page metadata, explanatory text, reference labels and fallbacks:

| Actual path | Approved wording / required disclosure |
| --- | --- |
| Automatic/category choice → `matchGenre` / `categoryProfile` | **Built-in genre profile** — illustrative comparison target; not a verified measured chart-track fingerprint |
| Uploaded reference → `decodeFile` → local service analysis → `targetFromFeatures` | **Measured uploaded reference** — local analysis using experimental current meters |
| Apple Music preview → `fetchPreviewBuffer` → local service analysis → `targetFromFeatures` | **Measured Apple Music preview** — only the available preview, not the full streamed track; current meters remain experimental |
| Resolved metadata/category → `profileForResolved` | **Metadata-selected built-in profile** — full streamed track was not analyzed |
| No usable reference audio/category → existing auto fallback | **Built-in profile fallback** — reference audio unavailable; explain the actual fallback, not success at measuring a stream |

Suggested entry description: “Local audio analysis, reference comparison, processing and conversion.” Remove promises to fix everything, measure top-track corpora or support every format; show actual available formats. Do not rename profile fields/IDs or alter analysis/processing math as a copy fix. Preserve the supported reference-resolution workflow and its network/privacy boundary; this assignment adds no upload/provider. No standards-grade loudness, true-peak, limiter or safe automatic-gain claim is authorized.

## 3. Actual failure propagation and reviewed correction

`createAnalysisService` in `src/application/analysis/analysisService.js` forwards buffers/progress unchanged; its async methods return the engine result or reject with the original thrown/rejected value. It does not convert errors to empty success, move work off-thread, validate meters or implement cancellation.

Actual controller paths in `src/main.js`:

- Uploaded-reference analysis is awaited inside `ensureReferenceReady()`'s try/catch. A handled failure reports reference failure and returns `{ ok: false }`.
- Preview fetch/analysis is awaited inside a different try/catch. Its intentional failure policy is a notice and profile fallback, **not** propagation of a fatal measurement error or a claim that full-track audio was measured.
- `runAnalysis()` awaits preparation, then the main analysis and constructs/displays the target/result. Review reproduced a defect: preparation and control setup were previously **outside** its try/finally, so an unexpected preparation rejection escaped feedback/cleanup with `state.busy === true`.
- COORD-006 moves setup/preparation into the existing try/finally. Declined preparation returns through cleanup; rejection reaches the existing error feedback; finally clears busy, hides progress and refreshes reference controls. Error formatting also handles null/undefined non-Error rejection values. There is no engine/DSP change.
- Fast remeasurement used by crop/master-fix/rebalance continues to be awaited through the service in the existing controller flows. Service substitution is not whole-application runtime equivalence, rollback proof or a new worker implementation.

`tests/unit/analysisErrorFlow.test.js` evaluates the **actual source function** in a Node VM with explicit collaborators. The first eight cases were run against the unfixed source: 5 passed / 3 failed (preparation rejection, declined-preparation cleanup, setup failure). After correction, all nine current cases pass, including non-Error values. Tests cover guards, success, early decline, setup/service/progress failures and cleanup/error identity before result publication. They do **not** prove DOM resilience, browser workflows, real audio rendering, atomic rollback after a view fails, or immediate cancellation. Original first exploratory VM harness omitted a playback stub and was invalid; it was corrected before the successful reproduction and regression run.

## 4. Font option A and texture packaging: resolved

- **Option A = approved self-hosting**, concretely mapped here to Orbitron for sparse brand/display, Rajdhani for UI and Share Tech Mono for readouts, with system fallbacks. These are the existing verifiable families; no unavailable historical family proposal is fabricated.
- Historical record: reviewed, unmodified WOFF2 subsets, complete OFL 1.1 notices, package versions/registry integrity and per-file SHA-256 hashes were previously vendored under `src/assets/fonts/`. UI-RESET-001 later removed the unused font bytes, manifest, README and notices; no font binaries or runtime references remain. This provenance record does not approve those families for the replacement UI.
- Slice A wires local `?inline` font URLs and accessible full `?raw` OFL text, and removes Google font links/preconnects. Assets are prepared in this baseline but **not yet wired into the old UI**. Don't mistake a successful baseline build for completed offline typography.
- **Textures: locally generated/procedural, no CDN or downloaded planet-texture dependency.** Prefer the existing Three.js CanvasTexture mechanism for the later spike; deterministic local generation needs no network/source-asset licence acquisition. If a small static texture is needed for presentation, store a locally authored PNG with provenance in `src/assets/textures/` and import it explicitly with `?inline`. No unreviewed external artwork.
- Existing `scripts/inline-dist.mjs` inlines JS/CSS, not arbitrary binary-relative URLs. An isolated proof using installed Vite and that exact inliner algorithm preserved a real inline WOFF2, a local PNG and full raw OFL text, with no external script/style/font/texture reference. This supports the packaging choice **at artifact level only**. Actual Slice A browser/file://, offline network and Electron behavior still require checks; no packaging configuration change is authorized/needed by this proof.

## 5. Exact handoff and exclusive ownership

**Dated boundary: 2026-10-15.** Lead completes the reviewed controller correction and integration first. On publication of verified M and the COORD-006 activation result, the following reservation is exclusively held for **agent-b on its existing fixed `arena/ced77c2a-onverse` branch in its own isolated checkout**. Lead freezes these UI/shared files until explicit release or coordinated re-handoff. Reservation is not evidence the worker has acknowledged or started; missing acknowledgment is never silently treated as one.

**Slice A write allowlist (new paths permitted only where stated):**

- `src/main.js`: presentation/templates and event binding only; preserve state schema, action semantics, awaited service calls, cleanup, reference decisions, processing/playback behavior and domain/application APIs. Ground-up DOM/CSS is allowed, not a core/controller/state rewrite.
- `src/style.css`, `index.html`.
- New presentation-only files under `src/ui/presentation/**` and `src/ui/styles/**`.
- The pre-reset proposal reserved `src/assets/fonts/fonts.css` and `notices.js`; that reservation is superseded. Do not recreate or wire font assets before new owner references.
- New locally generated textures/provenance under `src/assets/textures/**`, with the inline packaging rule above.
- New presentation tests under `tests/ui/**`, using existing tools; no new dependency/test runner.

**Forbidden:** `src/audio/**`, `src/application/**`, `src/domain/**`, `src/ui/draw.js`, `src/scene.js`, `src/scene/**`, existing core/audio tests and fixtures, Electron/IPC, package/lock/build/config/scripts, other existing assets, and coordinator/architecture/design/queue documents. Forbidden wins. Orbit files are **not** part of this allowlist. Report necessary shared-contract changes instead of implementing them. The lead may work separately in protected core paths only with a new scoped assignment and no shared-file overlap; CORE-008 is still not dispatched.

**No early Slice A at `38484e894a283f43cbb36e05804990b7a4a73e88`.** The actual requested ground-up slice needs shared `src/main.js` action wiring, now including the corrected preparation/error boundary, accepted local service/plan seams and explicit handoff. It is not an isolated CSS experiment independent of its future baseline. Expedite reviewed M rather than create a second implementation on the stale audit base.

## 6. Worker activation: independent verification, then proceed

The lead inspected the available lead checkout/worktrees/remote refs/PRs; no published UI branch or UI worktree was accessible. Agent-b checkout cleanliness, unpublished commits, processes, runtime, reference artifacts and receipt **remain independently unverified**. Do not claim otherwise or move that checkout remotely.

Once the COORD-006 PR result publishes actual M, agent-b is **authorized to perform the following preflight and, if it passes and ownership is acknowledged, start Slice A without another owner/lead approval round-trip**:

1. Discover/report its own path/runtime, fixed branch and full HEAD; inspect status including untracked work, worktrees, relevant remote refs and active processes. Require its own isolated checkout, not the lead's directory or a shared editing worker. Preserve all work. Stop on unique commits/edits/unknown ownership, branch mismatch or tooling/access restrictions; no stash/reset/rebase/clean/force/switch workaround.
2. Fetch main. Obtain full M from the actual PR #3 COORD-006 result and independently confirm PR #3 is merged with that exact merge commit. Verify M exists, is reachable from fetched main, and contains the reviewed PR head/required baseline commits recorded in that result. The worker is checking actual objects/relationships, not trusting a branch label or this prose.
3. Require current UI HEAD to be an ancestor of M (`git merge-base --is-ancestor HEAD "$M"`); otherwise stop and preserve divergence. Inspect ignored/untracked collisions against incoming paths (including file/directory collisions), and ensure no active process can write them. A clean ordinary `git status` alone does not prove this. Do not authorize overwriting ignored work.
4. Only if all checks pass, on the **same fixed UI branch**, run `git merge --ff-only "$M"` with the exact approved full SHA. Verify after-HEAD equals M and status remains clean. No branch switch, reset, discard, rebase, history rewrite or unreviewed moving-tip substitution.
5. Publish a **UI-004 acknowledgment on PR #3** containing before/after full SHAs, ancestry/collision/status evidence, isolated path/runtime, exact ownership/allowlist acknowledgment and the bounded implementation/check plan. This mechanically verified acknowledgment activates the grant; it does not wait for a new product decision. Lead reservation is already exclusive. Do not label the task running without that actual acknowledgment.
6. Implement/review Slice A in small reversible commits, push only the UI session's fixed branch, then open its PR into main. Publish actual results, screenshots/preview where available, failures/skips and release request. No self-merge, no broader Orbit work before separate assignment/acceptance.

## 7. Whole-PR review and validation record

Review scope is the **entire PR #3 cumulative change**, not just its production refactor. The baseline reviewed at this task's start was `1b2c351ae4b4a2218bcb99e0439198dc7a92041e` (11 commits / 25 files). Supplemental changes are the error boundary/test, reviewed font assets/provenance, this scoped handoff and reconciled current onboarding notices. The final pushed head and merge outcome are recorded in the live PR result.

| Reviewed area | Findings / disposition |
| --- | --- |
| Production analyzer and analyzer regression/PCM fixtures | Channel-aware peak/clipped-frame/mean-channel energy and short-FFT padding are bounded changes with regressions; legacy LUFS, interpolated “true peak” and dangerous automatic-gain limitations remain explicit, not repaired/certified here |
| Analysis service + unit tests; processing-plan builder + unit tests; all controller substitutions | Async error/progress/input identity and trusted-plan behavior reviewed; fix the preparation/cleanup defect above; no imported-plan validator, worker or new state model implied |
| Native reference C, pinned-source runner, JS research candidate, comparator, metering recipes/tests | Fetches/hash checks/native build remain isolated test tooling; retained source notices; supported profile/rejection/boundary/chunk controls checked. Research stays outside production and does not confer normative certification |
| Metering contract and evidence | Distinguishes proposals, executed synthetic controls, provenance, dangerous existing gain and missing official vectors/independent broader conformance; no research API silently accepted |
| Architecture, product vision and roadmap | Reconciled PR #1 attribution; actual-vs-proposed boundaries, manual linked updates, relevant dependencies, destination preservation, transactions/recovery/graph safety and real proof gates retained. Commercial/POC/schema choices remain review drafts; planning cases are not executed/original-scenario coverage |
| Rules, README, guide, worker prompt, design brief, baseline decision, full queue | Ownership, links/fences/task IDs and historical-vs-current authority reviewed. Substantive stale read-only/extra-owner-approval instructions are superseded explicitly by this dated scoped grant; no invented worker receipt. PR #1 remains a separate unmerged draft |
| New assets, regression and handoff/onboarding diff | Only reviewed font members/notices copied, no new dependency; validate hashes, source boundary, grant intersection, local links and whitespace before final publication |

Executed on 2026-10-15 in lead Linux environment:

- Locked `npm ci --ignore-scripts --no-audit --no-fund`: 323 packages; no manifest/lock change. Deprecated transitive-package warnings retained; no fresh audit/security certification.
- Before the controller correction: default 145 tests / 142 passes / 3 known TODOs / 0 failures. The isolated eight-case new regression on unfixed source exited 1, 5 passes / 3 failures. Corrected current command `node --test tests/unit/*.test.js tests/audio/*.test.js`: **154 tests / 151 passes / 3 known legacy LUFS TODOs / 0 unexpected failures**.
- `node scripts/test-analyze.mjs`: all sanity checks pass.
- `MUSICONVERSE_STRICT_AUDIO_REGRESSIONS=1 node --test tests/audio/analyzerRegression.test.js`: exit 1, 47 tests / 44 passes / 3 known LUFS failures; not hidden or relabelled.
- `node scripts/validation/run-metering-reference.mjs --fetch`: pinned/hash-verified libebur128 1.2.6, 56 fixtures / 278 reference runs, 25 negative / 20 analytical controls pass. Upstream unused-variable warning; wrapper compiled with warnings-as-errors. Reference report SHA-256 `30acf2f7ea24f4dd277f470fec2be463e867d1e11bc16daf9cd0b77faf23b5ef`.
- `node scripts/validation/compare-loudness-candidate.mjs --reference /tmp/onverse-pr3-review-reference.json`: 56 fixtures / 278 runs, maximum difference **5.172680062059953e-9 LU**, zero chunk difference. Research files unchanged by this handoff.
- `npm run build` after source correction: succeeds, 17 modules, single-file inliner; >500 kB chunk warning remains. Vendored fonts are not imported by the old UI. Scratch inline asset/OFL artifact proof passes separately as described above.
- Local document links/fence pairs/unique queue IDs, font byte lengths/SHA-256/WOFF2 magic, protected manifest/lock/config/inliner diff and `git diff --check` are checked before publication. Final Git/PR HEAD/ancestry and main equality are rechecked around merge, not assumed.

**Not run / not claimed:** browser/UI/file:// font rendering, offline network observation, Electron/macOS startup or packaging/signing, actual listening, official metering conformance vectors, real Linked Sessions renderer/storage/recovery, worker checkout execution or either reference-image comparison. Owner-side tests remain deferred. These limitations prevent release/quality claims, not this bounded preservation-first UI assignment.
