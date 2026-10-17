// Opt-in trusted synthetic native validation of the actual application facade.
// Not Electron IPC, human interaction, LLM/provider execution or application playback.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createGenerationStore,openGenerationStore} from '../../src/infrastructure/linkedSessions/generationStore.js';
import {createSessionApplication} from '../../src/application/sessions/sessionApplication.js';
import {storeFixture} from '../../tests/fixtures/linkedSessionStoreFixture.js';
import {decodePCM} from '../../src/audio/linkedSessions/pcm.js';
import {recipe,expectedGroup,expectedDestination,compare,MAX_ERROR} from './offline-render-fixtures.mjs';
import {run as nativeHarness} from './run-linked-render-probe.mjs';
const SCRIPT=fileURLToPath(import.meta.url), digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function separateReader(descriptor) {
  const script=fileURLToPath(new URL('./run-linked-session-integration.mjs',import.meta.url));
  const out=spawnSync(process.execPath,[script,'--read'],{input:JSON.stringify({descriptor}),encoding:'utf8',timeout:20000,maxBuffer:512*1024,
    env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',TZ:'UTC'}});
  assert.equal(out.status,0,out.stderr);assert.equal(out.signal,null);const result=JSON.parse(out.stdout);
  result.bytes=Buffer.from(result.base64,'base64');result.other=Buffer.from(result.otherBase64,'base64');
  assert.equal(result.bytes.length,32768);assert.equal(digest(result.bytes),result.version.sha256);return result;
}
export async function run(tools,{reviewMode='metadata'}={}) {
  return nativeHarness(tools,async native=>{
    const parent=await fs.mkdtemp('/tmp/onverse-host-native-');let hook;
    const store=await createGenerationStore(storeFixture(parent,async(at,op)=>{if(hook)await hook(at,op);}));
    const sources=[],destinations=[],previews=[],candidateBytes=new Map(),preparedTokens=new Map();let preparations=0;
    // Observe opaque-token identity/counts while using the real repository ports.
    const observedStorage={...store,async prepare(media){
      preparations++;const token=await store.prepare(media);preparedTokens.set(media.provenance.planId,token);return token;
    },async commit(command){assert.equal(command.prepared,preparedTokens.get(command.provenance.planId));return store.commit(command);}};
    const render=async request=>{
      const selected=new Set(request.selection.trackIds),assets={};
      for(const track of request.snapshot.tracks)if(selected.has(track.trackId))assets[track.assetId]=Array.from(await store.loadAsset(track.assetId));
      const result=await native.render(request,assets),metrics=compare(decodePCM(result.bytes,4096),expectedGroup(recipe(request.snapshot.tracks[0].gain===1?'updated':'original')));
      assert.equal(metrics.passed,true);sources.push(metrics);return result;
    };
    const app=createSessionApplication({projectId:'project-native',storage:observedStorage,render,reviewMode}),ui=app.connect({role:'human-ui'}),sylune=app.connect({role:'sylune'});let seq=0;
    const call=(client,method,params={})=>client.invoke({schemaVersion:1,hostEpoch:app.hostEpoch,requestId:'native-'+(++seq),projectId:'project-native',method,params});
    async function value(client,method,params={}){const r=await call(client,method,params);assert.equal(r.ok,true,JSON.stringify(r));return r.value;}
    async function reviewStatus(reviewId,predicate=r=>!!r.review) {
      const deadline=performance.now()+20000;
      while(performance.now()<deadline){const r=await value(ui,'getLinkedReview',{reviewId});if(predicate(r))return r;await new Promise(r=>setTimeout(r,2));}
      throw Error('Native rendered review did not settle');
    }
    async function approved() {
      const before=(await store.readState()).generationId;
      let p=await value(sylune,'reviewLinkedUpdate',{groupId:'drums',targetId:'linked'});
      if(reviewMode==='rendered') {
        p=(await reviewStatus(p.reviewId)).review;assert.equal(p.reviewKind,'rendered');
        const request={schemaVersion:1,hostEpoch:app.hostEpoch,projectId:'project-native',planId:p.planId,previewId:p.preview.previewId};
        const first=await ui.readPreview(request);assert.equal(first.ok,true);const copy=new Uint8Array(first.value.bytes);first.value.bytes.fill(255);
        const second=await sylune.readPreview(request);assert.equal(second.ok,true);assert.deepEqual(second.value.bytes,copy);
        assert.equal(digest(copy),p.preview.sha256);assert.equal((await store.readState()).generationId,before);
        const source=await store.readSource('drums'),metrics=compare(decodePCM(copy,4096),expectedGroup(recipe(source.snapshot.tracks[0].gain===1?'updated':'original')));
        assert.equal(metrics.passed,true);previews.push({planId:p.planId,previewId:p.preview.previewId,sha256:p.preview.sha256,...metrics});candidateBytes.set(p.planId,copy);
      }else{assert.equal(p.reviewKind,'metadata-only');assert.equal(p.preview,null);}
      assert.equal((await call(sylune,'approveLinkedUpdate',{planId:p.planId,reviewRevision:p.reviewRevision})).error.code,'ROLE_FORBIDDEN');
      await value(ui,'approveLinkedUpdate',{planId:p.planId,reviewRevision:p.reviewRevision});return {...p,sourceRenderCount:sources.length,preparationCount:preparations};
    }
    async function execute(p,started=()=>{}) {
      const op=await value(sylune,'executeApproved',{planId:p.planId});started(op);assert.equal((await finish(op.operationId)).outcome.status,'completed');
      if(reviewMode==='rendered'){assert.equal(preparations,p.preparationCount);assert.equal(sources.length,p.sourceRenderCount);assert.equal(op.operationId,p.preview.previewId);}
      return op;
    }
    async function finish(id) {
      const deadline=performance.now()+20000;
      while(performance.now()<deadline){const op=await value(ui,'getOperation',{operationId:id});if(op.outcome)return op;await new Promise(r=>setTimeout(r,2));}
      throw Error('Native host operation did not settle');
    }
    async function destination(label) {
      const r=separateReader(store.descriptor),p=r.state.destination.processing;
      if(reviewMode==='rendered')assert.ok(r.bytes.equals(candidateBytes.get(r.version.provenance.planId)));
      const output=await native.renderDestination({linkedBytes:Array.from(r.bytes),unrelatedBytes:Array.from(r.other),unrelatedFrames:r.otherFrames,processing:p});
      assert.deepEqual(output.params,p);const metrics=compare(output.channels.map(c=>Float32Array.from(c)),expectedDestination(r.bytes));assert.equal(metrics.passed,true);
      destinations.push({label,...metrics});return r;
    }
    let last;
    try {
      const before=await value(sylune,'getSession',{sessionId:'source-a'});assert.equal(before.capabilities.renderedPreview,reviewMode==='rendered');
      const p=await approved();await execute(p);
      const original=await destination('original-through-host');
      const source=structuredClone(await store.readSource('drums'));source.snapshot.tracks[0].gain=1;source.snapshot.revisionId='host-source-r2';await store.updateSource(source);
      const q=await approved();await execute(q);
      const updated=await destination('updated-through-host');assert.ok(!original.bytes.equals(updated.bytes));assert.deepEqual(updated.other,original.other);
      await value(ui,'moveLinkedHistory',{targetId:'linked',direction:'undo',expectedLinkRevisionId:(await store.readState()).destination.linkRevisionId});
      assert.deepEqual((await destination('undo-through-host')).bytes,original.bytes);
      await value(ui,'moveLinkedHistory',{targetId:'linked',direction:'redo',expectedLinkRevisionId:(await store.readState()).destination.linkRevisionId});
      assert.deepEqual((await destination('redo-through-host')).bytes,updated.bytes);
      const beforeCancel=(await store.readState()).destination.linkedVersionId;let early;
      if(reviewMode==='rendered') {
        let handle;
        hook=async(at,op)=>{if(at==='media-synced'&&op==='prepare')assert.equal((await value(sylune,'cancelLinkedReview',{reviewId:handle.reviewId})).status,'accepted');};
        handle=await value(sylune,'reviewLinkedUpdate',{groupId:'drums',targetId:'linked'});
        const cancelled=await reviewStatus(handle.reviewId,r=>r.cleanup.status==='completed');assert.equal(cancelled.phase,'cancelled');assert.equal(cancelled.review,null);
        assert.equal((await store.readState()).destination.linkedVersionId,beforeCancel);
      }else {
        const e=await approved();hook=async(at,op)=>{if(at==='media-synced'&&op==='prepare')assert.equal((await value(sylune,'cancelOperation',{operationId:early.operationId})).status,'accepted');};
        early=await value(sylune,'executeApproved',{planId:e.planId});assert.equal((await finish(early.operationId)).outcome.status,'cancelled');assert.equal((await store.readState()).destination.linkedVersionId,beforeCancel);
      }
      hook=undefined;const l=await approved();
      hook=async(at,op)=>{if(at==='pointer-synced'&&op==='commit')assert.equal((await value(sylune,'cancelOperation',{operationId:last.operationId})).status,'too-late');};
      last=await execute(l,op=>{last=op;});hook=undefined;
      const save=await value(ui,'getPersistenceState');assert.equal(save.status,'session-only');assert.equal(save.lastPersistedAt,null);
    }finally{hook=undefined;await app.close();}
    const reopened=await openGenerationStore(store.descriptor,{writable:true});
    const restarted=createSessionApplication({projectId:'project-native',storage:reopened,render:async()=>{throw Error('Receipt queries must not re-render');}});
    let recovered;
    try {
      const client=restarted.connect({role:'human-ui'});recovered=await client.invoke({schemaVersion:1,hostEpoch:restarted.hostEpoch,requestId:'reopened-receipt',projectId:'project-native',method:'getOperation',params:{operationId:last.operationId}});
      assert.equal(recovered.ok,true);assert.equal(recovered.value.recovered,true);assert.equal(recovered.value.outcome.versionId,(await reopened.readLinked()).version.versionId);
    }finally{await restarted.close();}
    const hashes={};for(const name of ['src/application/sessions/sessionApplication.js','src/application/sessions/sessionWireContract.js',
      'src/application/linkedSessions/linkedUpdateService.js','src/infrastructure/linkedSessions/generationStore.js','scripts/validation/run-session-application-integration.mjs','tests/fixtures/linkedSessionStoreFixture.js'])hashes[name]=digest(await fs.readFile(new URL('../../'+name,import.meta.url)));
    return {kind:'CORE-014-native-application-facade',reviewMode,previews,preparations,preparedTokenIdentityVerified:true,exactCandidateCommitWithoutRerender:reviewMode==='rendered',storage:'real Linux generation repository',sourceMetrics:sources,destinations,maxAllowedError:MAX_ERROR,
      cancellation:{duringPrepare:'cancelled',duringCommit:'too-late'},receiptReconciledAfterHostRestart:recovered.value.recovered,hostCodeHashes:hashes,
      limitations:['synthetic programmatic roles, not actual human UI/LLM provider',reviewMode==='rendered'?'staged byte access only, no actual UI audition/player':'metadata-only review; no staged audition','4096-frame profile','not Electron IPC/app quit-restart/playback','no qualified application save receipt','not macOS production storage/security/release certification']};
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===SCRIPT){
  const args=process.argv.slice(2);(args[0]==='--tools-dir'&&((args.length===2)||(args.length===3&&args[2]==='--rendered-review'))?run(args[1],{reviewMode:args.length===3?'rendered':'metadata'}):Promise.reject(Error('Usage: --tools-dir <approved-private-toolkit> [--rendered-review]'))).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.stack);process.exitCode=1;});
}
