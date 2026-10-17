> Historical candidate status below is superseded by UI-RESET-003. The owner
> explicitly assigned main/controller repair to lead; the factory is now used by
> the workbench, and the original nine-case suite imports it with assertions intact.
> See UI_REBUILD_STARTUP_REPORT.md for current integration/runtime evidence.

# CORE-ANALYSIS-EXTRACT-001 — isolated controller candidate

2026-10-16 · lead-owned · **held for review; not integrated or accepted**

## Task, reason and boundaries

The owner's instruction was to continue independent lead work while P corrects
the complete UI reset. The shared-main extraction remains paused. This slice
prepares a small, DOM-free analysis/reference orchestration candidate so a later
coordinated frontend can use the existing functional path without importing the
old visual entry point. It is not a new UI, a second engine, or a DAW/session model.

Working branch: `arena/14df8ffa-onverse`; unchanged HEAD:
`2faa3939b9e109e5a9ed2e0d53130dc51c5abc9e`. The 140-file pre-slice working-tree
snapshot includes earlier held work; HEAD alone is NOT its complete baseline.
No commit, push, merge, release, branch switch or destructive Git action was done.

### Exact slice paths

| Path | Change |
| --- | --- |
| `src/application/analysis/analysisController.js` | New, unused internal factory; three existing functions plus explicit collaborators. |
| `tests/unit/analysisController.test.js` | New, 31 independent candidate cases; imports the candidate as ESM without main or a DOM. |
| `docs/engineering/ANALYSIS_CONTROLLER_CANDIDATE_REVIEW.md` | This review/status/evidence record. |
| `docs/engineering/WORK_QUEUE.md` | Append-only status for this task; all prior text retained. |

Of the 140 pre-existing files, 139 remain byte-identical. Only the queue gains an
append; there are three new files, yielding 143 files. The preserved source,
original tests, P's shared/frontend files, package/lock/build configuration,
Electron, audio/DSP, reference/genre catalogs, application service, domain,
storage/recovery/history/IPC and earlier held proofs have NOT been edited.
The larger pre-existing Git diff is not part of this four-file slice.

## Interface candidate — internal and unadopted

`createAnalysisController(ports)` keeps the caller's **same mutable workbench
state**, not a clone, singleton, localStorage store or new authoritative model.
Construction does no analysis, network fetch, playback, listener registration or
state mutation. The returned API is frozen; the supplied state is not frozen.
Methods are `runAnalysis`, `ensureReferenceReady`, and `makeTarget`.

The caller must supply the existing `state` and all eleven effects:
`stopPlayback`, `updateAbUI`, `renderRefAreas`, `showProgress`, `setProgress`,
`setProgressLabel`, `renderAnalysis`, `renderReport`, `renderTweakPanel`,
`showPanel`, `toast`. Missing/non-function effects fail construction, rather than
silently installing no-op successful-looking UI behavior. These callbacks are
trusted in-process collaborators, not an API for imported/model-generated code.
This factory is not an untrusted-input validator or new public/IPC contract.

Defaults use the SAME `analysisService.analyze`, `scoreAnalysis`, `buildIssues`,
`buildFixPlan`, genre/category lookup, `targetFromFeatures`,
`profileForResolved`, and `fetchPreviewBuffer` implementations. Optional service,
scoring, reference-preparation, target-resolution and logging collaborators are
explicit fault-test seams. No dependency, framework, runtime, runner or service
contract changes; no fake engine is installed in production code.

The candidate contains no HTML, CSS, SVG, old visual assets or DOM bindings.
Existing progress wording and target/report metadata are copied for behavior
parity, not endorsed as the replacement design or a scientific accuracy claim.
The existing reference module still has browser fetch/decode functions; explicit
preview preparation can invoke them. DOM-free does NOT promise a cross-platform
decoder or that real preview fetching was tested here. Import and construction
alone do not call those functions.

## Preservation and source parity evidence

The pre-slice snapshot and SHA-256 manifest were taken BEFORE candidate edits.
The delivered review packet retains them persistently, along with the exact
four-file slice patch, cumulative held patch, logs and a reproduction verifier.

The entire contiguous original span from `ensureReferenceReady` through
`runAnalysis` is equal after ONLY:

1. adding the factory's two-space indentation;
2. renaming declarations `ensureReferenceReady` → `prepareReference` and
   `makeTarget` → `resolveTarget`, to permit explicit collaborator bindings.

Call sites, expressions, comments, strings, branch order, progress values,
mutation order, catch/finally behavior and result shapes in that span are
otherwise identical. Normalized span SHA-256:
`abcdba47f8c25d28ec8016b4e8464476fae99212872a8471d126a60dbcc8b241`.
This is bounded textual parity of those functions, not a claim that every
possible JavaScript environment or future integration is equivalent.

Every assertion and case body in the original nine-case suite is also retained
in the new suite. Only its outer describe title changes; the new harness imports
the factory rather than extracting main through a VM. The original suite itself
is unchanged and still runs. Original nine-case block SHA-256:
`32a19bb24c5fa623df67445fb854859b859748bc0fa313251edc0046368e9c79`.

Key unchanged complete-file hashes:

- `src/main.js`: `cb73be9e95b024006bccd295e6bad6b08953c60491be08eeb68f644123dc1b6f`
- `tests/unit/analysisErrorFlow.test.js`: `836ddca17b109faf8ca4d36cba40bf985728c42a0a353a69b2421c4660e69462`
- `src/application/analysis/analysisService.js`: `f551cfe6cfc5f905c3416f1bbdb308a49c28b73a930d34ae2dfaa86516ab7a58`

## Executed tests

Node `v22.22.3`, Linux. No dependency installation, real provider request, user
media, paid service, generated-code execution, browser, AudioContext/device or
listening was used. Fixture PCM is synthetic and local.

| Execution | Result |
| --- | --- |
| Frozen pre-slice tree: `node --test tests/unit/*.test.js tests/audio/*.test.js` | 404 tests; 401 pass; 0 ordinary failures; 3 known TODO failures. |
| Candidate: `node --test tests/unit/analysisController.test.js` | 31 tests; 31 pass; 0 fail/TODO/skip. |
| Combined current tree: `node --test tests/unit/*.test.js tests/audio/*.test.js` | 435 tests; 432 pass; 0 ordinary failures; the SAME 3 known TODO failures. |
| `node --check src/application/analysis/analysisController.js` | Pass. |
| Source/case-block parity, existing-file hashes, reversible patch checks | Pass; exact machine output and verifier in packet. |
| `git diff --check`; staged index | Pass; index empty. |

The new cases cover all nine existing success/error/guard cases, required
collaborators/no constructor effects, exact buffer/state/result/plan identities,
visible effect order, shared existing busy guard across factories, scoring/
issue/plan faults, post-publication view faults, finally-consumer propagation,
reference-file caching/errors, URL rejection, measured preview/profile
separation, preview fetch/measurement fallback, manual category/subgenre targets,
and metadata-only fallback.

One case deliberately removes synthetic engine/scoring overrides and runs the
factory's **real production defaults** on a deterministic stereo tone. It compares
its analysis to the same real service independently, compares scoring/issues/plan
to the existing helpers, checks plan identity and source-channel immutability,
and asserts zero preview-fetch calls. This is real analyzer execution on synthetic
PCM, NOT proof of loudness accuracy, audible quality or integrated playback.

The three TODO assertions execute and still expose known stereo LUFS fold-down
cancellation defects (full, fast, quick). They are not hidden passes. Strict audio
diagnostics were not rerun here; those defects, true-peak/gain risks and existing
measurement limitations are not repaired by extraction.

## Retained limitations — no silent architecture improvement

- The current busy guard is shared, but no cancellation, per-request generation,
  async freshness/revision validation, rollback, worker or scheduler is added.
- Reference preparation mutates the existing reference cache exactly as before.
  Failed preview measurement can leave its fetched buffer cached, and preview
  fallback sets `prepared`; it does not silently retry or fabricate measurements.
- Main result publication precedes view callbacks. A view error can therefore
  leave newly published results while reporting failure. There is no new atomic
  transaction/last-valid rollback guarantee; the tests explicitly preserve this.
- `busy` clears before the final UI callbacks. A throwing finally callback can
  propagate and interrupt remaining cleanup. This is not newly swallowed.
- Profile targets remain profiles, not decoded full streaming tracks. Existing
  profile wording/heuristics are not certified mastering/reference standards.
- This is the existing single-buffer workbench, not adopted Linked Sessions,
  durable project state, real SYLUNE/provider integration or undo/redo.

## Dependencies, decisions and acceptance gate

No engine/public-contract decision is needed to TEST this unused candidate.
Review the internal port shape and extraction before adopting it. P's PR8
correction review remains separate; its two published review comments are not an
acceptance or formal request-changes event. No P correction or receipt is claimed.
Design remains WAIT for new owner media; SYLUNE's name and protected services
remain unchanged.

Before integration:

1. Review and approve the narrow extraction/port boundary against the then-current
   GitHub head and preserved held work; no automatic commit/push/merge authority.
2. Coordinate P's explicit shared-main release/split. Compare functional changes
   and resolve any changed controller behavior rather than replaying this copy.
3. Wire exactly one factory to the real existing state/effects; remove old duplicate
   functions in a separately reviewed cutover, not a second controller authority.
4. Preserve/migrate ALL nine old assertions only with that actual cutover; do not
   delete them just because the candidate passes. Rerun current parity/regressions.
5. Verify real entry boot and import, analysis/reference, A/B/playback, crop/seek,
   manual processing, conversion/export and error cleanup with the replacement
   frontend. Build/browser/accessibility/keyboard/reduced-motion/performance and
   screenshots remain appropriate integration gates, not checks passed here.
6. Keep packaged Mac/Electron persistence, native audio/device, migration/recovery,
   provider/SYLUNE and release/security qualification separate and unclaimed.

**Acceptance status:** review-ready local candidate only. No integration, runtime
cutover, public interface adoption, UI-reset acceptance, Mac qualification,
commit/push/merge or release. Main and its original tests remain active and intact.
