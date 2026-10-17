import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createGenerationStore, openGenerationStore } from '../../src/infrastructure/linkedSessions/generationStore.js';
import { createLinkedUpdateService } from '../../src/application/linkedSessions/linkedUpdateService.js';
import { encodePCM, hashPCM } from '../../src/audio/linkedSessions/pcm.js';
import { expectedGroup, recipe } from '../../scripts/validation/offline-render-fixtures.mjs';
import { storeFixture } from '../fixtures/linkedSessionStoreFixture.js';
const linux = { skip:process.platform !== 'linux' };
async function setup(onBoundary) {
  const parent = await fs.mkdtemp('/tmp/onverse-store-tests-'), fixture = storeFixture(parent, onBoundary);
  return { parent, fixture, store:await createGenerationStore(fixture) };
}
function service(store, hooks = {}) {
  return createLinkedUpdateService({ readSource:store.readSource, readTarget:store.readTarget,
    render:async () => { // Deterministic oracle double; not native audio evidence.
      const bytes = encodePCM(expectedGroup(recipe()));
      return { bytes, sha256:await hashPCM(bytes), frames:4096, sampleRate:48000, layout:['L','R'] };
    }, storage:store, ...hooks });
}
async function commit(store, hooks) { const s = service(store,hooks); const job = s.start(s.approve(await s.review({ groupId:'drums', targetId:'linked' }))); return { job, result:await job.completion }; }

test('durable PCM, narrow linked pointer, journal and clean read-only/writable reopen', linux, async () => {
  const {store} = await setup(); try {
    const before = await store.readState(), {result} = await commit(store); assert.equal(result.status,'completed');
    const linked = await store.readLinked(); assert.equal(linked.version.versionId,result.versionId);
    assert.deepEqual(linked.state.destination.processing,before.destination.processing);
    assert.equal(linked.state.destination.unrelatedAssetId,before.destination.unrelatedAssetId);
    const reader = await openGenerationStore(store.descriptor); assert.deepEqual((await reader.readLinked()).bytes,linked.bytes); await reader.close();
  } finally { await store.close(); }
  const reopened = await openGenerationStore(store.descriptor,{writable:true}); await reopened.close();
});
test('one kernel writer; readers coexist, corrupt epoch remains fail-closed', linux, async () => {
  const {store} = await setup(); try {
    await assert.rejects(openGenerationStore(store.descriptor,{writable:true}),/WRITER_BUSY/);
    const reader = await openGenerationStore(store.descriptor); await assert.rejects(reader.updateSource((await store.readState()).source),/READ_ONLY/); await reader.close();
  } finally { await store.close(); }
  await fs.writeFile(path.join(store.descriptor.root,'.writer'),'stale-but-not-authorized-to-delete',{mode:0o600});
  await assert.rejects(openGenerationStore(store.descriptor,{writable:true}));
  const reader = await openGenerationStore(store.descriptor); await reader.close();
});
test('relevant source change during staging is rejected; media never promoted', linux, async () => {
  const {store} = await setup(); try {
    const storage = { ...store, async prepare(m) {
      const token = await store.prepare(m), value = structuredClone(await store.readSource('drums'));
      value.snapshot.tracks[0].gain=1; value.snapshot.revisionId='source-r2'; await store.updateSource(value); return token;
    } };
    const {result} = await commit(store,{storage}); assert.equal(result.status,'failed'); assert.equal(result.error.code,'STALE_SOURCE');
    assert.equal((await store.readState()).destination.linkedVersionId,null);
  } finally { await store.close(); }
});
test('serialized source guard catches change after the service async observation', linux, async () => {
  const {store} = await setup(); try {
    const storage = { ...store, async commit(c) {
      const source = structuredClone(await store.readSource('drums')); source.snapshot.tracks[0].gain=1;
      await store.updateSource(source); return store.commit(c);
    } };
    const {result}=await commit(store,{storage}); assert.equal(result.status,'uncertain'); assert.equal(result.error.code,'SOURCE_CONFLICT');
    assert.equal((await store.readState()).destination.linkedVersionId,null);
  } finally { await store.close(); }
});
test('manual processor edits and unrelated source edits survive a linked update', linux, async () => {
  const {store} = await setup(); try {
    const storage = { ...store, async prepare(m) {
      const token=await store.prepare(m), source=structuredClone(await store.readSource('drums'));
      source.snapshot.tracks[2].gain=4; source.snapshot.revisionId='unrelated-r2'; await store.updateSource(source);
      const processing=structuredClone((await store.readState()).destination.processing); processing.eq.gainDb=2;
      await store.editDestination({processing}); return token;
    } };
    assert.equal((await commit(store,{storage})).result.status,'completed');
    const s=await store.readState(); assert.equal(s.destination.processing.eq.gainDb,2); assert.equal(s.source.snapshot.tracks[2].gain,4);
  } finally { await store.close(); }
});
test('real retained undo/redo changes only link pointer/history, keeps processing and source', linux, async () => {
  const {store}=await setup(); try {
    const a=(await commit(store)).result.versionId, b=(await commit(store)).result.versionId;
    const processing=structuredClone((await store.readState()).destination.processing); processing.eq.gainDb=1;
    await store.editDestination({processing});
    const current=await store.readState(); assert.equal(await store.moveHistory('undo',current.destination.linkRevisionId),a);
    assert.equal((await store.readState()).destination.processing.eq.gainDb,1);
    const undo=await store.readState(); assert.equal(await store.moveHistory('redo',undo.destination.linkRevisionId),b);
    await assert.rejects(store.moveHistory('undo',current.destination.linkRevisionId),/TARGET_CONFLICT/);
    await assert.rejects(store.moveHistory('redo',(await store.readState()).destination.linkRevisionId),/HISTORY_UNAVAILABLE/);
  } finally { await store.close(); }
});
test('new commit after undo clears redo without deleting retained versions', linux, async () => {
  const {store}=await setup(); try {
    await commit(store); await commit(store); await store.moveHistory('undo',(await store.readState()).destination.linkRevisionId);
    await commit(store); const s=await store.readState(); assert.equal(s.future.length,0); assert.equal(s.versions.length,3);
  } finally { await store.close(); }
});
test('cancel while real media is staging prevents publication; retained blobs are not guessed/deleted', linux, async () => {
  const {store}=await setup(); try {
    let release, entered; const gate=new Promise(r=>{release=r;}), ready=new Promise(r=>{entered=r;});
    const storage={...store,async prepare(m){const token=await store.prepare(m);entered();await gate;return token;}};
    const s=service(store,{storage}), job=s.start(s.approve(await s.review({groupId:'drums',targetId:'linked'})));
    await ready; assert.equal(job.cancel(),'accepted'); release(); assert.equal((await job.completion).status,'cancelled');
    assert.equal((await store.readState()).destination.linkedVersionId,null);
  } finally { await store.close(); }
});
test('I/O uncertainty preserves last-valid pointer and requires reopen before writes', linux, async () => {
  let enabled=false;const {store}=await setup(async(at,op)=>{if(enabled&&op==='commit'&&at==='journal-published')throw Error('injected IO failure');});
  try {
    enabled=true; assert.equal((await commit(store)).result.status,'uncertain');
    assert.equal((await store.readState()).destination.linkedVersionId,null);
    await assert.rejects(store.editDestination({unrelatedAssetId:'destination-vocal'}),/RECOVERY_REQUIRED/);
  } finally { await store.close(); }
  const r=await openGenerationStore(store.descriptor,{writable:true});try {assert.equal((await r.readState()).destination.linkedVersionId,null);} finally {await r.close();}
});
test('durable media corruption, unsafe owner/path and symlinked blobs fail closed', linux, async () => {
  const {store}=await setup();try {
    await assert.rejects(openGenerationStore({...store.descriptor,owner:'bad'}));
    await assert.rejects(openGenerationStore({...store.descriptor,root:store.descriptor.root+'/../x'}));
    const state=await store.readState(), a=state.assets[0], name=path.join(store.descriptor.root,`media-${a.sha256}.f32`);
    await fs.writeFile(name,new Uint8Array(a.frames*8)); await assert.rejects(store.readState(),/MEDIA_CHECKSUM/);
    await fs.unlink(name);await fs.symlink('/etc/passwd',name);await assert.rejects(store.readState());
  } finally {await store.close();}
});
test('malformed imports cannot select paths, alter schema or mutate data before validation', linux, async () => {
  const {store}=await setup();try {
    const before=await store.readState(); const bad=structuredClone(before.source);bad.snapshot.tracks[0].assetId='../escape';
    await assert.rejects(store.updateSource(bad));await assert.rejects(store.editDestination({linkedVersionId:'forged'}));
    await assert.rejects(store.commit({prepared:{},path:'../outside'}));
    assert.equal((await store.readState()).generationId,before.generationId);
  } finally {await store.close();}
});
test('simultaneous same-link updates cannot lose history or both replace the observed revision', linux, async()=>{
  const {store}=await setup();try {
    const results=await Promise.all([commit(store),commit(store)]);
    assert.equal(results.filter(x=>x.result.status==='completed').length,1);
    const s=await store.readState();assert.equal(s.versions.length,1);assert.equal(s.past.length,1);
  }finally{await store.close();}
});
test('changed staged file is rechecked at commit; last valid pointer stays unchanged',linux,async()=>{
  const {store}=await setup();try{
    const storage={...store,async prepare(m){const token=await store.prepare(m);await fs.writeFile(path.join(store.descriptor.root,`media-${m.sha256}.f32`),new Uint8Array(32768));return token;}};
    const result=(await commit(store,{storage})).result;assert.equal(result.status,'uncertain');assert.equal(result.error.code,'MEDIA_CHECKSUM');
    assert.equal((await store.readState()).destination.linkedVersionId,null);
  }finally{await store.close();}
});
test('source mutation queues behind in-flight publication rather than interleaving after the guard',linux,async()=>{
  let release,entered;const gate=new Promise(r=>{release=r;}),ready=new Promise(r=>{entered=r;});
  const {store}=await setup(async(at,op)=>{if(at==='generation-synced'&&op==='commit'){entered();await gate;}});
  try{
    const running=commit(store);await ready;
    const source=structuredClone(await store.readSource('drums'));source.snapshot.tracks[0].gain=1;
    let done=false;const edit=store.updateSource(source).then(()=>{done=true;});await Promise.resolve();assert.equal(done,false);
    release();assert.equal((await running).result.status,'completed');await edit;
    const s=await store.readState();assert.equal(s.source.snapshot.tracks[0].gain,1);assert.equal(s.versions.length,1);
  }finally{release();await store.close();}
});
test('close is one shared completion and malformed destination object does not create a generation',linux,async()=>{
  const {store}=await setup();const before=await store.readState();
  const malformed=new Date();malformed.processing=structuredClone(before.destination.processing);
  await assert.rejects(store.editDestination(malformed));
  assert.equal((await store.readState()).generationId,before.generationId);
  const a=store.close(),b=store.close();assert.equal(a,b);await Promise.all([a,b]);
});
test('post-rename exception is uncertain, not rollback; new valid generation is retained and writer blocked',linux,async()=>{
  const {store}=await setup(async(at,op)=>{if(at==='pointer-renamed'&&op==='commit')throw Error('after rename IO fault');});
  try {
    const {result}=await commit(store);assert.equal(result.status,'uncertain');
    const linked=await store.readLinked();assert.equal(linked.bytes.length,32768);assert.equal(linked.state.versions.length,1);
    await assert.rejects(store.editDestination({unrelatedAssetId:'destination-vocal'}),/RECOVERY_REQUIRED/);
  }finally{await store.close();}
  const reopened=await openGenerationStore(store.descriptor,{writable:true});try{assert.equal((await reopened.readLinked()).bytes.length,32768);}finally{await reopened.close();}
});
