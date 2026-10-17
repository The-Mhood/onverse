# CORE-014 — shared application facade foundation

> Historical foundation record. The subsequent additive opt-in
> [rendered-review slice](SESSION_RENDERED_REVIEW.md) extends the existing service,
> facade/wire and this driver. The metadata-only default and original evidence
> below remain; old-source-unchanged statements describe this earlier slice only.

2026-10-16. Implemented core-only slice, **not Electron IPC, production storage or
an integrated user-facing Linked Sessions/SYLUNE workflow**. No old core source,
B presentation, Electron, dependency, manifest or build files changed. No commit,
push, merge or release. Production target remains [SESSION_APPLICATION_IPC.md](SESSION_APPLICATION_IPC.md).

## Implemented files / one authoritative operation path

- `src/application/sessions/sessionApplication.js`: trusted host constructor wraps
  the existing `createLinkedUpdateService` and real repository ports. No copied
  rendering/approval/commit/history algorithm or second authoritative session store.
  Every projection reads the actual repository; private registries hold only
  connection, review/approval and live-operation control state.
- `src/application/sessions/sessionWireContract.js`: exact bounded serializable
  request validation, canonical copying/freezing and allowlisted public errors.
  Validators are **not** Electron sender authentication.
- `tests/unit/sessionApplication.test.js`, `sessionWireContract.test.js`:23new
  tests, including actual Linux filesystem state changes/reopening. Audio fixtures
  in unit tests use an explicitly identified CPU oracle, not native-render proof.
- `scripts/validation/run-session-application-integration.mjs`: reproducible native
  harness drives the same facade/service/repository, no frontend/application mock.
  Programmatic registered roles are test fixtures, not an actual human/LLM provider.

Trusted core creates a host with projectId/storage/render and registers a client
as `human-ui` or `sylune`. The caller must be a privileged host, never an incoming
JSON/renderer/model actor field. A future Electron adapter must authenticate the
registered window/main frame/exact document before routing requests. `connect`
and role selection must never be exposed to the renderer or SYLUNE tools.

Requests have exactly `{schemaVersion,hostEpoch,requestId,projectId,method,params}`.
IDs/fields/methods are validated; no SQL, code, file paths or arbitrary action
objects. Commands are copied before awaiting, canonicalized by schema order and
serialized on a short-command queue. Operations continue asynchronously so
cancellation is not blocked behind a render/commit.

## Actual supported behavior

- `getSession`: real source snapshot/selection, target/processing/link revision,
  media descriptors, retained version IDs/hashes and history. No audio bytes,
  filesystem descriptors, private approval objects or raw error stacks.
- `reviewLinkedUpdate`: calls the existing metadata-only review. Wire view says
  `reviewKind: metadata-only`, `preview: null`; current capability flags explicitly
  disable rendered preview, selection mutation, playback transport, application
  persistence and production readiness. Nothing implies an audition already exists.
- `approveLinkedUpdate`: only a registered human-ui client; exact host plan and
  review revision. Service's opaque view/receipt never crosses the wire. This is
  role policy, not proof a real human clicked a production control.
- `executeApproved`: proposer or approving UI context can consume the private
  receipt once. An unrelated SYLUNE client cannot execute it. Same existing service
  applies source/target freshness, render validation, staging and promotion barrier.
- `discardReview`, `getOperation`, `cancelOperation`: actual plan eligibility and
  service phases/outcomes, not progress timers. Disconnect revokes unstarted plans/
  approvals and requests cancellation of related operations. Accepted in-flight
  transactions may finish; disconnect never promises a rollback after the barrier.
- `moveLinkedHistory`: registered UI only, real target/revision-checked storage
  undo/redo, exact retained audio and unchanged destination processing.
- `getPersistenceState`: returns session-only with no durable save timestamp for
  this unqualified experimental application adapter. Actual disk files do not
  justify an application "Saved" claim. Recovery-required is explicit after an
  uncertain or unexpectedly rejected service completion.

Every response has host/project/request identity and either a result or fixed
public error code. Future renderer projections must discard stale host responses.
`getSession` also distinguishes registered methods from role-allowed methods.
Errors/event codes are sanitized; paths/messages/stacks/causes are not returned.

## Replay, lifetime and resource controls

- Mutating request retries within one connection return the same promise/result;
  reusing an ID with changed parameters conflicts. Canonical key order avoids
  treating an equivalent structured-clone object as a different mutation.
- Reads are always fresh and do not occupy the mutation replay ledger. They are
  not cached as old operation snapshots or mistaken for a new execution request.
- Project/host epoch mismatches reject. Review/approval expire after five minutes
  by default; clock rollback also expires them. Disconnect/restart invalidates
  process-local authority. A new host cannot replay an old approval.
- 8 active clients, 32 pending commands/client, 64 pending globally, 64 reviews/operations,
  128 retained mutating request IDs/client and 4096 issued host IDs. No mutation-ledger
  eviction that could silently permit reexecution. Quotas fail explicitly; these
  are experimental limits, not final DAW resource policy.
- Close is shared/idempotent: stop new requests, revoke/cancel, drain accepted
  commands/operations, then close the underlying writer. No guessed lease release.
  It still waits for the trusted render promise; production worker liveness/
  termination bounds remain a separate gate, not falsely solved by cancellation.

## Reopening and outcome reconciliation

For an operation not in the current host registry, query the repository's retained,
verified version provenance. Exactly one matching committed operation reconstructs
a completed/version receipt, without rendering or changing the selected version.
This works after normal close and an ambiguous post-pointer-rename failure.

No match returns **OUTCOME_UNKNOWN**, never invented failed/cancelled status and
never an automatic retry. Duplicate matching records require recovery. This is
not the complete production operation ledger: unsuccessful/in-flight actor and
request states are not persisted by this adapter. SQLite's transactional receipt
ledger, project registry and production qualification remain unimplemented.

## Executed evidence

- First15-test run:9pass/6fail. Regressions exposed canonical ordering, query
  caching/ledger pressure and error handling; fixed rather than weakening assertions.
  Added coverage for real read freshness, queue backpressure, context disconnect,
  shared-service contention and ambiguous persisted receipt reconciliation.
- Targeted **23/23**. Full default **313total/310pass/3existing LUFS TODOs** after
  final source checks. Strict analyzer remains47/44pass/3knownfailures(expected1);
  sanity passes. These metering/gain/true-peak risks remain unchanged.
- New actual native facade run:4source checks(maxError0),4separate-process reopened
  destination renders(original/updated/undo/redo), maxError
  **3.5762786865234375e-7** under unchanged2e-6. Prepare cancellation prevents
  promotion; commit cancellation returns too-late. Host restart recovers the real
  retained receipt without re-rendering. No observed page requests/errors.
- Existing real repository native workflow rerun unchanged:37destination renders,
 10commit SIGKILL cases plus normal completion, same maximum error/tolerance.
- Chromium153.0.8010.0/Node22.22.3, exact approved scripts-disabled43-package scratch
  toolkit outside app dependencies. Existing offline/private/request-rejecting/
  finally-close harness; sandbox disabling is synthetic-only, never app config.

```sh
node --test tests/unit/sessionApplication.test.js tests/unit/sessionWireContract.test.js
node --test tests/unit/*.test.js tests/audio/*.test.js
node scripts/validation/run-session-application-integration.mjs --tools-dir <approved-private-toolkit>
node scripts/validation/run-linked-session-integration.mjs --tools-dir <approved-private-toolkit>
```

## Not ready for frontend integration yet / next slice

No `window.movSessions` endpoint, real Electron sender/permission enforcement,
UI click approval, application playback/quit-restart, connected SYLUNE provider,
actual user-import selection or useful-length staged audio audition is implemented
by this slice. Source changes in the native driver are trusted fixture setup,
not an exposed editing command. B continues visuals with honest endpoint absence.

Next extend the **same** service for immutable rendered-preview-before-final-
approval and meaningful bounded ranges, preserving existing fixture regressions.
Implement the reviewed production repository/operation ledger behind the same
ports and verify actual packaged macOS SQLite ownership/recovery/migration. Only
then review narrow host/preload/package wiring and publish an interface-ready
notice to B. General DAW/audio/platform backlog stays explicit in the queue.
