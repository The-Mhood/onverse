import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {createGenerationStore,openGenerationStore} from '../../src/infrastructure/linkedSessions/generationStore.js';
import {createSessionApplication} from '../../src/application/sessions/sessionApplication.js';
import {storeFixture} from '../fixtures/linkedSessionStoreFixture.js';
import {encodePCM,hashPCM} from '../../src/audio/linkedSessions/pcm.js';
import {recipe,expectedGroup} from '../../scripts/validation/offline-render-fixtures.mjs';
const linux={skip:process.platform!=='linux'};
async function setup(t,options={}) {
  const parent=await fs.mkdtemp('/tmp/onverse-application-'),store=await createGenerationStore(storeFixture(parent,options.boundary));
  let renders=0;
  const render=options.render??(async()=>{
    renders++;const bytes=encodePCM(expectedGroup(recipe()));return {bytes,sha256:await hashPCM(bytes),sampleRate:48000,frames:4096,layout:['L','R']};
  });
  const app=createSessionApplication({projectId:'project-a',storage:options.adaptStorage?.(store)??store,render,...options.host});t.after(()=>app.close());
  const ui=app.connect({role:'human-ui'}),sylune=app.connect({role:'sylune'});let seq=0;
  function command(client,method,params={},extra={}) {
    return client.invoke({schemaVersion:1,hostEpoch:app.hostEpoch,requestId:'request-'+(++seq),projectId:'project-a',method,params,...extra});
  }
  async function value(client,method,params={},extra={}){const r=await command(client,method,params,extra);assert.equal(r.ok,true,JSON.stringify(r));return r.value;}
  async function plan(client=sylune){return value(client,'reviewLinkedUpdate',{groupId:'drums',targetId:'linked'});}
  async function approved(client=sylune){const p=await plan(client);await value(ui,'approveLinkedUpdate',{planId:p.planId,reviewRevision:p.reviewRevision});return p;}
  async function finish(operationId,client=ui){
    // Poll actual service state, not timers/simulated progress. Bounded turn yield.
    for(let n=0;n<2000;n++){const op=await value(client,'getOperation',{operationId});if(op.outcome)return op;await new Promise(r=>setTimeout(r,1));}
    throw Error('Operation failed to settle');
  }
  return {store,app,ui,sylune,command,value,plan,approved,finish,get renders(){return renders;}};
}
test('facade projects the actual repository, not a second store; saving/preview remain honestly unavailable',linux,async t=>{
  const h=await setup(t),before=await h.store.readState();
  const view=await h.value(h.sylune,'getSession',{sessionId:'source-a'});assert.equal(view.revisionId,before.generationId);assert.deepEqual(view.source,before.source);
  assert.ok(!view.capabilities.allowedMethods.includes('approveLinkedUpdate'));assert.equal(view.capabilities.renderedPreview,false);assert.equal(view.capabilities.productionReady,false);
  assert.equal((await h.command(h.ui,'getSession',{sessionId:'imaginary'})).error.code,'SESSION_NOT_FOUND');
  const p=await h.plan();assert.equal(p.reviewKind,'metadata-only');assert.equal(p.preview,null);assert.equal(h.renders,0);
  const save=await h.value(h.ui,'getPersistenceState');assert.equal(save.status,'session-only');assert.equal(save.lastPersistedAt,null);assert.equal(save.persistedRevisionId,null);
  assert.equal((await h.store.readState()).generationId,before.generationId);
});
test('SYLUNE inspect/propose uses same core; only registered UI can approve, no caller-minted authority',linux,async t=>{
  const h=await setup(t),p=await h.plan();
  assert.equal((await h.command(h.sylune,'approveLinkedUpdate',{planId:p.planId,reviewRevision:p.reviewRevision})).error.code,'ROLE_FORBIDDEN');
  assert.equal((await h.command(h.sylune,'executeApproved',{planId:p.planId})).error.code,'INVALID_APPROVAL');
  assert.equal((await h.command(h.ui,'approveLinkedUpdate',{planId:p.planId,reviewRevision:'forged'})).error.code,'INVALID_APPROVAL');
  assert.equal((await h.command(h.ui,'approveLinkedUpdate',{planId:p.planId,reviewRevision:p.reviewRevision},{role:'human-ui'})).error.code,'INVALID_REQUEST');
  await h.value(h.ui,'approveLinkedUpdate',{planId:p.planId,reviewRevision:p.reviewRevision});
  const other=h.app.connect({role:'sylune'});assert.equal((await h.command(other,'executeApproved',{planId:p.planId})).error.code,'SCOPE_FORBIDDEN');
  const started=await h.value(h.sylune,'executeApproved',{planId:p.planId}),done=await h.finish(started.operationId);
  assert.equal(done.outcome.status,'completed');assert.equal((await h.store.readLinked()).version.versionId,done.outcome.versionId);
  assert.equal(h.renders,1);assert.equal((await h.command(h.sylune,'executeApproved',{planId:p.planId})).error.code,'ALREADY_STARTED');
});
test('request retries deduplicate pending execution, changed payload conflicts, inputs are copied',linux,async t=>{
  const h=await setup(t),p=await h.approved();
  const r={schemaVersion:1,hostEpoch:h.app.hostEpoch,requestId:'same-execute',projectId:'project-a',method:'executeApproved',params:{planId:p.planId}};
  const a=h.sylune.invoke(r),b=h.sylune.invoke({...r});r.params.planId='changed-after-call';
  const [one,two]=await Promise.all([a,b]);assert.deepEqual(one,two);assert.equal(one.ok,true);
  assert.equal((await h.sylune.invoke(r)).error.code,'REQUEST_CONFLICT');await h.finish(one.value.operationId);assert.equal(h.renders,1);
});
test('project/host binding, unsupported capabilities and disconnect reject without mutation',linux,async t=>{
  const h=await setup(t),before=(await h.store.readState()).generationId;
  assert.equal((await h.command(h.ui,'getSession',{sessionId:'source-a'},{projectId:'project-b'})).error.code,'FOREIGN_PROJECT');
  assert.equal((await h.command(h.ui,'getSession',{sessionId:'source-a'},{hostEpoch:'old-host'})).error.code,'HOST_EPOCH_CHANGED');
  assert.equal((await h.command(h.ui,'defineSelection',{})).error.code,'UNSUPPORTED_METHOD');
  h.ui.disconnect();assert.equal((await h.command(h.ui,'getSession',{sessionId:'source-a'})).error.code,'DISCONNECTED');
  assert.equal((await h.store.readState()).generationId,before);
});
test('disconnect revokes unstarted approval; stale source rejects with actual failed result',linux,async t=>{
  const h=await setup(t),p=await h.approved();h.ui.disconnect();
  assert.equal((await h.command(h.sylune,'executeApproved',{planId:p.planId})).error.code,'INVALID_PLAN');
  const ui=h.app.connect({role:'human-ui'}),next=await h.plan();await h.value(ui,'approveLinkedUpdate',{planId:next.planId,reviewRevision:next.reviewRevision});
  const source=structuredClone(await h.store.readSource('drums'));source.snapshot.tracks[0].gain=1;await h.store.updateSource(source);
  const op=await h.value(h.sylune,'executeApproved',{planId:next.planId}),done=await h.finish(op.operationId,ui);
  assert.equal(done.outcome.status,'failed');assert.equal(done.outcome.error.code,'STALE_SOURCE');assert.equal(h.renders,0);
});
test('review expiry and backwards clock fail closed',linux,async t=>{
  let now=100;const h=await setup(t,{host:{now:()=>now,reviewLifetimeMs:10}}),p=await h.plan();now=110;
  assert.equal((await h.command(h.ui,'approveLinkedUpdate',{planId:p.planId,reviewRevision:p.reviewRevision})).error.code,'PLAN_EXPIRED');
  now=200;const q=await h.plan();now=199;
  assert.equal((await h.command(h.ui,'approveLinkedUpdate',{planId:q.planId,reviewRevision:q.reviewRevision})).error.code,'PLAN_EXPIRED');
});
test('real cancellation during staging prevents promotion',linux,async t=>{
  let enter,release,enabled=false;const ready=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
  const h=await setup(t,{boundary:async(at,op)=>{if(enabled&&op==='prepare'&&at==='media-synced'){enter();await gate;}}});
  const p=await h.approved();enabled=true;const op=await h.value(h.sylune,'executeApproved',{planId:p.planId});await ready;
  try {assert.equal((await h.value(h.sylune,'cancelOperation',{operationId:op.operationId})).status,'accepted');} finally {release();}
  assert.equal((await h.finish(op.operationId)).outcome.status,'cancelled');assert.equal((await h.store.readState()).destination.linkedVersionId,null);
});
test('commit cancellation is too-late, exact history survives close/reopen and receipt recovery',linux,async t=>{
  let started,enter,release,enabled=false;const ready=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
  const h=await setup(t,{boundary:async(at,op)=>{if(enabled&&op==='commit'&&at==='pointer-synced'){enter();await gate;}}});
  const first=await h.approved(h.ui),a=await h.value(h.ui,'executeApproved',{planId:first.planId});await h.finish(a.operationId);const original=await h.store.readLinked();
  const next=await h.approved();enabled=true;started=await h.value(h.sylune,'executeApproved',{planId:next.planId});await ready;
  try {assert.equal((await h.value(h.sylune,'cancelOperation',{operationId:started.operationId})).status,'too-late');}finally{release();enabled=false;}
  const done=await h.finish(started.operationId);assert.equal(done.outcome.status,'completed');
  assert.equal((await h.command(h.sylune,'moveLinkedHistory',{targetId:'linked',direction:'undo',expectedLinkRevisionId:(await h.store.readState()).destination.linkRevisionId})).error.code,'ROLE_FORBIDDEN');
  const processing=(await h.store.readState()).destination.processing;
  await h.value(h.ui,'moveLinkedHistory',{targetId:'linked',direction:'undo',expectedLinkRevisionId:(await h.store.readState()).destination.linkRevisionId});
  assert.equal((await h.store.readLinked()).version.versionId,original.version.versionId);assert.deepEqual((await h.store.readLinked()).bytes,original.bytes);
  await h.value(h.ui,'moveLinkedHistory',{targetId:'linked',direction:'redo',expectedLinkRevisionId:(await h.store.readState()).destination.linkRevisionId});
  assert.deepEqual((await h.store.readState()).destination.processing,processing);
  await h.app.close();const reopened=await openGenerationStore(h.store.descriptor,{writable:true});
  const app=createSessionApplication({projectId:'project-a',storage:reopened,render:async()=>{throw Error('must not rerender');}});t.after(()=>app.close());
  const ui=app.connect({role:'human-ui'}),query=id=>ui.invoke({schemaVersion:1,hostEpoch:app.hostEpoch,requestId:id,projectId:'project-a',method:'getOperation',params:{operationId:id}});
  const recovered=await query(started.operationId);assert.equal(recovered.value.recovered,true);assert.equal(recovered.value.outcome.versionId,done.outcome.versionId);
  assert.equal((await query('not-recorded')).error.code,'OUTCOME_UNKNOWN');
  assert.equal((await ui.invoke({schemaVersion:1,hostEpoch:app.hostEpoch,requestId:'old-plan-replay',projectId:'project-a',method:'executeApproved',params:{planId:next.planId}})).error.code,'INVALID_PLAN');
});
test('operation errors and event codes redact private messages, paths and arbitrary codes',linux,async t=>{
  const h=await setup(t,{render:async()=>{throw Object.assign(Error('/private/user-audio.wav'),{code:'/secret/path'});}});
  const p=await h.approved(),op=await h.value(h.sylune,'executeApproved',{planId:p.planId}),done=await h.finish(op.operationId);
  assert.equal(done.outcome.status,'failed');assert.ok(!JSON.stringify(done).includes('/secret'));assert.ok(!JSON.stringify(done).includes('/private'));
});
test('host close is shared, cancels eligibility, drains operation then releases writer',linux,async t=>{
  let enter,release;const ready=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
  const h=await setup(t,{render:async()=>{enter();await gate;const bytes=encodePCM(expectedGroup(recipe()));return {bytes,sha256:await hashPCM(bytes),sampleRate:48000,frames:4096,layout:['L','R']};}});
  const p=await h.approved();await h.value(h.sylune,'executeApproved',{planId:p.planId});await ready;
  const a=h.app.close(),b=h.app.close();assert.equal(a,b);assert.equal((await h.command(h.ui,'getSession',{sessionId:'source-a'})).error.code,'HOST_CLOSED');release();await a;
  const next=await openGenerationStore(h.store.descriptor,{writable:true});try{assert.equal((await next.readState()).destination.linkedVersionId,null);}finally{await next.close();}
});
test('read queries stay fresh and do not consume or cache the mutation replay ledger',linux,async t=>{
  let enter,release;const ready=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
  const h=await setup(t,{render:async()=>{enter();await gate;const bytes=encodePCM(expectedGroup(recipe()));return {bytes,sha256:await hashPCM(bytes),sampleRate:48000,frames:4096,layout:['L','R']};}});
  const p=await h.approved(),op=await h.value(h.sylune,'executeApproved',{planId:p.planId});await ready;
  const r={schemaVersion:1,hostEpoch:h.app.hostEpoch,requestId:'fresh-query',projectId:'project-a',method:'getOperation',params:{operationId:op.operationId}};
  try {
    assert.equal((await h.ui.invoke(r)).value.outcome,null);
    for(let n=0;n<140;n++)assert.equal((await h.command(h.ui,'getOperation',{operationId:op.operationId})).ok,true);
  }finally{release();}
  await h.finish(op.operationId);assert.equal((await h.ui.invoke(r)).value.outcome.status,'completed');
});
test('disconnect during asynchronous review rejects new authority and does not publish',linux,async t=>{
  let enter,release;const ready=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
  const h=await setup(t,{adaptStorage:store=>({...store,async readSource(id){enter();await gate;return store.readSource(id);}})});
  const pending=h.command(h.sylune,'reviewLinkedUpdate',{groupId:'drums',targetId:'linked'});await ready;h.sylune.disconnect();release();
  assert.equal((await pending).error.code,'DISCONNECTED');assert.equal((await h.store.readState()).destination.linkedVersionId,null);
});
test('unexpected service completion rejection becomes recovery-required and close still releases writer',linux,async t=>{
  const h=await setup(t,{render:async()=>{throw Object.defineProperty(Error('/private/data'),'code',{get(){throw Error('/secret');}});}});
  const p=await h.approved(),op=await h.value(h.sylune,'executeApproved',{planId:p.planId}),done=await h.finish(op.operationId);
  assert.equal(done.phase,'uncertain');assert.equal(done.outcome.error.code,'RECOVERY_REQUIRED');assert.ok(!JSON.stringify(done).includes('/secret'));
  assert.equal((await h.value(h.ui,'getPersistenceState')).status,'recovery-required');
  assert.equal((await h.command(h.ui,'reviewLinkedUpdate',{groupId:'drums',targetId:'linked'})).error.code,'RECOVERY_REQUIRED');
  assert.equal((await h.value(h.sylune,'cancelOperation',{operationId:op.operationId})).status,'too-late');
  await h.app.close();const next=await openGenerationStore(h.store.descriptor,{writable:true});await next.close();
});
test('two approved same-target operations cannot both promote through the shared service',linux,async t=>{
  const h=await setup(t),a=await h.approved(),b=await h.approved();
  const [x,y]=await Promise.all([h.value(h.sylune,'executeApproved',{planId:a.planId}),h.value(h.sylune,'executeApproved',{planId:b.planId})]);
  const done=await Promise.all([h.finish(x.operationId),h.finish(y.operationId)]);assert.equal(done.filter(o=>o.outcome.status==='completed').length,1);
  assert.equal((await h.store.readState()).versions.length,1);
});
test('mutation replay ledger is bounded without eviction/reexecution; reads remain available',linux,async t=>{
  const h=await setup(t);
  for(let n=0;n<128;n++)assert.equal((await h.command(h.ui,'discardReview',{planId:'not-issued'})).error.code,'INVALID_PLAN');
  assert.equal((await h.command(h.ui,'discardReview',{planId:'not-issued'})).error.code,'REQUEST_CAPACITY');
  assert.equal((await h.command(h.ui,'getSession',{sessionId:'source-a'})).ok,true);
});
test('host client registrations are bounded, role-bound and capacity releases on disconnect',linux,async t=>{
  const h=await setup(t),clients=[];for(let n=0;n<6;n++)clients.push(h.app.connect({role:'sylune'}));
  assert.throws(()=>h.app.connect({role:'human-ui'}),/HOST_CAPACITY/);clients[0].disconnect();h.app.connect({role:'human-ui'});
  assert.throws(()=>h.app.connect({role:'admin'}),/ROLE_FORBIDDEN/);
});
test('ambiguous post-rename commit reconciles real retained receipt after reopen, never repeats approval',linux,async t=>{
  const h=await setup(t,{boundary:async(at,op)=>{if(op==='commit'&&at==='pointer-renamed')throw Error('private injected I/O');}});
  const p=await h.approved(),op=await h.value(h.sylune,'executeApproved',{planId:p.planId}),done=await h.finish(op.operationId);
  assert.equal(done.outcome.status,'uncertain');const actual=await h.store.readLinked();
  assert.equal((await h.command(h.ui,'moveLinkedHistory',{targetId:'linked',direction:'undo',expectedLinkRevisionId:actual.state.destination.linkRevisionId})).error.code,'RECOVERY_REQUIRED');
  await h.app.close();const reopened=await openGenerationStore(h.store.descriptor,{writable:true});
  const app=createSessionApplication({projectId:'project-a',storage:reopened,render:async()=>{throw Error('no retry');}});t.after(()=>app.close());const ui=app.connect({role:'human-ui'});
  const result=await ui.invoke({schemaVersion:1,hostEpoch:app.hostEpoch,projectId:'project-a',requestId:'reconcile',method:'getOperation',params:{operationId:op.operationId}});
  assert.equal(result.value.outcome.status,'completed');assert.equal(result.value.outcome.versionId,actual.version.versionId);assert.equal(result.value.recovered,true);
});
test('queued queries have per-client/global backpressure and capacity returns after drain',linux,async t=>{
  let release;const gate=new Promise(r=>release=r);
  const h=await setup(t,{adaptStorage:store=>({...store,async readState(){await gate;return store.readState();}})}),pending=[];
  try {
    for(let n=0;n<32;n++)pending.push(h.command(h.ui,'getSession',{sessionId:'source-a'}));
    assert.equal((await h.command(h.ui,'getSession',{sessionId:'source-a'})).error.code,'HOST_CAPACITY');
    for(let n=0;n<32;n++)pending.push(h.command(h.sylune,'getSession',{sessionId:'source-a'}));
    const extra=h.app.connect({role:'human-ui'});assert.equal((await h.command(extra,'getSession',{sessionId:'source-a'})).error.code,'HOST_CAPACITY');
  }finally{release();}
  assert.ok((await Promise.all(pending)).every(r=>r.ok));assert.equal((await h.command(h.ui,'getSession',{sessionId:'source-a'})).ok,true);
});
