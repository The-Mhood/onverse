import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {createGenerationStore,openGenerationStore} from '../../src/infrastructure/linkedSessions/generationStore.js';
import {createSessionApplication} from '../../src/application/sessions/sessionApplication.js';
import {storeFixture} from '../fixtures/linkedSessionStoreFixture.js';
import {encodePCM,hashPCM} from '../../src/audio/linkedSessions/pcm.js';
import {recipe,expectedGroup} from '../../scripts/validation/offline-render-fixtures.mjs';
const linux={skip:process.platform!=='linux'};
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function setup(t,options={}) {
  const store=await createGenerationStore(storeFixture(await fs.mkdtemp('/tmp/onverse-staged-host-'),options.boundary));let renders=0;
  const bytes=encodePCM(expectedGroup(recipe())),media={bytes,sha256:await hashPCM(bytes),frames:4096,sampleRate:48000,layout:['L','R']};
  const app=createSessionApplication({projectId:'project-a',storage:options.adaptStorage?.(store)??store,
    render:async request=>{renders++;return options.render?options.render(request,media):media;},reviewMode:'rendered',...options.host});
  t.after(()=>options.closeFails?assert.rejects(app.close(),/Session cleanup failed/):app.close());
  const ui=app.connect({role:'human-ui'}),sylune=app.connect({role:'sylune'});let n=0;
  const request=(method,params={})=>({schemaVersion:1,hostEpoch:app.hostEpoch,projectId:'project-a',requestId:'staged-'+(++n),method,params});
  const call=(client,method,params={})=>client.invoke(request(method,params));
  async function value(client,method,params={}){const r=await call(client,method,params);assert.equal(r.ok,true,JSON.stringify(r));return r.value;}
  const begin=(client=sylune)=>value(client,'reviewLinkedUpdate',{groupId:'drums',targetId:'linked'});
  async function until(client,reviewId,predicate=r=>!!r.review){
    const end=performance.now()+5000;
    while(performance.now()<end){const r=await value(client,'getLinkedReview',{reviewId});if(predicate(r))return r;await new Promise(r=>setTimeout(r,2));}
    throw Error('Review did not settle');
  }
  const ready=async(client=sylune)=>{const handle=await begin(client);return (await until(client,handle.reviewId)).review;};
  const previewRequest=(p,extra={})=>({schemaVersion:1,hostEpoch:app.hostEpoch,projectId:'project-a',planId:p.planId,previewId:p.preview.previewId,...extra});
  const read=(client,p,extra)=>client.readPreview(previewRequest(p,extra));
  async function finish(id){const end=performance.now()+5000;while(performance.now()<end){const op=await value(ui,'getOperation',{operationId:id});if(op.outcome)return op;await new Promise(r=>setTimeout(r,2));}throw Error('Operation did not settle');}
  return {store,app,ui,sylune,media,request,call,value,begin,until,ready,read,previewRequest,finish,get renders(){return renders;}};
}
test('opt-in handle -> staged bytes -> registered UI approval -> exact commit without rerender',linux,async t=>{
  const h=await setup(t),before=(await h.store.readState()).generationId,handle=await h.begin();
  assert.ok(handle.reviewId);assert.equal(handle.review,null);assert.equal(handle.phase,'capturing');
  const p=(await h.until(h.ui,handle.reviewId)).review;assert.equal(p.reviewKind,'rendered');assert.equal(p.preview.frames,4096);assert.equal(h.renders,1);
  assert.equal((await h.store.readState()).generationId,before);assert.equal((await h.value(h.ui,'getSession',{sessionId:'source-a'})).capabilities.playbackTransport,false);
  assert.equal((await h.call(h.sylune,'executeApproved',{planId:p.planId})).error.code,'INVALID_APPROVAL');
  assert.equal((await h.call(h.sylune,'approveLinkedUpdate',{planId:p.planId,reviewRevision:p.reviewRevision})).error.code,'ROLE_FORBIDDEN');
  const a=await h.read(h.ui,p);assert.equal(a.ok,true);assert.ok(a.value.bytes instanceof Uint8Array);assert.equal(await hashPCM(a.value.bytes),p.preview.sha256);
  a.value.bytes.fill(255);const b=await h.read(h.sylune,p);assert.equal(await hashPCM(b.value.bytes),p.preview.sha256);assert.ok(Object.isFrozen(b.value));
  assert.ok(!JSON.stringify(p).includes('bytes'));await h.value(h.ui,'approveLinkedUpdate',{planId:p.planId,reviewRevision:p.reviewRevision});
  const op=await h.value(h.sylune,'executeApproved',{planId:p.planId});assert.equal(op.operationId,p.preview.previewId);
  assert.equal((await h.finish(op.operationId)).outcome.status,'completed');assert.equal(h.renders,1);assert.ok((await h.store.readLinked()).bytes.equals(b.value.bytes));
  assert.equal((await h.read(h.ui,p)).error.code,'ALREADY_STARTED');assert.equal((await h.call(h.sylune,'executeApproved',{planId:p.planId})).error.code,'ALREADY_STARTED');
});
test('preview byte path enforces exact context, IDs and role scope; malformed requests do not revoke valid review',linux,async t=>{
  const h=await setup(t),p=await h.ready(),other=h.app.connect({role:'sylune'}),anotherUI=h.app.connect({role:'human-ui'});
  assert.equal((await h.read(other,p)).error.code,'SCOPE_FORBIDDEN');assert.equal((await h.call(other,'getLinkedReview',{reviewId:p.planId})).error.code,'SCOPE_FORBIDDEN');
  for(const [extra,code]of [[{hostEpoch:'foreign'},'HOST_EPOCH_CHANGED'],[{projectId:'foreign'},'FOREIGN_PROJECT'],[{previewId:'forged'},'INVALID_PREVIEW'],[{planId:'forged'},'INVALID_PLAN'],[{role:'human-ui'},'INVALID_REQUEST']])assert.equal((await h.read(h.ui,p,extra)).error.code,code);
  const evil=h.previewRequest(p);let touched=false;Object.defineProperty(evil,'planId',{enumerable:true,get(){touched=true;return p.planId;}});
  assert.equal((await h.ui.readPreview(evil)).error.code,'INVALID_REQUEST');assert.equal(touched,false);assert.equal((await h.read(anotherUI,p)).ok,true);
});
test('pending review render never occupies command queue; cancellation revokes immediately and close drains render',linux,async t=>{
  const entered=gate(),release=gate(),h=await setup(t,{render:async(_r,media)=>{entered.resolve();await release.promise;return media;}});
  try {
    const handle=await h.begin();await entered.promise;
    assert.equal((await h.call(h.ui,'approveLinkedUpdate',{planId:handle.reviewId,reviewRevision:'forged'})).error.code,'REVIEW_NOT_READY');
    assert.equal((await h.value(h.sylune,'cancelLinkedReview',{reviewId:handle.reviewId})).status,'accepted');
    assert.equal((await h.value(h.ui,'getLinkedReview',{reviewId:handle.reviewId})).review,null);
    let closed=false;const closing=h.app.close().then(()=>{closed=true;});await new Promise(r=>setImmediate(r));assert.equal(closed,false);
    release.resolve();await closing;const next=await openGenerationStore(h.store.descriptor,{writable:true});assert.equal((await next.readState()).destination.linkedVersionId,null);await next.close();
  }finally{release.resolve();}
});
test('native repository prepare hook can await host cancellation without command-queue deadlock',linux,async t=>{
  let h,handle,enabled=false;const entered=gate(),allowHook=gate();
  h=await setup(t,{boundary:async(at,op)=>{if(enabled&&at==='media-synced'&&op==='prepare'){entered.resolve();await allowHook.promise;assert.equal((await h.value(h.sylune,'cancelLinkedReview',{reviewId:handle.reviewId})).status,'accepted');}}});
  try{enabled=true;handle=await h.begin();await entered.promise;allowHook.resolve();const r=await h.until(h.ui,handle.reviewId,r=>r.cleanup.status==='completed');assert.equal(r.phase,'cancelled');assert.equal(r.review,null);assert.equal((await h.store.readState()).destination.linkedVersionId,null);assert.equal((await h.store.inspectOrphans()).files.length,1);}finally{allowHook.resolve();}
});
test('expiry/clock rollback discard ready previews and unpin; expiry during rendering cannot publish a ready handle',linux,async t=>{
  let now=100;const h=await setup(t,{host:{now:()=>now,reviewLifetimeMs:10}}),p=await h.ready();now=110;
  assert.equal((await h.read(h.ui,p)).error.code,'PLAN_EXPIRED');const expired=await h.until(h.ui,p.planId,r=>r.cleanup.status==='completed');assert.equal(expired.review,null);
  now=200;const q=await h.ready();now=199;assert.equal((await h.call(h.ui,'approveLinkedUpdate',{planId:q.planId,reviewRevision:q.reviewRevision})).error.code,'PLAN_EXPIRED');
  const enter=gate(),release=gate();let later=300;const k=await setup(t,{host:{now:()=>later,reviewLifetimeMs:10},render:async(_r,m)=>{enter.resolve();await release.promise;return m;}});
  try{const handle=await k.begin();await enter.promise;later=310;release.resolve();const status=await k.until(k.ui,handle.reviewId,r=>r.cleanup.status==='completed');assert.equal(status.review,null);assert.equal((await k.store.readState()).destination.linkedVersionId,null);}finally{release.resolve();}
});
test('disconnect invalidates ready authority, including already approved review and other participants',linux,async t=>{
  const h=await setup(t),p=await h.ready();await h.value(h.ui,'approveLinkedUpdate',{planId:p.planId,reviewRevision:p.reviewRevision});h.sylune.disconnect();
  assert.equal((await h.read(h.ui,p)).error.code,'INVALID_PLAN');assert.equal((await h.call(h.ui,'executeApproved',{planId:p.planId})).error.code,'INVALID_PLAN');
  assert.equal((await h.until(h.ui,p.planId,r=>r.cleanup.status==='completed')).review,null);assert.equal((await h.store.inspectOrphans()).files.length,1);
});
test('disconnect during asynchronous preview read denies returned bytes without revoking another owner',linux,async t=>{
  let pause=false;const entered=gate(),release=gate(),h=await setup(t,{adaptStorage:s=>({...s,readSource:async id=>{if(pause){entered.resolve();await release.promise;}return s.readSource(id);}})}),p=await h.ready();
  try{pause=true;const reading=h.read(h.ui,p);await entered.promise;h.ui.disconnect();release.resolve();assert.equal((await reading).error.code,'DISCONNECTED');pause=false;assert.equal((await h.read(h.sylune,p)).ok,true);}finally{release.resolve();}
});
test('relevant source edits fail before final approval, and stale-after-approval commit never rerenders',linux,async t=>{
  for(const approveFirst of [false,true]){
    const h=await setup(t),p=await h.ready();if(approveFirst)await h.value(h.ui,'approveLinkedUpdate',{planId:p.planId,reviewRevision:p.reviewRevision});
    const source=structuredClone(await h.store.readSource('drums'));source.snapshot.tracks[0].gain=1;await h.store.updateSource(source);
    if(approveFirst){const op=await h.value(h.sylune,'executeApproved',{planId:p.planId});assert.equal((await h.finish(op.operationId)).outcome.error.code,'STALE_SOURCE');}
    else assert.equal((await h.call(h.ui,'approveLinkedUpdate',{planId:p.planId,reviewRevision:p.reviewRevision})).error.code,'STALE_SOURCE');
    assert.equal(h.renders,1);assert.equal((await h.store.readState()).destination.linkedVersionId,null);
  }
});
test('ready discard is observable, cleanup failure is fail-closed and close still releases real writer',linux,async t=>{
  const h=await setup(t,{closeFails:true,adaptStorage:s=>({...s,discard:async()=>{throw Error('/private/cleanup-file');}})}),p=await h.ready();
  await h.value(h.ui,'discardReview',{planId:p.planId});const status=await h.until(h.ui,p.planId,r=>r.cleanup.status==='failed');
  assert.deepEqual(status.cleanup.error,{code:'INTERNAL_ERROR'});assert.ok(!JSON.stringify(status).includes('/private'));assert.equal((await h.value(h.ui,'getPersistenceState')).status,'recovery-required');
  assert.equal((await h.call(h.sylune,'reviewLinkedUpdate',{groupId:'drums',targetId:'linked'})).error.code,'RECOVERY_REQUIRED');
  await assert.rejects(h.app.close(),/Session cleanup failed/);const next=await openGenerationStore(h.store.descriptor,{writable:true});await next.close();
});
test('cancel/disconnect after promotion never dispose possibly committed staging',linux,async t=>{
  let h,planId,enabled=false,discards=0;h=await setup(t,{adaptStorage:s=>({...s,discard:async token=>{discards++;return s.discard(token);}}),boundary:async(at,op)=>{
    if(enabled&&at==='pointer-synced'&&op==='commit'){assert.equal((await h.value(h.sylune,'cancelLinkedReview',{reviewId:planId})).status,'too-late');h.sylune.disconnect();}
  }});
  const p=await h.ready();planId=p.planId;await h.value(h.ui,'approveLinkedUpdate',{planId,reviewRevision:p.reviewRevision});enabled=true;
  const op=await h.value(h.sylune,'executeApproved',{planId});assert.equal((await h.finish(op.operationId)).outcome.status,'completed');assert.equal(discards,0);assert.equal((await h.store.readLinked()).version.sha256,p.preview.sha256);
});
test('preview reads share per-client/global backpressure and capacity returns after drain',linux,async t=>{
  let pause=false;const entered=gate(),release=gate(),h=await setup(t,{adaptStorage:s=>({...s,readSource:async id=>{if(pause){entered.resolve();await release.promise;}return s.readSource(id);}})}),p=await h.ready();
  try{pause=true;const reads=Array.from({length:32},()=>h.read(h.ui,p));await entered.promise;assert.equal((await h.read(h.ui,p)).error.code,'HOST_CAPACITY');
    reads.push(...Array.from({length:32},()=>h.read(h.sylune,p)));const other=h.app.connect({role:'human-ui'});assert.equal((await h.call(other,'getPersistenceState')).error.code,'HOST_CAPACITY');
    release.resolve();assert.ok((await Promise.all(reads)).every(r=>r.ok));pause=false;assert.equal((await h.read(h.ui,p)).ok,true);
  }finally{release.resolve();}
});
test('review creation retries deduplicate work but repeated status request IDs read fresh state',linux,async t=>{
  const entered=gate(),release=gate(),h=await setup(t,{render:async(_r,m)=>{entered.resolve();await release.promise;return m;}});
  try{const request=h.request('reviewLinkedUpdate',{groupId:'drums',targetId:'linked'}),a=h.sylune.invoke(request),b=h.sylune.invoke(structuredClone(request));assert.equal(a,b);
    const handle=(await a).value;await entered.promise;const query=h.request('getLinkedReview',{reviewId:handle.reviewId});assert.equal((await h.ui.invoke(query)).value.review,null);
    release.resolve();await h.until(h.ui,handle.reviewId);assert.ok((await h.ui.invoke(query)).value.review);assert.equal(h.renders,1);
  }finally{release.resolve();}
});
test('review cancellation after execute is still accepted before promotion, without prematurely releasing its token',linux,async t=>{
  let pause=false,discards=0;const enter=gate(),release=gate(),h=await setup(t,{adaptStorage:s=>({...s,
    readSource:async id=>{if(pause){enter.resolve();await release.promise;}return s.readSource(id);},discard:async token=>{discards++;return s.discard(token);}})}),p=await h.ready();
  try{await h.value(h.ui,'approveLinkedUpdate',{planId:p.planId,reviewRevision:p.reviewRevision});pause=true;
    const op=await h.value(h.sylune,'executeApproved',{planId:p.planId});await enter.promise;
    assert.equal((await h.value(h.sylune,'cancelLinkedReview',{reviewId:p.planId})).status,'accepted');assert.equal(discards,0);assert.equal((await h.store.inspectOrphans()).files.length,0);
    pause=false;release.resolve();assert.equal((await h.finish(op.operationId)).outcome.status,'cancelled');assert.equal(discards,1);assert.equal((await h.store.readState()).destination.linkedVersionId,null);
  }finally{release.resolve();}
});
test('expiry or discard while preview read is pending never returns late bytes',linux,async t=>{
  for(const kind of ['expiry','discard']){
    let pause=false,now=100;const enter=gate(),release=gate(),h=await setup(t,{host:{now:()=>now,reviewLifetimeMs:10},adaptStorage:s=>({...s,readSource:async id=>{if(pause){enter.resolve();await release.promise;}return s.readSource(id);}})}),p=await h.ready();
    try{pause=true;const reading=h.read(h.ui,p);await enter.promise;if(kind==='expiry')now=110;else await h.value(h.ui,'discardReview',{planId:p.planId});pause=false;release.resolve();
      const result=await reading;assert.equal(result.ok,false);assert.ok(['PLAN_EXPIRED','INVALID_PREVIEW'].includes(result.error.code));assert.equal(result.value,undefined);
      await h.until(h.ui,p.planId,r=>r.cleanup.status==='completed');
    }finally{release.resolve();}
  }
});
test('close waits pending preview readers before releasing repository ownership',linux,async t=>{
  let pause=false;const enter=gate(),release=gate(),h=await setup(t,{adaptStorage:s=>({...s,readSource:async id=>{if(pause){enter.resolve();await release.promise;}return s.readSource(id);}})}),p=await h.ready();
  try{pause=true;const reading=h.read(h.ui,p);await enter.promise;let closed=false;const closing=h.app.close().then(()=>{closed=true;});await new Promise(r=>setImmediate(r));assert.equal(closed,false);
    pause=false;release.resolve();assert.equal((await reading).ok,false);await closing;const next=await openGenerationStore(h.store.descriptor,{writable:true});await next.close();
  }finally{release.resolve();}
});
test('pending review jobs are bounded independently of the short-command queue',linux,async t=>{
  const release=gate(),h=await setup(t,{render:async(_r,m)=>{await release.promise;return m;}});
  try{for(let n=0;n<64;n++)assert.ok((await h.begin()).reviewId);
    assert.equal((await h.call(h.sylune,'reviewLinkedUpdate',{groupId:'drums',targetId:'linked'})).error.code,'HOST_CAPACITY');
    assert.equal((await h.value(h.ui,'getPersistenceState')).status,'session-only');release.resolve();
  }finally{release.resolve();}
});
