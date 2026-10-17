# CORE-014 — bounded useful-range prerequisite

2026-10-16. **Experimental, submitted for review, not accepted/integrated/shipped.**
Extends the SAME domain/audio/service/host/Linux generation repository from
[rendered review](SESSION_RENDERED_REVIEW.md), not a duplicate executor or UI store.
No B presentation, Electron/preload, dependencies, manifest/build, production
SQLite adapter or provider changes. No commit, push, merge or release. CORE-015 (the real integrated application workflow)
is still planned; this submitted prerequisite does not complete or accept it.

## Task and explicit contract choice

Raise the ~85ms fixture limitation through a trusted **opt-in profile**, with real
nonzero selection origins, bounded memory/transport and persisted exact geometry.
Changing just the renderer length would leave codec/storage/approval mismatches.
The held review patch therefore changes the shared contract and its existing
adapters together. This is not automatic app rollout or an existing-store migration.

`renderProfile: 'linked-selection-range-v1'` must be supplied explicitly to trusted
constructors. `reviewMode: 'rendered'` is required for this new profile. Default
`linked-selection-integration-v1`, its exact canonical dependency keys, fixed4096
geometry, metadata/rendered review modes and schema1/2 behavior remain supported.
Profile is NOT a wire request/role/model-chosen capability or mutable global limit.
Unknown strings/objects, incompatible host/storage profiles and extra wire fields
fail closed. There is no generic caller-provided renderer configuration.

| Range profile policy | Exact limit |
| --- | --- |
| Audio | 48000 Hz, L/R, canonical finite Float32LE, no clipping/normalization |
| Selection length / source clip length | 1–1440000 frames (up to30seconds) |
| Source timeline | 0–14400000 frames (five minutes), track end within bound |
| Source inventory / selected members | Existing16 / 8 limits retained |
| Snapshot media / repository initial assets | 64 MiB each (logical bytes; repeated references charged) |
| Selected source media | 32 MiB, checked before asset loads/native graph |
| Retained linked versions | 64 MiB logical frames total, existing64-version count retained |
| Staging | 32 MiB AND at most2 candidates, reserved before copying/awaiting |
| Preview read | At most256KiB, stereo-frame-aligned offset/length, at most2 concurrent host reads |
| Destination placement | 0–1440000frames; output covers linked/unrelated audio plus4096tail frames |

These are experimental engineering budgets, not a professional DAW track/song cap
or an OS memory/disk/liveness certification. Native graphs, channel arrays, hashes,
validation/copies and protocol encoding have bounded **additional** overhead;32MiB
staging is not a claim the process RSS stays below32MiB. Retained version/media
budgets are logical current-state bounds, not quota/reclamation for orphan files,
lineage metadata, quarantines or repeated abandoned sessions. No media is deleted
by cancellation/guess; explicit quarantine/reclamation remains separate.

## Files and one authority

- `src/domain/linkedSessions/renderProfiles.js`: frozen allowlisted profiles and
  exact frame/range policy. No clocks/audio/persistence/UI state.
- Existing `linkedSessionContract.js`: optional trusted profile; integer range and
  timeline validation; selected media budget; canonical dependencies bind profile,
  engine, exact range, ordered membership and relevant source parameters. Labels
  and unrelated whole-session revision changes remain metadata-only.
- Existing `pcm.js`, `renderSelection.js`, `renderLinkedDestination.js`: optional
  profile; bounded dimensions before audio copying; crop/timing and native tail.
- Existing `linkedUpdateService.js`: captured frame geometry, fixed reserved
  provenance/identity/token, range-aware validation, two-candidate reservations,
  copied chunk read. SAME approval/execution/cancellation/recovery barrier.
- Existing `generationStore.js`: experimental schema3 profile header and variable
  version geometry derived from verified canonical provenance; SAME lock/CAS/
  atomic pointer/history/lineage/quarantine protocol. No production storage claim.
- Existing `sessionApplication.js` / `sessionWireContract.js`: explicit capabilities,
  profile compatibility, two live candidates/read limits, exact chunk validator.
- Existing native harness extended with bounded base64 fixture transport and static
  profile module; new `run-session-range-integration.mjs`, `linkedRangeFixture.js`
  and `linkedRangeProfile.test.js` provide real/labelled-oracle regression evidence.

## Range render semantics

Selection `[rangeStartFrame,rangeEndFrame)` has output frame0 at the selected source
origin, not session origin. For each selected clip:

- Native start = `max(0,track.startFrame-rangeStartFrame)`.
- Native source offset = `max(0,rangeStartFrame-track.startFrame)`.
- Duration = minimum of remaining clip and remaining selected output.
- No overlap produces silence; starts exactly at the exclusive end do not sound.
- All selected media, including muted and out-of-window clips, must still pass
  dimensions/checksum validation before a graph is constructed. No skipped corrupt
  dependencies, silent rebinding or JS-summing fallback.

Gain/mute order and exact immutable media identity are retained. Native offline
render is still uninterruptible: cancellation revokes promotion eligibility and
disposal drains rendering/preparation; it is not a CPU abort or worker timeout.

The destination keeps existing processors and unrelated audio. Native range input
is zero-padded through the **declared4096-frame tail** so graph deactivation cannot
truncate filter state immediately at source end. This does not promise arbitrary
natural EQ/reverb/plugin tail completion. Low-frequency/high-Q settings may need
more than this experimental fixed tail; production tail policy remains a separate
acceptance item. No loudness/true-peak/gain fix or listening claim is inferred.

## Persistence compatibility and fail-closed checks

New range stores are created as experimental `schemaVersion:3` with exact
`renderProfile:'linked-selection-range-v1'`. Source snapshot shape remains the
existing version1 shape under that explicit persisted profile. Versions retain
existing fields; their geometry is recovered from validated canonical dependency
selection/profile, not a mutable current selection, filename, guessed byte count
or assumed4096. Thus8s/12s/30s historical versions keep their exact original bytes.

Existing schema2 stores still write schema2; schema1 remains read-only. No existing
head is silently widened, rewritten, converted or migrated. Mixed-profile/schema
lineages, bad geometry/provenance/checksums and unsupported headers cannot acquire
a valid resumed writer. The permanent Linux writer protocol is otherwise unchanged;
this does NOT qualify macOS/Electron ownership, migration or power-loss behavior.

Repository staging count/byte reservations include queued/in-flight/active prepares
before large defensive copies. Separate services cannot evade the shared repository
budget. Commit-time profile/source/target/media checks still apply atomically. A
retained-version quota failure occurs before new publication, preserves last-valid
head, and is conservatively uncertain to the service after entering its barrier;
no false failure/no-commit guarantee or automatic retry. Close/reopen/reconciliation
remain explicit. Reachability/unpin/quarantine handle larger bounded media safely.

## Scoped chunk API, not playback or IPC

Range-profile core clients must supply exact fields:

```js
await client.readPreview({schemaVersion:1, hostEpoch, projectId,
  planId, previewId, offsetBytes, lengthBytes});
// ok/value includes frames/sampleRate/layout, whole-candidate sha256,
// offsetBytes, totalBytes, chunkSha256 and an independent bytes:Uint8Array.
```

Offsets/lengths are safe integers, multiples of8, length8..262144, with the entire
interval inside the candidate. Missing/unbounded/full-array reads fail. Wrong
ranges/context/scope do not consume a good candidate. Every read checks currentness,
TTL/connection/recovery/plan identity and repeats eligibility checks after async
work. Expiry/discard/start/disconnect while reading cannot return late eligible
bytes. Existing five-field whole-preview input remains unchanged for the4096 profile.

Reassembly is by exact offsets/total size; verify chunk hashes and the complete
candidate SHA. No mutable storage/private buffer is returned. Approval remains the
same one-use private host receipt, tied to that candidate; execution reuses its
prepared token/operation/provenance without render or prepare again. Chunk retrieval
is not proof a human listened or clicked a real UI. There is still no registered
Electron endpoint/player/provider or general arbitrary-asset read access.

Capabilities report `frames:null`, `maxRangeFrames`, `maxTimelineFrames`, candidate
and chunk limits for the range host rather than claiming fixed4096 or arbitrary
length. Playback/selection mutation/production/app persistence remain false. Save
status stays session-only/null timestamp. B must not wire fictional functionality
from this core status; amended independent COORD-010 visual scope is unchanged.

## Executed evidence and unchanged acceptance thresholds

- New range tests:19/19. Combined focused domain/codec/audio/service/host/wire:
  **118/118**. Unit render/graph fixtures are explicitly CPU or wiring spies,
  not substitutes for native rendering.
- Full default suite: **365 tests,362pass,0fail,3existing LUFS TODOs**.
- Strict analyzer:47/44pass/3known failures, expected exit1. Sanity PASS.
- Actual native source renders: **8s,12s,12s(cancelled),30s**, zero sample error
  against independent CPU crop/gain/mute oracle. Source start is0.1s, not zero.
  The30s boundary includes real generated signal followed by silence, not30s of
  continuously nonzero music; no hardware/listening certification.
- Ready candidates: **12/18/44 bounded chunks**, whole SHA verified after reassembly,
  caller mutation isolated,3commits reuse exact opaque tokens/bytes; no execute
  rerender/reprepare. Four actual source renders and four prepares total, one
  prepare cancellation; commit cancellation too-late.
- Actual separate-process reopen/destination renders:8s original,12s update,
  undo8s,redo12s,30s boundary. Max error **1.043081283569336e-7**, unchanged limit
  **2e-6**; exact destination parameters/unrelated audio retained.
- New range SIGKILL boundaries: large `media-partial`, `pointer-synced`,
  `pointer-renamed`; exact old/new audio, writable recovery, explicit orphan
  quarantine, postcommit stored undo; verified native candidate bytes are replayed
  by the child as immutable input, not falsely claimed as a new native child render.
- Old4096 native facade modes rerun (metadata and rendered):4destination checks
  each; old37destination/10SIGKILL+normal recovery proof rerun; max error remains
  3.5762786865234375e-7. Page requests/errors empty in all native proofs.

The first8s native destination check **failed honestly** at source end:
max error0.0222318135201931, worst channel0/frame384257, actual0 versus
expected-0.0222318135201931. Zero-padding range input through the declared tail
fixed the actual graph-lifetime issue. No oracle/tolerance relaxation, cropping
away failing samples or relabelled outcome. The complete fixed outputs pass.
The old4096 path is kept separate and rerun, not assumed compatible.

Approved external proof toolkit restored because prior temporary folders were
absent in the resumed runtime: Chromium153.0.0/Puppeteer25.14.0,43packages,
scripts-disabled/pins/integrities audited, private TMPDIR/offline rejection/
allowlisted environment/finally cleanup. Current lock SHA:
`b5876866c0e2cd4b94077619e2f0df4e7ea6727b213f8c20019bb7c846907e78`.
No application install/lock change. Final validation also detected the older
harness closed browsers/restored the environment but retained extracted runtime
directories. This scoped harness now removes only its own validated private runtime
after confirmed browser close, and preserves primary/cleanup failures; it retains
the runtime if browser termination is uncertain. Disabled sandbox remains
synthetic-proof-only.

Reproduce with the existing approved external toolkit:

```sh
node --test tests/unit/linkedRangeProfile.test.js
node --test tests/unit/*.test.js tests/audio/*.test.js
MUSICONVERSE_STRICT_AUDIO_REGRESSIONS=1 node --test tests/audio/analyzerRegression.test.js # expected 1
node scripts/test-analyze.mjs
node scripts/validation/run-session-range-integration.mjs --tools-dir "$TOOLS"
node scripts/validation/run-session-application-integration.mjs --tools-dir "$TOOLS" --rendered-review
node scripts/validation/run-session-application-integration.mjs --tools-dir "$TOOLS"
node scripts/validation/run-linked-session-integration.mjs --tools-dir "$TOOLS"
```

## Outstanding acceptance / next gate

Review the new held profile/schema/transport policy before integration. Still not
an application-facing workflow or full professional DAW. Production storage/full
operation ledger/migrations, packaged macOS ownership/recovery, qualified save
receipts/timestamps and bounded worker/tail/resource-pressure behavior remain.
Then authenticate and register narrow IPC/package inclusion; B owns real
render->audition->explicit approval->update->playback->history->quit/reopen UI;
real constrained SYLUNE uses these SAME services. Existing import/analyze/reference/
manual process/playback/crop/conversion controllers/presentation were untouched;
core regression passed, but no GUI/manual listening/build/accessibility/performance
or visual acceptance is claimed. No merge/release authority or B receipt/start.
