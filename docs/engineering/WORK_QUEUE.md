# MusicOnVerse engineering work queue

## Purpose and current scope

This is a coordinator-maintained task and result record under [AGENTS.md](../../AGENTS.md) and [issue #2](https://github.com/The-Mhood/onverse/issues/2). It is not a scheduler, file lock, worker launcher, or automatic result collector. The product owner approved creation of these two coordination documents, not implementation of an orchestration platform or a UI redesign.

Snapshot date: 2026-10-15. Re-audit Git and worker acknowledgments before assignment; this file is not proof of current remote state.

## Verified baseline

| Item | Audited value |
| --- | --- |
| Environment | Arena Linux workspace at `/home/user/onverse` |
| Coordinator branch | `arena/b25c318e-onverse`; this session must remain on it |
| Engineering base at start of this unit | `b56989e83a3d630cad74c2f1617bdf56eb3f4631` |
| Remote engineering branch | Same SHA at audit |
| Local and remote `main` | `ce02cf90ecdb0f9729817e2bfe449f0e42969d31` |
| Architecture branch | Remote-only locally; `architecture/product-foundation` at `eedc24cb38c21d1a4be6186593c7ae7fcb8c6f85` |
| Architecture review | [PR #1](https://github.com/The-Mhood/onverse/pull/1), open draft targeting `main`, unmerged |
| Worktrees | One: `/home/user/onverse` on the coordinator branch |
| Working tree at start of this unit | Clean, including no untracked files |
| Repository history | Shallow clone |
| Runtime discovery | `git`, `gh`, Node, npm, Python available; no `codex`, `arena`, or `claude` executable found on PATH |
| Worker execution | No automatic launcher or agent API verified; Codex's external environment is unknown |

Issue #2 names `d2ae77c` as the engineering tip. The actual tip is newer: `b56989e` includes the analysis-service follow-up. Do not revert or replace it to match the issue's older snapshot.

### Existing engineering deliveries

| Delivery | Commit | Changed paths | Verification already recorded |
| --- | --- | --- | --- |
| Processing-plan extraction | `d2ae77c17758544fda6827c905a057993c748b31` | `src/main.js`, `src/domain/processors/buildProcessingPlan.js`, `tests/unit/buildProcessingPlan.test.js` | 24 unit tests, sanity script, syntax checks, production build; one-off 1,000-case comparison with prior implementation |
| Analysis-service boundary | `b56989e83a3d630cad74c2f1617bdf56eb3f4631` | `src/main.js`, `src/application/analysis/analysisService.js`, `tests/unit/analysisService.test.js` | 21 new tests plus 24 existing tests, sanity script, syntax checks, production build |

Both commits are published on the engineering branch. Neither is on `main`; no engineering PR was found at audit. Published, accepted, and merged are distinct states. User-side macOS verification is not recorded here.

## Task schema

Every task must record all fields below; use `unassigned`, `not published`, or `not run` explicitly instead of inventing IDs, locations, or successful results.

| Field | Required meaning |
| --- | --- |
| ID / title | Unique stable ID and one bounded outcome |
| Owner / runtime | Accountable agent; verified execution route or blocker |
| Status / attempt | State below; retain prior attempts and failure evidence |
| Dependencies | Task IDs requiring `accepted`; additional approval/environment gates |
| Base SHA / branch / workspace | Exact reviewed starting point and isolated editing location |
| Allowed / forbidden paths | Explicit paths or patterns; forbidden wins; renames include both paths |
| Reservation / acknowledgment | Exact active file ownership, granting coordinator, worker acknowledgment, and release evidence |
| Acceptance criteria | Observable completion conditions, including non-goals |
| Checks | Exact planned commands/manual checks and actual outcomes, including failures/skips |
| Delivery | Actual commits, PR URL/base, and changed-file inventory |
| Review / integration | Reviewer, evidence, acceptance decision, and integration commit/status separately |
| Blockers / risks / next | Reason work cannot proceed; eligible successors after acceptance |

### Status meanings and readiness

`planned` -> `ready` -> `assigned` -> `running` -> `submitted` -> `accepted`

- `planned`: scoped but not cleared to start.
- `ready`: every dependency accepted, approvals present, base reviewed, paths conflict-checked, execution route available.
- `assigned`: isolated workspace and reservation recorded, worker has acknowledged.
- `running`: acknowledged execution has started.
- `submitted`: actual output and result report await coordinator/product review.
- `accepted`: explicit reviewer acceptance with evidence; record merge state separately.
- `blocked`: unmet gate or unsafe condition; record the previous state and reason.
- `failed`: an actual attempt failed; preserve its artifacts and block successors.
- `cancelled`: explicitly stopped; preserve history and do not satisfy dependencies.

Do not skip dependencies because a prerequisite has a commit or passing tests. Reject duplicate IDs, unknown/self dependencies, dependency cycles, and overlapping reservations during manual review. Re-evaluate readiness after any failed attempt, contract change, new reservation, or revoked acceptance. Retries append history under the same task ID; they do not erase failures.

## Queue

| ID | Owner | Status | Dependencies / gates | Delivery |
| --- | --- | --- | --- | --- |
| COORD-001 | Coordinator | accepted | None; product owner approved the next documentation step after audit | Audit report in this conversation; no file changes |
| COORD-002 | Coordinator | accepted | COORD-001 accepted; product owner reviewed the result and authorized publication | Two coordination documents; see Git history and coordinator publication report |
| UI-001 | Codex, externally active per product owner | blocked | Coordinator proposal review awaits published audit/design and actual branch/base | External UI/UX work reported; no proposal received here |
| CORE-001 | Coordinator | accepted | COORD-002 accepted; product owner directed continued core work while Codex handles UI | Evidence accepted for progression; published in draft PR #3 |
| CORE-002 | Coordinator | accepted | CORE-001 accepted; product owner directed continuation with the bounded fix | Automated evidence accepted for progression; published in draft PR #3; macOS checks pending |
| CORE-003 | Coordinator | submitted | CORE-002 accepted for progression; product owner requested the next core step | Published for review in draft PR #3; 89 passes, 3 LUFS TODO cases; macOS checks pending |
| UI-002 | Codex, externally active per product owner | blocked | Coordinator integration review awaits UI-001 and actual diff, approvals, isolation and ownership evidence | External activity reported; implementation state unverified here |

### COORD-001 — Audit actual Git state and execution tools

- **Attempt:** 1. Read-only coordinator audit in the existing checkout; no worker assignment.
- **Base:** `b56989e83a3d630cad74c2f1617bdf56eb3f4631`, `arena/b25c318e-onverse`, `/home/user/onverse`.
- **Allowed writes / reservation:** None. No active write reservation to retain.
- **Forbidden:** All file/Git/GitHub mutations, branch movement, agent dispatch, installation, and builds during the read-only audit.
- **Acceptance:** Report local/remote branch state, PR #1, issue #2, worktrees, dirty work, runtime availability, and conflicts without changing files.
- **Actual checks:** `pwd`; `git branch --show-current`; `git status --short --branch --untracked-files=all`; `git log`; `git remote -v`; `git worktree list --porcelain`; `git branch -avv`; `git ls-remote --heads origin`; GitHub issue/PR queries and compare APIs; tracked-file and interface inspection; executable discovery. Completed successfully.
- **Regression checks:** Both existing unit suites passed (45 tests); `node scripts/test-analyze.mjs` passed. No build or macOS check in that audit.
- **Changed files / commit / PR:** None.
- **Review:** Product owner replied `approved` to the audit's proposed two-file documentation step. This is not approval of PR #1 or the full architecture.
- **Integration:** Not applicable; no code changes.
- **Limitations:** Cannot inspect unpublished Codex work or the user's Mac. Next: COORD-002.

### COORD-002 — Record shared rules and task schema

- **Attempt / owner:** 1; coordinator in the current session, not a launched worker.
- **Dependencies:** COORD-001 accepted. Product owner explicitly approved this documentation-only unit.
- **Base / branch / workspace:** `b56989e83a3d630cad74c2f1617bdf56eb3f4631`; `arena/b25c318e-onverse`; `/home/user/onverse`.
- **Allowed writes:** `AGENTS.md`, `docs/engineering/WORK_QUEUE.md` only.
- **Forbidden writes:** Every other path, including application/audio/UI code, tests, dependencies, lockfile, Electron/configuration, and PR #1 files.
- **Reservation:** Coordinator exclusively holds the two allowed paths through publication, acknowledged in the pre-edit message. No worker reservation is granted. After verified commit/push and a clean working tree, release this task reservation; no downstream ownership is granted automatically. This is not a machine-enforced lock.
- **Acceptance criteria:** Record roles, task schema, dependency gates, path conflict review, results, safe recovery, interface constraints, unmerged architecture references, and honest runtime limits. No custom platform, automatic dispatch, styling, or application change.
- **Pre-edit checks:** Branch/status/log/worktrees and remote refs rechecked; working tree clean; issue #2 still open; PR #1 still open/draft at its audited SHA. Neither document existed, so no file was overwritten.
- **Verification:** See the validation record below for commands and actual outcomes.
- **Changed paths:** `AGENTS.md`, `docs/engineering/WORK_QUEUE.md`.
- **Commit / PR:** This delivery is identified by the commit introducing these two documents on `arena/b25c318e-onverse` (inspect `git log --oneline -- AGENTS.md docs/engineering/WORK_QUEUE.md`). The coordinator reports the actual commit SHA and push outcome after execution. No PR creation or merge is authorized in this publication step.
- **Reviewer / integration:** Product owner replied `proceed` at the documentation review checkpoint, accepting this unit for commit/push. No merge into `main` or acceptance of worker implementation is implied.
- **Risk:** Rules are documentary/manual until all agents receive and acknowledge them. No Codex runtime or branch is verified.
- **Next after acceptance:** UI-001 remains blocked until its runtime/publication route is available; CORE-001 needs its test-only plan approved. Read-only UI audit and disjoint core work can proceed in parallel only after their own gates clear.

### UI-001 — Codex UI audit and design proposal, no application edits

- **Owner / runtime:** Codex assigned by product owner; actual worker identity, runtime, and launch route unverified here. Status is `blocked`, not dispatched.
- **Dependencies:** COORD-002 accepted; Codex must acknowledge rules and access a reviewed snapshot containing both engineering refactors. No dependency on merging PR #1.
- **Proposed baseline:** `b56989e83a3d630cad74c2f1617bdf56eb3f4631` plus accepted coordination documents. The exact final SHA must be recorded before assignment; do not assume the current HEAD will remain unchanged.
- **Branch / workspace / reservation:** Unassigned. No active file reservation or acknowledgment.
- **Proposed deliverable paths:** `docs/design/UI_AUDIT.md`, `docs/design/UI_PROPOSAL.md` on an isolated worker branch. A purely read-only audit may initially report in GitHub instead, with no file writes.
- **Forbidden writes:** All application files, DSP/services/domain, dependencies, configuration, root collaboration rules, and this queue. No UI implementation in this task.
- **Acceptance:** Inspect the real existing UI; propose workflow, accessibility/responsiveness, affected paths, and interface needs; distinguish current features from future features. Identify where product-owner gradient direction is required. Lead architectural review precedes implementation.
- **Planned checks:** Snapshot/status inventory and exact affected-file proposal. Do not run a mutating build in a read-only checkout. Any additional checks must be reported truthfully.
- **Actual checks / output / commit / PR / review:** None; not run, not received, not published, not reviewed.
- **Blockers / risks:** No verified worker execution/publication route; no Codex branch visible. Unknown unpublished work may exist externally. Do not assume it is safe to replace.
- **Next:** UI-002 only after proposal acceptance and its additional gates.

### CORE-001 — Add bounded audio regression coverage

- **Owner / runtime / attempt:** Coordinator; local Node; attempt 1, `accepted` when the product owner directed continuation with the proposed narrow fix. Product owner instructed the lead to continue core work while Codex works on UI/UX. The coordinator announced the exact test-only scope and expected-failure policy before editing; measurement fixes remain separate.
- **Dependencies:** COORD-002 accepted and published as `a8bc85580eec487ce5a42d0fa676466ba679342d`; remote HEAD and clean working tree verified at start.
- **Base / branch / workspace:** `a8bc85580eec487ce5a42d0fa676466ba679342d`; `arena/b25c318e-onverse`; `/home/user/onverse`. Coordinator remains on the session-fixed branch.
- **Allowed implementation writes:** `tests/audio/analyzerRegression.test.js`, `tests/fixtures/audioBuffers.js` only. Coordinator administration additionally updates this queue; that does not authorize application edits.
- **Forbidden writes:** All other paths, notably `src/main.js`, styles, visualization, `src/audio/**`, application/domain contracts, dependencies, build/Electron configuration, and Codex's design work.
- **Reservation / acknowledgment:** Coordinator holds the two exact test paths and queue record for this attempt, acknowledged in the pre-edit message. No UI path reserved or touched. No visible overlapping remote branch/PR at start; unpublished external work cannot be inspected.
- **Acceptance:** Deterministic synthetic PCM exercises the real analyzer/service. Check normal controls and polarity/short-input correctness properties. Known defects run as explicitly labelled TODO assertions by default, with an opt-in strict run exposing actual nonzero failures. Do not report TODO cases as passes or claim standards-grade measurements. No production audio behavior, parameter contract, or UI change.
- **Planned checks:** New test suite and existing unit suites; strict known-defect reproduction using `MUSICONVERSE_STRICT_AUDIO_REGRESSIONS=1`; sanity script; syntax, diff scope/whitespace, and build checks. Commands/results will be appended after execution.
- **Actual results / delivery / review:** See the historical CORE-001 result record below. Product owner subsequently replied `continue` to the short-input fix proposal, accepting the test evidence as its prerequisite. Tests are now published in commit `b64f051cc9f5fdac177ac47fa70c1812730d2771` and draft PR #3. Acceptance for progression does not imply merge.
- **Risks:** Existing mono-fold-down and short FFT defects. TODO cases keep the ordinary gate usable but leave unresolved defects; successful strict assertions must become normal tests with their separately approved fixes. These fixtures prove signal properties, not standards compliance, decoder support, or listening quality.
- **Next:** CORE-002 proposes the bounded short-FFT fix after acceptance of this evidence. No measurement change has been implemented or preapproved; UI integration remains independently review-gated.

### CORE-002 — Correct short-input FFT handling

- **Owner / runtime / attempt:** Coordinator; local Node; attempt 1, `accepted` for next-step progression by the product owner; macOS verification deferred. Product owner replied `continue` to the proposed bounded fix; exact files were announced before edits.
- **Dependencies:** CORE-001 evidence accepted with that continuation instruction; no dependency on UI styling work. COORD-002 already accepted/published.
- **Base / branch / workspace:** HEAD `a8bc85580eec487ce5a42d0fa676466ba679342d` on `arena/b25c318e-onverse`, `/home/user/onverse`, plus preserved uncommitted CORE-001 fixtures/tests and queue updates. No reset, stash, branch movement, or overwritten external work.
- **Allowed writes / reservation:** `src/audio/analyzer.js` (only incomplete FFT window handling), `tests/audio/analyzerRegression.test.js` (promote short-input TODO cases, add padding and complete-window checks), and coordinator administration in this queue. Coordinator acknowledged exact ownership in the pre-edit message. Existing fixture helper is preserved unchanged during CORE-002. No UI path reserved.
- **Forbidden writes:** UI/controller/visualization files, other DSP mechanisms, analysis-service and processing-plan contracts, dependencies/configuration, and Codex work. Stereo/loudness corrections remain separate because their downstream effects are broader.
- **Acceptance:** Zero-pad missing samples for nonempty inputs shorter than the 4096-frame FFT window; finite spectral outputs for tested lengths 1, 100, and 4095; preserve results for complete windows. Never read beyond valid PCM. This does not make very short clips high-confidence references or certify loudness/true-peak accuracy.
- **POC decision:** No separate POC needed for bounded array access and zero-padding; real analyzer regression tests validate this mechanism. No native, provider, or device integration is involved.
- **Pre-change evidence:** Captured 48 complete-window full/fast results at 44.1/48 kHz, lengths 4096/4097/8192/24000, mono/in-phase/opposite-polarity stereo. Temporary V8 serialization retains typed arrays and non-finite values for exact post-change comparison; no binary fixture is added to Git. Permanent tests also record bounded spectral fingerprints as regression baselines, not calibrated measurements.
- **Planned checks:** Promote six existing short-input assertions; compare short spectra with explicitly zero-padded inputs; verify source PCM/metadata; complete-window baseline parity; existing unit/control suites and sanity script; strict diagnostic run retaining unresolved stereo failures; production build and scope checks.
- **Actual checks / delivery / review:** See the historical CORE-002 result record below. Product owner requested the next step and deferred macOS testing; automated evidence accepted for progression, not a claim of user-side verification or merge. Prior fixtures/tests and the short-input fix are now published in commit `b64f051cc9f5fdac177ac47fa70c1812730d2771` and draft PR #3; nothing is merged.
- **Risks / next:** Very short audio has limited spectral information even after numeric safety is fixed. No result-shape change. Reassess actual Codex changes before integration; stereo/loudness work requires a separate proposal/review.

### CORE-003 — Channel-aware sample peak and clipping

- **Owner / runtime / attempt:** Coordinator; local Node; attempt 1, `submitted` after local verification. Product owner requested the next step and will perform macOS testing later. This does not preapprove broader loudness/true-peak corrections or UI integration.
- **Dependencies:** CORE-002 automated evidence accepted for progression; CORE-001/COORD-002 already accepted. No dependency on Codex styling.
- **Base / workspace:** HEAD `a8bc85580eec487ce5a42d0fa676466ba679342d`, `arena/b25c318e-onverse`, `/home/user/onverse`, with the preserved uncommitted CORE-001/002 delivery. Existing edits accounted for; no branch movement or discard.
- **Allowed writes / reservation:** `src/audio/analyzer.js` (time-domain sample peak/clipping and directly dependent RMS/crest calculation), `tests/audio/analyzerRegression.test.js`, and coordinator queue administration. Coordinator acknowledged these exact paths before editing. Preserve the fixture helper and prior short-FFT fix.
- **Forbidden writes:** UI/controller/visualization, LUFS/quick-LUFS filtering or trim, true-peak estimator, spectral/pitch/tempo/DC/block-dynamics algorithms, processing plans, application/domain interfaces, dependencies, build/Electron configuration, Codex work.
- **Measurement policy:** Sample peak is the maximum absolute sample across all channels. Clipping retains the existing `>= 0.9992` threshold and counts frames where any channel meets it, once per frame, rather than counting duplicated stereo samples twice. RMS is the square root of mean channel/sample energy; crest uses that RMS and the corrected sample peak. The RMS adjustment is necessary to avoid a falsely huge crest when peak is fixed but a cancelling mono RMS is retained. This is a basic PCM policy, not a BS.1770 loudness or true-peak claim.
- **Acceptance:** Correct strongest-channel/anti-polarity/negative sample peaks; per-frame clipping counts, including overlapping clips and threshold controls; RMS/crest remain polarity-invariant and match hand-computable energies. Source PCM and result shapes preserved. Mono/identical-stereo compatibility checked. LUFS, true peak, and other out-of-scope outputs remain unchanged, including known defects.
- **POC decision:** No separate POC needed for bounded PCM peak/count/energy calculations; analytical fixtures and real-analyzer regressions validate the mechanism. Meter-standard validation and live/offline integration remain outside this task.
- **Planned checks:** Red-before-green regressions; promote two peak and one clipping TODO cases; real analyzer/unit/sanity suites; strict diagnostics expected to retain three LUFS failures; pre-change compatibility capture; production build, syntax, file ownership and queue checks.
- **Actual results / commit / PR / review:** See CORE-003 result and publication records below. Published as `b64f051cc9f5fdac177ac47fa70c1812730d2771`, submitted in draft PR #3; no merge or final acceptance of this fix. User-side testing remains deferred.
- **Risks / next:** Changes to RMS/crest can legitimately change derived scores/compression recommendations for asymmetric or cancelling channels. Existing mono-based true-peak, spectrum, block dynamics, and LUFS may still disagree with corrected sample metrics; disclose rather than silently expanding scope. No standards-grade claim; macOS/listening checks deferred by product owner.

### UI-002 — Implement an approved UI slice

- **Owner / runtime:** Codex proposed; no launch or assignment verified. Status `blocked`.
- **Dependencies:** UI-001 accepted; product-owner colour-gradient direction; lead-approved architecture/interface plan; acceptance of every required shared-contract task.
- **Base / branch / workspace:** Unassigned; must use an approved base and isolated worker workspace.
- **Allowed writes:** None yet. Name exact presentation files after design review; no blanket frontend grant.
- **Forbidden writes:** DSP, processing plans, analysis services, core contracts/tests, dependencies/configuration, and coordination records. `src/main.js`, `src/ui/draw.js`, and `src/scene.js` remain forbidden unless explicitly assigned for the slice.
- **Reservation / acknowledgment:** None. Any `src/main.js` work requires exclusive ownership; the lead must not edit it concurrently.
- **Acceptance:** Actual diff matches approved design/scope, shared state/contracts preserved, required workflows function, gradient direction approved, no fabricated functionality.
- **Planned checks:** Core tests/build plus browser checks for import/reference/analysis/processing/adjustments/A-B/crop-seek/export relevant to the diff. Define devices and exact manual steps before implementation.
- **Actual checks / changed paths / commit / PR / review:** None; no implementation started.
- **Risks / next:** UI/core coupling in `src/main.js`; avoid parallel edits. Integration only after actual diff and workflow review; no automatic merge.

## External Codex activity update

The product owner reports Codex is working on UI/UX and asks the lead to continue disjoint core work, reviewing Codex later. That report is recorded without inventing an agent dispatch, branch, acknowledgment, or accepted proposal. At the CORE-001 start check, remote refs still showed only `main`, the engineering branch, and the architecture branch; only PR #1 was open. The UI tasks' `blocked` states describe coordinator review/integration gates, not a claim that the external Codex process has stopped. Earlier `not started`/runtime observations in their task details are historical; current external phase and changed files remain unverified. The coordinator will retrieve and inspect published work when available, not duplicate the UI or assume its shared-contract changes are accepted.

No current core task writes `src/main.js`, `src/style.css`, `src/ui/draw.js`, or `src/scene.js`. Shared-interface changes and UI integration still require actual-diff review before proceeding.

## Results and failure reporting

For each attempt, append a report with:

```text
Task / attempt / owner / runtime:
Base SHA / branch / workspace:
Allowed paths / reservation acknowledgment:
Changed paths, including untracked work:
Commits / PR URL and base:
Commands actually run / exit outcomes:
Manual checks and environment:
Failures / skipped or unavailable checks:
Blockers / risks / outstanding processes:
Reviewer decision / integration status:
Next eligible tasks and why:
```

On failure, interruption, conflict, or abandonment, preserve the workspace and record status/commit/untracked material before reassignment. Do not release ownership or delete a worktree without reviewing preserved work. Keep dependent tasks blocked until the coordinator accepts a recovery outcome. See [AGENTS.md](../../AGENTS.md#failure-and-recovery).

## Manual use on macOS

Start with read-only checks from the user's existing clone; the path below is the previously reported location, not proof of its current state:

```bash
cd /Users/mhoodpc/onverse
pwd
git branch --show-current
git status --short --branch --untracked-files=all
git log -5 --oneline --decorate
git remote -v
git worktree list
git ls-remote --heads origin
command -v codex
```

If dirty work, another active branch, or an occupied worker workspace is found, report it and stop before moving anything. A failed `command -v codex` means it was not found on that shell's PATH, not that no external Codex service exists. Do not install or authenticate a worker as a side effect of the audit.

Only after these documents are explicitly committed/pushed and local work is accounted for should another checkout retrieve them. A worker's branch/worktree creation needs an approved base, unoccupied location, and compatible session permissions; no creation/switching commands are authorized by this document alone.

GitHub issue inspection is available with `gh issue view 2 --repo The-Mhood/onverse`. Published worker results and PRs can be retrieved by the coordinator directly. No agent is launched by that command.

Sequential example: COORD-002 accepted -> UI-001 assigned and submitted -> lead accepts design -> product owner approves visual direction -> UI-002 assigned. Parallel example: after COORD-002 acceptance and their separate approvals, CORE-001 may edit only approved test/fixture paths while UI-001 audits/submits only design documents. Neither edits `src/main.js`.

There is no `orchestrator run` or automated dry-run command. Previewing proposed assignments and reading Git state does not dispatch agents; assignment, ownership enforcement, review, and result aggregation are manual coordinator duties. Automated dependency/conflict/failure/aggregation tests and runtime adapters are explicitly deferred with the custom platform, not claimed complete.

## COORD-002 validation record

Actual checks run for this unit:

| Command / check | Result |
| --- | --- |
| `pwd`, `git branch --show-current`, `git status --short --branch --untracked-files=all`, `git log -3 --oneline`, `git worktree list`, `git ls-remote --heads origin` | Confirmed the clean starting checkout and baseline above; no branch movement |
| `gh issue view 2 --json number,state,url`; `gh pr view 1 --json number,state,isDraft,headRefName,headRefOid,url` | Issue open; PR #1 open/draft at the pinned SHA |
| One-off read-only Python integrity check | Passed: exactly the two allowed changed paths, local Markdown link targets exist, fenced blocks balanced, final newlines present; five unique task records match their detail sections; task dependencies are known and acyclic |
| `gh api` recursive tree query at the pinned architecture SHA | Confirmed all four linked proposal documents exist |
| `git diff --no-index --check -- /dev/null <file>` for each new document | No whitespace diagnostics. The first shell chain stopped at Git's expected exit 1 for a new-file difference; both files were then checked separately with a wrapper requiring an expected exit code and empty diagnostics. Both passed |
| `node --test --test-reporter=dot tests/unit/analysisService.test.js tests/unit/buildProcessingPlan.test.js` | All 45 tests passed |
| `node scripts/test-analyze.mjs` | Passed |

The integrity checker was a one-off audit command, not a new script, scheduler, or automated orchestration test suite. No build, dependency installation, application changes, agent dispatch, branch movement, or GitHub mutation was performed. Browser/macOS/packaging checks were not run. No commit or push was performed during that initial validation. The product owner subsequently authorized the separate publication step described above; its actual outcome is reported after execution.

## CORE-001 result record

- **Task / attempt / owner:** CORE-001 / 1 / coordinator; local Node execution, not a launched worker.
- **Base:** `a8bc85580eec487ce5a42d0fa676466ba679342d` on `arena/b25c318e-onverse`, `/home/user/onverse`.
- **Changed files:** `tests/fixtures/audioBuffers.js`, `tests/audio/analyzerRegression.test.js`, and this coordinator-owned queue only. No tracked application, style, dependency, or configuration change.
- **Fixture design:** Deterministic 1 kHz PCM at 48 kHz, 0.5 seconds by default, explicit per-channel polarity and amplitude, fresh independent arrays. No user audio, randomness, browser mock engine, network, or new dependency. Sample-peak expectations use the known 0.5 amplitude; loudness assertions use channel-polarity invariance rather than an assumed absolute LUFS calibration.
- **Default combined run:** `node --test --test-reporter=tap tests/audio/analyzerRegression.test.js tests/unit/analysisService.test.js tests/unit/buildProcessingPlan.test.js` exited 0: **73 tests, 61 passes, 12 TODO cases, 0 unexpected failures**. All 12 TODO assertions executed and failed as expected; they are not counted as passing or resolved.
- **Strict reproduction:** `MUSICONVERSE_STRICT_AUDIO_REGRESSIONS=1 node --test --test-reporter=tap tests/audio/analyzerRegression.test.js` exited **1**: **28 tests, 16 passes, 12 failures, 0 TODO**. This failure is the intended diagnostic outcome, not a new production fix or a successful strict gate. Two full/fast peak, two full/fast loudness, six short-input spectral, one full-analysis clipping, and one quick-LUFS assertion fail.
- **Other checks:** `node scripts/test-analyze.mjs` passed; both new files passed `node --check`; `git diff --check` and protected-source diff checks passed. `npm run build` passed with the existing large-bundle warning. The build writes ignored assets; no assertion of browser appearance or generated-CSS equivalence is made. Tailwind's automatic source detection can include utility candidates in added documentation/tests; build/source scoping belongs in a separately reviewed UI/build task, not an incidental stylesheet edit here.
- **Observed signal evidence:** In-phase 0.5-amplitude stereo reports sample peak `-6.020599913279624 dB`, loudness `-9.611351271611932`; opposite-polarity channels report peak `-240 dB` and loudness `-120.691` despite unchanged per-channel amplitudes. A 1.1-amplitude signal reports 7,000 clipped frames in phase and zero after right-channel inversion. Both measured and quick loudness paths share the cancellation. All seven bands are non-finite for lengths 1, 100, and 4095; lengths 4096 and 4097 are finite.
- **Root causes inspected:** `analyze()`, `analyzeFast()`, and `quickLufs()` measure a channel average that can cancel; `timeDomain()` scans that average for peak/clipping. `spectral()` forces a 4096-sample frame for short input and reads undefined values beyond the source. No mechanism changed in this unit.
- **Skipped checks:** Browser playback/listening, import/decoding, macOS devices/packaging, and standards-grade external meter comparison were not run. No Codex implementation or proposal reviewed; external unpublished files remain unknown.
- **Review / delivery:** Submitted locally for review, not accepted or published. No GitHub mutation, branch movement, worktree deletion, or agent dispatch.
- **Next:** CORE-002 is proposed, not ready, until CORE-001 is accepted and the narrow production fix is approved. UI review/integration remains pending an actual published proposal/diff. No conflict with visible Codex paths was found; the core task deliberately avoids all UI/shared-controller files.

### Run the audio diagnostics on macOS after publication/retrieval

From the repository root containing these test files:

```bash
node --test tests/audio/analyzerRegression.test.js tests/unit/analysisService.test.js tests/unit/buildProcessingPlan.test.js
node scripts/test-analyze.mjs
npm run build
```

To reproduce the unresolved defects as ordinary failures (expected exit 1 until the respective fixes land):

```bash
MUSICONVERSE_STRICT_AUDIO_REGRESSIONS=1 node --test tests/audio/analyzerRegression.test.js
```

Default mode does not catch or suppress assertions; Node reports the known failures explicitly as TODO. Strict mode removes their TODO designation. When fixing a defect, remove that case's TODO permanently so it becomes an ordinary gate in both modes. Do not leave fixed behavior labelled unresolved.

## CORE-002 result record

- **Task / attempt / owner:** CORE-002 / 1 / coordinator. Product-owner continuation accepted CORE-001 evidence and authorized the separately announced short-input change, not broader stereo/loudness changes.
- **Base / preserved work:** HEAD `a8bc85580eec487ce5a42d0fa676466ba679342d`, plus existing uncommitted CORE-001 fixtures/tests and queue updates. No user/worker work was discarded, stashed, reset, or moved.
- **This unit's writes:** `src/audio/analyzer.js`, `tests/audio/analyzerRegression.test.js`, and this queue only. `tests/fixtures/audioBuffers.js` is preserved unchanged from CORE-001. The cumulative uncommitted delivery therefore contains four paths, including the fixture helper.
- **Root cause / fix:** The spectral analyzer allocated a full window for short inputs but multiplied missing samples by the Hann window, introducing `NaN`. The loop now checks `off + i < n` before reading PCM and writes zero for the remaining FFT input positions. Complete-window arithmetic, frame counts, progress, and result shapes are unchanged.
- **Red-before-green:** Before the production edit, six promoted short-input assertions failed normally, with exit 1; six unrelated stereo cases remained TODO. This verifies that the new regressions detect the actual defect rather than only testing the corrected implementation.
- **Default combined suite:** `node --test --test-reporter=tap tests/audio/analyzerRegression.test.js tests/unit/analysisService.test.js tests/unit/buildProcessingPlan.test.js` exited 0: **79 tests, 73 passes, 6 unresolved TODO cases, 0 unexpected failures**. All six short-input cases are ordinary passing tests, not TODO.
- **Short-input mechanism:** Full and fast analysis handle 1/100/4095-frame impulse inputs with finite bands/centroid/flatness; the full spectrum is finite where exposed. Spectral results exactly match explicitly zero-padded 4096-frame inputs. Source samples, source frame count, channel count, sample rate, and reported duration are preserved. The final nonzero sample guards against accidental signal truncation.
- **Complete-window compatibility:** A one-off Node/V8 serialized baseline captured before editing contains 48 full/fast results across 44.1/48 kHz, lengths 4096/4097/8192/24000, and mono/in-phase/opposite-polarity stereo. Post-edit `assert.deepEqual` passed for every complete result, including typed arrays and existing non-finite values. No serialized/binary baseline is added to Git. Six permanent spectral-fingerprint checks at 4096/4097/8192 frames also pass with bounded numeric tolerances; they preserve legacy behavior, not measurement calibration.
- **Strict diagnostic suite:** `MUSICONVERSE_STRICT_AUDIO_REGRESSIONS=1 node --test --test-reporter=tap tests/audio/analyzerRegression.test.js` exited **1**: **34 tests, 28 passes, 6 failures, 0 TODO**. Only the previously recorded channel-fold-down peak/loudness/clipping/quick-LUFS cases remain failing. Their failures were not swallowed or labelled resolved.
- **Other checks:** `node scripts/test-analyze.mjs` passed; syntax checks for analyzer/test files passed; `git diff --check` passed; `npm run build` passed with the existing large-bundle warning. Final scope/queue integrity checks passed: only the four cumulative allowed paths differ, six task records are unique and dependencies acyclic, and changed-line whitespace checks are clean. An initial whole-file formatting checker flagged the analyzer's pre-existing missing final newline and unrelated trailing whitespace; it was corrected to check changed lines for tracked files rather than expanding this fix into unrelated formatting.
- **Skipped / limitations:** No browser listening, decoding/import integration, macOS packaging/device tests, or standards-grade independent meter comparison. Zero-padding improves numeric safety, not information content or confidence for extremely short audio. Input validation, loudness windows, true peak, stereo fold-down, and recommendation policy were not changed.
- **UI/core boundary:** No edits to `src/main.js`, CSS, visualization, application/domain interfaces, dependency manifests, configuration, or Codex files. At the start of this unit no new remote worker branch/PR was visible. External unpublished work is still unverified; review Codex's actual diff before integration.
- **Commit / PR / acceptance / integration:** None yet; changes are saved in Arena only. Review/publication is separate from acceptance or merge. CORE-001's initial results above are historical; current test counts and strict failure expectations are those in this record.
- **Next proposed work:** Separately scope channel-aware sample peak/clipping before the larger loudness correction. Do not modify automatic loudness trim or standards claims without a reviewed measurement contract and independent validation plan. No downstream production change is preapproved.

### Current macOS verification after this delivery is published/retrieved

```bash
node --test tests/audio/analyzerRegression.test.js tests/unit/analysisService.test.js tests/unit/buildProcessingPlan.test.js
node scripts/test-analyze.mjs
npm run build
```

Expected default result: 73 passes and six explicitly unresolved stereo TODO cases. Strict diagnostics still deliberately exit 1 with six stereo failures:

```bash
MUSICONVERSE_STRICT_AUDIO_REGRESSIONS=1 node --test tests/audio/analyzerRegression.test.js
```

These commands require the updated files; they are not available in another checkout until publication/retrieval. There is no claim that the strict suite is fully passing or that audio measurement correctness is complete.

## CORE-003 result record

- **Task / attempt / owner:** CORE-003 / 1 / coordinator. Product owner requested the next step and deferred user-side testing. CORE-002 automated evidence was accepted for progression, not claimed verified on macOS.
- **Base / preserved work:** `a8bc85580eec487ce5a42d0fa676466ba679342d`, `arena/b25c318e-onverse`, `/home/user/onverse`, with all existing CORE-001/002 work preserved. At start, the working-tree inventory contained only the three prior modified/new implementation files plus this queue. No reset, stash, forced update, branch switch, or worker-file overwrite.
- **Files changed this unit:** `src/audio/analyzer.js`, `tests/audio/analyzerRegression.test.js`, this queue. Fixture helper unchanged. Cumulative unpublished files remain these three plus `tests/fixtures/audioBuffers.js`.
- **Root cause / correction:** Time-domain peak/clipping and RMS previously used a mono channel average. Opposite-polarity channels cancelled before measurement. Sample peak now scans every channel; clipping keeps the `0.9992` threshold and counts each affected frame once; RMS uses mean channel/sample energy so crest's denominator does not cancel. Result field names and method signatures remain unchanged; numeric peak/RMS/crest/clipping values intentionally change for asymmetric/cancelling channels.
- **Policy and scope:** Mean channel energy is an explicitly documented PCM RMS policy, not K-weighted loudness. Duplicate mono/in-phase stereo is not double-counted for clipping or RMS. The mono signal is still used by the out-of-scope DC, block-dynamics, spectral, pitch/tempo, LUFS, and legacy true-peak paths. No blanket multichannel or standards-compliance claim is made.
- **Red-before-green:** Promoted two sample-peak and one clipping TODO cases, added 13 ordinary checks including channel ordering, channel count beyond stereo, analytical RMS/crest, duplicate-mono preservation, overlapping clipping, threshold controls, and negative clips. Before editing production code, the audio suite exited 1 with **47 tests, 30 passes, 14 ordinary failures, 3 LUFS TODO cases**. Those ordinary failures are now resolved.
- **Default suite:** `node --test --test-reporter=tap tests/audio/analyzerRegression.test.js tests/unit/analysisService.test.js tests/unit/buildProcessingPlan.test.js` exited 0: **92 tests, 89 passes, 3 unresolved LUFS TODO cases, 0 unexpected failures**. Sample-peak/clipping cases are ordinary tests, not TODO.
- **Strict diagnostics:** `MUSICONVERSE_STRICT_AUDIO_REGRESSIONS=1 node --test --test-reporter=tap tests/audio/analyzerRegression.test.js` exited **1**: **47 tests, 44 passes, 3 failures, 0 TODO**. The failures are full/fast analysis LUFS polarity invariance and quick-LUFS polarity invariance. Do not describe this as a fully passing audio-correctness suite.
- **Compatibility capture:** Before editing, captured 64 complete full/fast results across 44.1/48 kHz, four lengths, and mono/identical/opposite-polarity/unequal stereo. After the change, exact comparison passed for every field other than intended peak/RMS/crest/clip changes in all 64 cases. All fields are exactly unchanged in 32 mono/identical-stereo cases. The temporary serialized baseline is diagnostic output, not a binary asset added to Git.
- **Observed evidence:** The 0.5-amplitude stereo tone reports peak `-6.020599913279624 dB`, RMS `-9.030899952596856 dB`, crest `3.010300039317232 dB` for both channel polarities. The 1.1-amplitude tone reports 7,000 affected clipping frames for both polarities. A separate union-of-clips fixture counts three affected frames rather than double-counting four channel events.
- **Other checks:** Existing sanity script passed; analyzer/test syntax checks and `git diff --check` passed; `npm run build` passed with the existing large-bundle warning. Final changed-file/queue checks are recorded in the coordinator report.
- **Residual defects and risks:** Corrected RMS/crest can change heuristic scores/compression recommendations for asymmetric/cancelling channels. LUFS and automatic trim still suffer mono-fold-down errors; legacy true-peak interpolation is not a valid standards-grade estimator and can report below sample peak (opposite-polarity fixture still reports `-240 dB` true peak). Spectral/block-dynamics paths can also cancel. These limitations are disclosed, not fixed or hidden by this unit; do not rely on these remaining measurements for professional mastering guarantees.
- **Not run:** Browser listening, macOS recording/packaging, clean install, external calibrated-meter comparison, Codex design/diff review. User explicitly deferred their testing.
- **UI/core isolation:** No `src/main.js`, CSS, drawing/scene, application/domain interface, manifest/lockfile, configuration, or Codex-file edits. No Codex worker branch/PR was visible at the start check; unpublished external work remains unknown. Review actual published UI diff before integration.
- **Delivery / review:** Saved in Arena only; no commit, push, PR, acceptance, or merge performed for this attempt. Previous result counts are historical; current verification is the 92-test result here.
- **Next recommendation:** Review/publish this bounded core batch, then propose an independently validated loudness/true-peak measurement contract before changing gain normalization. A standards-sensitive LUFS change can alter reference targets and render gain; it is not authorized as an incidental follow-up to sample peak.

### Latest macOS test commands after publication/retrieval

```bash
node --test tests/audio/analyzerRegression.test.js tests/unit/analysisService.test.js tests/unit/buildProcessingPlan.test.js
node scripts/test-analyze.mjs
npm run build
```

Current expected default summary: 89 passes, 3 explicit LUFS TODO cases, no unexpected failures. Strict diagnostic mode intentionally still exits 1 with the three LUFS failures:

```bash
MUSICONVERSE_STRICT_AUDIO_REGRESSIONS=1 node --test tests/audio/analyzerRegression.test.js
```

No local user testing is required before the owner is ready, but unperformed checks remain unverified. The published branch must be retrieved before these new cases can run on another machine; see the publication record below.

## Publication and review record

This is the latest delivery state. Earlier result records describe the state at their original local submission and their historical test counts; they do not override this publication record.

- **Authorization:** Product owner replied `proceed` to publishing the bounded core batch for review. This did not authorize a merge, new UI work, or LUFS/true-peak implementation.
- **Core batch commit:** [`b64f051cc9f5fdac177ac47fa70c1812730d2771`](https://github.com/The-Mhood/onverse/commit/b64f051cc9f5fdac177ac47fa70c1812730d2771), `fix: handle short FFT windows and channel-aware sample measurements`.
- **Publication:** `git push origin arena/b25c318e-onverse` succeeded. This commit contains the analyzer correction, synthetic fixtures, regression suite, and task/result updates. The working tree was clean after that commit/push.
- **Review artifact:** [Draft PR #3 — Core foundation and bounded audio regression fixes](https://github.com/The-Mhood/onverse/pull/3), head `arena/b25c318e-onverse`, base `main`, open/draft verified after creation. It also includes the previously published processing-plan extraction, analysis-service boundary, and collaboration documents because those commits are not yet on `main`.
- **Exact files in the core batch commit:** `src/audio/analyzer.js`, `tests/audio/analyzerRegression.test.js`, `tests/fixtures/audioBuffers.js`, `docs/engineering/WORK_QUEUE.md`. The earlier `src/main.js` changes visible in the overall PR are the approved delegation refactors, not a UI redesign in this batch.
- **Rechecks before publication:** Combined suite again reported 92 tests / 89 passes / 3 known LUFS TODO cases / 0 unexpected failures; strict diagnostics exited 1 with 44 passes and the same three LUFS failures. Sanity script, three source/test syntax checks, protected-file diff checks, staged whitespace checks, and production build passed. Existing large-bundle warning remains.
- **No acceptance inflation:** CORE-003 remains `submitted` for review. Publication does not resolve TODO cases, establish standards compliance, record unperformed macOS/listening tests, or merge anything into `main`.
- **Architecture and UI:** PR #1 remains open/draft at `eedc24cb38c21d1a4be6186593c7ae7fcb8c6f85`, untouched. No published Codex branch/PR was visible at the pre-publication audit; external UI work remains unreviewed. No worker was launched or claimed to acknowledge ownership.
- **Reservations:** Core implementation edits for this batch have ended; after the verified clean commit/push, release those editing reservations. Updating this publication record is coordinator-only administration, not a new core/UI assignment.
- **This record:** A follow-up documentation-only commit records the actual core commit and PR URL. The PR head can advance for that record without changing the code under test. Its actual commit/push outcome is verified and reported by the coordinator after execution.
- **Next eligible activity:** Owner/reviewer can inspect draft PR #3 and perform the deferred Mac workflow checks when ready. A loudness/true-peak validation contract may be proposed separately; no production meter change is authorized by this publication. Codex integration remains gated on its actual proposal/diff and shared-file review.

### Retrieve on macOS without overwriting local work

First inspect the existing clone:

```bash
cd /Users/mhoodpc/onverse
git branch --show-current
git status --short --branch --untracked-files=all
```

If on `arena/b25c318e-onverse` with a clean working tree and no worker using that checkout, update with:

```bash
git pull --ff-only origin arena/b25c318e-onverse
```

Otherwise stop before pulling or switching and account for local/Codex work. Do not reset, stash, or move it automatically. Then use the latest macOS test commands above. Installing dependencies is not necessary if the locked environment is already present; report install/build failures rather than changing dependencies ad hoc.
