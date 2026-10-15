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
| UI-001 | Codex, proposed worker | blocked | COORD-002 accepted; verified Codex execution/publication route and pinned baseline | Not dispatched; no proposal received |
| CORE-001 | Coordinator, proposed owner | planned | COORD-002 accepted; fixture/test scope approved before edits | No implementation started |
| UI-002 | Codex, proposed worker | blocked | UI-001 accepted; product-owner visual approval, accepted required core contracts, isolated workspace and exact ownership | No implementation started |

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

### CORE-001 — Propose and add bounded audio regression coverage

- **Owner / runtime:** Coordinator proposed; local Node execution available. Status `planned`; no edits authorized by the documentation approval.
- **Dependencies:** COORD-002 accepted; present exact fixtures, expected outcomes, paths, and defect-handling policy for approval before implementing tests. Do not silently add a failing release gate or bless incorrect behavior as correct.
- **Base / branch / workspace:** Final SHA to be recorded at assignment. Coordinator remains on the session-fixed engineering branch; no alternate branch/worktree will be created in this session.
- **Proposed allowed writes:** Exact test files under `tests/audio/` and synthetic fixture helpers under `tests/fixtures/`, to be named before implementation. This is not yet an active directory-wide grant.
- **Forbidden writes:** Application/UI files, `src/audio/**`, `src/application/**`, `src/domain/**`, existing shared contracts, dependencies, configuration, coordination documents. Measurement fixes require a separately reviewed task.
- **Reservation / acknowledgment:** None yet.
- **Acceptance:** Reproducible stereo/short-input defect evidence, explicit expected behavior and limitations, no audio-behavior change. Distinguish regression diagnosis from standards-grade meter validation.
- **Planned checks:** Exact new test commands established in the approved proposal; existing 45-test suite and sanity script for regression. Independent reference evidence required before claiming measurement correctness.
- **Actual checks / changed paths / commit / PR / review:** None for this task; not started.
- **Risks:** Existing analyzer defects; a same-implementation comparison cannot prove measurement accuracy. Parallelism with UI-001 is safe only with disjoint reservations.
- **Next:** Separately propose the smallest measurement fix after test/evidence review; no downstream fix is preapproved.

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
