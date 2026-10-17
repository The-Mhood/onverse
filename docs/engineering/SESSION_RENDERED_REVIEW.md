# CORE-014 — opt-in rendered review before approval

> Subsequent opt-in [useful-range continuation](USEFUL_RANGE_PROFILE.md) adds an
> explicitly persisted bounded range profile and chunk reader. This record
> describes the earlier4096-frame profile/evidence; its default remains supported.

2026-10-16. Core-only continuation of [the host foundation](SESSION_HOST_FOUNDATION.md).
**Implemented and tested, submitted for review; not product/interface acceptance.**
No Electron registration, UI/player/provider, production-storage migration, new
application dependency, build configuration, commit, push, merge or release.
Independent B presentation ownership and the amended COORD-010 grant are unchanged.
The production target in [SESSION_APPLICATION_IPC.md](SESSION_APPLICATION_IPC.md)
remains unfulfilled.

## Task, reason and boundaries

The default service previously approved metadata, then rendered during execution.
It could not honestly provide audio for review before final approval. This slice
extends that **same service and facade**, not a second executor or session store:

`capture -> native render -> validate/copy/hash -> prepare (no promotion) -> ready
candidate -> scoped byte reads -> explicit registered-UI approval -> freshness/CAS
-> commit the same prepared token/identity/bytes -> retained history`

`reviewMode: 'rendered'` is an explicit trusted-constructor option on both existing
constructors. Omitting it preserves the metadata-only flow, synchronous metadata
approval, original operation phases and the existing callers. Neither the wire
request nor SYLUNE can select a mode, role, renderer, source code or storage path.

Changed implementation: `src/application/linkedSessions/linkedUpdateService.js`,
`src/application/sessions/{sessionApplication,sessionWireContract}.js`. The service
shares one render-validation-preparation helper between modes. The generation
repository, domain/range schema and native DSP modules are unchanged. The existing
native facade driver gains `--rendered-review`, retaining its default proof.
Focused tests: `linkedRenderedReview.test.js`, `sessionRenderedReview.test.js`,
plus additive `sessionWireContract.test.js` cases. No B-reserved source changes.

## Service lifecycle and opaque authority

Rendered-mode core clients call `beginReview({groupId,targetId})` for a job with
`reviewId`, `phase`, `events`, `completion`, `cancel()` and async `dispose()`.
Completion resolves to `review-ready` with an opaque frozen view, or to actual
`cancelled`/`failed` with the primary error and any cleanup error. Convenience
`await review(...)` also works in rendered mode but cannot provide pending-job
cancellation; the facade deliberately uses `beginReview` instead.

Before preparing media, the service reserves the plan and eventual operation ID.
The ready view binds the captured relevant dependencies/target revision and exact
`previewId`, SHA-256, frames, sample rate and channel layout. The prepared token,
private immutable recipe and private preview buffer never cross the public host
boundary. IDs are lookup keys, not bearer approval capabilities.

`readPreview(view,previewId)` checks opaque view identity, exact preview identity,
read eligibility and current source/target dependencies, then returns independent
verified PCM bytes. `approvePreview(view)` rechecks eligibility/currentness before
issuing the existing private, one-use receipt. The synchronous metadata `approve`
shortcut rejects rendered views. Cloned views/receipts, views from another service,
missing/forged preview IDs and replayed receipts cannot read/approve/execute.

`start(receipt)` reuses the staged operation ID, provenance and prepared token. It
does **not** render or prepare again. Source/target freshness is checked again;
the unchanged repository atomically compares source dependency key and target link
revision inside commit and verifies the durable media checksum. A changed/corrupt
candidate cannot silently regenerate or replace destination audio. Commit exceptions
retain the conservative uncertain/recovery barrier: no potentially promoted media
is discarded. An immutable preview copy is not a substitute for that durable
commit-time checksum/CAS.

## Nonblocking host flow

The metadata-only profile still supports its original nine commands. In rendered
mode `reviewLinkedUpdate` returns a pending handle immediately, not an awaited
render. New exact commands:

- `getLinkedReview({reviewId})`: fresh job/status/events, ready `review` (including
  `planId`, `reviewRevision`, `expiresAt`, preview descriptor), actual non-ready
  outcome and cleanup status. Reusing a query request ID still reads fresh state.
- `cancelLinkedReview({reviewId})`: revoke an unstarted review immediately and
  track its asynchronous disposal. A started operation instead delegates to the
  existing operation cancel barrier; accepted before promotion, too-late after.

The ready review uses the existing `approveLinkedUpdate` / `executeApproved`
interface. Only a trusted host-registered `human-ui` may approve. The proposer or
approving UI may execute. Registered UI clients can inspect/cancel a candidate;
SYLUNE-role clients can inspect/cancel only their own review. No real human click,
actual model/provider integration or authenticated Electron sender is claimed.

A separate core client method, **not an `invoke` command or IPC endpoint**, reads:

```js
await client.readPreview({
  schemaVersion: 1, hostEpoch, projectId, planId, previewId
});
// {schemaVersion, hostEpoch, projectId, requestId:null, ok:true,
//  value:{planId, previewId, sha256, frames, sampleRate, layout, bytes:Uint8Array}}
// or the normal fixed-code public error envelope (no value/bytes).
```

The exact plain-data validator rejects accessors without invoking them, authority
fields, paths, malformed IDs, extra payloads and typed audio input. Reads enforce
host epoch/project/connection, live plan/preview identity, scope, TTL and recovery
state **both before and after asynchronous work**. No request replay cache for
bytes, no raw audio arrays in metadata `invoke` responses. Wrappers/layout are
frozen; returned nonempty typed bytes cannot be frozen and are deliberately a
mutable isolated copy, not a private or storage-owned buffer.

Preview reads do not occupy the short-command queue. They do share its 32 pending
requests/client and 64 global pending limits. Hosts retain at most 64 rendered
review job/status records per lifetime (including terminal records), separately
from the existing 64-plan/operation bounds; explicit capacity errors, not unsafe
registry eviction. Long renders count against review capacity rather than blocking
status/cancellation or consuming command-queue slots until completion.

## Revocation, resource cleanup and uncertainty

- Cancel/discard/disconnect invalidate eligibility synchronously. Cancellation of
  uninterruptible render/prepare is logical: it cannot stop native CPU/I/O, but no
  unapproved or revoked preparation may promote.
- `discard(view)` remains a synchronous eligibility operation, not a false async
  cleanup promise. Direct core users must await `release(view)` or job `dispose()`.
  Shared disposal is idempotent and waits pending render/prepare before unpinning
  the returned token. It never deletes media, including shared/referenced blobs.
- The host observes every disposal task. `discardReview` in rendered mode returns
  cleanup-pending, and `getLinkedReview` exposes pending/completed/failed cleanup.
  Terminal evidence remains available even after the executable plan is removed.
  Cleanup failures are sanitized, force recovery-required and make `close()` reject
  **after still attempting to release storage ownership**; they are not hidden.
- Five-minute default TTL includes rendering time. Expiry and clock rollback are
  enforced at authority/read boundaries and when a job completes; pruning/close
  schedules disposal. There is no wall-clock background-expiry timer. Expired IDs
  never regain eligibility even if staging cleanup has not completed.
- Once execution has started, review disposal never unpins its token. The operation
  owns cleanup until its existing promotion barrier, then owns committed/uncertain
  recovery. Disconnect can request cancellation, not promise a post-barrier rollback.
- `close()` revokes clients/reviews, drains the short queue, operations, review jobs,
  outstanding byte readers and observed disposals, then closes storage. It still
  waits trusted/uninterruptible renderers; no worker timeout/liveness guarantee.

Errors during staging cannot promote. Relevant source edits or target-link
replacement invalidate preview/approval/commit. Unrelated source edits, names and
manual destination processors do not spuriously invalidate; retained processor,
unrelated audio and exact history semantics remain in the existing repository.
Missing restarted operation outcomes remain `OUTCOME_UNKNOWN`; only verified
retained committed provenance is reconciled. This adds no full persisted request/
actor/unsuccessful-operation ledger or qualified application save timestamp.

## Executed validation

Unit audio results below use an explicitly labelled CPU oracle; native checks use
the real existing renderer/OfflineAudioContext, real Linux generation repository,
separate-process media reader and actual destination render.

| Check | Result |
| --- | --- |
| Focused service/host/wire tests (five files) | 72/72 pass: 33 added cases plus existing 39 |
| Full `node --test tests/unit/*.test.js tests/audio/*.test.js` | 346 total, 343 pass, zero fail, 3 existing LUFS TODOs |
| Strict analyzer diagnostic | 47 total, 44 pass, 3 known LUFS failures, expected exit 1 |
| `node scripts/test-analyze.mjs` | PASS |
| Rendered facade native | 4 source renders, 3 ready preview byte/hash/oracle checks, 3 exact candidate commits without rerender; one prepare cancellation |
| Default metadata facade native | 4 source / 4 reopened destination checks, original metadata-only behavior |
| Both facade destination profiles | original/update/undo/redo, max error 3.5762786865234375e-7 < unchanged 2e-6 |
| Existing recovery/native workflow rerun | 37 destination checks; 10 SIGKILL boundaries + normal completion; exact recovery/history retained |
| Both facade/native runs | prepare cancellation accepted; commit cancellation too-late; committed receipt reconciled after host restart; page requests/errors empty |

Added regressions include actual stage-before-approval, no second render/prepare,
independent caller/renderer/adapter bytes, forged/cross-context/replayed authority,
preapproval and postapproval stale source/target, malformed render gates, corrupt
durable media, prepare-hook cancellation without queue deadlock, expiry/rollback,
revocation during byte reads, disconnect/close drains, cleanup failure preservation,
pre/post-promotion cancellation and bounded pending review/byte-read pressure.

Native runtime: Linux Node22.22.3 / HeadlessChrome153.0.8010.0. The previous scratch
toolkit was absent after workspace resumption; restored outside the repository with
approved exact Chromium153.0.0/Puppeteer25.14.0 pins, scripts disabled, 43 packages.
Current independently audited lock SHA-256:
`2a1821c8da0585556791ad1cd0078375b3e2a02aa121e98fa2d3a21e3bb53fd3`.
No application install/lock change. Existing private TMPDIR, allowlisted environment,
offline/request rejection and finally-cleanup browser harness unchanged. Disabled
sandbox flags remain synthetic-proof-only, never Electron configuration.

The first native extended-driver attempt surfaced an assertion-hook identity bug
(the test assigned its operation only after awaiting completion); it conservatively
reported uncertain. Fixed the **driver** to capture the real start ID before commit,
then reran both modes successfully. No failed outcome was relabelled or tolerance
relaxed. Initial new service tests failed 0/10 before implementation; the first
new host run also caught Buffer-versus-Uint8Array assertion typing, corrected to
exact byte equality, not approximate audio acceptance.

Reproduce (approved external toolkit path required for native commands):

```sh
node --test tests/unit/linkedUpdateService.test.js tests/unit/linkedRenderedReview.test.js tests/unit/sessionApplication.test.js tests/unit/sessionRenderedReview.test.js tests/unit/sessionWireContract.test.js
node --test tests/unit/*.test.js tests/audio/*.test.js
MUSICONVERSE_STRICT_AUDIO_REGRESSIONS=1 node --test tests/audio/analyzerRegression.test.js # expected 1, three known failures
node scripts/test-analyze.mjs
node scripts/validation/run-session-application-integration.mjs --tools-dir "$TOOLS" --rendered-review
node scripts/validation/run-session-application-integration.mjs --tools-dir "$TOOLS"
node scripts/validation/run-linked-session-integration.mjs --tools-dir "$TOOLS"
```

## Limits and next acceptance

This is still the experimental 48kHz L/R **4096-frame (~85ms)** profile. Native byte
access is not useful-length musical audition, actual listening, UI playback or an
app quit/reopen test. `playbackTransport`, `applicationPersistence`, `productionReady`
and selection mutation remain false; save state remains session-only/null time.
No GUI/build/accessibility/visual acceptance is inferred from this core-only diff.
No controller, import/analysis/reference/manual processing/playback/crop/conversion
presentation file was modified; full existing core regression suite passed, but
those GUI workflows were not manually exercised in this slice.

Next contract gate: useful musical ranges with bounded render/storage/byte transport
budgets and honest cancellation/cleanup. Then production storage/full operation
ledger/migration and packaged macOS ownership/recovery evidence; authenticated narrow
IPC/package inclusion; B-owned render->audition->explicit approval->update->playback
->history->quit/reopen; constrained real SYLUNE tools on the **same** services. These
are separate integration acceptance gates, not functioning-looking controls to add
now. Existing LUFS/true-peak/gain risks and review/shipping hold remain explicit.
