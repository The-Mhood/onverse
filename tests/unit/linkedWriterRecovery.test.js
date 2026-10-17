import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {dependencyKey} from '../../src/domain/linkedSessions/linkedSessionContract.js';
import {createGenerationStore,openGenerationStore} from '../../src/infrastructure/linkedSessions/generationStore.js';
import {storeFixture} from '../fixtures/linkedSessionStoreFixture.js';
const linux={skip:process.platform!=='linux'};
const script=fileURLToPath(new URL('../fixtures/linkedWriterProcess.mjs',import.meta.url));
async function root(){const s=await createGenerationStore(storeFixture(await fs.mkdtemp('/tmp/onverse-writer-recovery-')));await s.close();return s.descriptor;}
function contender(t,descriptor,extra={}) {
  const c=spawn(process.execPath,[script,Buffer.from(JSON.stringify({descriptor,...extra})).toString('base64')],{stdio:['pipe','pipe','pipe'],env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'}});
  const exited=new Promise((resolve,reject)=>{c.once('exit',(code,signal)=>resolve({code,signal}));c.once('error',reject);});
  const ready=new Promise((resolve,reject)=>{
    let out='',err='';const timer=setTimeout(()=>reject(Error('fixture ready timeout: '+err)),5000);
    c.stderr.on('data',b=>{err+=b;});c.stdout.on('data',b=>{out+=b;if(out.includes('\n')){clearTimeout(timer);try{resolve(JSON.parse(out.split('\n')[0]));}catch(e){reject(e);}}});
    c.once('error',e=>{clearTimeout(timer);reject(e);});c.once('exit',()=>{clearTimeout(timer);if(!out.includes('\n'))reject(Error('fixture exited before ready: '+err));});
  });
  t.after(async()=>{if(c.exitCode===null&&c.signalCode===null)c.kill('SIGKILL');await exited;});
  return {c,ready,exited};
}
test('kernel ownership releases after killed writer, independent of stale metadata or PID guesses',linux,async t=>{
  const descriptor=await root(),writer=contender(t,descriptor);assert.equal((await writer.ready).status,'acquired');
  await assert.rejects(openGenerationStore(descriptor,{writable:true}));
  writer.c.kill('SIGKILL');assert.equal((await writer.exited).signal,'SIGKILL');
  const recovered=await openGenerationStore(descriptor,{writable:true});
  try{const before=await recovered.readState();await recovered.editDestination({unrelatedAssetId:'destination-vocal'});assert.notEqual((await recovered.readState()).generationId,before.generationId);}finally{await recovered.close();}
});
test('two cold-recovery contenders have exactly one kernel owner; live owner is never displaced',linux,async t=>{
  const descriptor=await root(),old=contender(t,descriptor);assert.equal((await old.ready).status,'acquired');old.c.kill('SIGKILL');await old.exited;
  const contenders=[contender(t,descriptor),contender(t,descriptor)],results=await Promise.all(contenders.map(c=>c.ready));
  assert.equal(results.filter(r=>r.status==='acquired').length,1);assert.equal(results.filter(r=>r.code==='WRITER_BUSY').length,1);
  await assert.rejects(openGenerationStore(descriptor,{writable:true}),e=>e.code==='WRITER_BUSY');
  const winner=contenders[results.findIndex(r=>r.status==='acquired')];winner.c.stdin.end();await winner.exited;
  const final=await openGenerationStore(descriptor,{writable:true});await final.close();
});
test('diagnostic PID may be alive/reused; kernel ownership alone decides availability',linux,async()=>{
  const descriptor=await root(),file=descriptor.root+'/.writer';
  const epoch=JSON.parse(await fs.readFile(file,'utf8'));epoch.pid=1;await fs.writeFile(file,JSON.stringify(epoch)+'\n');
  const store=await openGenerationStore(descriptor,{writable:true});try{assert.notEqual(JSON.parse(await fs.readFile(file,'utf8')).epochId,epoch.epochId);}finally{await store.close();}
});
test('unknown/legacy locking profile stays read-only, with no automatic migration',linux,async()=>{
  const descriptor=await root();await fs.unlink(descriptor.root+'/.writer-lock');
  const before=await fs.readFile(descriptor.root+'/.writer');await assert.rejects(openGenerationStore(descriptor,{writable:true}));
  assert.deepEqual(await fs.readFile(descriptor.root+'/.writer'),before);
  const reader=await openGenerationStore(descriptor);await reader.readState();await reader.close();
});
test('malformed epoch is not overwritten by ownership recovery',linux,async()=>{
  const descriptor=await root(),epoch=descriptor.root+'/.writer';await fs.writeFile(epoch,'unknown epoch');
  await assert.rejects(openGenerationStore(descriptor,{writable:true}));assert.equal(await fs.readFile(epoch,'utf8'),'unknown epoch');
});
test('every killed recovery phase can be retried, without publishing a different generation',linux,async t=>{
  for(const stop of ['lock-acquired','recovery-validated','epoch-synced','epoch-renamed','epoch-directory-synced']) {
    const descriptor=await root(),reader=await openGenerationStore(descriptor),before=(await reader.readState()).generationId;await reader.close();
    const c=contender(t,descriptor,{stop});assert.deepEqual(await c.ready,{status:'boundary',at:stop});assert.equal((await c.exited).signal,'SIGKILL');
    const writer=await openGenerationStore(descriptor,{writable:true});try{assert.equal((await writer.readState()).generationId,before);}finally{await writer.close();}
  }
});
async function staged(store) {
  const source=await store.readSource('drums'),bytes=new Uint8Array(32768),sha256=createHash('sha256').update(bytes).digest('hex');
  const provenance={profile:'linked-selection-integration-v1',sourceSessionId:source.snapshot.sessionId,sourceRevisionId:source.snapshot.revisionId,
    dependencyKey:dependencyKey(source.snapshot,source.selection),targetId:'linked',planId:'plan-recovery',operationId:'op-recovery',sha256};
  return {token:await store.prepare({bytes,frames:4096,sampleRate:48000,layout:['L','R'],sha256,provenance}),sha256};
}
async function orphan(descriptor,tag='f') {
  const name=`media-${tag.repeat(64)}.f32`;await fs.writeFile(descriptor.root+'/'+name,Buffer.from([1,2,3]),{flag:'wx',mode:0o600});return name;
}
test('orphan audit protects committed lineage/assets and active preparation; quarantine retains unknown files',linux,async()=>{
  const descriptor=await root(),store=await openGenerationStore(descriptor,{writable:true});try{
    const before=await store.readState(),name=await orphan(descriptor),active=await staged(store);
    await fs.writeFile(descriptor.root+'/KEEP-UNKNOWN','preserve me',{mode:0o600});
    const report=await store.inspectOrphans();assert.ok(report.files.some(f=>f.name===name));assert.ok(report.unknown.includes('KEEP-UNKNOWN'));
    assert.ok(!report.files.some(f=>f.name===`media-${active.sha256}.f32`));
    const result=await store.quarantineOrphans(report);assert.equal(result.count,1);
    assert.equal((await store.readState()).generationId,before.generationId);assert.equal(await fs.readFile(descriptor.root+'/KEEP-UNKNOWN','utf8'),'preserve me');
    assert.deepEqual(await fs.readFile(descriptor.root+'/'+result.archive+'/'+name),Buffer.from([1,2,3]));
    await store.discard(active.token);const second=await store.inspectOrphans();assert.ok(second.files.some(f=>f.name===`media-${active.sha256}.f32`));
    await store.quarantineOrphans(second);assert.equal((await store.quarantineOrphans(await store.inspectOrphans())).count,0);
    await assert.rejects(store.quarantineOrphans(JSON.parse(JSON.stringify(report))),/INVALID_ORPHAN_PLAN/);
  }finally{await store.close();}
});
test('stale cleanup plans and changed candidates reject before moving files',linux,async()=>{
  const descriptor=await root(),store=await openGenerationStore(descriptor,{writable:true});try{
    const name=await orphan(descriptor),plan=await store.inspectOrphans();await staged(store);
    await assert.rejects(store.quarantineOrphans(plan),/ORPHAN_PLAN_STALE/);
    const second=await store.inspectOrphans();await fs.writeFile(descriptor.root+'/'+name,Buffer.from([4,5,6]));
    await assert.rejects(store.quarantineOrphans(second),/ORPHAN_CHANGED/);assert.deepEqual(await fs.readFile(descriptor.root+'/'+name),Buffer.from([4,5,6]));
  }finally{await store.close();}
});
test('symlink candidates are reported unsafe, never followed or moved',linux,async()=>{
  const descriptor=await root(),store=await openGenerationStore(descriptor,{writable:true});try{
    const name=`media-${'a'.repeat(64)}.f32`;await fs.symlink('CURRENT.json',descriptor.root+'/'+name);
    const plan=await store.inspectOrphans();assert.ok(plan.unsafe.includes(name));await store.quarantineOrphans(plan);
    assert.ok((await fs.lstat(descriptor.root+'/'+name)).isSymbolicLink());await store.readState();
  }finally{await store.close();}
});
test('crashes during quarantine preserve active state and make retries safe',linux,async t=>{
  for(const stop of ['quarantine-manifest-synced','orphan-moved','quarantine-synced']) {
    const descriptor=await root();await orphan(descriptor);await orphan(descriptor,'e');const c=contender(t,descriptor,{stop,quarantine:true});
    assert.deepEqual(await c.ready,{status:'boundary',at:stop});assert.equal((await c.exited).signal,'SIGKILL');
    const store=await openGenerationStore(descriptor,{writable:true});try{
      await store.readState();const audit=await store.inspectOrphans();
      assert.equal(audit.files.length,stop==='quarantine-manifest-synced'?2:stop==='orphan-moved'?1:0);assert.equal(audit.archives.length,1);
      await store.quarantineOrphans(audit);
      assert.equal((await store.inspectOrphans()).files.length,0);await store.editDestination({unrelatedAssetId:'destination-vocal'});
    }finally{await store.close();}
  }
});
test('committed metadata cycle blocks recovery before changing epoch',linux,async()=>{
  const descriptor=await root(),store=await openGenerationStore(descriptor,{writable:true});await store.editDestination({unrelatedAssetId:'destination-vocal'});const state=await store.readState();await store.close();
  const gen=descriptor.root+`/generation-${state.parentId}.json`,journal=descriptor.root+`/journal-${state.parentId}.json`;
  const old=JSON.parse(await fs.readFile(gen,'utf8'));old.parentId=state.generationId;const bytes=Buffer.from(JSON.stringify(old)+'\n');await fs.writeFile(gen,bytes);
  const j=JSON.parse(await fs.readFile(journal,'utf8'));j.parentId=old.parentId;j.generationSha256=createHash('sha256').update(bytes).digest('hex');await fs.writeFile(journal,JSON.stringify(j)+'\n');
  const epoch=await fs.readFile(descriptor.root+'/.writer');await assert.rejects(openGenerationStore(descriptor,{writable:true}),/LINEAGE/);
  assert.deepEqual(await fs.readFile(descriptor.root+'/.writer'),epoch);
});
test('failed-open paths release their descriptor; repeated close retains permanent lock inode',linux,async()=>{
  const descriptor=await root(),epoch=descriptor.root+'/.writer',good=await fs.readFile(epoch),inode=(await fs.stat(descriptor.root+'/.writer-lock')).ino;
  await fs.writeFile(epoch,'corrupt');await assert.rejects(openGenerationStore(descriptor,{writable:true}));await fs.writeFile(epoch,good);
  const writer=await openGenerationStore(descriptor,{writable:true});const a=writer.close(),b=writer.close();assert.equal(a,b);await a;
  assert.equal((await fs.stat(descriptor.root+'/.writer-lock')).ino,inode);
  const next=await openGenerationStore(descriptor,{writable:true});await next.close();
});
test('lock identity tampering prevents publication and close still releases the owned descriptor',linux,async()=>{
  const descriptor=await root(),writer=await openGenerationStore(descriptor,{writable:true}),name=descriptor.root+'/.writer-lock';
  try{await fs.chmod(name,0o640);await assert.rejects(writer.editDestination({unrelatedAssetId:'destination-vocal'}),/LOCK_IDENTITY_CHANGED/);}finally{await writer.close();await fs.chmod(name,0o600);}
  const next=await openGenerationStore(descriptor,{writable:true});await next.close();
});
test('referenced corrupted media blocks writer recovery without changing epoch or pointer',linux,async()=>{
  const descriptor=await root(),reader=await openGenerationStore(descriptor),state=await reader.readState();await reader.close();
  const epoch=await fs.readFile(descriptor.root+'/.writer'),pointer=await fs.readFile(descriptor.root+'/CURRENT.json');
  const file=descriptor.root+`/media-${state.assets[0].sha256}.f32`,bytes=await fs.readFile(file);bytes[0]^=1;await fs.writeFile(file,bytes);
  await assert.rejects(openGenerationStore(descriptor,{writable:true}),/MEDIA_CHECKSUM/);
  assert.deepEqual(await fs.readFile(descriptor.root+'/.writer'),epoch);assert.deepEqual(await fs.readFile(descriptor.root+'/CURRENT.json'),pointer);
});
test('schema-one stores can be read, but never silently migrate to the kernel writer protocol',linux,async()=>{
  const descriptor=await root(),pointer=JSON.parse(await fs.readFile(descriptor.root+'/CURRENT.json','utf8'));
  const file=descriptor.root+`/generation-${pointer.generationId}.json`,state=JSON.parse(await fs.readFile(file,'utf8'));state.schemaVersion=1;
  const bytes=Buffer.from(JSON.stringify(state)+'\n');await fs.writeFile(file,bytes);pointer.generationSha256=createHash('sha256').update(bytes).digest('hex');
  const journal=descriptor.root+`/journal-${pointer.generationId}.json`,j=JSON.parse(await fs.readFile(journal,'utf8'));j.generationSha256=pointer.generationSha256;
  const jb=Buffer.from(JSON.stringify(j)+'\n');await fs.writeFile(journal,jb);pointer.journalSha256=createHash('sha256').update(jb).digest('hex');await fs.writeFile(descriptor.root+'/CURRENT.json',JSON.stringify(pointer)+'\n');
  await assert.rejects(openGenerationStore(descriptor,{writable:true}),/LEGACY_READ_ONLY/);
  const reader=await openGenerationStore(descriptor);assert.equal((await reader.readState()).schemaVersion,1);await reader.close();
});
test('generation cap rejects publication before creating an unrecoverable lineage',linux,async()=>{
  const descriptor=await root(),writer=await openGenerationStore(descriptor,{writable:true});
  try{
    for(let n=1;n<256;n++)await writer.editDestination({unrelatedAssetId:'destination-vocal'});
    const before=(await writer.readState()).generationId;
    await assert.rejects(writer.editDestination({unrelatedAssetId:'destination-vocal'}),/GENERATION_CAPACITY/);
    assert.equal((await writer.readState()).generationId,before);
  }finally{await writer.close();}
  const next=await openGenerationStore(descriptor,{writable:true});await next.close();
});
