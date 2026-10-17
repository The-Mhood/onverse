# Authoritative session host and IPC contract — v1 integration target

2026-10-16. Lead-owned contract for the first usable Linked Sessions workflow.
The [host foundation](SESSION_HOST_FOUNDATION.md) and subsequent opt-in
[rendered-review slice](SESSION_RENDERED_REVIEW.md) implement a core-only subset
using the same service/repository: nonblocking staged review, scoped byte reads
and exact staged-token commit are now available in that explicit mode. The default
remains metadata-only; no UI audition/player or authenticated Electron endpoint.
The subsequent [useful-range profile](USEFUL_RANGE_PROFILE.md) adds explicit
experimental schema3/range geometry and bounded chunks (up to30s selections),
not automatic migration, UI audition or a production adapter.
The production target below is not fulfilled by these slices.
**Specified, not yet implemented/exported in Electron.** This is not permission
to advertise capabilities as available. No presentation files are re-handed off;
Agent B keeps full visual ownership and wires accepted ports in its own files.

## One authority, not three products

Electron main owns a `SessionApplication` per open project. Its repository stores
stable project/session/track/group/link/version IDs, source revisions, exact group
selection/range, media IDs/hashes, target links, destination processing, retained
history and durable operation receipts. Session roles are not permanently
Project/Reference/Master. UI labels never resolve identity.

UI and SYLUNE use the **same** application commands and source of truth. Existing
`linkedSessionContract.js`, `linkedUpdateService.js`, PCM/native render and
storage ports are extended/adapted, not copied. A SQLite repository implements
those ports, with schema/version migration reviewed separately. No project
localStorage, UI-owned canonical session or private SYLUNE action/history store.
Renderer caches are disposable projections. Pending form selection and hover/
playhead/expansion state are presentation state, not committed session mutations.

Existing single-buffer import/analyze/reference/process/playback/crop/conversion
flows stay available until a real host adapter replaces each authority seam.
A new empty DAW must not replace working audio workflows. `src/main.js` remains
B-reserved; any genuine functional controller replacement requires an exact
sequenced handoff, not concurrent lead editing.

## Target ports and transport

Main registers fixed allowlisted handlers. A minimal preload exposes named
methods under `window.movSessions`; no ipcRenderer, generic channel sender,
filesystem paths, SQL, module/function names, generated code or shell execution.
`movUpdate` remains a separate existing updater surface.

Version1 commands have exact, allowlisted fields and bounded structured-clone
payloads: `schemaVersion`, `requestId`, `projectId` where applicable, and specific
method arguments. IDs are stable opaque strings; server rejects extra fields,
wrong types, missing IDs and stale revisions. No audio arrays in session metadata.
Media transport uses bounded ArrayBuffers/MessagePorts with host-issued scoped
asset/job handles and backpressure; exact caps come from the reviewed render
profile, not today’s JSON fixture transport. Imports use native picker grants,
never arbitrary renderer paths. No general file-read capability.

Initial named operations (contract targets, not existing exports):

| Method | Authority/semantics |
| --- | --- |
| `getSession({projectId,sessionId})` | Sanitized authoritative projection: IDs, track/media descriptors, revisions, supported capabilities. No tokens/private paths. |
| `defineSelection({projectId,sessionId,groupId,expectedDefinitionRevisionId,trackIds,range})` | Validate real membership/range, commit exact ordered selection and fresh definition revision through the host. No linked auto-update. |
| `reviewLinkedUpdate({projectId,groupId,targetId})` | Capture immutable dependencies/target revision, render/verify/stage the candidate, return server planId, diff, preview handle/hash, scope and expiry. No destination mutation. |
| `approveLinkedUpdate({projectId,planId,reviewRevision})` | Human UI endpoint only; host binds a one-use approval to exact rendered bytes, source/selection and target revision. Cannot be called as a SYLUNE tool. |
| `executeApproved({projectId,planId})` | UI or authorized SYLUNE orchestrator requests execution; host requires its own matching approval record and consumes it once. No approval token in model-generated text. |
| `discardReview({projectId,planId})` | Invalidate pending plan/approval; unpin preparation without deleting shared media. |
| `getOperation({projectId,operationId})` | Real phase/outcome and durable receipt, including unknown/uncertain, not timed simulation. |
| `cancelOperation({projectId,operationId})` | Accepted before promotion eligibility barrier; too-late after. Report actual eventual outcome. |
| `moveLinkedHistory({projectId,targetId,direction,expectedLinkRevisionId})` | Exact stored-version undo/redo; preserve unrelated audio and destination processing. Not general DAW history. |
| `getPlaybackAsset({projectId,versionId})` | Verify the stored version and grant read-only bounded audio to playback. Does not regenerate or mutate it. |
| `getPersistenceState()` / `onPersistenceState(callback)` | Read-only host state below; event subscription returns a real unsubscribe. |

Approval registries are host-only and bound to project, exact source/target scope,
requesting actor and connected UI/host epoch. Review/approval expire across close,
restart or invalidation; committed operation receipts persist. IPC IDs are lookup
keys, not authority minted by a JSON clone. Imported/LLM plans are proposals that
must pass the same validators, never executable objects. Structured error results
carry allowlisted codes, not stacks or local paths.

Handlers authorize the exact registered window/webContents, its main frame and
exact packaged local document. `file://`, null origin, a renderer-supplied actor or
an operation name alone is not authorization. Reject subframes, devtools/foreign
windows, changed navigation and stale host epochs. Keep contextIsolation/sandbox
on and nodeIntegration off. Sender roles come from main registration; render worker
and SYLUNE tool router cannot impersonate human UI approval.

Events use `{hostEpoch,sequence,projectId,type,payload}`. UI drops wrong-epoch/
wrong-project/old sequence events; reconnect fetches a complete authoritative
snapshot. No UI-authored saved/completed state. Host request deduplication and
transactional operation receipt prevent duplicate promotion after a lost reply.

## Render-review-approve, not merely metadata approval

Existing service renders after metadata approval; that is not the final product
contract. Extend it to stage a fixed verified preview **before** final approval.
Review describes exact selected tracks/range, changed dependencies, target version,
processing retained and the preview's bytes/hash. Audition uses those staged bytes.
Approval binds that candidate; execution rechecks dependencies/target atomically
and commits those exact bytes, not a different render. Stale plans require renewed
review; no automatic cascade after a relevant source edit. Cancellation revokes
candidate promotion even if native rendering cannot be interrupted immediately.

Audio execution belongs to a fixed local host-controlled sandboxed worker,
separate from the UI. Inputs are verified selected immutable assets and a validated
recipe; no supplied JS/module URLs. Main validates job/sender/result and bytes;
UI cannot substitute arbitrary media as an authorized render. Worker lifecycle,
network denial, resource limits and death/retry are explicit integration tests.

## Read-only persistence projection / B's requested save signal

Target DTO (exact fields; values below represent the currently unconnected UI):

```json
{
  "schemaVersion": 1,
  "projectId": null,
  "status": "session-only",
  "revisionId": null,
  "persistedRevisionId": null,
  "lastPersistedAt": null,
  "errorCode": null
}
```

`status`: session-only, loading, clean, dirty, saving, error, read-only or
recovery-required. IDs are null only where no verified project/revision is known.
`lastPersistedAt` is null or the UTC timestamp recorded by a successful durable
host transaction. Never Date.now in the view, file mtime, render completion or
synthetic progress. `clean` requires a verified persistent project and current
revision equal to durable revision, with no pending authoritative mutation.
Ephemeral UI movement does not make a project dirty. A failed save must not erase
an earlier durable receipt or imply newer data persisted.

B may implement a disposable presenter/port subscriber with these names/shape;
**the endpoint does not exist yet**. Feature-detect absence and retain "Not saved ·
session only". Do not call the Linux experimental store, create localStorage
persistence or infer successful saving. Host-connected clean may say "Saved
locally" with the returned time; saving/error/read-only/recovery must remain
explicit. Reload/reconnect must reset stale status until a verified snapshot.
This is an unblocked visual contract, not a request to wait for engine completion.

## Small first SYLUNE capability set

Start with an explicit constrained tool router: inspect real session, propose a
Linked Sessions update, execute an already approved plan, query actual result and
cancel its operation. No plugin manipulation, recording, arbitrary automation,
research/provider claims, generated code or model authority to approve. A
predefined deterministic proposal is allowed for integration testing only if
labelled as such, not called an actual connected language-model provider.

Proposal provenance records actor/tool/source context. Tool calls pass identical
application validators and transactions as UI. A human reviews the same candidate;
SYLUNE sees approval status, never gets an approval-minting tool. Execution returns
operation/version receipt; UI observes real phases. Unsupported requests return
unsupported without animations or mutation. Provider/network/auth integration is
separate; no credentials/uploads/paid service are authorized by this contract.

## First usable application acceptance matrix

| Gate | Required observed result |
| --- | --- |
| Real inputs/range | Import ordinary supported audio through a native picker; create actual source/destination sessions and select tracks by IDs. Generalize fixed85ms fixture profile to a meaningful bounded musical range; display bounds/errors. No fake tracks or hardcoded recipe. |
| Render/review | Verified native candidate from actual selected media, visible diff and preview audition before approval. Destination unchanged while reviewing. |
| Approval/update | Explicit human action binds exact candidate. Correct target only, retained manual processing/unrelated audio. Replays/stale source/selection/target reject. |
| Playback | Actual destination playback uses reopened stored bytes; capture/compare the output graph and verify transport/seek. Human listening is separately recorded, never inferred from a numerical test. |
| History | Undo/redo restores exact prior bytes/hash and intended link identity while keeping unrelated audio/processing. No re-render from newer source. |
| Close/reopen | Quit packaged app, restart, open the same project, verify media/hash/version/history/processing and real save status. Not just a Node reader or browser refresh. |
| Failures | Bad media/missing source, corrupt storage, disk-full/I/O error, stale plan, duplicate request, renderer/worker death and unknown commit outcome preserve last valid state or explicitly require recovery. |
| Cancellation | Cancel render/review/preparation means no promotion. Cancel after barrier is too-late with actual outcome, not false cancelled. |
| Recovery/migration | Kill actual app/owner at commit and migration checkpoints, reopen under ownership, verify valid old/new result and exact history; legacy source untouched. |
| SYLUNE | Inspect real project -> propose same candidate -> required human approval -> authorized tool execution -> actual receipt/observed session result. Forged approval/unsupported tools cannot mutate. |
| UI quality | B-owned wiring at1120x700/1480x920, keyboard/focus/accessibility, reduced-motion, event cleanup and performance; preserve existing working audio paths. |

No gate is marked complete merely because a contract or isolated proof exists.

## Remaining DAW/audio work (explicitly not implemented here)

General clip editing/trim/split/move, recording/device input/monitoring, routing/
buses/sends, mixer/automation/plugin hosting, full-project history and large-media
streaming remain tracked product work. Three known LUFS regression defects,
true-peak and automatic-gain risks remain unresolved; do not enable unrestricted
AI gain changes. macOS arm64/x64 packaging/APFS/runtime/security/listening and
release validation remain outstanding. The initial vertical slice must not be
marketed as a complete professional DAW.
