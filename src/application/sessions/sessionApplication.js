import { LEGACY_PROFILE, getRenderProfile } from '../../domain/linkedSessions/renderProfiles.js';
// Trusted core facade, NOT registered Electron IPC or a second session store.
// Existing repository remains authoritative. Rendered review is explicitly opt-in;
// byte delivery here is not a UI audition/player or an authenticated IPC endpoint.
import {createLinkedUpdateService} from '../linkedSessions/linkedUpdateService.js';
import {SESSION_METHODS, isSessionId, sessionError, sessionRecord, readSessionRequest,
  freezeSessionValue, publicSessionError, readSessionPreviewRequest} from './sessionWireContract.js';
const requireValue = (x, code) => { if (!x) throw sessionError(code); };
export function createSessionApplication({projectId, storage, render,
  makeId = () => globalThis.crypto.randomUUID(), now = () => Date.now(), reviewLifetimeMs = 300000, reviewMode = 'metadata', renderProfile=LEGACY_PROFILE}) {
  const limits=getRenderProfile(renderProfile),candidateSlots=new Set();
  requireValue(limits.fixedFrames!==null || reviewMode==='rendered','UNSUPPORTED_REVIEW_MODE');
  requireValue(storage?.renderProfile===renderProfile || (renderProfile===LEGACY_PROFILE && storage?.renderProfile===undefined),'PROFILE_MISMATCH');
  requireValue(isSessionId(projectId) && typeof makeId === 'function' && typeof now === 'function' &&
    Number.isSafeInteger(reviewLifetimeMs) && reviewLifetimeMs >= 1 && reviewLifetimeMs <= 900000, 'INVALID_REQUEST');
  requireValue(['metadata','rendered'].includes(reviewMode),'INVALID_REQUEST');
  for (const name of ['readState', 'readSource', 'readTarget', 'prepare', 'commit', 'discard', 'moveHistory', 'close'])
    requireValue(typeof storage?.[name] === 'function', 'INVALID_REQUEST');
  requireValue(typeof render === 'function', 'INVALID_REQUEST');
  const issued = new Set(), clients = new Set(), plans = new Map(), operations = new Map(), reviews = new Map();
  const cleanupTasks = new Set(), cleanupFailures = [], activeReads = new Set();
  let tail = Promise.resolve(), closing = false, closePromise, recoveryRequired = false, pending = 0;
  function nextId() {
    requireValue(issued.size < 4096, 'HOST_CAPACITY'); const id = makeId();
    requireValue(isSessionId(id) && !issued.has(id), 'INVALID_HOST_ID'); issued.add(id); return id;
  }
  const hostEpoch = nextId();
  const linked = createLinkedUpdateService({readSource:id => storage.readSource(id), readTarget:id => storage.readTarget(id),
    storage, render, makeId:nextId, reviewMode, renderProfile});
  const capabilities = freezeSessionValue({profile:'experimental-generation-host-v1', supportedMethods:SESSION_METHODS.filter(method=>reviewMode==='rendered' || !['getLinkedReview','cancelLinkedReview'].includes(method)),
    reviewKind:reviewMode === 'rendered' ? 'rendered' : 'metadata-only', renderedPreview:reviewMode === 'rendered',
    previewByteAccess:reviewMode === 'rendered', productionReady:false, applicationPersistence:false,
    playbackTransport:false, selectionMutation:false, sampleRate:48000, frames:limits.fixedFrames, layout:['L','R'],renderProfile,
    ...(limits.fixedFrames===null?{maxRangeFrames:limits.maxFrames,maxTimelineFrames:limits.maxTimelineFrames,
      maxCandidates:limits.maxCandidates,previewRead:{chunked:true,maxChunkBytes:limits.maxPreviewChunkBytes,maxConcurrentReads:2}}:{})});
  function clock() { const t = now(); requireValue(Number.isSafeInteger(t) && t >= 0, 'INVALID_REQUEST'); return t; }
  function connected(client) { requireValue(!closing, 'HOST_CLOSED'); requireValue(client.connected, 'DISCONNECTED'); }
  function writable(client) { connected(client); requireValue(!recoveryRequired, 'RECOVERY_REQUIRED'); }
  // Revoke synchronously; retain and observe the asynchronous unpin. Never dispose
  // a started operation: its promotion/recovery barrier owns that token now.
  function dropPlan(id, record) {
    if(record.started)return;
    record.revoked=true;plans.delete(id);record.reviewJob?.cancel();
    if(record.view)linked.discard(record.view);
    if(!record.cleanupPromise){
      const task=Promise.resolve().then(()=>record.reviewJob ? record.reviewJob.dispose() : linked.release(record.view)).then(
        ()=>{candidateSlots.delete(record);record.cleanupOutcome={status:'completed'};},
        error=>{recoveryRequired=true;cleanupFailures.push(error);record.cleanupOutcome={status:'failed',error:publicSessionError(error)};});
      record.cleanupPromise=task;cleanupTasks.add(task);task.then(()=>cleanupTasks.delete(task));
    }
  }
  function reviewAccess(client, record) {
    requireValue(client.role==='human-ui' || client.id===record.owner,'SCOPE_FORBIDDEN');
  }
  function reviewedValue(record) {
    return {...structuredClone(record.view),reviewRevision:record.reviewRevision,expiresAt:record.expiresAt,
      reviewKind:reviewMode==='rendered' ? 'rendered' : 'metadata-only',preview:record.view.preview ?? null};
  }
  function reviewStatus(record) {
    const result=record.reviewResult;
    return {reviewId:record.reviewJob.reviewId,phase:record.started?'consumed':record.reviewJob.phase,
      review:record.view && !record.revoked && !record.started ? reviewedValue(record) : null,
      outcome:result && result.status!=='review-ready' ? {status:result.status,
        ...(result.error?{error:publicSessionError(result.error)}:{}),
        ...(result.cleanupError?{cleanupError:publicSessionError(result.cleanupError)}:{})}:null,
      cleanup:record.cleanupOutcome ?? {status:record.cleanupPromise?'pending':'not-requested'},
      events:record.reviewJob.events.map(e=>({reviewId:e.reviewId,sequence:e.sequence,phase:e.phase,
        ...(e.code?{code:publicSessionError(e).code}:{})}))};
  }
  function observeReview(record) {
    record.reviewCompletion=record.reviewJob.completion.then(result=>{
      record.reviewResult=result;
      if(result.cleanupError)recoveryRequired=true;
      if(result.status!=='review-ready' && !result.cleanupError)candidateSlots.delete(record);
      if(result.status==='review-ready') {
        record.view=result.view;
        try {
          const t=clock();
          if(record.revoked || closing || recoveryRequired || !record.ownerClient.connected || t>=record.expiresAt || t<record.createdAt)
            dropPlan(record.reviewJob.reviewId,record);
        }catch{recoveryRequired=true;dropPlan(record.reviewJob.reviewId,record);}
      }
      return result;
    },()=>{recoveryRequired=true;record.reviewResult={status:'failed',error:sessionError('RECOVERY_REQUIRED')};dropPlan(record.reviewJob.reviewId,record);});
  }
  function prune() {
    const t = clock();
    for (const [id, record] of plans) if (!record.started && (t >= record.expiresAt || t < record.createdAt)) dropPlan(id, record);
  }
  function plan(id) {
    const record = plans.get(id); requireValue(record, 'INVALID_PLAN');
    requireValue(!record.started, 'ALREADY_STARTED');
    const t = clock();
    if (t >= record.expiresAt || t < record.createdAt) { dropPlan(id, record); throw sessionError('PLAN_EXPIRED'); }
    requireValue(record.view,'REVIEW_NOT_READY');
    requireValue(!record.revoked,'INVALID_PLAN');
    return record;
  }
  function participant(client, record) {
    requireValue(client.id === record.owner || client.id === record.approvedBy, 'SCOPE_FORBIDDEN');
  }
  function operationView(record) {
    const job = record.job, result = record.result;
    return {operationId:job.operationId, planId:record.view.planId, phase:result?.status === 'uncertain' ? 'uncertain' : job.phase,
      outcome:result ? {status:result.status, ...(result.versionId ? {versionId:result.versionId} : {}),
        ...(result.error ? {error:publicSessionError(result.error)} : {}),
        ...(result.cleanupError ? {cleanupError:publicSessionError(result.cleanupError)} : {})} : null,
      events:job.events.map(e => ({operationId:e.operationId, planId:e.planId, sequence:e.sequence, phase:e.phase,
        ...(e.code ? {code:publicSessionError(e).code} : {}), ...(e.versionId ? {versionId:e.versionId} : {})})), recovered:false};
  }
  async function dispatch(client, request) {
    connected(client); const p = request.params;
    if (recoveryRequired && !['getSession','getOperation','getPersistenceState','cancelOperation','getLinkedReview','cancelLinkedReview'].includes(request.method))
      throw sessionError('RECOVERY_REQUIRED');
    switch (request.method) {
      case 'getSession': {
        const s = await storage.readState(); requireValue(s.source.snapshot.sessionId === p.sessionId, 'SESSION_NOT_FOUND');
        return {projectId, revisionId:s.generationId, source:structuredClone(s.source), target:structuredClone(s.destination),
          assets:s.assets.map(a => ({...a})), versions:s.versions.map(v => ({versionId:v.versionId, sha256:v.sha256})),
          history:{past:[...s.past], future:[...s.future]}, capabilities:{...capabilities,
            allowedMethods:capabilities.supportedMethods.filter(method => client.role === 'human-ui' || !['approveLinkedUpdate','moveLinkedHistory'].includes(method))}};
      }
      case 'getPersistenceState': {
        const s = await storage.readState();
        // This adapter has no qualified application save receipt/time. Disk files
        // do not authorize a production "Saved" claim. Never infer from mtime.
        return {schemaVersion:1, projectId, status:recoveryRequired ? 'recovery-required' : 'session-only', revisionId:s.generationId,
          persistedRevisionId:null, lastPersistedAt:null, errorCode:recoveryRequired ? 'RECOVERY_REQUIRED' : null};
      }
      case 'reviewLinkedUpdate': {
        prune(); requireValue(plans.size < 64, 'HOST_CAPACITY');
        if(reviewMode==='rendered') {
          requireValue(reviews.size<64 && candidateSlots.size<limits.maxCandidates,'HOST_CAPACITY');
          const createdAt=clock(),reviewRevision=nextId();
          requireValue(Number.isSafeInteger(createdAt+reviewLifetimeMs),'INVALID_REQUEST');
          const job=linked.beginReview(p),record={reviewJob:job,view:null,reviewRevision,owner:client.id,ownerClient:client,
            approvedBy:null,receipt:null,started:false,revoked:false,createdAt,expiresAt:createdAt+reviewLifetimeMs};
          candidateSlots.add(record);plans.set(job.reviewId,record);reviews.set(job.reviewId,record);observeReview(record);
          return reviewStatus(record);
        }
        const view = await linked.review(p);
        try { writable(client); } catch (e) { linked.discard(view); throw e; }
        const createdAt = clock(), reviewRevision = nextId();
        requireValue(Number.isSafeInteger(createdAt + reviewLifetimeMs), 'INVALID_REQUEST');
        const record = {view, reviewRevision, owner:client.id, approvedBy:null, receipt:null, started:false,
          createdAt, expiresAt:createdAt + reviewLifetimeMs};
        plans.set(view.planId, record);
        return reviewedValue(record);
      }
      case 'getLinkedReview': {
        requireValue(reviewMode==='rendered','UNSUPPORTED_REVIEW_MODE');prune();const r=reviews.get(p.reviewId);requireValue(r,'INVALID_PLAN');reviewAccess(client,r);return reviewStatus(r);
      }
      case 'cancelLinkedReview': {
        requireValue(reviewMode==='rendered','UNSUPPORTED_REVIEW_MODE');const r=reviews.get(p.reviewId);requireValue(r,'INVALID_PLAN');reviewAccess(client,r);
        if(r.started)return {reviewId:p.reviewId,status:r.result?.status==='uncertain'?'too-late':r.job.cancel()};
        dropPlan(p.reviewId,r);return {reviewId:p.reviewId,status:'accepted',cleanup:r.cleanupOutcome?.status??'pending'};
      }
      case 'approveLinkedUpdate': {
        requireValue(client.role === 'human-ui', 'ROLE_FORBIDDEN'); const r = plan(p.planId);
        requireValue(r.reviewRevision === p.reviewRevision && !r.receipt, 'INVALID_APPROVAL');
        let receipt;
        if(r.reviewJob) {
          try{receipt=await linked.approvePreview(r.view);}catch(error){
            if(publicSessionError(error).code==='RECOVERY_REQUIRED')recoveryRequired=true;
            dropPlan(p.planId,r);throw error;
          }
          writable(client);requireValue(plan(p.planId)===r,'INVALID_PLAN');
        }else receipt=linked.approve(r.view);
        r.receipt = receipt; r.approvedBy = client.id;
        return {planId:p.planId, status:'approved'}; // Original capability object stays private.
      }
      case 'executeApproved': {
        const r = plan(p.planId); participant(client, r); requireValue(r.receipt, 'INVALID_APPROVAL');
        requireValue(operations.size < 64, 'HOST_CAPACITY');
        // No await between receipt consumption and service start. Service applies
        // the actual freshness/prepare/promotion barrier; no second executor here.
        const receipt = r.receipt; r.receipt = null; r.started = true;
        let job;
        try { job = linked.start(receipt); } catch { recoveryRequired = true; throw sessionError('RECOVERY_REQUIRED'); }
        r.job = job; r.result = null;
        operations.set(job.operationId, r);
        r.completion = job.completion.then(result => {
          r.result = result; if(result.status!=='uncertain'&&!result.cleanupError)candidateSlots.delete(r); if (result.status === 'uncertain' || result.cleanupError) recoveryRequired = true; return result;
        }, () => {
          recoveryRequired = true; r.result = {status:'uncertain',error:sessionError('RECOVERY_REQUIRED')}; return r.result;
        });
        return operationView(r);
      }
      case 'discardReview': {
        const r = plan(p.planId); if(r.reviewJob)reviewAccess(client,r);else participant(client, r);
        dropPlan(p.planId, r); return {status:'discarded',...(r.reviewJob?{cleanup:'pending'}:{})};
      }
      case 'getOperation': {
        const r = operations.get(p.operationId); if (r) return operationView(r);
        // Only committed operations can be reconciled from this adapter's
        // retained provenance. Absence is unknown, NEVER fabricated failure.
        const s = await storage.readState(), matches = s.versions.filter(v => v.provenance.operationId === p.operationId);
        requireValue(matches.length <= 1, 'RECOVERY_REQUIRED'); requireValue(matches.length === 1, 'OUTCOME_UNKNOWN');
        const v = matches[0];
        return {operationId:p.operationId, planId:v.provenance.planId, phase:'completed',
          outcome:{status:'completed', versionId:v.versionId}, events:[], recovered:true};
      }
      case 'cancelOperation': {
        const r = operations.get(p.operationId); requireValue(r, 'OUTCOME_UNKNOWN'); participant(client, r);
        return {operationId:p.operationId, status:r.result?.status === 'uncertain' ? 'too-late' : r.job.cancel()};
      }
      case 'moveLinkedHistory': {
        requireValue(client.role === 'human-ui', 'ROLE_FORBIDDEN');
        const target = await storage.readTarget(p.targetId); requireValue(target, 'INVALID_TARGET_ID');
        writable(client); const versionId = await storage.moveHistory(p.direction, p.expectedLinkRevisionId);
        return {targetId:p.targetId, versionId};
      }
      default: throw sessionError('UNSUPPORTED_METHOD');
    }
  }
  function disconnect(client) {
    if (!client.connected) return;
    client.connected = false; clients.delete(client);
    for (const [id, r] of plans) if (r.owner === client.id || r.approvedBy === client.id) {
      if (r.started) r.job?.cancel(); else dropPlan(id, r);
    }
  }
  return Object.freeze({hostEpoch, capabilities,
    // Privileged host-only registration. Never expose connect/role over IPC.
    connect(options) {
      requireValue(!closing, 'HOST_CLOSED'); sessionRecord(options, ['role']);
      requireValue(['human-ui','sylune'].includes(options.role), 'ROLE_FORBIDDEN');
      requireValue(clients.size < 8, 'HOST_CAPACITY');
      const client = {id:nextId(), role:options.role, connected:true, pending:0, requests:new Map()}; clients.add(client);
      function envelope(requestId, value, error) {
        return freezeSessionValue({schemaVersion:1, hostEpoch, projectId, requestId,
          ...(error ? {ok:false, error:publicSessionError(error)} : {ok:true, value})});
      }
      return Object.freeze({hostEpoch,
        invoke(input) {
          let request;
          try {
            connected(client); request = readSessionRequest(input);
            requireValue(request.projectId === projectId, 'FOREIGN_PROJECT');
            requireValue(request.hostEpoch === hostEpoch, 'HOST_EPOCH_CHANGED');
          } catch (e) { return Promise.resolve(envelope(request?.requestId ?? null, null, e)); }
          const fingerprint = JSON.stringify(request), old = client.requests.get(request.requestId);
          if (old) return old.fingerprint === fingerprint ? old.promise : Promise.resolve(envelope(request.requestId, null, sessionError('REQUEST_CONFLICT')));
          const mutating = !['getSession','getOperation','getPersistenceState','getLinkedReview'].includes(request.method);
          if (mutating && client.requests.size >= 128) return Promise.resolve(envelope(request.requestId, null, sessionError('REQUEST_CAPACITY')));
          if (client.pending >= 32 || pending >= 64) return Promise.resolve(envelope(request.requestId, null, sessionError('HOST_CAPACITY')));
          client.pending++; pending++;
          const promise = tail.then(async () => {
            try { const value = await dispatch(client, request); return envelope(request.requestId, value); }
            catch (e) { return envelope(request.requestId, null, e); }
          }).finally(() => { client.pending--; pending--; });
          tail = promise.then(() => {}, () => {});
          if (mutating) client.requests.set(request.requestId, {fingerprint, promise}); return promise;
        },
        readPreview(input) {
          let request;
          try {
            connected(client);request=readSessionPreviewRequest(input,renderProfile);
            requireValue(request.projectId===projectId,'FOREIGN_PROJECT');requireValue(request.hostEpoch===hostEpoch,'HOST_EPOCH_CHANGED');
            requireValue(reviewMode==='rendered','UNSUPPORTED_REVIEW_MODE');
            requireValue(client.pending<32 && pending<64 && (limits.fixedFrames!==null || activeReads.size<2),'HOST_CAPACITY');
          }catch(error){return Promise.resolve(envelope(null,null,error));}
          client.pending++;pending++;
          const task=Promise.resolve().then(async()=>{
            try {
              writable(client);const r=plan(request.planId);reviewAccess(client,r);
              requireValue(request.previewId===r.view.preview.previewId,'INVALID_PREVIEW');
              if(limits.fixedFrames===null)requireValue(request.offsetBytes<=r.view.preview.frames*8-request.lengthBytes,'INVALID_PREVIEW_RANGE');
              let preview;
              try{preview=await linked.readPreview(r.view,request.previewId,limits.fixedFrames===null?{offsetBytes:request.offsetBytes,lengthBytes:request.lengthBytes}:undefined);}catch(error){
                if(publicSessionError(error).code==='RECOVERY_REQUIRED')recoveryRequired=true;
                dropPlan(request.planId,r);throw error;
              }
              writable(client);requireValue(plan(request.planId)===r,'INVALID_PLAN');reviewAccess(client,r);
              // Freeze metadata only. A nonempty Uint8Array cannot be frozen; this
              // is the service's isolated copy, never a private/stored buffer.
              return Object.freeze({schemaVersion:1,hostEpoch,projectId,requestId:null,ok:true,
                value:Object.freeze({...preview,planId:request.planId})});
            }catch(error){return envelope(null,null,error);}
          }).finally(()=>{client.pending--;pending--;});
          activeReads.add(task);task.then(()=>activeReads.delete(task),()=>activeReads.delete(task));return task;
        },
        disconnect() { disconnect(client); }
      });
    },
    close() {
      if (!closePromise) {
        closing = true;
        for (const client of [...clients]) disconnect(client);
        closePromise = (async () => {
          await tail;
          await Promise.all([...operations.values()].map(r => r.completion));
          await Promise.all([...reviews.values()].map(r=>r.reviewCompletion));
          await Promise.all([...activeReads]);
          await Promise.all([...cleanupTasks]);
          try{await storage.close();}catch(error){cleanupFailures.push(error);}
          if(cleanupFailures.length)throw new AggregateError(cleanupFailures,'Session cleanup failed');
        })();
      }
      return closePromise;
    }
  });
}
