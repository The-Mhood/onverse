# Production session persistence — architecture decision under validation

2026-10-16. **Selected direction, not accepted packaged implementation.** No
production dependency, build/Electron configuration or current storage code is
changed by this record. The Linux generation adapter remains experimental.

## Decision and alternatives

Use one main-process-authorized project host and a SQLite repository adapter.
Prefer Electron's bundled `node:sqlite` if actual runtime verification passes;
no native npm addon or external system executable is adopted. SQLite is a storage
adapter behind existing domain/application ports, not a second implementation of
Linked Sessions or SYLUNE operations.

Keep project state, immutable canonical media BLOBs, version/provenance/history
and committed operation receipts in **one transactional `session.sqlite`** for
the first usable bounded workflow. This deliberately avoids an unreviewed
external-media/metadata two-phase commit. Large-session external blob streaming
and reclamation are a later reviewed storage evolution, not assumed solved.
The existing filesystem generation repository is a regression/reference adapter,
not an alternative live authoritative store for the same open project.

Rejected for initial packaged storage: shipping Linux flock; PID/time-based lease
cleanup; lock-directory stale deletion; renderer localStorage/IndexedDB as the
project authority; a second SYLUNE database; an unreviewed native npm addon.
Electron's application single-instance lock is useful startup routing, **not**
the entire project ownership protocol.

## Evidence and open runtime gate

Repository lock pins Electron44.2.0. Its tagged upstream `DEPS` declares
Nodev24.20.0. Nodev24.20.0 documents `node:sqlite` as stability1.2/release candidate.
This is source evidence, not proof of the shipped Electron binary's modules or
macOS support. The sandbox has standalone Node22.22.3/SQLite3.51.3; its SQLite
module emits an experimental warning. No Electron or macOS binary was executed.

Sources read via authenticated GitHub API, not arbitrary web pages:

- [Electron44.2.0 DEPS](https://github.com/electron/electron/blob/v44.2.0/DEPS)
- [Electron44.2.0 app lock documentation](https://github.com/electron/electron/blob/v44.2.0/docs/api/app.md#apprequestsingleinstancelockadditionaldata)
- [Electron44.2.0 IPC API](https://github.com/electron/electron/blob/v44.2.0/docs/api/ipc-main.md)
- [Node24.20.0 SQLite API](https://github.com/nodejs/node/blob/v24.20.0/doc/api/sqlite.md)

`probe-sqlite-ownership.mjs` executed in standalone Linux Node, using synthetic
four-byte BLOBs: live owner excluded; killed owner releases; two contenders have
one winner; SIGKILL before COMMIT retains old head/no staged media, SIGKILL after
COMMIT retains new head/media; integrity/foreign-key checks pass. It deletes only
its newly created synthetic temp root on completion. No existing project data is
opened. This is **not** native audio, a production adapter, power loss or APFS proof.

## Runtime prerequisite tooling — 2026-10-16 continuation

The validation-only [runtime qualification record](SESSION_RUNTIME_QUALIFICATION.md)
now exercises real builtin SQLite with generated8s/12s PCM BLOBs, lifetime rollback-
journal ownership, contender/owner-death recovery,8transaction SIGKILL boundaries,
receipt/head/history atomicity, exact-byte history and corrupt-BLOB rejection.
It is **not** an application adapter, production schema or full operation ledger.
Unknown/missing fixture ownership and unknown/future schemas fail closed.

Observed here: standalone Node22.22.3 / SQLite3.51.3 / Linux x64, no Electron/Mac
execution. Report remains `productionReady:false`; Electron invocation deliberately
blocks pending a reviewed packaged-main entry, rather than guessing app CLI behavior.
Accepted flush PRAGMAs and fixture file-identity checks are not APFS/hardware or
same-UID attack qualification. Experimental schema1/2/3 stores are not production-
migrated. **The actual packaged macOS gate and adoption order are unchanged.**

## Ownership, persistence and recovery contract

- Main process owns the project registry and application service; renderer and
  SYLUNE receive projections and scoped commands, never DB handles/SQL/paths.
- Canonical private application-managed project directories outside app.asar,
  under the application's userData project root; stable project/store identities.
  First scope is local storage, not network/cloud-sync concurrent writers.
  User import/export and future portable project locations are explicit operations,
  not arbitrary renderer filesystem paths. Do not open a synced copy live.
- One permanent `ownership.sqlite` per store is a **mutex only**, not another
  session database. A dedicated connection holds `BEGIN EXCLUSIVE` in rollback-
  journal mode for the entire writable host lifetime. It does not store leases
  that authorize a writer. No PID/deadline takeover; kernel/SQLite lock release
  on connection/process death is the candidate recovery mechanism. Never unlink,
  replace, restore-over or quarantine this file while a host can own the store.
- Acquire that ownership before validating or migrating writable state. Revalidate
  private root/file identity and profile. Missing/unknown ownership metadata in an
  existing store fails closed; no auto-creation that could bypass an older writer.
  The exact creation/identity protocol must be implemented/tested before shipping.
- State connection: WAL, foreign keys on, FULL synchronous writes; serialize every
  source/selection/target/history mutation through one host queue. Candidate Mac
  fullfsync/checkpoint_fullfsync options require actual runtime/filesystem tests;
  accepting a PRAGMA is not proof of hardware flush. Sync project creation paths
  before advertising persistence. Verify all settings, never assume defaults.
- Publish metadata, exact media/provenance, history pointer and operation receipt
  together in a transaction. Unique operation IDs and compare-and-swap expected
  source dependencies/target revision protect replay/freshness. No "saved" event
  before the transaction and required durability steps acknowledge success.
- Cancel before the transaction barrier revokes eligibility; cancel after barrier
  is too-late. Lost connection/ambiguous commit returns outcome-unknown; reconnect
  queries a durable receipt and verified project head before permitting replay.
- On reopen, acquire ownership, allow SQLite journal/WAL recovery, validate schema,
  integrity/relations and referenced audio hashes/dimensions/provenance before
  writable services. Do not scan for a guessed newer version or silently roll back.
  Failures leave the project preserved and report a recovery-required state.
- Renderer close is not permission to truncate the WAL or delete lock files.
  Main drains/finishes eligible commits, closes connections and releases ownership;
  forced quit relies on the tested transaction/recovery protocol. Reopen must
  restore exact media/history/processing, not regenerate audio from live sources.
- Keep retained/history/shared media. Initial slice has no destructive GC.
  Backups use a consistent SQLite snapshot, not arbitrary copies of a live DB
  without its WAL. Export/import gives the new copy a fresh store identity and
  fresh ownership setup while preserving relevant session/version IDs.

## Migration and compatibility

- New production DBs have explicit schema/profile versions; future-version DBs
  are read-only/refused, never downgraded. Transactional versioned migration under
  ownership, a verified backup and restart-safe migration tests are required.
- Do not migrate Linux schema1/2 roots in place or add a lock to an old store.
  Provide an explicit offline **import into a new project directory**, reading a
  chosen verified committed snapshot plus all retained media/history. Recheck
  the source pointer and checksums; changes during capture require retry/review.
  Never write or delete the source. Make a migrated-copy/fork visible to the user;
  do not claim this stops an incompatible old application from writing its copy.
- Validate the imported copy through a separate reader before switching the
  application registry. Failed/interrupted imports remain unselected staged copies;
  restart does not adopt them by directory scan. Original remains usable/preserved.
- A rollback of the app must not let an old build overwrite a newer schema.
  Real production app files and old projects have not been migrated in this pass.

## Packaging/security gate

Current package includes dist/electron only. A reviewed main-process bundle and
fixed worker asset entry must be explicitly included and inspected in app.asar.
No filesystem/SQLite in the sandboxed UI preload; no relaxation of sandbox or
context isolation. Keep updater routes separate. No system-helper/native-addon
fallback. Any unavailable built-in stops this path with an actionable capability
error; adoption of an alternative dependency is a separate narrow decision.

## Completion criteria before calling production storage settled

Run the same protocol in development **and packaged Electron44.2.0**, on macOS
arm64 and x64/APFS: builtin availability/version; two app starts and competing
project opens; live exclusion; killed owner; all migration/commit boundaries;
failed-open/close release; dirty/WAL recovery; corruption; useful audio BLOBs;
disk-full/I/O failure; consistent backups; old/future-schema refusal; repeated
close/reopen and exact history; package artifact inclusion and security checks.
Record actual process.versions, SQLite compile/settings, OS/filesystem and artifact
hashes. No signing credentials are requested. Signing/notarization/release checks
remain separate; no package release is authorized.

If this gate fails, document the failure and review the smallest alternative.
Do not compensate with guessed stale-lock removal or a new parallel session model.
