# CORE-012 — bounded Linux writer recovery and orphan quarantine

2026-10-16. Lead-owned experimental core contract, not a production IPC/UI API.
Supersedes the second slice's intentional permanent crash-writer block **only
for newly created schema-2 stores using this protocol**. No dependency, build,
Electron, presentation or existing-session migration changes.

## Ownership protocol: `linux-flock-fd-v1`

- Creation writes a private permanent `.writer-lock` containing the profile and
  store owner UUID. Never unlink, replace or quarantine this inode. Existing
  schema-1 roots do not acquire a new marker or get silently migrated.
- `linuxWriterLock.js` uses the already-installed **`/usr/bin/flock`**, a Linux
  OS/runtime dependency, not a Node built-in lock, npm native addon or bundled
  portable Electron implementation. Its canonical executable must be a
  root-owned regular file, not group/world writable. Missing/unsafe helper or
  unsupported platform fails closed. No fallback lease/PID algorithm.
- Open the lock with NOFOLLOW/NONBLOCK; validate private ownership, single link,
  marker bytes and named/open descriptor identity. Invoke the fixed executable
  with fixed exclusive/nonblocking arguments and inherited descriptor 3; no
  shell, supplied command/path, inherited loader environment or unbounded output.
  Timeout is 3 seconds. Conflict exit 73 becomes `WRITER_BUSY`.
- On Linux `flock(2)` follows the inherited **open file description**. Node keeps
  its descriptor after the helper exits; closing it or process death releases
  ownership. It is never exposed to callers. There is no deliberate descriptor
  inheritance to arbitrary workers. The fixed helper does not execute a command.
- `.writer` is retained diagnostic epoch JSON: exact profile, store owner,
  random epoch ID and PID. PID existence/reuse does **not** grant or prevent
  ownership. Neither the epoch filename nor an elapsed timeout is the OS lock.
- A writable opener must first win the kernel lock, then validate CURRENT,
  generation/journal checksums, every committed parent and all referenced media.
  Reject unknown profiles/epoch records, legacy lineage, cycles, excess depth,
  unsafe files and corruption. Never scan for a replacement CURRENT or guess a
  rollback. No epoch is published until this validation succeeds.
- Write/sync a fresh exclusive `writer-epoch-<UUID>.tmp`, rename it atomically
  to `.writer`, sync the root directory. Crashes before/after rename leave an
  old/new valid diagnostic epoch; retry still requires kernel ownership and
  complete validation. Initialization failure without a valid CURRENT is not
  automatically reconstructed.
- The serialized writer queue rechecks root/descriptor/epoch ownership at entry
  and before pointer rename. Close drains already queued operations, refuses
  new ones, releases the descriptor once, retains metadata/inode and shares its
  cleanup promise. Open failure releases an acquired descriptor; combined open/
  cleanup errors are retained. An I/O failure after publication can poison the
  handle; reopen validates committed reality rather than fabricating rollback.

The profile permits at most 256 committed generations, 64 versions and 64 active
preparations. Generation capacity is checked **before** writing a new generation,
so an accepted publication cannot exceed recovery's lineage bound. These are
integration-profile limits, not final DAW limits. Root/media bounds and exact
freshness/cancellation barriers remain those of the preceding slice.

## Explicit audit and quarantine, never deletion

Writable `inspectOrphans()` runs under the queue/kernel owner and returns a frozen
report plus an opaque, handle-local plan identity. There is **no automatic cleanup
on open**, no imported JSON command, no deletion API and no orphan promotion.

The protected set contains CURRENT, owner/epoch/lock, **all** committed ancestors'
generations and journals, every registered asset and retained version from every
ancestor (including shared/history-only media), and all active preparation blobs.
Source/destination registered media are protected regardless of current selection.
Discard only unpins a preparation; it does not remove a shared blob.

Audit scans at most 2048 root names. Candidates are only bounded private regular
single-link files with adapter-generated media, generation, journal, pointer-temp
or writer-epoch-temp names. It records bytes/hash/device/inode. Unknown names are
reported and preserved; symlinks/unsafe candidate files are reported and never
followed/moved. Existing quarantine directories are listed but not traversed,
interpreted, restored, promoted, reclaimed or treated as authority.

`quarantineOrphans(theExactReportObject)`:

1. Revalidate ownership, complete committed reachability, current generation,
   active preparation fingerprint and every candidate's identity/size/hash.
   Forged/copied/used plans, changed candidates and stale snapshots reject.
2. Create private `quarantine-<UUID>`, write/sync an exclusive manifest with base
   generation and exact file records, sync quarantine/root directories **before
   moving any file**. A crash while writing a manifest moves nothing.
3. Recheck reachability/preparations/candidate and descriptor before each rename;
   rename within the same root filesystem, sync both directories after each move.
   CURRENT, committed lineage, processing and unrelated audio are not modified.
4. An interrupted archive remains retained evidence, possibly a subset of its
   manifest. It is not an all-or-nothing transaction. After a crash, acquire a new
   writer, validate current state and request a **new audit** for remaining root
   candidates. Never replay imported manifest paths or delete an archive. This
   makes repeat recovery safe without pretending an old plan is resumable.

Failure after quarantine creation poisons that writer handle. Partial progress
is not silently rolled back; close/reopen and inspect again. Empty plans return
`nothing-to-quarantine`. Quarantine intentionally consumes disk; storage-pressure
policy, migration, archive restoration and eventual reclamation require review.

## Executed validation

- First killed-writer resumption regression failed against the preceding adapter
  (`WRITER_BUSY_OR_STALE`), then passed against kernel ownership.
- 16 writer-recovery tests: killed owner, live exclusion, two simultaneous
  recoverers with exactly one winner, live/reused diagnostic PID, absent/legacy
  profile, corrupt epoch/media/lineage, failed-open descriptor release, repeated
  close, lock identity tampering, real schema-1 read-only compatibility, generation
  capacity, opaque/stale/changed plans, active preparation protection, unknown/
  unsafe files, and crash/retry checkpoints.
- Actual SIGKILL at five recovery checkpoints: lock acquired, validation complete,
  epoch synced, epoch renamed, epoch directory synced. Actual SIGKILL at three
  quarantine checkpoints: manifest synced, orphan moved, quarantine synced.
- Full default core suite: **290 total / 287 pass / 3 existing LUFS TODOs**;
  strict analyzer: **47 / 44 pass / 3 known failures**, expected exit 1. Sanity
  passes. These existing audio defects were not hidden or weakened.
- Native real-repository driver repeats ten commit SIGKILL boundaries plus normal
  completion. Each case verifies byte-exact old/new CURRENT, writable recovery,
  explicit audit/quarantine, fresh reviewed/approved update, separate reader,
  unchanged unrelated audio, native destination processing and undo/redo, then a
  second clean writable reopen. Partial conflicting content-addressed media is
  quarantined before re-preparing the same complete bytes.
- Chromium **153.0.8010.0**, Node **22.22.3**, approved exact scripts-disabled
  43-package external toolkit. Four ordinary plus 33 post-recovery native
  destination renders: maximum error **3.5762786865234375e-7**, unchanged limit
  **2e-6**; native source checks pass; page requests/errors empty. Toolkit root and
  browser runtime are private and outside app dependencies; browser sandbox
  disabling is synthetic-proof-only, never Electron configuration.

```sh
node --test tests/unit/linkedGenerationStore.test.js tests/unit/linkedGenerationRecovery.test.js tests/unit/linkedWriterRecovery.test.js tests/audio/linkedDestinationRender.test.js
node --test tests/unit/*.test.js tests/audio/*.test.js
MUSICONVERSE_STRICT_AUDIO_REGRESSIONS=1 node --test tests/audio/analyzerRegression.test.js
node scripts/test-analyze.mjs
node scripts/validation/run-linked-session-integration.mjs --tools-dir <approved-private-toolkit>
```

## Boundaries, not certification

Cooperating trusted adapter processes on this observed Linux/local filesystem
only. No guarantee against malicious same-UID/root mutation, external lock-file
replacement, descriptor theft/inheritance, untrusted helper replacement, network
filesystems, hardware/power loss, disk exhaustion or process-tree attacks. A
validated path/helper is not a hostile-filesystem attestation. SIGKILL is not a
power-cut test. No macOS/Windows/Electron packaging, listening, security, audio
standards or release certification. Production locking/platform packaging still
needs architecture review; old stores need an explicit offline migration policy.

No UI/IPC wiring, full DAW database/engine or functional SYLUNE execution is added.
Agent B's COORD-010 full visual authority remains independent and untouched.
Next: review this bounded protocol, then separately coordinate authoritative
application/IPC/session interfaces and production platform ownership. Passing
this probe must not enable unsupported UI controls or fabricate AI execution.
