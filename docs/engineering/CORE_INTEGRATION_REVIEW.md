# Core preservation and product integration review

2026-10-16. Owner-directed continuation. **No commit, push, merge or release is
authorized by this review.** Preserve current branch, sessions and dirty work.

## Immediate task and order

Preserve the exact current patch and test evidence, review its product blockers,
then implement one authoritative application host against a reviewed production
storage boundary. UI wiring comes after that boundary, not directly to the Linux
experiment. No new demo project store, renderer localStorage model or parallel
SYLUNE executor. Agent B continues full visuals independently.

Files in this review pass:

- This record, `PRODUCTION_SESSION_STORAGE.md`, `SESSION_APPLICATION_IPC.md`.
- `scripts/validation/probe-sqlite-ownership.mjs`: standalone builtin-SQLite
  feasibility check, not production repository code or a dependency change.
- `WORK_QUEUE.md`, `UI_IMPLEMENTATION_HANDOFF.md`,
  `SYLUNE_PRESENTATION_CONTRACT.md`: status and exact narrow interface decisions.
- External review bundle: cumulative binary-safe patch against HEAD, per-file
  hashes/inventory, previous PR evidence, current test outputs and upstream source
  evidence. Bundle deliberately lives outside the repository to avoid a patch
  recursively including itself. It is not a commit or approval.

## Existing exact evidence

[PR4 comment6210759543](https://github.com/The-Mhood/onverse/pull/4#issuecomment-6210759543)
preserves the eight-file recovery delta, exact base/current hashes, contract and
native evidence. Its prerequisite source/test comments are linked there. All
eight current files were re-hashed against that record in this review: **match**.
This proves identity with the recorded tested source; it is not a new native run.

Previous executed results: targeted35/35; default290/287pass/3known LUFS TODOs;
strict47/44pass/3known failures (expected exit1); sanity pass. Native Chromium
153.0.8010.0,37destination renders,max3.5762786865234375e-7 under2e-6, no page
requests/errors. Crash/approval/history tests use real Linux storage but synthetic
fixtures. No listening or packaged-app persistence is established by these tests.
Fresh regression results from this pass belong in the bundle, separately dated.

## Runtime prerequisite continuation — 2026-10-16

The findings below preserve the earlier review baseline, not a statement that later
rendered-review/range prerequisites never happened. The held/submitted staged
rendered-review and useful-range core slices are described in their own records;
none is an actual packaged application/IPC acceptance.

CORE-013 now has a [validation-only runtime qualification runner](SESSION_RUNTIME_QUALIFICATION.md)
with real Node SQLite ownership/contention/death, generated8s/12s PCM transactions,
8SIGKILL boundaries, committed receipt/history atomicity, strict unknown-schema/
file-identity refusal and exact-byte history/corruption tests.19focused regressions
pass in the available Linux Node22.22.3/SQLite3.51.3 runtime. This is no application
adapter/full ledger or production migration. `productionReady:false` remains explicit.
Actual packaged Electron/macOS runtime/ownership/recovery evidence still blocks the
production repository: the runner refuses guessed packaged-app script invocation.
No IPC, presentation, package/dependency or Electron change is made here; the prior
storage adoption order remains in force. See the record for the exact Mac/package
entry prerequisite, test limitations and separately reviewed next change.

## Review findings / outstanding concerns

| Finding | Consequence and required action |
| --- | --- |
| R1: `generationStore.js` and `linuxWriterLock.js` require Linux/private POSIX roots and installed `/usr/bin/flock`. | Do not ship this as a macOS adapter. See storage ADR, runtime and packaged-platform gates. |
| R2: package build includes `dist/**` and `electron/**` only. No session host or session preload API exists. | Source-only core modules are not automatically packaged or integrated. Review a narrow main-process bundle/artifact inclusion change, then inspect its output. |
| R3: current model is explicitly one bounded source/destination aggregate; fixed4096frames at48kHz is about85ms. | It is not a usable music project. Generalize the existing profile to a meaningful selected range before claiming the first user workflow. Preserve old fixture checks, do not relax them. |
| R4: service plans/approvals/preparations use process-local opaque objects. | JSON cannot carry their authority. Add host-owned, sender/project/epoch-bound ID registries and a persisted operation receipt ledger; no raw WeakMap objects over IPC. |
| R5: current `review` examines metadata, then renders after approval. | Required product workflow includes rendering/auditioning before final approval. Extend the same application service with a staged immutable preview and bind approval to its exact bytes/dependencies/target; do not implement a second executor. |
| R6: current saved state has no durable save timestamp or application projection. | Do not infer saved from mtime, epoch or a completed animation. Define/read actual durable revision/receipt state; B keeps honest session-only text until connected. |
| R7: IPC security must be stricter than the existing file-protocol navigation rule. | `file://` alone is not authorization. Exact registered webContents/main frame/document, strict command schema, bounded payloads and least-privilege preload are prerequisites. Preserve sandbox/context isolation; do not expose ipcRenderer or paths. Existing updater route is not a template for session authorization. |
| R8: render is a trusted injected port today; UI is not an audio authority. | Use a dedicated fixed local render worker controlled by the host, not UI-supplied arbitrary rendered bytes/code. Validate job scope/result and keep worker sender separate from UI. Test renderer death. |
| R9: durability/cancellation uncertainty after commit is explicit; no persistent application operation ledger yet. | Persist receipt with the state change; reconnect queries outcome rather than rerunning. Preserve too-late/uncertain states and exact-audio history. |
| R10: 256 generations/64 versions, full ancestry audit, quarantine disk growth and external filesystem assumptions. | Valid experimental bounds, not final storage policy. Production growth/backups/space handling need tests. Never add automatic deletion or silently discard history. |

No current source regression was found by these identity checks; these findings
are blockers to claiming product integration, not newly discovered data loss.
Independent architecture review remains outstanding. Review completion does not
implicitly authorize Git publication or deployment.

## Next engineering slice / acceptance

1. Verify the selected SQLite primitive in the **actual packaged Electron runtime**
   on macOS arm64/x64, including ownership and commit crash tests. Source research
   and standalone Linux Node success are insufficient. If unavailable, stop the
   production adapter, document the exact failure and review an alternative;
   never silently install a native dependency or reuse flock on macOS.
2. Implement the production repository behind the existing application storage
   ports, with durable receipts; keep one source of truth. Pass identical
   source/target guards, approval/cancellation/history and corruption contracts.
3. Extend that same service/model for useful-length selection and rendered review;
   then implement narrow host/preload registration and B-owned UI wiring.
4. Deliver the application acceptance matrix in `SESSION_APPLICATION_IPC.md`.

Ordinary implementation within these boundaries needs no repeated owner approval.
An actual dependency/build/security change gets an exact scoped review before
adoption. Mac execution is an environment/evidence dependency, not a request for
credentials or permission to fabricate success. No Mac runner or signing access
has been established in this sandbox.
