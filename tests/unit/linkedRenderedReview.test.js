import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {createGenerationStore} from '../../src/infrastructure/linkedSessions/generationStore.js';
import {createLinkedUpdateService} from '../../src/application/linkedSessions/linkedUpdateService.js';
import {hashPCM} from '../../src/audio/linkedSessions/pcm.js';
import {storeFixture} from '../fixtures/linkedSessionStoreFixture.js';
const linux={skip:process.platform!=='linux'};
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function setup(t,options={}) {
  const store=await createGenerationStore(storeFixture(await fs.mkdtemp('/tmp/onverse-rendered-review-'),options.boundary));t.after(()=>store.close());
  let renders=0,discards=0,prepares=0;const bytes=new Uint8Array(32768),sha256=await hashPCM(bytes);
  const media={bytes,sha256,frames:4096,sampleRate:48000,layout:['L','R']};
  const ports={readSource:store.readSource,readTarget:store.readTarget,render:options.render??(async()=>{renders++;return media;}),
    storage:options.storage?.(store)??{...store,async prepare(media){prepares++;return store.prepare(media);},async discard(token){discards++;return store.discard(token);}},reviewMode:'rendered'};
  const service=createLinkedUpdateService(ports);
  const begin=()=>service.beginReview({groupId:'drums',targetId:'linked'});
  async function ready(){const result=await begin().completion;assert.equal(result.status,'review-ready');return result.view;}
  return {store,service,ports,begin,ready,media,get renders(){return renders;},get discards(){return discards;},get prepares(){return prepares;}};
}
test('render/stage precede approval; preview is isolated and execution commits its exact bytes without rerender',linux,async t=>{
  const h=await setup(t),before=(await h.store.readState()).generationId,job=h.begin(),result=await job.completion;
  assert.equal(result.status,'review-ready');const view=result.view;assert.equal(view.reviewKind,'rendered');assert.equal(view.preview.sha256,h.media.sha256);
  assert.equal((await h.store.readState()).generationId,before);assert.equal(h.renders,1);
  const preview=await h.service.readPreview(view,view.preview.previewId);preview.bytes[0]=255;h.media.bytes[0]=254;
  assert.equal((await h.service.readPreview(view,view.preview.previewId)).bytes[0],0);
  const receipt=await h.service.approvePreview(view),operation=h.service.start(receipt);assert.equal(job.cancel(),'too-late');
  assert.equal((await operation.completion).status,'completed');assert.equal(h.renders,1);assert.equal(h.prepares,1);
  const linked=await h.store.readLinked();assert.equal(linked.version.sha256,view.preview.sha256);assert.equal(linked.bytes[0],0);
  assert.equal(linked.version.provenance.operationId,operation.operationId);assert.equal(await h.service.release(view),'too-late');
});
test('copied/forged view, preview ID or approval cannot access/execute a candidate',linux,async t=>{
  const h=await setup(t),view=await h.ready();
  await assert.rejects(h.service.readPreview(structuredClone(view),view.preview.previewId));await assert.rejects(h.service.readPreview(view,'forged'));
  await assert.rejects(h.service.approvePreview(structuredClone(view)));const receipt=await h.service.approvePreview(view);
  assert.throws(()=>h.service.start(structuredClone(receipt)));const op=h.service.start(receipt);assert.throws(()=>h.service.start(receipt));await op.completion;
});
test('cancel during uninterruptible preview rendering prevents staging',linux,async t=>{
  const entered=gate(),release=gate();let media;
  const h=await setup(t,{render:async()=>{entered.resolve();await release.promise;return media;}});media=h.media;
  const job=h.begin();await entered.promise;assert.equal(job.cancel(),'accepted');release.resolve();
  assert.equal((await job.completion).status,'cancelled');await job.dispose();assert.equal((await h.store.inspectOrphans()).files.length,0);
});
test('cancel during durable preparation disposes the active token without promotion or deletion',linux,async t=>{
  const entered=gate(),release=gate();let enabled=false;
  const h=await setup(t,{boundary:async(at,op)=>{if(enabled&&at==='media-synced'&&op==='prepare'){entered.resolve();await release.promise;}}});
  const head=(await h.store.readState()).generationId;enabled=true;const job=h.begin();await entered.promise;job.cancel();release.resolve();
  assert.equal((await job.completion).status,'cancelled');await job.dispose();assert.equal((await h.store.readState()).generationId,head);
  assert.equal((await h.store.inspectOrphans()).files.length,1);assert.equal(h.discards,1);
});
test('ready cancellation revokes preview/approval, release is shared and unpins but never deletes',linux,async t=>{
  const h=await setup(t),job=h.begin(),{view}=await job.completion;assert.equal((await h.store.inspectOrphans()).files.length,0);
  assert.equal(job.cancel(),'accepted');await assert.rejects(h.service.readPreview(view,view.preview.previewId));await assert.rejects(h.service.approvePreview(view));
  await Promise.all([job.dispose(),job.dispose(),h.service.release(view)]);assert.equal(h.discards,1);assert.equal((await h.store.inspectOrphans()).files.length,1);
});
test('stale source before preview read/approval invalidates staging and cannot promote',linux,async t=>{
  const h=await setup(t),view=await h.ready(),s=structuredClone(await h.store.readSource('drums'));s.snapshot.tracks[0].gain=1;await h.store.updateSource(s);
  await assert.rejects(h.service.approvePreview(view),/STALE_SOURCE/);await assert.rejects(h.service.readPreview(view,view.preview.previewId));
  await h.service.release(view);assert.equal((await h.store.inspectOrphans()).files.length,1);assert.equal((await h.store.readState()).destination.linkedVersionId,null);
});
test('unrelated source/processor edits survive staged review and approval',linux,async t=>{
  const h=await setup(t),view=await h.ready(),s=structuredClone(await h.store.readSource('drums'));s.snapshot.tracks[2].gain=4;s.snapshot.revisionId='unrelated-new';await h.store.updateSource(s);
  const p=structuredClone((await h.store.readState()).destination.processing);p.eq.gainDb=2;await h.store.editDestination({processing:p});
  const op=h.service.start(await h.service.approvePreview(view));assert.equal((await op.completion).status,'completed');assert.equal(h.renders,1);
  assert.equal((await h.store.readState()).destination.processing.eq.gainDb,2);assert.equal((await h.store.readLinked()).version.provenance.sourceRevisionId,view.sourceRevisionId);
});
test('source change after approval rejects without rerendering and releases staging',linux,async t=>{
  const h=await setup(t),view=await h.ready(),approval=await h.service.approvePreview(view),s=structuredClone(await h.store.readSource('drums'));s.snapshot.tracks[0].muted=true;await h.store.updateSource(s);
  const result=await h.service.start(approval).completion;assert.equal(result.status,'failed');assert.equal(result.error.code,'STALE_SOURCE');assert.equal(h.renders,1);assert.equal(h.discards,1);
});
test('corrupt staged durable bytes fail closed at commit, never silently rerender or promote',linux,async t=>{
  const h=await setup(t),view=await h.ready(),approval=await h.service.approvePreview(view),before=(await h.store.readState()).generationId;
  await fs.writeFile(h.store.descriptor.root+'/media-'+view.preview.sha256+'.f32',new Uint8Array(16));
  const result=await h.service.start(approval).completion;assert.equal(result.status,'uncertain');assert.equal(h.renders,1);assert.equal((await h.store.readState()).generationId,before);
  await assert.rejects(h.service.review({groupId:'drums',targetId:'linked'}),/RECOVERY_REQUIRED/);
});
test('cleanup failures are preserved and require recovery before another review',linux,async t=>{
  const h=await setup(t,{storage:s=>({...s,async discard(){throw Error('cleanup failure');}})}),view=await h.ready();
  await assert.rejects(h.service.release(view),/cleanup failure/);await assert.rejects(h.service.review({groupId:'drums',targetId:'linked'}),/RECOVERY_REQUIRED/);
});
test('target replacement before approval or execution preserves concurrent committed link',linux,async t=>{
  for(const approveFirst of [false,true]){
    const h=await setup(t),view=await h.ready(),receipt=approveFirst?await h.service.approvePreview(view):null;
    const other=createLinkedUpdateService({...h.ports,reviewMode:'metadata'}),v=await other.review({groupId:'drums',targetId:'linked'});
    assert.equal((await other.start(other.approve(v)).completion).status,'completed');const keep=(await h.store.readState()).destination.linkedVersionId;
    if(approveFirst){const r=await h.service.start(receipt).completion;assert.equal(r.status,'failed');assert.equal(r.error.code,'TARGET_CHANGED');}
    else await assert.rejects(h.service.approvePreview(view),/TARGET_CHANGED/);
    await h.service.release(view);assert.equal((await h.store.readState()).destination.linkedVersionId,keep);assert.equal(h.renders,2);assert.equal(h.discards,1);
  }
});
test('rendered flow uses same geometry/hash/finite-PCM gates before staging',linux,async t=>{
  for(const mutation of [m=>({...m,frames:4095}),m=>({...m,sampleRate:44100}),m=>({...m,layout:['R','L']}),m=>({...m,bytes:new Uint8Array(8)}),m=>({...m,sha256:'0'.repeat(64)}),m=>{new DataView(m.bytes.buffer).setFloat32(0,NaN,true);return m;}]){
    let media;const h=await setup(t,{render:async()=>mutation(media)});media=h.media;
    assert.equal((await h.begin().completion).status,'failed');assert.equal((await h.store.inspectOrphans()).files.length,0);assert.equal((await h.store.readState()).destination.linkedVersionId,null);
  }
});
test('adapter-owned prepare buffer cannot alias the private preview bytes',linux,async t=>{
  const h=await setup(t,{storage:s=>({...s,prepare:async media=>{const token=await s.prepare(media);media.bytes.fill(255);return token;}})}),view=await h.ready();
  assert.equal(await hashPCM((await h.service.readPreview(view,view.preview.previewId)).bytes),view.preview.sha256);
  assert.equal((await h.service.start(await h.service.approvePreview(view)).completion).status,'completed');
});
test('rendered approval cannot use the synchronous metadata shortcut or a different service context',linux,async t=>{
  const h=await setup(t),k=await setup(t),view=await h.ready();
  assert.throws(()=>h.service.approve(view),/INVALID_APPROVAL/);await assert.rejects(h.service.readPreview(view),/INVALID_PREVIEW/);
  await assert.rejects(k.service.readPreview(view,view.preview.previewId),/INVALID_PREVIEW/);await assert.rejects(k.service.approvePreview(view));await h.service.release(view);
});
test('pending review keeps both freshness and cleanup errors, and disposal reports the cleanup failure',linux,async t=>{
  const cleanup=Error('cleanup failure');const h=await setup(t,{storage:s=>({...s,prepare:async media=>{
    const token=await s.prepare(media),source=structuredClone(await s.readSource('drums'));source.snapshot.tracks[0].gain=1;await s.updateSource(source);return token;
  },discard:async()=>{throw cleanup;}})}),job=h.begin(),result=await job.completion;
  assert.equal(result.status,'failed');assert.equal(result.error.code,'STALE_SOURCE');assert.equal(result.cleanupError,cleanup);await assert.rejects(job.dispose(),/cleanup failure/);
  await assert.rejects(h.service.review({groupId:'drums',targetId:'linked'}),/RECOVERY_REQUIRED/);
});
