# CORE-009 — reconstructed Linux interruption/recovery fixture

Fresh reconstruction on 2026-10-15, **not recovery of the unavailable historical
patch or its bytes**. Base: `2faa3939b9e109e5a9ed2e0d53130dc51c5abc9e`.
Owner-authorized reconstruction; lead/core on fixed branch
`arena/14df8ffa-onverse`. Isolated Node built-ins only; no application imports, user media, network, UI,
production schema, repository adapter or Linked Sessions implementation.

## Reproduce

```sh
node --test tests/unit/linkedMediaRecoveryProbe.test.js
node scripts/validation/linked-media-recovery-probe.mjs
```

Linux only. Tests explicitly skip on other platforms; CLI reports unsupported
platform as skipped, never passed. Roots use `mkdtemp` below the real system temp
directory, private permissions, a UUID owner marker, expected prefix/parent and
realpath checks. Opened files use `O_NOFOLLOW`, bounded regular-file reads and
exclusive creation. Regular-file reads use a fixed maximum allocation, and
nonblocking opens reject special files without waiting for a pipe writer.
No automatic cleanup: roots/stages are retained for inspection.
Child modes invoke only this fixed script through `process.execPath`; CLI has no
arbitrary-folder initialization mode. These checks are fixture containment, not
protection against a hostile same-UID process racing directory entries.

## Mechanism and fixture

Four interleaved stereo Float32 frames at 48 kHz, including values above unity.
These are **precomputed PCM fixtures, not native render output**. Fixed immutable
g0/g1 generations bind exact bytes/checksums, source revision, operation, unrelated
media, gain -3 dB, EQ 1000 Hz/-2 dB, placement frame 120, and g0 retained history.
Preserving this metadata does not prove audible destination processing.

Writes handle partial progress. Each new stage is exclusive and file-synced;
immutable publication uses hard links without replacement (EEXIST must match).
Directories are synced. Generation and journal are published before candidate
validation. A synced pointer is renamed over HEAD on the same filesystem, then
the directory is synced. Stages remain deliberately; no garbage collection.

Readers run in fresh processes. Complete valid HEAD wins even with a corrupt
pending journal. Otherwise only the journal's complete validated **previous**
generation can be read, with `needsRepair=true`; no writes are allowed until
explicit repair (out of scope). No scanning newer files/automatic roll-forward.
Media, unrelated media and retained history must all validate. Fixed exact schema
bytes intentionally constrain this experiment; it is not a general manifest API.

## Executed evidence

Environment: Linux x64, Node 22.22.3; observed filesystem type `0xef53`.

- Storage tests: **31 tests / 31 passes / 0 failures / 0 skips**.
- All ten writers emitted the exact reached marker and exited via **SIGKILL**.
- Tests independently inspected stage content/length and publication presence.
  `media-partial` contained exactly 16 of 32 bytes, matching the expected prefix.
- Before pointer rename (eight boundaries): fresh reader opened g0.
- After pointer rename and directory sync (two boundaries): fresh reader opened g1.
- Normal completion: g1; over-range Float32 bytes, old media, history and unrelated
  media preserved. Retry after commit made no additional file/inode/mtime/content
  changes; pre-promotion retry preserved published immutable inodes/content.
- Missing/malformed/oversized/traversal/forged pointers, missing/corrupt generations,
  truncated/same-length-corrupt media, broken history/unrelated media, invalid
  journals, immutable collision, wrong owner/non-temp roots and matching-byte
  foreign symlinks exercised. Fallback reads did not mutate files; writes refused.
- Negative mutation in a **scratch copy only** replaced `O_NOFOLLOW` with zero.
  The matching-byte foreign symlink rejection assertion then failed with
  `Missing expected rejection`. Real source was never mutated.

The executed CLI report is `/tmp/onverse-storage-report.json`; it records eleven
retained artifact roots. The scratch mutation is under
`/tmp/onverse-nofollow-mutation-wgARFa`. These paths are local diagnostics, not
portable deliverables. Reproduction creates new roots and owner tokens.

## Limits and next gate

SIGKILL proves process-restart visibility on this host, **not physical power-loss,
OS reboot, storage cache/barrier durability or fsync portability**. No macOS,
Windows, network volume, multi-writer, GC, cancellation-race, Electron IPC or full
project transaction is proved. Native rendering is the separate
[CORE-010 experiment](OFFLINE_RENDER_PROBE.md). Their coexistence is not integration.

After review/publication: accept minimum identity, snapshots, exact dependencies,
manual prepare/commit, compatibility and cancellation/promotion contracts; then
join actual rendered bytes to this failure-tested mechanism. Keep prior valid
audio and destination processing intact. No production contract is accepted by
this report.
