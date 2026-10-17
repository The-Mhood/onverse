import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {LEGACY_PROFILE,RANGE_PROFILE,getRenderProfile} from '../../src/domain/linkedSessions/renderProfiles.js';
import {createSnapshot,createSelection,dependencyKey,projectDependencies} from '../../src/domain/linkedSessions/linkedSessionContract.js';
import {encodePCM,decodePCM} from '../../src/audio/linkedSessions/pcm.js';
import {renderSelection} from '../../src/audio/linkedSessions/renderSelection.js';
import {createGenerationStore,openGenerationStore} from '../../src/infrastructure/linkedSessions/generationStore.js';
import {createLinkedUpdateService} from '../../src/application/linkedSessions/linkedUpdateService.js';
import {createSessionApplication} from '../../src/application/sessions/sessionApplication.js';
import {readSessionPreviewRequest} from '../../src/application/sessions/sessionWireContract.js';
import {rangeFixture,rangeHash,expectedRange} from '../fixtures/linkedRangeFixture.js';
const linux={skip:process.platform!=='linux'};
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function setup(t,options={}){
  const f=rangeFixture(await fs.mkdtemp('/tmp/onverse-range-test-'),options.boundary),store=await createGenerationStore(f);let renders=0;
  const render=options.render??(async({snapshot,selection})=>{renders++;const bytes=encodePCM(expectedRange(snapshot,selection,f.assets),RANGE_PROFILE);return {bytes,sha256:rangeHash(bytes),frames:bytes.length/8,sampleRate:48000,layout:['L','R']};});
  const app=createSessionApplication({projectId:'project-a',storage:options.storage?.(store)??store,render,reviewMode:'rendered',renderProfile:RANGE_PROFILE,...options.host});t.after(()=>app.close());
  const ui=app.connect({role:'human-ui'}),sylune=app.connect({role:'sylune'});let n=0;
  const call=(client,method,params={})=>client.invoke({schemaVersion:1,hostEpoch:app.hostEpoch,projectId:'project-a',requestId:'range-'+(++n),method,params});
  async function value(client,method,params={}){const r=await call(client,method,params);assert.equal(r.ok,true,JSON.stringify(r));return r.value;}
  const begin=()=>value(sylune,'reviewLinkedUpdate',{groupId:'drums',targetId:'linked'});
  async function until(id,predicate=r=>!!r.review){const end=performance.now()+10000;while(performance.now()<end){const r=await value(ui,'getLinkedReview',{reviewId:id});if(predicate(r))return r;await new Promise(r=>setTimeout(r,2));}throw Error('Review did not settle');}
  const ready=async()=>{const r=await begin();return (await until(r.reviewId)).review;};
  const read=(client,p,offsetBytes,lengthBytes,extra={})=>client.readPreview({schemaVersion:1,hostEpoch:app.hostEpoch,projectId:'project-a',planId:p.planId,previewId:p.preview.previewId,offsetBytes,lengthBytes,...extra});
  async function finish(id){const end=performance.now()+10000;while(performance.now()<end){const r=await value(ui,'getOperation',{operationId:id});if(r.outcome)return r;await new Promise(r=>setTimeout(r,2));}throw Error('Operation did not settle');}
  return {f,store,app,ui,sylune,render,call,value,begin,until,ready,read,finish,get renders(){return renders;}};
}
test('profile is explicit/frozen; legacy rejects larger ranges and PCM by default',()=>{
  const f=rangeFixture('/tmp');assert.ok(Object.isFrozen(getRenderProfile(RANGE_PROFILE)));assert.throws(()=>getRenderProfile({id:RANGE_PROFILE}));
  assert.throws(()=>createSnapshot(f.source.snapshot));assert.throws(()=>createSelection(f.source.selection));
  assert.equal(createSelection(f.source.selection,RANGE_PROFILE).rangeStartFrame,4800);
  const c=[new Float32Array(48000),new Float32Array(48000)];assert.throws(()=>encodePCM(c));const b=encodePCM(c,RANGE_PROFILE);assert.throws(()=>decodePCM(b,48000));assert.equal(decodePCM(b,48000,RANGE_PROFILE)[0].length,48000);
});
test('range/timeline/integer budgets reject before graph construction or allocation',()=>{
  const f=rangeFixture('/tmp');for(const patch of [{rangeStartFrame:-1},{rangeEndFrame:1},{rangeStartFrame:.5},{rangeEndFrame:4800+1440001},{rangeEndFrame:14400001},{rangeStartFrame:Number.MAX_SAFE_INTEGER}])assert.throws(()=>createSelection({...f.source.selection,...patch},RANGE_PROFILE));
  const max=createSelection({...f.source.selection,rangeStartFrame:14400000-1440000,rangeEndFrame:14400000},RANGE_PROFILE);assert.equal(max.rangeEndFrame-max.rangeStartFrame,1440000);
  for(const patch of [{frames:1440001},{startFrame:14400000},{frames:48000,startFrame:14400000-1}]){const s=structuredClone(f.source.snapshot);Object.assign(s.tracks[0],patch);assert.throws(()=>createSnapshot(s,RANGE_PROFILE));}
  const s=structuredClone(f.source.snapshot);s.tracks=Array.from({length:8},(_,i)=>({...s.tracks[0],trackId:'t-'+i,frames:1440000}));assert.throws(()=>createSnapshot(s,RANGE_PROFILE),/budget/);
  s.tracks=s.tracks.slice(0,4);const sel={...f.source.selection,trackIds:s.tracks.map(t=>t.trackId)};assert.throws(()=>projectDependencies(s,sel,RANGE_PROFILE),/budget/);
});
test('range, profile and exact members participate in canonical source guards',()=>{
  const f=rangeFixture('/tmp'),a=dependencyKey(f.source.snapshot,f.source.selection,RANGE_PROFILE),changed={...f.source.selection,rangeStartFrame:4801};
  assert.notEqual(a,dependencyKey(f.source.snapshot,changed,RANGE_PROFILE));assert.equal(JSON.parse(a).profile,RANGE_PROFILE);
  const s=structuredClone(f.source.snapshot);s.revisionId='renamed';s.tracks[0].label='rename';assert.equal(a,dependencyKey(s,f.source.selection,RANGE_PROFILE));
});
test('native wiring spy proves crop offset/duration, late start, silence outside range and mute; not DSP proof',async()=>{
  const f=rangeFixture('/tmp'),starts=[],gains=[],nodes=[];let graph=0;
  const context={destination:{},createBuffer(){return {copyToChannel(){}};},createBufferSource(){const n={connect(){},disconnect(){n.done=true;},start(...args){starts.push(args);}};nodes.push(n);return n;},createGain(){const n={gain:{value:1},connect(){},disconnect(){n.done=true;}};nodes.push(n);gains.push(n);return n;},async startRendering(){return {length:48000,sampleRate:48000,numberOfChannels:2,getChannelData:()=>new Float32Array(48000)};}};
  await renderSelection({...f.source,renderProfile:RANGE_PROFILE,loadAsset:async id=>f.assets.find(a=>a.assetId===id).bytes,createOfflineContext:(c,n,r)=>{graph++;assert.deepEqual([c,n,r],[2,48000,48000]);return context;}});
  assert.equal(graph,1);assert.deepEqual(starts,[[0,.1,1],[.4,0,.6],[0,.1,.1]]);assert.equal(gains[3].gain.value,0);assert.ok(nodes.every(n=>n.done));
});
test('range wire requires aligned bounded chunks and never accepts profiles/authority as input',()=>{
  const input={schemaVersion:1,hostEpoch:'host-a',projectId:'project-a',planId:'plan-a',previewId:'preview-a',offsetBytes:0,lengthBytes:262144};assert.equal(readSessionPreviewRequest(input,RANGE_PROFILE).lengthBytes,262144);assert.throws(()=>readSessionPreviewRequest(input));
  for(const patch of [{offsetBytes:-8},{offsetBytes:1},{lengthBytes:0},{lengthBytes:262152},{lengthBytes:9},{renderProfile:RANGE_PROFILE},{path:'/private'}])assert.throws(()=>readSessionPreviewRequest({...input,...patch},RANGE_PROFILE));
  let accessed=false;Object.defineProperty(input,'offsetBytes',{enumerable:true,get(){accessed=true;return 0;}});assert.throws(()=>readSessionPreviewRequest(input,RANGE_PROFILE));assert.equal(accessed,false);
});
test('real range host stages a 1s candidate, isolates chunks and commits same bytes once',linux,async t=>{
  const h=await setup(t),head=(await h.store.readState()).generationId,p=await h.ready();assert.equal(p.preview.frames,48000);assert.equal((await h.store.readState()).schemaVersion,3);assert.equal((await h.store.readState()).generationId,head);
  const parts=[];for(let offset=0;offset<384000;offset+=262144){const r=await h.read(h.ui,p,offset,Math.min(262144,384000-offset));assert.equal(r.ok,true);assert.equal(rangeHash(r.value.bytes),r.value.chunkSha256);parts.push(Buffer.from(r.value.bytes));r.value.bytes.fill(255);}
  const bytes=Buffer.concat(parts);assert.equal(rangeHash(bytes),p.preview.sha256);assert.equal((await h.read(h.sylune,p,0,8)).value.bytes[0],bytes[0]);
  const caps=(await h.value(h.ui,'getSession',{sessionId:'source-a'})).capabilities;assert.equal(caps.frames,null);assert.equal(caps.maxRangeFrames,1440000);assert.equal(caps.playbackTransport,false);
  await h.value(h.ui,'approveLinkedUpdate',{planId:p.planId,reviewRevision:p.reviewRevision});const op=await h.value(h.sylune,'executeApproved',{planId:p.planId});assert.equal((await h.finish(op.operationId)).outcome.status,'completed');assert.equal(h.renders,1);assert.ok((await h.store.readLinked()).bytes.equals(bytes));
});
test('invalid chunks and foreign/unscoped preview requests do not consume good candidate',linux,async t=>{
  const h=await setup(t),p=await h.ready(),other=h.app.connect({role:'sylune'});
  for(const [offset,length]of [[384000,8],[383992,16],[0,262152],[1,8]])assert.equal((await h.read(h.ui,p,offset,length)).error.code,'INVALID_PREVIEW_RANGE');
  assert.equal((await h.read(other,p,0,8)).error.code,'SCOPE_FORBIDDEN');assert.equal((await h.read(h.ui,p,0,8,{hostEpoch:'foreign'})).error.code,'HOST_EPOCH_CHANGED');assert.equal((await h.read(h.ui,p,0,8)).ok,true);
});
test('two retained candidates cap is enforced before rendering, and disposal releases capacity',linux,async t=>{
  const h=await setup(t),a=await h.ready(),b=await h.ready();assert.equal((await h.call(h.sylune,'reviewLinkedUpdate',{groupId:'drums',targetId:'linked'})).error.code,'HOST_CAPACITY');assert.equal(h.renders,2);
  await h.value(h.ui,'discardReview',{planId:a.planId});await h.until(a.planId,r=>r.cleanup.status==='completed');const c=await h.ready();assert.ok(c.preview);assert.equal(h.renders,3);await h.value(h.ui,'discardReview',{planId:b.planId});
});
test('range renderer cancellation during prepare remains nonblocking and unpins without promotion',linux,async t=>{
  let h,id,armed=false;const entered=gate(),release=gate();h=await setup(t,{boundary:async(at,op)=>{if(armed&&at==='media-synced'&&op==='prepare'){entered.resolve();await release.promise;assert.equal((await h.value(h.sylune,'cancelLinkedReview',{reviewId:id})).status,'accepted');}}});
  try{armed=true;id=(await h.begin()).reviewId;await entered.promise;release.resolve();const r=await h.until(id,r=>r.cleanup.status==='completed');assert.equal(r.phase,'cancelled');assert.equal((await h.store.readState()).destination.linkedVersionId,null);assert.ok((await h.store.inspectOrphans()).files.some(f=>f.size===384000));}finally{release.resolve();}
});
test('range change after approval fails closed, without rerendering; destination processors remain',linux,async t=>{
  const h=await setup(t),p=await h.ready();await h.value(h.ui,'approveLinkedUpdate',{planId:p.planId,reviewRevision:p.reviewRevision});
  const source=structuredClone(await h.store.readSource('drums'));source.selection.rangeStartFrame++;await h.store.updateSource(source);
  const op=await h.value(h.sylune,'executeApproved',{planId:p.planId});assert.equal((await h.finish(op.operationId)).outcome.error.code,'STALE_SOURCE');assert.equal(h.renders,1);assert.equal((await h.store.readState()).destination.linkedVersionId,null);
});
test('range host cannot attach by accident to legacy storage or omit rendered review mode',linux,async t=>{
  const h=await setup(t);assert.throws(()=>createSessionApplication({projectId:'project-a',storage:h.store,render:h.render}),/PROFILE_MISMATCH/);
  assert.throws(()=>createSessionApplication({projectId:'project-a',storage:h.store,render:h.render,renderProfile:RANGE_PROFILE}),/UNSUPPORTED_REVIEW_MODE/);
});
test('schema3 reopen verifies range geometry, restores exact history and rejects corrupted retained bytes',linux,async t=>{
  const h=await setup(t);async function update(){const p=await h.ready();await h.value(h.ui,'approveLinkedUpdate',{planId:p.planId,reviewRevision:p.reviewRevision});const op=await h.value(h.sylune,'executeApproved',{planId:p.planId});assert.equal((await h.finish(op.operationId)).outcome.status,'completed');return h.store.readLinked();}
  const a=await update(),s=structuredClone(await h.store.readSource('drums'));s.snapshot.tracks[0].gain=.75;s.selection.rangeEndFrame+=4800;await h.store.updateSource(s);const b=await update();assert.notEqual(a.bytes.length,b.bytes.length);
  await h.value(h.ui,'moveLinkedHistory',{targetId:'linked',direction:'undo',expectedLinkRevisionId:(await h.store.readState()).destination.linkRevisionId});assert.ok((await h.store.readLinked()).bytes.equals(a.bytes));
  await h.app.close();const next=await openGenerationStore(h.store.descriptor,{writable:true});assert.equal(next.renderProfile,RANGE_PROFILE);await next.moveHistory('redo',(await next.readState()).destination.linkRevisionId);assert.ok((await next.readLinked()).bytes.equals(b.bytes));await next.close();
  await fs.writeFile(h.store.descriptor.root+'/media-'+a.version.sha256+'.f32',new Uint8Array(8));await assert.rejects(openGenerationStore(h.store.descriptor,{writable:true}));
});
test('two concurrent range chunk reads are bounded and a third is backpressured',linux,async t=>{
  let pause=false;const enter=gate(),release=gate(),h=await setup(t,{storage:s=>({...s,readSource:async id=>{if(pause){enter.resolve();await release.promise;}return s.readSource(id);}})}),p=await h.ready();
  try{pause=true;const a=h.read(h.ui,p,0,8),b=h.read(h.sylune,p,8,8);await enter.promise;assert.equal((await h.read(h.ui,p,16,8)).error.code,'HOST_CAPACITY');pause=false;release.resolve();assert.equal((await a).ok,true);assert.equal((await b).ok,true);}finally{release.resolve();}
});
test('direct service also reserves candidate capacity before any awaited source/render',linux,async t=>{
  const h=await setup(t),release=gate();const service=createLinkedUpdateService({readSource:h.store.readSource,readTarget:h.store.readTarget,storage:h.store,render:async r=>{await release.promise;return h.render(r);},renderProfile:RANGE_PROFILE,reviewMode:'rendered'});
  try{const a=service.beginReview({groupId:'drums',targetId:'linked'}),b=service.beginReview({groupId:'drums',targetId:'linked'});assert.throws(()=>service.beginReview({groupId:'drums',targetId:'linked'}),/STAGING_CAPACITY/);a.cancel();b.cancel();release.resolve();await Promise.all([a.dispose(),b.dispose()]);const c=service.beginReview({groupId:'drums',targetId:'linked'});assert.equal((await c.completion).status,'review-ready');await c.dispose();}finally{release.resolve();}
});
test('range destination keeps native input alive through its declared EQ tail (wiring regression, not DSP proof)',async()=>{
  const {renderLinkedDestination}=await import('../../src/audio/linkedSessions/renderLinkedDestination.js');const buffers=[],starts=[],frames=48000;
  const ctx={destination:{},createBuffer(_c,n){buffers.push(n);return {copyToChannel(){}};},createBufferSource(){return {connect(){},disconnect(){},start(t){starts.push(t);}};},createGain(){return {gain:{value:1},connect(){},disconnect(){}};},createBiquadFilter(){return {frequency:{value:0},Q:{value:0},gain:{value:0},connect(){},disconnect(){}};},async startRendering(){return {length:52352,sampleRate:48000,numberOfChannels:2,getChannelData:()=>new Float32Array(52352)};}};
  const f=rangeFixture('/tmp'),out=await renderLinkedDestination({renderProfile:RANGE_PROFILE,linkedFrames:frames,linkedBytes:new Uint8Array(frames*8),unrelatedBytes:new Uint8Array(frames*8),unrelatedFrames:frames,processing:f.destination.processing,createOfflineContext:()=>ctx});
  assert.deepEqual(buffers,[52096,48000]);assert.deepEqual(starts,[256/48000,0]);assert.equal(out.frames,52352);
});
test('shared repository staging budget cannot be bypassed with multiple service instances',linux,async t=>{
  const h=await setup(t),make=()=>createLinkedUpdateService({readSource:h.store.readSource,readTarget:h.store.readTarget,storage:h.store,render:h.render,renderProfile:RANGE_PROFILE,reviewMode:'rendered'}),services=[make(),make(),make()];
  const jobs=services.map(s=>s.beginReview({groupId:'drums',targetId:'linked'})),results=await Promise.all(jobs.map(j=>j.completion));
  assert.equal(results.filter(r=>r.status==='review-ready').length,2);assert.equal(results.find(r=>r.status==='failed').error.code,'STAGING_CAPACITY');
  await Promise.all(jobs.map(j=>j.dispose()));const again=make().beginReview({groupId:'drums',targetId:'linked'});assert.equal((await again.completion).status,'review-ready');await again.dispose();
});
test('retained range-version budget fails before publication and preserves last valid pointer',linux,async t=>{
  const h=await setup(t),src=structuredClone(await h.store.readSource('drums'));src.selection.rangeEndFrame=src.selection.rangeStartFrame+1440000;await h.store.updateSource(src);
  let last;
  for(let n=0;n<6;n++){const p=await h.ready();await h.value(h.ui,'approveLinkedUpdate',{planId:p.planId,reviewRevision:p.reviewRevision});const before=await h.store.readState(),op=await h.value(h.sylune,'executeApproved',{planId:p.planId}),r=await h.finish(op.operationId);
    if(n<5){assert.equal(r.outcome.status,'completed');last=r.outcome.versionId;}else{assert.equal(r.outcome.status,'uncertain');assert.equal(r.outcome.error.code,'MEDIA_BUDGET');const after=await h.store.readState();assert.equal(after.generationId,before.generationId);assert.equal(after.destination.linkedVersionId,last);assert.equal(after.versions.length,5);}
  }
});
test('initial media budget rejects before root creation or copying oversized claimed assets',linux,async()=>{
  const parent=await fs.mkdtemp('/tmp/onverse-range-budget-'),f=rangeFixture(parent);f.assets=Array.from({length:6},(_,n)=>({assetId:'a-'+n,frames:1440000,bytes:new Uint8Array(8)}));
  await assert.rejects(createGenerationStore(f),/MEDIA_BUDGET/);assert.deepEqual(await fs.readdir(parent),[]);
});
test('expiry during a range-chunk read rejects late data and drains disposal',linux,async t=>{
  let pause=false,now=100;const enter=gate(),release=gate(),h=await setup(t,{host:{now:()=>now,reviewLifetimeMs:10},storage:s=>({...s,readSource:async id=>{if(pause){enter.resolve();await release.promise;}return s.readSource(id);}})}),p=await h.ready();
  try{pause=true;const reading=h.read(h.ui,p,0,262144);await enter.promise;now=110;pause=false;release.resolve();const r=await reading;assert.equal(r.ok,false);assert.equal(r.error.code,'PLAN_EXPIRED');assert.equal(r.value,undefined);await h.until(p.planId,r=>r.cleanup.status==='completed');}finally{release.resolve();}
});
