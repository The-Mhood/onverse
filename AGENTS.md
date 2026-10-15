# MusicOnVerse agent collaboration rules

## Scope and authority

- The product owner decides product scope, visual direction, major architecture changes, dependencies, external costs, and destructive actions.
- The lead/coordinator owns architecture, application contracts, core audio engineering, task assignment, review, and integration recommendations.
- Codex is no longer active. The owner now reports **agent-b** as the UI/UX collaborator on fixed branch `arena/ced77c2a-onverse`. Its exact checkout/runtime and acknowledgment remain to be verified. The [UI baseline decision](docs/engineering/UI_BASELINE_DECISION.md) authorizes read-only preflight/audit/proposal only; UI implementation remains blocked. No editing workspace or file reservation is granted by onboarding. Workers do not independently change architecture or shared interfaces.
- These rules establish a Git-based collaboration protocol, not an automatic scheduler, agent launcher, or permission to implement the full roadmap.
- Follow [issue #2](https://github.com/The-Mhood/onverse/issues/2), with the product owner's later direction to defer a custom orchestration platform. No new orchestration runtime or dependency is authorized.

## Current UI integration decision

Keep agent-b's fixed branch main-based; wait for reviewed prerequisites to merge. Do not rebase/switch/reset it or silently treat the lead branch as the UI integration base. Read-only audit reference is `370190c180682eb45edbdd9029a33b7e58c605dd` plus the later [decision record](docs/engineering/UI_BASELINE_DECISION.md). No future main merge SHA is invented. A later reviewed main SHA, guarded fast-forward-only update, proposal approval, dependency acceptance, exact file ownership and worker acknowledgment must precede implementation. Read the complete decision for evidence, scope and stop conditions.

## Architecture references

CORE-007 explicitly reconciles three existing PR #1 proposal documents into the same canonical paths on the engineering branch, as **working drafts for review**, not implemented APIs or approved product defaults:

- [Architecture](docs/ARCHITECTURE.md): actual-state boundary, retained modular-monolith direction, proposed session/link records, dependency semantics, safe render/update/recovery and the minimum real proof.
- [Product vision](docs/PRODUCT_VISION.md): long-term intent, general Linked Sessions/manual-update promise, honest capability/design boundaries; commercial ideas remain unvalidated hypotheses.
- [Roadmap](docs/ROADMAP.md): incremental proof gates and a proposed test crosswalk, not task dispatch or executed coverage.

[PR #1](https://github.com/The-Mhood/onverse/pull/1) remains a separate unmerged draft at the inspected `eedc24cb38c21d1a4be6186593c7ae7fcb8c6f85`; source attribution is preserved in each revised document. Its original README and [engineering standards proposal](https://github.com/The-Mhood/onverse/blob/eedc24cb38c21d1a4be6186593c7ae7fcb8c6f85/docs/ENGINEERING_STANDARDS.md) are not adopted by this unit. Do not blindly merge/copy PR #1 over the revised working files; overlapping paths require explicit review. The working drafts do not satisfy an `accepted` dependency merely by existing or being published. Do not create a second competing architecture or design brief. This explicit architecture task does not relax the prohibition on adopting proposals incidentally during onboarding/coordination.

## Before every assignment

1. Read [README.md](README.md), this file, the [project guide](docs/engineering/PROJECT_GUIDE.md), the latest notices/results in [the work queue](docs/engineering/WORK_QUEUE.md), and the [canonical design brief](docs/design/DESIGN_BRIEF.md). The [agent-b master prompt](docs/engineering/AGENT_B_MASTER_PROMPT.md) supplies reusable context, not an assignment. Read the working architecture/roadmap when a task touches future state, session/link semantics or contracts; proposed interfaces are not permission to implement them.
2. Inspect the directory, current branch, full working-tree status, recent commits, remotes, and worktrees. Compare relevant local and remote refs; do not assume remote-tracking refs are current.
3. Preserve existing edits, including untracked files. Never reset, clean, stash, overwrite, force-push, switch away from active work, or remove worktrees without explicit authorization.
4. Record the task ID, exact base SHA, execution environment, owner, branch/worktree, dependencies, allowed paths, forbidden paths, acceptance criteria, and checks before editing.
5. Explain the intended changes and name the exact files to create or modify. Stop if scope, ownership, or prerequisites are unclear.
6. Respect restrictions imposed by the execution environment. If a session is fixed to a branch, do not create or switch to another branch to satisfy a worker assignment; report the isolation blocker.

## Ownership and isolation

Each worker implementation requires its own branch and separate worktree or clone, based on an explicitly approved SHA. Never run two editing agents in one working directory. Read-only audits can inspect a pinned snapshot without an editing workspace; they must not change files, install packages, or build into that checkout.

| Area | Default responsibility | Rule |
| --- | --- | --- |
| `src/audio/**` | Lead/core | DSP, measurement, processing, codecs, and reference mechanisms |
| `src/application/**`, `src/domain/**` | Lead/core | Use cases, contracts, and domain rules |
| Core unit tests, audio fixtures/tests | Lead/core | Assign exact test paths per task |
| UI audit and design proposal | agent-b after appointment | Audit/proposal must be reviewed before UI implementation; no task granted by onboarding |
| `src/style.css` and approved presentation files | agent-b after appointment/review | Visual changes only within the approved task |
| `src/main.js` | Exclusive assignment by lead | Shared UI/state/workflow hotspot; never concurrent edits |
| `src/ui/draw.js`, `src/scene.js` | Explicit assignment after review | Presentation changes must preserve waveform/playback semantics |
| Electron, build/configuration, manifests, lockfile | Lead approval | No incidental edits or dependency changes |
| `AGENTS.md`, onboarding/context/design-brief documents, `docs/engineering/WORK_QUEUE.md` | Coordinator | Workers propose changes through task/PR results; no competing canonical briefs |

These defaults are not active editing grants. The coordinator must check exact paths and prefix/pattern intersections before assigning work. A directory grant overlaps every contained file. Renames/deletes count against both affected paths. Forbidden paths win over allowed paths; changing the allowlist requires review first.

Separate branches do not resolve overlapping ownership. If two tasks need the same file, serialize them or establish a separate, approved shared-interface task. Record the active reservation and worker acknowledgment in the queue before either starts. Do not release a reservation merely because a worker stopped responding.

## Task lifecycle and dispatch gates

Use the queue's task schema and states. Only `accepted` prerequisites satisfy dependencies; a commit, push, successful test, or worker's `submitted` result is not acceptance. Acceptance records the reviewer and evidence; record merge/integration separately rather than implying that acceptance means merged.

The coordinator:

- Verifies dependencies, the approved base, ownership, worker availability, and required approvals before marking a task `ready`.
- Records the assignment and worker acknowledgment before `running`.
- Blocks affected tasks when an upstream task fails, changes contracts, or loses acceptance. Stops downstream dispatch; does not silently retarget running work.
- Reviews the actual diff, changed-file ownership, test evidence, and known risks before acceptance.
- Reports the next eligible tasks and the reason each remaining task is blocked.

For now, readiness and ownership checks are manual Git/GitHub review. Do not describe them as automated enforcement.

## UI/core interface rules

Current engineering interfaces, introduced on the engineering branch:

- `analysisService.analyze(buffer, onProgress)` and `analysisService.analyzeFast(buffer, onProgress)`: asynchronous local analysis; unchanged result shapes, optional engine-defined progress, propagated errors.
- `buildProcessingPlan(base, adjustments, bandKeys)`: independent plan construction, not validation of imported or AI-generated instructions.

The analysis service does not yet provide workers, cancellation, persistent projects, or undo. UI work must not imply those capabilities exist. Do not duplicate processing logic or introduce a second authoritative processor state in UI code.

When UI implementation is requested, agent-b first submits a UI audit and design proposal identifying affected files, workflow changes, accessibility/responsiveness, required core interfaces, and regressions to test. The lead reviews architectural compatibility before implementation. Any required shared-contract change is a separately assigned core task; UI must wait for its acceptance.

The owner-supplied direction is Logic-inspired professional DAW usability with an original restrained dark/celestial identity, not a clone or a gaming/SaaS dashboard. Read the canonical design brief. Notify the owner before look changes and obtain review of the proposed palette/gradient/layout before implementation; the brief is not palette or implementation approval. Core work must not duplicate agent-b's UI work.

## Required product and safety invariants

The project guide records current capabilities and future boundaries; do not infer implementation from proposals. Source is presently a single-buffer prototype, not a multitrack/session engine.

- Preserve the working audio/UI flows and existing contracts. No broad controller/framework rewrite or new dependency without a separately approved scope.
- Future UI intent flows through validated application operations and pure domain/state transitions to async repositories/storage; no second authoritative UI model or component-localStorage project store.
- Linked Sessions is general-purpose. Track transfers, selected-track sums, actual bus stems, and full mixes are distinct. Stable IDs, pinned relevant revisions, explicit render rules, immutable managed assets, provenance, atomic commit/history, and restart recovery are required.
- Source edits never silently replace destination audio. Explicit affected-item updates must preserve destination processing/routing/automation/placement, unrelated items, and the prior valid asset on failure/cancellation/incompatibility. Use relevant dependencies, not global session revisions, for currentness; never rebind by name.
- Chains record exact used revisions and distinguish local currentness from stale upstream ancestry. No silent cascading update; reject cycles and unresolved unsafe dependencies. Future AI must use the same validated approved operations and cannot override manual linked updates.
- Imported/AI data is untrusted: parsing does not mutate active state; validate targets, units, ranges, capabilities, and permissions before approved application. No arbitrary generated code/shell/filesystem execution, silent uploads/costs, or mutable originals.
- Prove high-risk mechanisms with a minimum real end-to-end render/storage/update test before dependent expansion. Mocks alone do not prove audio quality, persistence recovery, plugin support, or cancellation.

## Verification and review

- Keep each unit small and behavior-preserving unless its accepted scope explicitly changes behavior.
- No new dependency without product-owner approval. Never hardcode credentials or silently upload audio.
- AI/model output and imported files are untrusted; workers must not bypass application validation or execute arbitrary generated code.
- Report loading/error/cancellation limitations honestly. Do not swallow errors to make checks appear successful.
- Test actual audio mechanisms when assessing correctness; mocks validate contracts, not measurement quality or hardware support.
- Never claim browser listening, macOS startup, packaging, or agent dispatch was verified unless actually executed.

Existing core checks, run from the repository root when applicable:

```bash
node --test tests/audio/analyzerRegression.test.js tests/audio/integratedLoudnessCandidate.test.js tests/unit/analysisService.test.js tests/unit/buildProcessingPlan.test.js
node scripts/test-analyze.mjs
npm run build
```

The current default suite has 145 tests / 142 passes / 3 explicit known LUFS TODO cases. No npm test/lint/typecheck/UI-test scripts are configured; report missing checks as unconfigured, never passed. Strict diagnostics and unresolved audio/gain limits are in the project guide.

A build writes ignored output: it is not part of a read-only audit or dry run. Document-only tasks should verify paths, links, scope, and whitespace; avoid dependency installation or builds unless justified. Add task-specific tests for changed behavior. UI integration also requires import, reference analysis, processing, adjustments, A/B, crop/seek, and export checks appropriate to its diff.

## Results and integration

Workers return: task ID, owner/runtime, base SHA, branch/worktree, commit(s), PR link/base, changed paths (including untracked work), commands actually run, outcomes/failures, skipped checks, blockers, risks, and requested next work.

The coordinator reconciles that report with the actual diff and GitHub checks, then updates the queue. Use commits and PRs for code delivery; never push worker changes directly to the integration branch. Do not assume a worker's local checkout is synchronized with GitHub. In particular, changes saved only in Arena are unavailable on a user's Mac until explicitly published and retrieved.

No automatic merge. Before integration, recheck the base, combined diff, affected contracts, and relevant workflows. Obtain product-owner approval for merge actions. A concurrent update to a shared file invalidates the previous conflict review.

## Failure and recovery

- Failure/interruption: mark `failed` or `blocked`, capture the last commit, working-tree/untracked-file inventory, test failures, and outstanding processes. Preserve all work.
- Conflicting paths/contracts: stop affected edits and dispatch. Record the collision and obtain an explicit sequencing/reconciliation decision; do not automatically resolve conflicts or replay changes.
- Retry: retain the task ID, append attempt history, and record the new assignment/base only after reviewing the preserved attempt.
- Abandoned worktree: inspect its status, branch, untracked/ignored material, and running processes before considering reassignment or removal. Preserve recoverable work; removal needs explicit approval.
- Integration failure: block dependent tasks and record the failing checks. Do not reset a shared branch or continue stacking features on the failure.

## Runtime and automation boundary

The audited environment has `git`, `gh`, Node/npm, and Python. No `codex`, `arena`, or `claude` executable was found on PATH, and no agent-launch API was verified. This does not establish what exists on the user's Mac.

Use `git` for local version-control operations and `gh` for GitHub PR/issue/check records when available; report access/tool blockers rather than inventing success. Broad permissions do not replace a scoped task, preservation of work, or actual integration review.

GitHub tasks, PRs, checks, and worker-authored result comments are the shared communication channel. The coordinator retrieves published results directly rather than asking the product owner to relay every task. Publishing assignments or changing GitHub records is a mutation and must be reported; local queue entries alone do not dispatch an agent.

Do not install a runtime, request secrets in chat, create a generic shell-execution adapter, or claim automatic dispatch. If automation later becomes justified, first verify an authorized runtime's launch, authentication, isolation, cancellation, and result collection. Any future dry run must dispatch no agents and make no Git or GitHub mutations or task-state/file writes. There is no orchestrator CLI or automatic dry-run mode in this documentation-only setup.
