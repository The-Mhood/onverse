// Trusted synthetic integration driver; never an uploaded plan/executable runner.
import * as fs from 'node:fs/promises';
import { readFileSync, writeSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createGenerationStore, openGenerationStore } from '../../src/infrastructure/linkedSessions/generationStore.js';
import { createLinkedUpdateService } from '../../src/application/linkedSessions/linkedUpdateService.js';
import { decodePCM } from '../../src/audio/linkedSessions/pcm.js';
import { dependencyKey, observeCurrentness } from '../../src/domain/linkedSessions/linkedSessionContract.js';
import { storeFixture } from '../../tests/fixtures/linkedSessionStoreFixture.js';
import { recipe, expectedGroup, compare, peaking, MAX_ERROR } from './offline-render-fixtures.mjs';
import { run as runNative } from './run-linked-render-probe.mjs';
const SCRIPT=fileURLToPath(import.meta.url), sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const check=(ok,label)=>{if(!ok)throw Error(label);};
export const COMMIT_BOUNDARIES=Object.freeze(['media-partial','media-synced','media-published','generation-synced','generation-published','journal-synced','journal-published','pointer-synced','pointer-renamed','directory-synced']);
const rendered=bytes=>({bytes:new Uint8Array(bytes),frames:4096,sampleRate:48000,layout:['L','R'],sha256:sha(bytes)});
function service(store, render) {return createLinkedUpdateService({readSource:store.readSource,readTarget:store.readTarget,storage:store,render});}
function start(s) {return s.review({groupId:'drums',targetId:'linked'}).then(plan=>s.start(s.approve(plan)));}
function child(mode,payload) {
  const out=spawnSync(process.execPath,[SCRIPT,mode],{input:JSON.stringify(payload),encoding:'utf8',timeout:20000,maxBuffer:512*1024,
    env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',TZ:'UTC'}});
  if(out.error)throw out.error;return out;
}
function reopened(descriptor) {
  const out=child('--read',{descriptor});check(out.status===0&&!out.signal,'Reader failed: '+out.stderr);
  const data=JSON.parse(out.stdout),bytes=Buffer.from(data.base64,'base64');
  check(bytes.length===32768&&sha(bytes)===data.version.sha256,'Reader transport checksum');
  return {...data,bytes,other:Buffer.from(data.otherBase64,'base64')};
}
export async function exerciseCrashBoundaries(original, updated, native) {
  const rows=[];
  for(const stop of [...COMMIT_BOUNDARIES,'complete']) {
    const parent=await fs.mkdtemp('/tmp/onverse-linked-crash-'), store=await createGenerationStore(storeFixture(parent));
    let old;
    try {const job=await start(service(store,async()=>rendered(original)));check((await job.completion).status==='completed','Seed commit');old=(await store.readLinked()).version.versionId;}
    finally {await store.close();}
    const out=child('--writer',{descriptor:store.descriptor,base64:Buffer.from(updated).toString('base64'),stop});
    check(stop==='complete'?out.status===0:out.signal==='SIGKILL'&&out.stdout.includes(`REACHED:${stop}\n`),'Writer boundary '+stop+': '+out.stderr);
    const r=reopened(store.descriptor), promoted=['pointer-renamed','directory-synced','complete'].includes(stop);
    check((r.version.versionId!==old)===promoted,'Unexpected pointer after '+stop);
    check(r.bytes.equals(Buffer.from(promoted?updated:original)),'Reopened PCM differs at '+stop);
    const writer=await openGenerationStore(store.descriptor,{writable:true}),mixes=[];let quarantine;
    const desiredProcessing=structuredClone(r.state.destination.processing);desiredProcessing.eq.gainDb=2;
    async function verify(label,expected,versionId) {
      const current=reopened(store.descriptor);
      check(current.bytes.equals(Buffer.from(expected))&&current.version.versionId===versionId,'Recovered '+label+' bytes/version '+stop);
      check(current.other.equals(r.other),'Unrelated audio changed');
      check(JSON.stringify(current.state.destination.processing)===JSON.stringify(desiredProcessing),'Recovered manual processing changed');
      if(native) {
        const p=current.state.destination.processing;
        const output=await native.renderDestination({linkedBytes:Array.from(current.bytes),unrelatedBytes:Array.from(current.other),unrelatedFrames:current.otherFrames,processing:p});
        check(JSON.stringify(output.params)===JSON.stringify(p),'Recovered persisted processing');
        const metrics=compare(output.channels.map(c=>Float32Array.from(c)),destinationOracle(current.bytes,current.other,current.otherFrames,p));
        check(metrics.passed,'Recovered native destination '+label);mixes.push({label,...metrics});
      }
    }
    try {
      const audit=await writer.inspectOrphans();quarantine=await writer.quarantineOrphans(audit);
      check(reopened(store.descriptor).bytes.equals(r.bytes),'Quarantine changed current media');
      await writer.editDestination({processing:desiredProcessing});
      const render=async request=>{
        if(!native)return rendered(updated);
        const assets={};for(const track of request.snapshot.tracks)assets[track.assetId]=Array.from(await writer.loadAsset(track.assetId));
        const result=await native.render(request,assets);check(compare(decodePCM(result.bytes,4096),expectedGroup(recipe('updated'))).passed,'Recovered native source');return result;
      };
      const job=await start(service(writer,render));check((await job.completion).status==='completed','Fresh approved recovery update');
      const fresh=(await writer.readLinked()).version.versionId;check(fresh!==r.version.versionId,'Recovery did not publish fresh version');
      await verify('fresh-approved-update',updated,fresh);
      await writer.moveHistory('undo',(await writer.readState()).destination.linkRevisionId);await verify('undo',r.bytes,r.version.versionId);
      await writer.moveHistory('redo',(await writer.readState()).destination.linkRevisionId);await verify('redo',updated,fresh);
      check((await writer.inspectOrphans()).files.length===0,'Unexpected post-recovery orphan');
    }finally{await writer.close();}
    const final=await openGenerationStore(store.descriptor,{writable:true});await final.close();
    rows.push({boundary:stop,promoted,byteExact:true,writableRecovered:true,quarantine,freshApprovedUpdate:true,separateProcessReopen:true,undoRedo:true,destinations:mixes});
  }
  return rows;
}
function destinationOracle(linked,other,frames,p) {
  const input=decodePCM(linked,4096), unrelated=decodePCM(other,frames), k=peaking(p.eq.frequency,p.eq.Q,p.eq.gainDb);
  return [0,1].map(c=>{let x1=0,x2=0,y1=0,y2=0;return Float32Array.from({length:8192},(_,n)=>{
    const x=n>=p.startFrame&&n<p.startFrame+4096?Math.fround(input[c][n-p.startFrame]*p.gain):0;
    const y=k.b0*x+k.b1*x1+k.b2*x2-k.a1*y1-k.a2*y2;x2=x1;x1=x;y2=y1;y1=y;
    return Math.fround(Math.fround(y)+(n<frames?unrelated[c][n]:0));
  });});
}
export async function runIntegration(tools) {
  return runNative(tools,async native=>{
    const parent=await fs.mkdtemp('/tmp/onverse-linked-integration-');let hook;
    const store=await createGenerationStore(storeFixture(parent,async(at,op)=>{if(hook)await hook(at,op);}));
    const destinations=[], sourceMetrics=[];let original,updated;
    const render=async request=>{
      const assets={};for(const t of request.snapshot.tracks)assets[t.assetId]=Array.from(await store.loadAsset(t.assetId));
      const result=await native.render(request,assets);
      const r=recipe(request.snapshot.tracks[0].gain===1?'updated':'original'), metrics=compare(decodePCM(result.bytes,4096),expectedGroup(r));
      check(metrics.passed,'Source native oracle');sourceMetrics.push(metrics);return result;
    };
    async function destination(label) {
      const r=reopened(store.descriptor),p=r.state.destination.processing;
      const output=await native.renderDestination({linkedBytes:Array.from(r.bytes),unrelatedBytes:Array.from(r.other),unrelatedFrames:r.otherFrames,processing:p});
      check(JSON.stringify(output.params)===JSON.stringify(p),'Persisted processing params');
      const metrics=compare(output.channels.map(c=>Float32Array.from(c)),destinationOracle(r.bytes,r.other,r.otherFrames,p));
      check(metrics.passed,'Destination oracle '+label);destinations.push({label,...metrics});return r;
    }
    try {
      const s=service(store,render), initialSource=await store.readSource('drums');
      const a=await start(s);check((await a.completion).status==='completed','Original update');
      const first=await destination('original');original=first.bytes;
      const next=structuredClone(initialSource);next.snapshot.tracks[2].gain=4;next.snapshot.revisionId='unrelated-r2';await store.updateSource(next);
      check(observeCurrentness(initialSource.snapshot,initialSource.selection,next.snapshot,next.selection,1).status==='current','Unrelated currentness');
      check(reopened(store.descriptor).bytes.equals(original),'Automatic update must not happen');
      next.snapshot.tracks[0].gain=1;next.snapshot.revisionId='source-r3';await store.updateSource(next);
      check(observeCurrentness(initialSource.snapshot,initialSource.selection,next.snapshot,next.selection,2).status==='update-available','Relevant currentness');
      check(reopened(store.descriptor).bytes.equals(original),'Relevant edit auto-promoted');
      const plan=await s.review({groupId:'drums',targetId:'linked'});
      const p=structuredClone(first.state.destination.processing);p.eq.gainDb=2;await store.editDestination({processing:p});
      const b=s.start(s.approve(plan));check((await b.completion).status==='completed','Updated update');
      const second=await destination('updated-with-manual-EQ');updated=second.bytes;check(!original.equals(updated),'No changed PCM');
      await store.moveHistory('undo',(await store.readState()).destination.linkRevisionId);
      check((await destination('undo-retains-manual-EQ')).bytes.equals(original),'Undo PCM');
      await store.moveHistory('redo',(await store.readState()).destination.linkRevisionId);
      check((await destination('redo-retains-manual-EQ')).bytes.equals(updated),'Redo PCM');
      const before=(await store.readState()).destination.linkedVersionId;
      let early;hook=async(at,op)=>{if(op==='prepare'&&at==='media-synced')check(early.cancel()==='accepted','Early cancel');};
      early=await start(s);check((await early.completion).status==='cancelled','Cancelled update');
      check((await store.readState()).destination.linkedVersionId===before,'Cancelled media promoted');
      let late;hook=async(at,op)=>{if(op==='commit'&&at==='pointer-synced')check(late.cancel()==='too-late','Late cancel');};
      late=await start(s);check((await late.completion).status==='completed','Late committed update');hook=undefined;
      check((await store.readState()).destination.linkedVersionId!==before,'Late update missing');
    } finally {await store.close();}
    const restarted=await openGenerationStore(store.descriptor,{writable:true});await restarted.close();
    const crashes=await exerciseCrashBoundaries(original,updated,native);
    const codeHashes={};for(const name of ['src/infrastructure/linkedSessions/generationStore.js','src/infrastructure/linkedSessions/linuxWriterLock.js','scripts/validation/run-linked-session-integration.mjs','tests/fixtures/linkedSessionStoreFixture.js'])
      codeHashes[name]=sha(await fs.readFile(new URL('../../'+name,import.meta.url)));
    return {storage:'real single-writer filesystem generation repository; Linux synthetic integration',maxAllowedError:MAX_ERROR,
      sourceMetrics,destinations,manualUpdateOnly:true,undoRedo:true,cancellation:{duringPrepare:'cancelled',duringCommit:'too-late'},
      cleanWriterReopen:true,crashes,integrationCodeHashes:codeHashes,root:store.descriptor.root,
      filesystemType:'0x'+(await fs.statfs(store.descriptor.root)).type.toString(16),
      limitations:['not UI/IPC wired','Linux-only installed /usr/bin/flock; legacy roots remain read-only; explicit quarantine only','no power-loss/macOS/security/release certification']};
  });
}
async function cli() {
  const args=process.argv.slice(2);
  if(args.length===1&&['--read','--writer'].includes(args[0])) {
    const text=readFileSync(0,'utf8');check(text.length<=65536,'Child input bound');const input=JSON.parse(text);
    if(args[0]==='--read') {
      const store=await openGenerationStore(input.descriptor);try {
        const linked=await store.readLinked(),a=linked.state.assets.find(a=>a.assetId===linked.state.destination.unrelatedAssetId);
        const bytes=await store.loadAsset(a.assetId);
        console.log(JSON.stringify({state:linked.state,version:linked.version,base64:linked.bytes.toString('base64'),otherBase64:bytes.toString('base64'),otherFrames:a.frames}));
      } finally {await store.close();}return;
    }
    check([...COMMIT_BOUNDARIES,'complete'].includes(input.stop),'Unknown boundary');
    const bytes=Buffer.from(input.base64,'base64');decodePCM(bytes,4096);
    const store=await openGenerationStore(input.descriptor,{writable:true,onBoundary:async(at,op)=>{
      if(at===input.stop&&((op==='prepare'&&at.startsWith('media-'))||op==='commit')) {
        writeSync(1,`REACHED:${at}\n`);process.kill(process.pid,'SIGKILL');await new Promise(()=>{});
      }
    }});
    try {
      const source=structuredClone(await store.readSource('drums'));source.snapshot.tracks[0].gain=1;source.snapshot.revisionId='crash-r2';await store.updateSource(source);
      const job=await start(service(store,async()=>rendered(bytes)));const result=await job.completion;check(result.status==='completed',result.error?.stack||'Child commit failed');
    } finally {await store.close();}return;
  }
  check(args.length===2&&args[0]==='--tools-dir','Usage: run-linked-session-integration.mjs --tools-dir <approved toolkit>');
  console.log(JSON.stringify(await runIntegration(args[1]),null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===SCRIPT)cli().catch(e=>{console.error(e.stack);process.exitCode=1;});
