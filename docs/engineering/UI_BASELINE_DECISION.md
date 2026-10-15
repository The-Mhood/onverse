# UI baseline decision — agent-b / COORD-005

> **Historical checkpoint, superseded in part on 2026-10-15:** the owner subsequently authorized whole-PR #3 review/fixes and merge if it passes, and settled the UI choices. [COORD-006 / UI-004 handoff](UI_IMPLEMENTATION_HANDOFF.md) governs actual M publication, the exclusive dated reservation, safe same-branch fast-forward and conditional Slice A start. Keep the graph/preservation evidence below; do not use the old read-only restriction or extra-owner-approval gate to block the new scoped grant. No merge/worker receipt is inferred from either pre-merge document.

**Decision date: 2026-10-15. Strategy: keep the UI branch based on `main` and wait for the reviewed prerequisites to merge. No UI history rewrite, branch switch, reset, or immediate PR merge is authorized by this decision.** This record supplements [AGENTS.md](../../AGENTS.md) and the [work queue](WORK_QUEUE.md). It is an integration/authorization decision, not a feature implementation.

## 1. Verified facts and limits

The coordinator fetched the existing main/lead/architecture refs, inspected commit ancestry and cumulative source diffs, queried live PRs/reviews/checks, and inspected its own worktree. At the audit, before this documentation-only decision:

| Item | Actual observation |
| --- | --- |
| `main` | `ce02cf90ecdb0f9729817e2bfe449f0e42969d31` |
| Lead branch `arena/b25c318e-onverse` | Local and remote `370190c180682eb45edbdd9029a33b7e58c605dd`; clean sole local worktree |
| Main/lead ancestry | Merge base `ce02cf9`; main-only 0 / lead-only 9 commits; main is an ancestor of lead |
| Lead PR #3 | Open/draft into main, 9 commits / 21 changed files; mechanically mergeable/CLEAN; no reviews, no review decision, empty check rollup |
| Architecture PR #1 | Open/draft, `architecture/product-foundation` at `eedc24cb38c21d1a4be6186593c7ae7fcb8c6f85`; five docs-only commits from the same main base |
| Reported UI branch | Owner reports `arena/ced77c2a-onverse`, based on main; no edits/install/build/tests |
| Independently visible UI state | No such published remote ref, PR, local ref, or worktree in this lead checkout. Its exact HEAD, ancestry, unique commits, dirty/untracked/ignored work and runtime are **not independently verified** |

The clone has a shallow boundary at main, but the relevant common base and all commits from it to both visible feature tips are available. No claim about older history or an inaccessible UI checkout is needed to establish these visible relationships.

`main` -> nine lead commits -> `370190c` is verified. `main` -> reported UI branch is a report, not a verified edge. PR #1 branches independently from main and is not an ancestor of the lead branch.

### The nine lead-only commits actually inspected

| Commit | Content |
| --- | --- |
| `d2ae77c17758544fda6827c905a057993c748b31` | Extract processing-plan construction plus unit tests; controller delegates to it |
| `b56989e83a3d630cad74c2f1617bdf56eb3f4631` | Analysis-service boundary plus tests; controller full/fast calls delegate to it |
| `a8bc85580eec487ce5a42d0fa676466ba679342d` | Collaboration rules and work queue |
| `b64f051cc9f5fdac177ac47fa70c1812730d2771` | Short FFT zero-padding; channel-aware sample peak/clipping/RMS/crest; regression tests |
| `7bcea1c8bb3f96a0fb15696eb44513e5d5bfcd70` | Core publication/review documentation |
| `1e4192c44abbcfb27835d62ac8c86d72429dd8ed` | Isolated reference/candidate metering tooling/tests and proposed contract; not production integration |
| `e5229d8f601423a70fdeb946ab80112f650fa82c` | Research publication record |
| `a2983c2ba1be7ba5d6c5b09d2dc6e5e149b5d0c3` | Onboarding, source/capability guide, canonical design brief, updated roles |
| `370190c180682eb45edbdd9029a33b7e58c605dd` | Verified onboarding publication record |

Only four runtime paths differ from main: `src/main.js`, `src/audio/analyzer.js`, and the two added service/plan modules. `src/style.css`, `src/ui/draw.js`, `src/scene.js`, `index.html`, Electron, package/lock and Vite configuration are unchanged. Remaining changes are docs, validation sources, tests and fixtures. This decision adds only coordination documentation after that inspected runtime snapshot.

## 2. What the UI actually depends on

| Dependency | Requirement / non-requirement |
| --- | --- |
| Current working rules, project guide, design brief, this decision | Mandatory context; can be read from published pinned GitHub content now without modifying the UI checkout. Do not rely on stale main docs. |
| Analysis-service and processing-plan boundaries | Preserve these when any future UI slice touches controller templates/events or application calls. Do not copy main's old inline processing or direct analyzer calls over the lead refactors. Not a new service implementation task. |
| Bounded FFT/channel metric corrections and regression tests | Preserve the reviewed baseline and labels/units; they are not a reason to edit DSP for presentation. CSS-only concepts do not require additional audio algorithms. |
| Isolated metering candidate/native reference | **Not a functional UI dependency.** Do not wire it in or treat synthetic agreement as production validity, gain safety, cancellation, or standards certification. Whole-PR review is still necessary if merging this bundled PR. |
| PR #1 target architecture/product/roadmap/standards | Unmerged proposals, not installed architecture. Not a prerequisite to read-only UI audit or a current-capability presentation slice; reconcile explicitly before designing new core contracts. Do not merge PR #1 just to unblock UI. Its proposed README overlaps the current onboarding README. |
| Latest Linked Sessions requirements | Mandatory design constraints in AGENTS/project guide/design brief, not an implemented backend. Manual affected-item updates; stable IDs and exact used revisions; relevant-dependency currentness; immutable assets; safe atomic replacement/history/recovery; preserve destination processing and unrelated items; distinguish selected sums from routed bus stems; no silent upstream cascade; reject cycles; AI uses the same approved operations. |
| Functional Linked Sessions/DAW UI | Requires accepted state/command/render/persistence contracts and a real selected-group/update/restart proof. **Merging PR #3 does not provide these.** Defer operational linking/mixer/plugin controls until the relevant core exists; no UI-only fake session model or component localStorage. |

A basic current-capability shell/presentation proposal can proceed without waiting for a full DAW or Linked Sessions implementation. It still cannot become an implementation without reviewed visual scope, exact paths and a verified base.

## 3. Chosen strategy and intended base

**Choose option 2: remain main-based; wait for required reviewed changes to land in main.** Do not use the lead's evolving research/core branch as an implicit shared UI integration base. Do not cherry-pick files, copy docs into the UI checkout, rebase, or switch the fixed UI session to the lead branch.

Why: UI has no published commits to inspect; its exact local state is unknown; PR #3 bundles core behavior, isolated research, and onboarding and has no review/CI evidence on GitHub. Mechanically mergeable is not accepted. Broad owner Git permission exists, but does not make an unreviewed merge necessary or establish visual/task approval. A fixed branch can later advance without renaming or rewriting history.

- **Audit/reference base now:** exact lead snapshot `370190c180682eb45edbdd9029a33b7e58c605dd`, plus this later documentation-only decision. Read it via published GitHub content or fetched objects; do not change UI working files.
- **UI branch stays:** `arena/ced77c2a-onverse`, reported main-based. Current visible main is `ce02cf9`; do not claim the UI HEAD equals it until agent-b reports evidence.
- **Intended implementation base:** a specifically recorded, reviewed main commit containing the required lead baseline and this decision. That future main commit **does not exist yet and is not assigned a fabricated SHA here**. `370190c` is a compatibility floor/reference, not permission to implement on the lead branch.
- Review PR #3 and its actual final diff/checks before any merge. If that route is approved, retain ancestry using a normal merge commit, with explicit `gh pr merge 3 --merge`; do not execute it as part of this mismatch resolution or use auto-merge. Re-audit if the PR/head/main changes. Keep PR #1 separate.

## 4. Ownership and current authorization

The owner now reports an active UI agent/session. **agent-b is acknowledged as the UI collaborator**, but runtime, precise task details and acknowledgment are not invented. Historical notices that it was unappointed describe the earlier onboarding checkpoint.

### Authorized now: UI-003, read-only preflight, audit and proposal

Agent-b may inspect the pinned snapshot and return a UI audit/proposal in its conversation or a status comment on PR #3. Its first response must provide actual runtime/workspace, fixed branch, HEAD, status including untracked files, relevant ancestry/unique commits, access to the reference docs, and acknowledgment of this decision. This is not a code-writing assignment; the lead records acknowledgment before marking it running. No acceptance of the whole research API or PR #1 is required to read/audit it.

**Allowed checkout writes: none.** No source/docs edits, installs, builds, generated screenshots/assets in the checkout, tests, branch movement or history rewriting during this read-only phase. Existing screenshots may be inspected without claiming a running UI was verified. Report unsupported verification honestly. Preparing a reviewable text proposal is allowed; it must not pretend future capabilities exist.

**UI implementation: NOT authorized yet.** No `src/main.js` reservation is granted. A later approved slice must enumerate exact allowed files/sections and tests; no broad frontend grant. Lead owns core/DSP/domain/application/storage/IPC/configuration/dependencies and coordinator docs. Potential presentation paths (`src/style.css`, scoped `src/main.js`, `src/ui/draw.js`, later `src/scene.js`/`index.html`) remain conditional, not currently allowed. No concurrent same-file edits.

## 5. Exact next actions and safe later update

1. **Agent-b now:** acknowledge UI-003, report the actual preflight evidence, and read/audit the pinned snapshot plus this decision. Keep its fixed branch/worktree unchanged. Missing remote publication does not imply no local commits or no work.
2. **Lead:** review the proposed presentation scope and required core contracts; complete PR #3 integration review and applicable checks. Do not merge purely to remove a warning. Record any source/contract changes since `370190c` so the UI proposal can be refreshed.
3. **After required changes land:** lead records the exact approved main SHA `M`, verifies its contents/ancestry, updates the queue and supplies it to agent-b. No implementation authorization until then.
4. **Agent-b before advancing:** recheck its branch, clean tracked/untracked status, ignored-file collisions, unique commits and processes; preserve all work. Fetch main, verify `M` and required ancestry. Require the current UI HEAD to be an ancestor of `M`. If any check fails or the worker has unique commits, stop and report; no reset, rebase, stash, conflict overwrite or force push.
5. **Only after explicit go-ahead with real `M`:** `git merge --ff-only "$APPROVED_MAIN_SHA"` on the existing UI branch advances it without a merge commit, branch switch or history rewrite. This is a future, guarded procedure, **not a command to run now**. Require the variable to contain the actual coordinator-approved full SHA; verify it is reachable from fetched main and contains the required baseline. Record before/after HEAD and clean status. Never substitute an unreviewed moving branch name.
6. **Implementation gate:** agent-b acknowledges that verified base and exact exclusive file scope; lead records readiness/reservations; owner approves the visual proposal; required core dependencies are accepted. Then issue a separate explicit implementation authorization. Later delivery pushes only the worker's own fixed branch and uses a reviewed PR; no automatic merge.

## 6. Check evidence for this decision

Actual: local branch/status/worktrees; fetched remote refs; graph/log/merge-base/rev-list; full cumulative path and runtime diffs; live PR states/reviews/checks; absent published UI ref. Document validation checks paths, links, queue IDs/dependencies, fences, whitespace, exact allowed scope and protected published blobs before publication.

No new install, build, test suite, browser, listening, packaging, UI checkout inspection, rebase, merge, reset, source edit or remote deletion is claimed. One `gh pr view` request used an unsupported `baseRefOid` JSON field and failed; REST pull metadata provided the actual base SHA. No success was inferred from that failed request.
