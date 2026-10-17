import { LEGACY_PROFILE, getRenderProfile, selectionFrames } from '../../domain/linkedSessions/renderProfiles.js';
import { createSnapshot, createSelection, dependencyKey, projectDependencies } from '../../domain/linkedSessions/linkedSessionContract.js';
import { decodePCM, hashPCM } from '../../audio/linkedSessions/pcm.js';

const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value);
const fail = (code, message = code) => Object.assign(Error(message), { code });
function target(value, targetId) {
  if (!value || value.targetId !== targetId || !id(value.linkRevisionId) ||
      !(value.linkedVersionId === null || id(value.linkedVersionId)) || value.sampleRate !== 48000 ||
      !Array.isArray(value.layout) || value.layout.length !== 2 || value.layout[0] !== 'L' || value.layout[1] !== 'R') throw fail('INCOMPATIBLE_TARGET');
  // Deliberately omit processors, unrelated audio, labels and whole-project revision.
  return Object.freeze({ targetId, linkRevisionId: value.linkRevisionId, linkedVersionId: value.linkedVersionId, sampleRate: 48000, layout: Object.freeze(['L', 'R']) });
}
const targetKey = value => JSON.stringify(value);

// Core-only host API, NOT an imported/AI plan execution endpoint or UI store.
// Storage contract: prepare never promotes; commit atomically compares expected
// source dependency key AND target link revision in its serialized application
// transaction, then changes ONLY that link pointer + retained history. Separate
// asynchronous readSource/readTarget checks alone are not an atomic guarantee.
// It must not replace the whole destination or infer targets by display name.
// Any exception after entering commit is conservatively promotion-uncertain.
export function createLinkedUpdateService({ readSource, readTarget, render, storage,
  makeId = () => globalThis.crypto.randomUUID(), reviewMode = 'metadata', renderProfile = LEGACY_PROFILE }) {
  const limits=getRenderProfile(renderProfile),reservations=new Set();
  if(limits.fixedFrames===null && reviewMode!=='rendered')throw fail('UNSUPPORTED_REVIEW_MODE');
  if (!['metadata','rendered'].includes(reviewMode)) throw fail('UNSUPPORTED_REVIEW_MODE');
  if (![readSource, readTarget, render, makeId, storage?.prepare, storage?.commit, storage?.discard].every(f => typeof f === 'function')) throw Error('Missing linked update ports');
  const plans = new WeakMap(), approvals = new WeakMap(), issued = new Set(), uncertainTargets = new Set();
  const checkRecovery = targetId => { if (uncertainTargets.has(targetId)) throw fail('RECOVERY_REQUIRED'); };
  function nextId() {
    const value = makeId();
    if (!id(value) || issued.has(value)) throw fail('INVALID_OPERATION_ID');
    issued.add(value); return value;
  }
  async function source(groupId) {
    const value = await readSource(groupId);
    if (!value) throw fail('SOURCE_UNAVAILABLE');
    const snapshot = createSnapshot(value.snapshot,renderProfile), selection = createSelection(value.selection,renderProfile);
    if (selection.groupId !== groupId) throw fail('SELECTION_CHANGED');
    return { snapshot, selection, key: dependencyKey(snapshot, selection,renderProfile) };
  }
  async function current(plan) {
    checkRecovery(plan.targetId);
    if ((await source(plan.groupId)).key !== plan.source.key) throw fail('STALE_SOURCE');
    if (targetKey(target(await readTarget(plan.targetId), plan.targetId)) !== targetKey(plan.target)) throw fail('TARGET_CHANGED');
  }
  async function capture({ groupId, targetId }, planId) {
    if (!id(groupId) || !id(targetId)) throw fail('INVALID_TARGET_ID');
    checkRecovery(targetId);
    const selected = await source(groupId), destination = target(await readTarget(targetId), targetId);
    const view = Object.freeze({ planId:planId ?? nextId(), groupId, targetId,
      action: 'replace-linked-version', previousVersionId: destination.linkedVersionId,
      dependencies: projectDependencies(selected.snapshot, selected.selection,renderProfile),
      sourceSessionId: selected.snapshot.sessionId, sourceRevisionId: selected.snapshot.revisionId,
      trackIds: Object.freeze([...selected.selection.trackIds]), expectedLinkRevisionId: destination.linkRevisionId });
    return {view,groupId,targetId,source:selected,frames:selectionFrames(selected.selection,renderProfile),target:destination,approved:false,rendered:reviewMode === 'rendered'};
  }
  async function releasePrepared(plan) {
    if (plan.cleanup) return plan.cleanup;
    const token = plan.prepared;
    if (token === undefined || token === null) { plan.previewBytes = null; reservations.delete(plan.reservation); return; }
    plan.prepared = undefined; plan.previewBytes = null;
    plan.cleanup = Promise.resolve().then(() => storage.discard(token)).then(value=>{reservations.delete(plan.reservation);return value;}).catch(error => {
      uncertainTargets.add(plan.targetId); throw error;
    });
    return plan.cleanup;
  }
  async function stage(plan, operationId, checkCancel) {
    const result = await render({snapshot:plan.source.snapshot,selection:plan.source.selection,...(renderProfile===LEGACY_PROFILE?{}:{renderProfile})});
    checkCancel();
    if (!result || result.sampleRate !== 48000 || result.frames !== plan.frames ||
        JSON.stringify(result.layout) !== '["L","R"]' || (!(result.bytes instanceof Uint8Array) || result.bytes.byteLength!==plan.frames*8)) throw fail('INVALID_RENDER');
    const bytes = new Uint8Array(result.bytes), claimedHash = result.sha256;
    decodePCM(bytes,plan.frames,renderProfile); const sha256 = await hashPCM(bytes);
    if (sha256 !== claimedHash) throw fail('INVALID_RENDER_HASH');
    await current(plan); checkCancel();
    plan.provenance = Object.freeze({profile:renderProfile,sourceSessionId:plan.source.snapshot.sessionId,
      sourceRevisionId:plan.source.snapshot.revisionId,dependencyKey:plan.source.key,targetId:plan.targetId,
      planId:plan.view.planId,operationId,sha256});
    // Private preview bytes cannot alias caller or adapter-owned buffers.
    plan.previewBytes = bytes;
    plan.prepared = await storage.prepare({bytes:new Uint8Array(bytes),frames:plan.frames,sampleRate:48000,layout:['L','R'],sha256,provenance:plan.provenance});
    if (plan.prepared === undefined || plan.prepared === null) throw fail('INVALID_PREPARATION');
  }
  async function review(input) {
    if (reviewMode === 'rendered') {
      const result = await beginReview(input).completion;
      if (result.status !== 'review-ready') {
        if (result.cleanupError) throw new AggregateError([result.error,result.cleanupError],'Review and cleanup failed');
        throw result.error;
      }
      return result.view;
    }
    const plan = await capture(input); plans.set(plan.view,plan); return plan.view;
  }
  function beginReview(input) {
    if (reviewMode !== 'rendered') throw fail('UNSUPPORTED_REVIEW_MODE');
    if (!id(input?.groupId) || !id(input?.targetId)) throw fail('INVALID_TARGET_ID');
    if(limits.fixedFrames===null && reservations.size>=limits.maxCandidates)throw fail('STAGING_CAPACITY');
    const reservation={};
    const request = {groupId:input.groupId,targetId:input.targetId}, reviewId = nextId(), operationId = nextId();
    if(limits.fixedFrames===null)reservations.add(reservation);
    let plan, phase, cancelled = false, disposal;
    const events = [];
    const emit = (state, detail = {}) => {phase=state;events.push(Object.freeze({reviewId,sequence:events.length,phase,...detail}));};
    const checkCancel = () => {if (cancelled || plan?.discarded) throw fail('CANCELLED');};
    emit('capturing');
    const completion = (async () => {
      try {
        plan = await capture(request,reviewId); plan.operationId=operationId;plan.reservation=reservation; checkCancel();
        await current(plan); checkCancel(); emit('rendering');
        await stage(plan,operationId,checkCancel); emit('prepared');
        await current(plan); checkCancel();
        const preview = Object.freeze({previewId:operationId,sha256:plan.provenance.sha256,frames:plan.frames,sampleRate:48000,layout:Object.freeze(['L','R'])});
        plan.view = Object.freeze({...plan.view,reviewKind:'rendered',preview});plan.ready=true;
        plans.set(plan.view,plan);emit('review-ready');return Object.freeze({status:'review-ready',view:plan.view});
      } catch (error) {
        let cleanupError;
        if (plan) {plan.discarded=true;try{await releasePrepared(plan);}catch(e){cleanupError=e;}}
        else reservations.delete(reservation);
        const code = Object.getOwnPropertyDescriptor(Object(error),'code')?.value;
        const status = code === 'CANCELLED' ? 'cancelled' : 'failed';
        emit(status,{code:typeof code === 'string' && /^[A-Z_]+$/.test(code) ? code : 'UPDATE_FAILED'});
        return Object.freeze({status,error,...(cleanupError ? {cleanupError} : {})});
      }
    })();
    function cancel() {
      if (plan?.started) return 'too-late';
      if (phase === 'failed') return 'finished';
      if (phase === 'cancelled') return 'cancelled';
      cancelled=true;
      if (phase === 'review-ready') {plan.discarded=true;emit('cancelled',{code:'CANCELLED'});}
      return 'accepted';
    }
    return Object.freeze({reviewId,completion,cancel,
      get phase(){return phase;},get events(){return Object.freeze([...events]);},
      dispose(){
        if (!disposal) disposal=(async()=>{cancel();await completion;if(plan&&!plan.started){plan.discarded=true;await releasePrepared(plan);}return plan?.started?'too-late':'discarded';})();
        return disposal;
      }
    });
  }
  function previewPlan(view, previewId) {
    const plan=plans.get(view);
    if(!plan?.rendered || !plan.ready || plan.discarded || plan.started || !plan.previewBytes ||
      (previewId !== undefined && previewId !== view.preview.previewId)) throw fail('INVALID_PREVIEW');
    return plan;
  }
  async function invalidate(view, error) {
    const plan=plans.get(view);
    if(plan && !plan.started) {
      plan.discarded=true;
      try{await releasePrepared(plan);}catch(cleanupError){throw Object.assign(new AggregateError([error,cleanupError],'Preview invalidation and cleanup failed'),{code:'RECOVERY_REQUIRED'});}
    }
    throw error;
  }
  async function readPreview(view, previewId, chunk) {
    if (!id(previewId)) throw fail('INVALID_PREVIEW');
    const plan=previewPlan(view,previewId),totalBytes=plan.frames*8;
    let offsetBytes=0,lengthBytes=totalBytes;
    if(limits.fixedFrames===null){
      if(!chunk || Object.getPrototypeOf(chunk)!==Object.prototype || Object.keys(chunk).length!==2 ||
        !Number.isSafeInteger(chunk.offsetBytes) || !Number.isSafeInteger(chunk.lengthBytes) || chunk.offsetBytes<0 ||
        chunk.offsetBytes%8!==0 || chunk.lengthBytes<8 || chunk.lengthBytes%8!==0 || chunk.lengthBytes>limits.maxPreviewChunkBytes ||
        chunk.offsetBytes>totalBytes-chunk.lengthBytes)throw fail('INVALID_PREVIEW_RANGE');
      ({offsetBytes,lengthBytes}=chunk);
    }else if(chunk!==undefined)throw fail('INVALID_PREVIEW_RANGE');
    try {
      await current(plan);previewPlan(view,previewId);
      const bytes=plan.previewBytes.slice(offsetBytes,offsetBytes+lengthBytes),sha256=await hashPCM(bytes);previewPlan(view,previewId);
      if(limits.fixedFrames!==null && sha256!==view.preview.sha256)throw fail('INVALID_RENDER_HASH');
      return Object.freeze({...view.preview,...(limits.fixedFrames===null?{offsetBytes,totalBytes,chunkSha256:sha256}:{}),bytes});
    }catch(error){return invalidate(view,error);}
  }
  async function approvePreview(view) {
    const plan=previewPlan(view);
    if(plan.approved)throw fail('INVALID_APPROVAL');
    try{await current(plan);previewPlan(view);}catch(error){return invalidate(view,error);}
    return issueApproval(view);
  }
  async function release(view) {
    const plan=plans.get(view);if(!plan)throw fail('INVALID_PLAN');
    if(plan.started)return 'too-late';plan.discarded=true;await releasePrepared(plan);return 'discarded';
  }
  function approve(view) {
    if (plans.get(view)?.rendered) throw fail('INVALID_APPROVAL');
    return issueApproval(view);
  }
  function issueApproval(view) {
    const plan = plans.get(view);
    if (!plan || plan.approved || plan.discarded || (plan.rendered && !plan.ready)) throw fail('INVALID_APPROVAL');
    plan.approved = true;
    const receipt = Object.freeze({ planId: view.planId });
    approvals.set(receipt, plan);
    return receipt;
  }
  function discard(view) {
    const plan = plans.get(view);
    if (!plan) throw fail('INVALID_PLAN');
    if (plan.started) return 'too-late';
    plan.discarded = true;
    return 'discarded';
  }
  function start(receipt) {
    const plan = approvals.get(receipt);
    if (!plan || plan.discarded) throw fail('INVALID_APPROVAL');
    checkRecovery(plan.targetId);
    approvals.delete(receipt); // Consume BEFORE any asynchronous work: no replay.
    const operationId = plan.rendered ? plan.operationId : nextId();
    plan.started = true;
    let phase = 'rendering', cancelled = false, prepared=plan.prepared;
    const events = [];
    const emit = (state, detail = {}) => {
      phase = state;
      events.push(Object.freeze({ operationId, planId: receipt.planId, sequence: events.length,
        phase, ...detail }));
    };
    const checkCancel = () => { if (cancelled) throw fail('CANCELLED'); };
    emit(plan.rendered ? 'prepared' : 'rendering');
    const completion = (async () => {
      try {
        await current(plan); checkCancel();
        if (!plan.rendered) {await stage(plan,operationId,checkCancel);prepared=plan.prepared;emit('prepared');}
        const provenance=plan.provenance;
        await current(plan); checkCancel();
        // Logical promotion barrier. No await between eligibility check and commit.
        // Source changes after this point do not change the approved immutable
        // render; later observation may mark that version update-available.
        checkRecovery(plan.targetId);
        emit('promoting');
        const committed = await storage.commit({ prepared, targetId: plan.targetId, expected: plan.target,
          expectedSource: Object.freeze({ sessionId: plan.source.snapshot.sessionId,
            groupId: plan.groupId, dependencyKey: plan.source.key }), provenance });
        if (!committed || committed.targetId !== plan.targetId || !id(committed.versionId)) throw fail('INVALID_COMMIT_RECEIPT');
        plan.prepared=undefined;plan.previewBytes=null;reservations.delete(plan.reservation);
        emit('completed', { versionId: committed.versionId });
        return Object.freeze({ status: 'completed', operationId, versionId: committed.versionId });
      } catch (error) {
        if (phase === 'promoting') {
          uncertainTargets.add(plan.targetId);
          emit('uncertain', { code: 'PROMOTION_UNCERTAIN' });
          // Do not discard: storage may already have promoted this generation.
          return Object.freeze({ status: 'uncertain', operationId, error });
        }
        let cleanupError;
        if ((plan.prepared !== undefined && plan.prepared !== null) || plan.reservation) {
          try { await releasePrepared(plan); } catch (e) { cleanupError = e; }
        }
        const status = error?.code === 'CANCELLED' ? 'cancelled' : 'failed';
        emit(status, { code: error?.code || 'UPDATE_FAILED' });
        return Object.freeze({ status, operationId, error, ...(cleanupError ? { cleanupError } : {}) });
      }
    })();
    return Object.freeze({ operationId, completion,
      cancel() {
        if (phase === 'promoting' || phase === 'completed' || phase === 'uncertain') return 'too-late';
        if (phase === 'cancelled') return 'cancelled';
        if (phase === 'failed') return 'finished';
        cancelled = true; return 'accepted';
      },
      get phase() { return phase; },
      get events() { return Object.freeze([...events]); }
    });
  }
  return Object.freeze({ review, approve, discard, start, beginReview, readPreview, approvePreview, release });
}
