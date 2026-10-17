# CORE-013 — runtime/storage qualification prerequisite

2026-10-16. **Validation tooling implemented, production-adapter adoption BLOCKED.**
The [production storage decision](PRODUCTION_SESSION_STORAGE.md) explicitly requires
actual packaged Electron/macOS evidence before implementing/adopting that adapter.
This workspace is Linux x64 / standalone Node22.22.3 / SQLite3.51.3; no Electron
binary or Mac execution was established. A `proceed` instruction is not permission
to invent that evidence, silently install a dependency/runtime, ship Linux flock
on macOS or bypass the gate with a second live project store.

## Task, files and impact

Make the next runtime gate reproducible and fail closed, beyond the earlier tiny
four-byte SQLite feasibility probe. New validation-only files:

- `scripts/validation/session-runtime-contract.mjs`: exact CLI/fixture identity,
  observed runtime facts, safe private-temp setup/pinned file checks/cleanup.
- `scripts/validation/run-session-runtime-qualification.mjs`: real builtin-SQLite
  ownership/contention/death, useful PCM BLOB/receipt/history transaction checks.
- `tests/unit/sessionRuntimeQualification.test.js`:19 focused regressions, including
  the full real diagnostic and negative environment/path/schema cases.

No application/domain/audio/repository/host/IPC source is changed or imports this
fixture SQL. It is NOT the application repository, an adapter fallback or another
live authoritative store. Existing53file core patch is preserved except explicit
engineering-document status updates. No B presentation, Electron/preload, dependency,
manifest/build change, Git staging/commit/push/merge/release. No browser toolkit or
application dependency installation was needed for this slice.

## Honest runtime classification

```sh
node scripts/validation/run-session-runtime-qualification.mjs
# JSON status diagnostic-pass, productionReady:false, productionAdapterImplemented:false
node --no-experimental-sqlite scripts/validation/run-session-runtime-qualification.mjs
# JSON status blocked, BUILTIN_SQLITE_UNAVAILABLE, exit2; no fixture created
node --test tests/unit/sessionRuntimeQualification.test.js
```

Only observed `process` facts are recorded: Node/SQLite/Electron versions, process
type, OS/architecture and run-as-node flag. Caller-provided runtime claims are not
accepted. `packagedApplicationVerified` and `apfsVerified` remain false. Even a
standalone Node run on macOS would be diagnostic-only, not packaged-Electron proof.
`process.versions.sqlite` alone is insufficient: disabling the builtin leaves that
version string present, but actual import fails and this path blocks without a
native addon, subprocess SQLite executable or filesystem-store fallback.

**Do not run this as a pretend packaged Electron entry.** If Electron is detected,
the runner reports `REVIEWED_ELECTRON_ENTRY_REQUIRED` before fixture/child launch.
A packaged app cannot be assumed to execute a supplied `.mjs` development-script
path. No guessed spawn of a real application, utility worker or UI is attempted.
The test that injects an Electron-looking version is a **negative branch simulation
only**, never Electron/module/package evidence. Production readiness is never
inferred from an editable JSON result or a successful exit code.

## Real diagnostic protocol

Only newly created private, marked temporary roots/cases are opened. No existing
project directory, imported/user audio or arbitrary SQL/path/module/command input.
Database names and schema/SQL are fixed in the validation script. Children use the
current Node executable plus that fixed local script, bounded output/time and an
allowlisted environment, not a shell or generic execution API.

- Canonical temp parent; private owned directories/files, no symlink aliases or
  hard-linked DBs. Exact run/case marker and nonce before any SQLite open. Missing
  ownership files fail before SQLite can auto-create a replacement.
- Retained file descriptors and **BigInt** device/inode/link identity checks detect
  rename/replacement; rechecked before/after transactions. Cleanup requires original
  root identity and run marker; only this newly created fixture tree is removable.
  Child processes are closed/killed and awaited before removal. Primary and cleanup
  errors are retained, not swallowed into a passing diagnostic.
- `ownership.sqlite` uses rollback/DELETE mode and lifetime `BEGIN EXCLUSIVE`.
  Unknown mode/header/identity is refused; no PID/time takeover, unlink or stale
  lock replacement. Ownership precedes session validation/mutations. This is the
  selected **candidate** mechanism, not a qualified production implementation.
- `session.sqlite` verifies its fixture application/schema header before changing
  journal mode or data. WAL/FULL, foreign keys, zero busy timeout and requested
  fullfsync/checkpoint_fullfsync are set and read back. Unknown/future schema remains
  unchanged. An accepted flush PRAGMA is NOT proof of hardware/APFS durability.
- Actual two-process live exclusion, killed-owner release and one winner among
  simultaneous contenders. No app-single-instance assumption.
- Generated canonical stereo Float32LE PCM:8s/384000frames/3072000bytes old;
  12s/576000frames/4608000bytes new. These are CPU-generated byte-integrity fixtures,
  not a native audio render, actual listening, a human UI or model operation.
- One real transaction inserts media/version, source/target-CAS head, stored history
  and unique committed receipt. Eight real SIGKILL boundaries: before-media,
  after-media, after-version, after-head, after-history, after-receipt, before-commit,
  after-commit. A separate process acquires ownership and verifies exact old/all-new
  state, media hashes/dimensions/finite samples and SQLite integrity/foreign keys.
- Before COMMIT, old head/media/history/receipts remain together; after COMMIT,
  new head/media/history/committed receipt remain together. Receipt absence is not
  labelled a fabricated failed/no-commit application outcome.
- Stale source/target guard, duplicate operation receipt and deferred history-FK
  failure roll back exactly, not partially. Stored-version undo/redo restores exact
  original8s/new12s audio without regeneration. A structurally valid, byte-mutated
  PCM BLOB is rejected by hash checks even though SQLite relations remain valid.

Fixture SQL/keys are synthetic, **not** the existing application's dependency key,
operation actor/request ledger or storage port implementation. The demonstration
receipt table has committed entries only. No unfinished/request/actor-ledger,
qualified saved timestamp, production migration/backup/GC or player is introduced.

## Actual results

- Focused tests:19/19 pass, zero skips in this Linux runtime.
- Standalone diagnostic: `diagnostic-pass`,8transaction SIGKILL boundaries,
  live-owner SIGKILL recovery, one contender winner, exact PCM/history/receipt
  atomicity, conflict/constraint rollback and corrupt-BLOB rejection.
- Runtime observed: Node22.22.3, SQLite3.51.3, Linux x64, `electron:null`.
  Node emits its real experimental SQLite warning; not hidden or called stable.
- Session settings read back: WAL, synchronous2/FULL, foreign_keys1,
  busy_timeout0, fullfsync1, checkpoint_fullfsync1. Mutex mode read back DELETE.
  `hardwareFlushProven:false`, `powerLossProven:false`, `productionReady:false`.
- Final diagnostic records compile options, filesystem numeric type/block size,
  exact code hashes, `fixtureCleanup:{childrenClosed:true,rootRemoved:true}`.
  These are evidence observations, not a signing/attestation or acceptance system.
- Full default suite384tests/381pass/0fail/3existing LUFS TODOs; strict47/44pass/
  3known failures expected exit1; sanity PASS. No audio tolerances changed.
- Existing application/domain/audio/storage/host/renderer/test hashes stayed
  unchanged. Native audio/browser/platform runs from earlier slices are historical,
  not rerun or relabelled as this SQLite diagnostic. GUI/build/accessibility/
  performance/manual import/playback/listening checks not executed in this slice.

Early executed failures are retained in review evidence: the first fixture UUID
validator rejected valid UUID variants due to a malformed block length; fixed the
validator (not relaxed fixture identity). The next run correctly exposed that
SQLite synchronous safety settings cannot be changed inside a transaction; moved
connection settings before BEGIN while preserving ownership-before-session-state
validation. All final tests/diagnostics reran successfully after those fixes. An attempted
`npm test` also failed because this repository has no such script; the existing
direct `node --test tests/unit/*.test.js tests/audio/*.test.js` invocation is used,
not a new manifest/runner change.

## Threat/failure limits

Private roots and pinned descriptor identity are safeguards for this fixture, not
security qualification against a malicious same-UID process swapping paths during
SQLite open. SQLite doesn't expose its underlying open FD through this API; a
production pathname/open/registry protocol still needs exact review and testing.
No live lock-file replacement/takeover is adopted. Pinned non-SQLite FDs close
only after releasing this fixture's SQLite ownership connection: POSIX per-process
fcntl lock behavior must not be bypassed by opening/closing another raw FD in a
live owner's process. This diagnostic does not qualify a multi-host/same-process
production registry or arbitrary native-addon/raw-FD interactions. Temporary filesystem success
is not a userData/APFS/cloud-sync/network-volume result. No power cut, disk full,
I/O-fault injection, real app crash/migration/backup or rollback-build compatibility
has been established. Children have a bounded diagnostic timeout, but there is no
production renderer-worker liveness/cancellation qualification.

## Next required environment and separately reviewed package change

The missing input is **actual Mac execution**, not a password/token or another
ordinary design approval. Before the production adapter can proceed:

1. Review a minimal fixed packaged-main diagnostic entry and fixed child protocol.
   Current package includes only dist/electron; these source scripts are NOT shipped.
   Proposed paths are a new main-only diagnostic module plus minimal main dispatch
   and explicit package inclusion; exact diff must be reviewed before adoption.
   Normal app/updater behavior must remain unchanged without an explicit diagnostic
   invocation. No generic evaluate/SQL/path/shell endpoint or preload exposure.
2. In that reviewed entry, observe real `app.isPackaged`, `process.type==='browser'`,
   actual versions/module availability, exact app/asar/executable hashes and included
   fixed worker assets. Reject `ELECTRON_RUN_AS_NODE` as main-process qualification.
   A packaged child must enter its fixed diagnostic mode explicitly, not accept an
   assumed external-script invocation. Unavailable builtin blocks with no fallback.
3. Execute on actual macOS arm64 AND x64/APFS using the reviewed artifact, with
   full recorded outputs. No CI workflow/runner was dispatched, paid service used,
   runtime installed or credentials requested in this sandbox. Signing/notarization
   and any release remain separate, not prerequisites to inventing a runtime result.
4. Then review/implement the ONE repository behind existing storage ports, complete
   durable operation ledger/migration/backup/fault matrix; rerun actual UI/audio
   acceptance before B wiring and real constrained SYLUNE. CORE-015 remains planned.

Until those gates pass, the production adapter/IPC rollout stays blocked. B continues
its unchanged amended COORD-010 visual scope; no frontend interface-ready, worker
receipt/start or visual acceptance is claimed. Save remains session-only/null time.

## Packaged-entry review preparation — later 2026-10-16 continuation

[Exact main-only capability candidate](PACKAGED_RUNTIME_ENTRY_REVIEW.md) is now
prepared as a deterministic two-file patch, NOT applied to electron/main.cjs.
Candidate source remains outside packaged paths. Current electron/** inclusion is
already sufficient for its proposed self-contained destination; no package-config
edit is needed for this capability-only entry. No core modules/workers are thereby
packaged.20source-contract tests pass; positive Electron/Mac/artifact contexts are
explicit VM simulations, never platform evidence. Full suite404/401pass/3known TODOs.

Actual Mac route remains unestablished. Fixed packaged child protocol, ownership/
useful-PCM crash matrix and adapter/full-ledger/migration remain blocked. This does
not relax this runner's Electron refusal or change any readiness flag. No normal
startup/updater/preload/build/dependency/B/app source changes, installation, CI
execution or Git/GitHub publication. See review for exact hashes, limitations and
review/adoption/environment requirements.
