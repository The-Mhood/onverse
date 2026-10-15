# MusicOnVerse agent collaboration rules

## Scope and authority

- The product owner decides product scope, visual direction, major architecture changes, dependencies, external costs, and destructive actions.
- The lead/coordinator owns architecture, application contracts, core audio engineering, task assignment, review, and integration recommendations.
- Codex is the UI/UX design and frontend implementation worker. Other workers receive bounded assignments; they do not independently change architecture or shared interfaces.
- These rules establish a Git-based collaboration protocol, not an automatic scheduler, agent launcher, or permission to implement the full roadmap.
- Follow [issue #2](https://github.com/The-Mhood/onverse/issues/2), with the product owner's later direction to defer a custom orchestration platform. No new orchestration runtime or dependency is authorized.

## Architecture references

[PR #1](https://github.com/The-Mhood/onverse/pull/1) is an architecture proposal. At the 2026-10-15 audit it was open, draft, and unmerged. Its documents are not present in the current engineering branch. Check its current state before relying on it; do not merge or copy it as part of coordination setup.

Pinned proposal references, not claims of accepted architecture:

- [Architecture](https://github.com/The-Mhood/onverse/blob/eedc24cb38c21d1a4be6186593c7ae7fcb8c6f85/docs/ARCHITECTURE.md)
- [Product vision](https://github.com/The-Mhood/onverse/blob/eedc24cb38c21d1a4be6186593c7ae7fcb8c6f85/docs/PRODUCT_VISION.md)
- [Roadmap](https://github.com/The-Mhood/onverse/blob/eedc24cb38c21d1a4be6186593c7ae7fcb8c6f85/docs/ROADMAP.md)
- [Engineering standards](https://github.com/The-Mhood/onverse/blob/eedc24cb38c21d1a4be6186593c7ae7fcb8c6f85/docs/ENGINEERING_STANDARDS.md)

## Before every assignment

1. Read this file and [the work queue](docs/engineering/WORK_QUEUE.md).
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
| UI audit and design proposal | Codex | Audit/proposal must be reviewed before UI implementation |
| `src/style.css` and approved presentation files | Codex after review | Visual changes only within the approved task |
| `src/main.js` | Exclusive assignment by lead | Shared UI/state/workflow hotspot; never concurrent edits |
| `src/ui/draw.js`, `src/scene.js` | Explicit assignment after review | Presentation changes must preserve waveform/playback semantics |
| Electron, build/configuration, manifests, lockfile | Lead approval | No incidental edits or dependency changes |
| `AGENTS.md`, `docs/engineering/WORK_QUEUE.md` | Coordinator | Workers submit updates through task/PR results |

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

Codex first submits a UI audit and design proposal identifying affected files, workflow changes, accessibility/responsiveness, required core interfaces, and regressions to test. The lead reviews architectural compatibility before implementation. Any required shared-contract change is a separately assigned core task; UI must wait for its acceptance.

The product owner wants a new colour gradient. Notify them and obtain their visual direction before visual implementation; do not choose the gradient or independently redesign the interface. Core work must not duplicate Codex's UI work.

## Verification and review

- Keep each unit small and behavior-preserving unless its accepted scope explicitly changes behavior.
- No new dependency without product-owner approval. Never hardcode credentials or silently upload audio.
- AI/model output and imported files are untrusted; workers must not bypass application validation or execute arbitrary generated code.
- Report loading/error/cancellation limitations honestly. Do not swallow errors to make checks appear successful.
- Test actual audio mechanisms when assessing correctness; mocks validate contracts, not measurement quality or hardware support.
- Never claim browser listening, macOS startup, packaging, or agent dispatch was verified unless actually executed.

Existing core checks, run from the repository root when applicable:

```bash
node --test tests/unit/analysisService.test.js tests/unit/buildProcessingPlan.test.js
node scripts/test-analyze.mjs
npm run build
```

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

GitHub tasks, PRs, checks, and worker-authored result comments are the shared communication channel. The coordinator retrieves published results directly rather than asking the product owner to relay every task. Publishing assignments or changing GitHub records is a mutation and must be reported; local queue entries alone do not dispatch an agent.

Do not install a runtime, request secrets in chat, create a generic shell-execution adapter, or claim automatic dispatch. If automation later becomes justified, first verify an authorized runtime's launch, authentication, isolation, cancellation, and result collection. Any future dry run must dispatch no agents and make no Git or GitHub mutations or task-state/file writes. There is no orchestrator CLI or automatic dry-run mode in this documentation-only setup.
