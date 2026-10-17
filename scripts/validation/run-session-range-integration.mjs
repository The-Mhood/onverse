// Opt-in trusted synthetic range proof: same renderer/service/host/repository.
// No GUI, real human/model, player, IPC registration, Mac or release claim.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createGenerationStore,openGenerationStore} from '../../src/infrastructure/linkedSessions/generationStore.js';
import {createSessionApplication} from '../../src/application/sessions/sessionApplication.js';
import {createLinkedUpdateService} from '../../src/application/linkedSessions/linkedUpdateService.js';
import {RANGE_PROFILE} from '../../src/domain/linkedSessions/renderProfiles.js';
import {decodePCM} from '../../src/audio/linkedSessions/pcm.js';
import {rangeFixture,rangeHash,expectedRange,expectedRangeDestination} from '../../tests/fixtures/linkedRangeFixture.js';
import {compare,MAX_ERROR} from './offline-render-fixtures.mjs';
import {run as harness} from './run-linked-render-probe.mjs';
const SCRIPT=fileURLToPath(import.meta.url),RATE=48000;
function media(bytes){return {bytes:new Uint8Array(bytes),frames:bytes.length/8,sampleRate:RATE,layout:['L','R'],sha256:rangeHash(bytes)};}
function readSeparate(descriptor){
  const r=spawnSync(process.execPath,[SCRIPT,'--read'],{input:JSON.stringify({descriptor}),encoding:'utf8',maxBuffer:20*1024*1024,timeout:30000,env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',TZ:'UTC'}});
  assert.equal(r.status,0,r.stderr);assert.equal(r.signal,null);const out=JSON.parse(r.stdout);
  out.bytes=Buffer.from(out.base64,'base64');out.other=Buffer.from(out.otherBase64,'base64');assert.equal(rangeHash(out.bytes),out.version.sha256);return out;
}
export async function run(tools){return harness(tools,async native=>{
  const parent=await fs.mkdtemp('/tmp/onverse-native-range-'),f=rangeFixture(parent,undefined,12*RATE);f.source.selection.rangeEndFrame=4800+8*RATE;
  let hook,renders=0,preparations=0;const tokens=new Map(),candidates=new Map(),sources=[],previews=[],destinations=[],crashes=[];
  const store=await createGenerationStore({...f,onBoundary:async(at,op)=>{if(hook)await hook(at,op);}});
  const storage={...store,async prepare(m){preparations++;const token=await store.prepare(m);tokens.set(m.provenance.planId,token);return token;},async commit(c){assert.equal(c.prepared,tokens.get(c.provenance.planId));return store.commit(c);}};
  const app=createSessionApplication({projectId:'range-native',storage,renderProfile:RANGE_PROFILE,reviewMode:'rendered',render:async request=>{
    renders++;const assets={};for(const t of request.snapshot.tracks)if(request.selection.trackIds.includes(t.trackId))assets[t.assetId]=await store.loadAsset(t.assetId);
    const out=await native.render(request,assets),metrics=compare(decodePCM(out.bytes,out.frames,RANGE_PROFILE),expectedRange(request.snapshot,request.selection,f.assets));assert.equal(metrics.passed,true);sources.push({frames:out.frames,...metrics});return out;
  }}),ui=app.connect({role:'human-ui'}),sylune=app.connect({role:'sylune'});let seq=0;
  async function value(client,method,params={}){const r=await client.invoke({schemaVersion:1,hostEpoch:app.hostEpoch,projectId:'range-native',requestId:'native-range-'+(++seq),method,params});assert.equal(r.ok,true,JSON.stringify(r));return r.value;}
  async function status(id,predicate=r=>!!r.review){const end=performance.now()+30000;while(performance.now()<end){const r=await value(ui,'getLinkedReview',{reviewId:id});if(predicate(r))return r;await new Promise(r=>setTimeout(r,2));}throw Error('Review timeout');}
  async function ready(){
    const before=(await store.readState()).generationId,handle=await value(sylune,'reviewLinkedUpdate',{groupId:'drums',targetId:'linked'}),p=(await status(handle.reviewId)).review;
    const parts=[];for(let offsetBytes=0;offsetBytes<p.preview.frames*8;offsetBytes+=262144){
      const lengthBytes=Math.min(262144,p.preview.frames*8-offsetBytes),r=await ui.readPreview({schemaVersion:1,hostEpoch:app.hostEpoch,projectId:'range-native',planId:p.planId,previewId:p.preview.previewId,offsetBytes,lengthBytes});
      assert.equal(r.ok,true);assert.equal(r.value.offsetBytes,offsetBytes);assert.equal(rangeHash(r.value.bytes),r.value.chunkSha256);parts.push(Buffer.from(r.value.bytes));r.value.bytes.fill(255);
    }
    const bytes=Buffer.concat(parts);assert.equal(rangeHash(bytes),p.preview.sha256);assert.equal((await store.readState()).generationId,before);candidates.set(p.planId,bytes);previews.push({frames:p.preview.frames,sha256:p.preview.sha256,chunks:parts.length});
    const request={schemaVersion:1,hostEpoch:app.hostEpoch,projectId:'range-native',planId:p.planId,previewId:p.preview.previewId,offsetBytes:0,lengthBytes:8};
    const again=await sylune.readPreview(request);assert.equal(again.ok,true);assert.ok(bytes.subarray(0,8).equals(again.value.bytes));
    await value(ui,'approveLinkedUpdate',{planId:p.planId,reviewRevision:p.reviewRevision});return p;
  }
  async function execute(p){const before=[renders,preparations],op=await value(sylune,'executeApproved',{planId:p.planId});assert.equal(op.operationId,p.preview.previewId);
    const end=performance.now()+30000;while(performance.now()<end){const r=await value(ui,'getOperation',{operationId:op.operationId});if(r.outcome){assert.equal(r.outcome.status,'completed');assert.deepEqual([renders,preparations],before);return op;}await new Promise(r=>setTimeout(r,2));}throw Error('Execute timeout');}
  async function destination(label){const r=readSeparate(store.descriptor);assert.ok(r.bytes.equals(candidates.get(r.version.provenance.planId)));
    const out=await native.renderDestination({renderProfile:RANGE_PROFILE,linkedFrames:r.bytes.length/8,linkedBytes:r.bytes,unrelatedBytes:r.other,unrelatedFrames:r.other.length/8,processing:r.state.destination.processing});
    assert.deepEqual(out.params,r.state.destination.processing);const expected=expectedRangeDestination(r.bytes,r.other,r.state.destination.processing),metrics=compare(out.channels,expected);let worst={error:0};if(!metrics.passed)for(let c=0;c<2;c++)for(let n=0;n<out.frames;n++)if(Math.abs(out.channels[c][n]-expected[c][n])>worst.error)worst={c,n,error:Math.abs(out.channels[c][n]-expected[c][n]),actual:out.channels[c][n],expected:expected[c][n]};assert.equal(metrics.passed,true,JSON.stringify({label,metrics,params:out.params,worst}));destinations.push({label,frames:out.frames,...metrics});return r;}
  let first,updated,last;
  try{
    const p=await ready();await execute(p);first=await destination('eight-second-nonzero-range');
    const source=structuredClone(await store.readSource('drums'));source.snapshot.tracks[0].gain=.75;source.snapshot.revisionId='range-r2';source.selection.rangeEndFrame=4800+12*RATE;await store.updateSource(source);
    const q=await ready();await execute(q);updated=await destination('twelve-second-explicit-update');assert.ok(!first.bytes.equals(updated.bytes));assert.ok(first.other.equals(updated.other));
    await value(ui,'moveLinkedHistory',{targetId:'linked',direction:'undo',expectedLinkRevisionId:(await store.readState()).destination.linkRevisionId});assert.ok((await destination('undo-eight-seconds')).bytes.equals(first.bytes));
    await value(ui,'moveLinkedHistory',{targetId:'linked',direction:'redo',expectedLinkRevisionId:(await store.readState()).destination.linkRevisionId});assert.ok((await destination('redo-twelve-seconds')).bytes.equals(updated.bytes));
    let handle;hook=async(at,op)=>{if(at==='media-synced'&&op==='prepare')assert.equal((await value(sylune,'cancelLinkedReview',{reviewId:handle.reviewId})).status,'accepted');};
    handle=await value(sylune,'reviewLinkedUpdate',{groupId:'drums',targetId:'linked'});assert.equal((await status(handle.reviewId,r=>r.cleanup.status==='completed')).phase,'cancelled');hook=undefined;
    assert.equal((await store.readState()).destination.linkedVersionId,updated.version.versionId);
    const max=structuredClone(await store.readSource('drums'));max.selection.rangeEndFrame=4800+30*RATE;await store.updateSource(max);
    const z=await ready();hook=async(at,op)=>{if(at==='pointer-synced'&&op==='commit')assert.equal((await value(sylune,'cancelLinkedReview',{reviewId:z.planId})).status,'too-late');};last=await execute(z);hook=undefined;await destination('thirty-second-boundary');
  }finally{hook=undefined;await app.close();}
  const reopened=await openGenerationStore(store.descriptor,{writable:true});try{assert.equal(reopened.renderProfile,RANGE_PROFILE);assert.equal((await reopened.readLinked()).version.provenance.operationId,last.operationId);}finally{await reopened.close();}
  // Crash children stage frozen audio produced by the native engine above, not a
  // synthetic re-render. Real service/prepare/approval/commit/kernel writer runs.
  for(const boundary of ['media-partial','pointer-synced','pointer-renamed']){
    const fixture=rangeFixture(parent,undefined,12*RATE);fixture.source.selection.rangeEndFrame=4800+8*RATE;const st=await createGenerationStore(fixture);
    const service=createLinkedUpdateService({readSource:st.readSource,readTarget:st.readTarget,storage:st,render:async()=>media(first.bytes),renderProfile:RANGE_PROFILE,reviewMode:'rendered'});
    const v=await service.review({groupId:'drums',targetId:'linked'});assert.equal((await service.start(await service.approvePreview(v)).completion).status,'completed');
    const src=structuredClone(await st.readSource('drums'));src.snapshot.tracks[0].gain=.75;src.snapshot.revisionId='range-r2';src.selection.rangeEndFrame=4800+12*RATE;await st.updateSource(src);await st.close();
    const killed=spawnSync(process.execPath,[SCRIPT,'--crash',boundary],{input:JSON.stringify({descriptor:st.descriptor,base64:updated.bytes.toString('base64')}),encoding:'utf8',maxBuffer:65536,timeout:30000,env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',TZ:'UTC'}});
    assert.equal(killed.signal,'SIGKILL',killed.stderr);const r=readSeparate(st.descriptor),promoted=boundary==='pointer-renamed';assert.ok(r.bytes.equals(promoted?updated.bytes:first.bytes));
    const recovered=await openGenerationStore(st.descriptor,{writable:true});let quarantine;
    try{const plan=await recovered.inspectOrphans();quarantine=await recovered.quarantineOrphans(plan);if(promoted){await recovered.moveHistory('undo',(await recovered.readState()).destination.linkRevisionId);assert.ok((await recovered.readLinked()).bytes.equals(first.bytes));}}
    finally{await recovered.close();}
    crashes.push({boundary,signal:killed.signal,promoted,exactBytes:true,writableReopened:true,quarantine});
  }
  const hashes={};for(const f of ['src/domain/linkedSessions/renderProfiles.js','src/domain/linkedSessions/linkedSessionContract.js','src/audio/linkedSessions/pcm.js','src/audio/linkedSessions/renderSelection.js','src/audio/linkedSessions/renderLinkedDestination.js','src/application/linkedSessions/linkedUpdateService.js','src/application/sessions/sessionApplication.js','src/application/sessions/sessionWireContract.js','src/infrastructure/linkedSessions/generationStore.js','tests/fixtures/linkedRangeFixture.js','scripts/validation/run-session-range-integration.mjs'])hashes[f]=rangeHash(await fs.readFile(new URL('../../'+f,import.meta.url)));
  return {kind:'CORE-014-range-native',renderProfile:RANGE_PROFILE,sources,previews,destinations,crashes,renders,preparations,exactPreparedTokensAndBytes:true,noExecutionRerenderOrPrepare:true,maxAllowedError:MAX_ERROR,codeIdentity:hashes,
    limitations:['experimental schema3, no silent migration or production database','synthetic programmatic roles, no actual GUI audition/listening or provider','30second/5minute bounded profile, not arbitrary DAW length','chunk byte API is core-only, no authenticated IPC/player','Linux SIGKILL not Mac/power-loss/security/release qualification','existing LUFS/truepeak/gain risks unchanged']};
},{renderProfile:RANGE_PROFILE});}
async function input(){const parts=[];let size=0;for await(const part of process.stdin){size+=part.length;if(size>17*1024*1024)throw Error('Oversize fixture input');parts.push(part);}return JSON.parse(Buffer.concat(parts));}
if(process.argv[1]&&path.resolve(process.argv[1])===SCRIPT){(async()=>{
  const a=process.argv.slice(2);
  if(a.length===1&&a[0]==='--read'){const {descriptor}=await input(),s=await openGenerationStore(descriptor);try{const r=await s.readLinked(),other=await s.loadAsset(r.state.destination.unrelatedAssetId);console.log(JSON.stringify({...r,bytes:undefined,base64:r.bytes.toString('base64'),otherBase64:Buffer.from(other).toString('base64')}));}finally{await s.close();}return;}
  if(a.length===2&&a[0]==='--crash'&&['media-partial','pointer-synced','pointer-renamed'].includes(a[1])){
    const {descriptor,base64}=await input(),bytes=Buffer.from(base64,'base64');decodePCM(bytes,bytes.length/8,RANGE_PROFILE);
    const store=await openGenerationStore(descriptor,{writable:true,onBoundary:async(at,op)=>{if(at===a[1]&&op===(a[1]==='media-partial'?'prepare':'commit'))process.kill(process.pid,'SIGKILL');}});
    try{const svc=createLinkedUpdateService({readSource:store.readSource,readTarget:store.readTarget,storage:store,render:async()=>media(bytes),renderProfile:RANGE_PROFILE,reviewMode:'rendered'}),v=await svc.review({groupId:'drums',targetId:'linked'});await svc.start(await svc.approvePreview(v)).completion;throw Error('Expected crash boundary not reached');}finally{await store.close();}
  }
  if(a.length!==2||a[0]!=='--tools-dir')throw Error('Usage: --tools-dir <approved-private-toolkit>');console.log(JSON.stringify(await run(a[1]),null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});}
