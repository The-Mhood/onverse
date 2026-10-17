import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {candidateMain,reviewPatch,prepareReview,EXPECTED_MAIN_SHA256,PROBE_FLAG} from '../../scripts/validation/prepare-packaged-runtime-probe.mjs';
const require=createRequire(import.meta.url),source=fs.readFileSync(new URL('../../scripts/validation/packaged-runtime-candidate/sessionRuntimeProbe.cjs',import.meta.url),'utf8');
const original=fs.readFileSync(new URL('../../electron/main.cjs',import.meta.url),'utf8');
let sqlite;try{sqlite=require('node:sqlite');}catch{}
// All Electron-looking contexts below are explicitly VM contract simulations.
// Real Node SQLite and plain fixture bytes do NOT prove Electron, ASAR or macOS.
function simulate({argv=['/fixture/MusicOnVerse',PROBE_FLAG],versions={...process.versions,electron:'simulated-not-evidence'},type='browser',platform='darwin',arch='arm64',env={},packaged=true,ready=false,loader,logicalFs={},writeError=false,appOverride,filename='/fixture/Resources/app.asar/electron/diagnostics/sessionRuntimeProbe.cjs'}={}){
  const calls=[],writes=[],exits=[];const app=appOverride??{isPackaged:packaged,isReady:()=>ready,exit:code=>exits.push(code),getAppPath:()=>'/fixture/Resources/app.asar'};
  const fakeProcess={argv,versions,version:process.version,type,platform,arch,env,resourcesPath:'/fixture/Resources',execPath:'/fixture/MusicOnVerse',hrtime:process.hrtime,exit:code=>exits.push(code)};
  const localRequire=name=>{calls.push(name);if(name==='electron')return {app};if(name==='node:fs')return {...fs,...logicalFs,writeSync:(_fd,text)=>{if(writeError)throw Error('simulated-output-failure');writes.push(text);return text.length;}};if(loader){const result=loader(name);if(result!==undefined)return result;}if(name==='node:sqlite'||name==='original-fs')throw Error('explicit simulated unavailable dependency');return require(name);};
  const context={module:{exports:{}},require:localRequire,process:fakeProcess,__filename:filename,Buffer};vm.runInNewContext(source,context,{filename:'VM-contract-only-probe.cjs'});const report=context.module.exports.run();
  return {report:JSON.parse(JSON.stringify(report)),writes,exits,calls,fakeProcess};
}
const problem=(options,expected)=>{const result=simulate(options);assert.deepEqual(result.report.problems,[expected]);assert.equal(result.report.productionReady,false);assert.equal(result.report.storageQualificationPassed,false);assert.ok(!result.calls.includes('node:sqlite'));assert.ok(!result.calls.includes('original-fs'));return result;};
test('patch generator pins exact current main; changed base is refused, never silently rebased',()=>{
  assert.equal(createHash('sha256').update(original).digest('hex'),EXPECTED_MAIN_SHA256);assert.throws(()=>candidateMain(original+'\n'),/MAIN_BASE_CHANGED/);assert.throws(()=>candidateMain(original.replace('autoDownload = true','autoDownload = false')),/MAIN_BASE_CHANGED/);
});
test('candidate main wraps the original normal path verbatim; no updater/preload/security edits',()=>{
  const candidate=candidateMain(original),prefix=candidate.indexOf('} else {\n')+9;
  assert.equal(candidate.slice(prefix,-2),original.slice(original.indexOf('"use strict"')+'"use strict"'.length+1));
  assert.equal((candidate.match(/require\("electron-updater"\)/g)||[]).length,1);assert.ok(candidate.indexOf('sessionRuntimeProbe.cjs')<candidate.indexOf('require("electron-updater")'));
});
test('prepared patch is deterministic, review-only and excludes package or application edits',async()=>{
  const a=await prepareReview(),b=await prepareReview();assert.deepEqual(a,b);assert.equal(a.patch.split('diff --git ').length-1,2);assert.ok(a.patch.includes('new file mode 100644'));assert.equal(fs.readFileSync(new URL('../../electron/main.cjs',import.meta.url),'utf8'),original);
  assert.throws(()=>reviewPatch(original,source+'\r'),/INVALID_PROBE_SOURCE/);
});
test('actual git apply/check/reverse succeeds only in an invocation-created review tree',async()=>{
  const root=await fsp.mkdtemp(path.join(os.tmpdir(),'mov-candidate-apply-'));try{
    await fsp.mkdir(path.join(root,'electron'));await fsp.writeFile(path.join(root,'electron/main.cjs'),original);const proposed=reviewPatch(original,source);
    for(const args of [['apply','--check'],['apply']]){const p=spawnSync('git',args,{cwd:root,input:proposed.patch,encoding:'utf8',timeout:10000});assert.equal(p.status,0,p.stderr);}
    assert.equal(await fsp.readFile(path.join(root,'electron/main.cjs'),'utf8'),proposed.proposedMain);assert.equal(await fsp.readFile(path.join(root,'electron/diagnostics/sessionRuntimeProbe.cjs'),'utf8'),source);
    const reverse=spawnSync('git',['apply','--reverse'],{cwd:root,input:proposed.patch,encoding:'utf8',timeout:10000});assert.equal(reverse.status,0,reverse.stderr);assert.equal(await fsp.readFile(path.join(root,'electron/main.cjs'),'utf8'),original);
  }finally{await fsp.rm(root,{recursive:true});}
});
test('normal candidate main takes precisely the original initialization call sequence (VM only)',()=>{
  const execute=text=>{const events=[],app={setName:n=>events.push(['name',n]),whenReady:()=>({then:fn=>events.push(['ready-callback',typeof fn])}),on:(...args)=>events.push(['app-on',args[0]])};const updater={};
    vm.runInNewContext(text,{require:name=>{events.push(['require',name]);if(name==='electron')return {app};if(name==='electron-updater')return {autoUpdater:updater};if(name==='path')return path;throw Error('unexpected normal-path import');},process:{argv:['/fixture/app'],platform:'darwin',env:{}},__dirname:'/fixture/electron'});return {events,updater};};
  assert.deepEqual(execute(candidateMain(original)),execute(original));
});
test('reserved diagnostic prefix never imports normal updater or creates a window (VM dispatch only)',()=>{
  for(const flag of [PROBE_FLAG,'--mov-session-runtime-typo']){const calls=[];vm.runInNewContext(candidateMain(original),{process:{argv:['/fixture/app',flag]},require:name=>{calls.push(name);assert.equal(name,'./diagnostics/sessionRuntimeProbe.cjs');return {run:()=>calls.push('probe-run')};}});assert.deepEqual(calls,['./diagnostics/sessionRuntimeProbe.cjs','probe-run']);}
});
test('extra, duplicate and arbitrary path/SQL arguments fail closed and exit even in Electron-looking context',()=>{
  for(const argv of [['/fixture/app',PROBE_FLAG,'--output','/private/user'],['/fixture/app',PROBE_FLAG,PROBE_FLAG],['/fixture/app','--mov-session-runtime-typo']]){const r=problem({argv},'INVALID_PROBE_ARGUMENTS');assert.deepEqual(r.exits,[2]);assert.ok(!r.writes.join('').includes('/private/user'));}
});
test('standalone Node and renderer contexts cannot qualify the entry (VM rejection branches only)',()=>{
  const a=problem({versions:{node:process.versions.node},type:'node'},'ELECTRON_MAIN_REQUIRED');assert.equal(a.fakeProcess.exitCode,2);
  const b=problem({type:'renderer'},'ELECTRON_MAIN_REQUIRED');assert.equal(b.fakeProcess.exitCode,2);
});
test('run-as-node, unpackaged, non-Mac, unsupported arch and late entry are refused (VM only)',()=>{
  problem({env:{ELECTRON_RUN_AS_NODE:'1'}},'RUN_AS_NODE_REFUSED');for(const opts of [{packaged:false},{platform:'linux'},{arch:'ia32'}])problem(opts,'PACKAGED_MAC_REQUIRED');problem({ready:true},'EARLY_ENTRY_REQUIRED');
});
test('unavailable Electron API exits nonzero without updater fallback (VM only)',()=>{
  const r=problem({appOverride:{}},'ELECTRON_API_UNAVAILABLE');assert.deepEqual(r.exits,[1]);
});
test('absent builtin is blocked without installing or loading a native alternative (VM only)',()=>{
  const r=simulate();assert.deepEqual(r.report.problems,['BUILTIN_SQLITE_UNAVAILABLE']);assert.deepEqual(r.exits,[2]);assert.equal(r.report.sqlite,undefined);assert.ok(!r.calls.includes('original-fs'));
});
test('real Node builtin :memory: capability checks can run inside a simulated main context, NOT Electron proof',{skip:!sqlite},()=>{
  const r=simulate({loader:n=>n==='node:sqlite'?sqlite:undefined});assert.equal(r.report.sqlite.available,true);assert.equal(r.report.sqlite.memoryOnly,true);assert.equal(r.report.sqlite.foreignKeyRejection,true);assert.equal(r.report.sqlite.transactionRollback,true);
  assert.deepEqual(r.report.problems,['RAW_ASAR_FS_UNAVAILABLE']);assert.equal(r.report.productionReady,false);assert.deepEqual(r.exits,[2]);
});
test('output failure cannot exit successfully (VM only)',()=>{
  const r=simulate({writeError:true});assert.deepEqual(r.exits,[1]);assert.equal(r.writes.length,0);
});
test('all reserved real-Node candidate main invocations reject, without loading Electron/updater',async()=>{
  const root=await fsp.mkdtemp(path.join(os.tmpdir(),'mov-candidate-node-'));try{await fsp.mkdir(path.join(root,'electron/diagnostics'),{recursive:true});await fsp.writeFile(path.join(root,'electron/main.cjs'),candidateMain(original));await fsp.writeFile(path.join(root,'electron/diagnostics/sessionRuntimeProbe.cjs'),source);
    const r=spawnSync(process.execPath,[path.join(root,'electron/main.cjs'),PROBE_FLAG],{encoding:'utf8',timeout:10000,env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'}});assert.equal(r.status,2,r.stderr);const report=JSON.parse(r.stdout);assert.deepEqual(report.problems,['INVALID_PROBE_ARGUMENTS']);assert.equal(report.runtime.electron,null);assert.equal(report.productionReady,false);
  }finally{await fsp.rm(root,{recursive:true});}
});
async function artifactFixture(t){
  const root=await fsp.mkdtemp(path.join(os.tmpdir(),'mov-capability-artifact-'));t.after(()=>fsp.rm(root,{recursive:true}));
  const files=new Map([['/fixture/MusicOnVerse',path.join(root,'executable')],['/fixture/Resources/app.asar',path.join(root,'plain-bytes-NOT-real-asar')]]);
  for(const [name,file] of files)await fsp.writeFile(file,'synthetic artifact bytes for '+name,{mode:0o600});
  const logical=new Map([['/fixture/Resources/app.asar/electron/main.cjs',Buffer.from(candidateMain(original))],['/fixture/Resources/app.asar/electron/diagnostics/sessionRuntimeProbe.cjs',Buffer.from(source)]]);
  const closed=[];const raw={...fs,realpathSync:p=>p,openSync:(p,flags)=>fs.openSync(files.get(p),flags),lstatSync:(p,opts)=>fs.lstatSync(files.get(p),opts),closeSync:fd=>{closed.push(fd);fs.closeSync(fd);}};
  const logicalFs={statSync:p=>({size:logical.get(p).length}),readFileSync:p=>logical.get(p)};
  const options={logicalFs,loader:name=>name==='node:sqlite'?sqlite:name==='original-fs'?raw:undefined};return {options,raw,closed,files};
}
test('raw byte/source hash happy path is contract simulation ONLY, never an actual ASAR or packaged Mac result',{skip:!sqlite},async t=>{
  const f=await artifactFixture(t),r=simulate(f.options);assert.equal(r.report.status,'capability-only-pass');assert.deepEqual(r.exits,[0]);assert.equal(r.report.productionReady,false);assert.equal(r.report.storageQualificationPassed,false);assert.equal(r.report.apfsVerified,false);assert.equal(r.report.artifacts.fullRuntimeBundleHashed,false);assert.equal(f.closed.length,2);
  assert.equal(r.report.artifacts.appAsar.sha256,createHash('sha256').update(await fsp.readFile(f.files.get('/fixture/Resources/app.asar'))).digest('hex'));assert.equal(r.report.artifacts.logicalSources['electron/main.cjs'].sha256,createHash('sha256').update(candidateMain(original)).digest('hex'));
  assert.ok(!r.writes[0].includes('/fixture'));assert.ok(!r.calls.includes('electron-updater'));
});
test('unreviewed source/archive layout blocks before raw file reads (VM only)',{skip:!sqlite},()=>{
  const r=simulate({filename:'/fixture/elsewhere.cjs',loader:n=>n==='node:sqlite'?sqlite:undefined});assert.deepEqual(r.report.problems,['ARTIFACT_LAYOUT_UNREVIEWED']);assert.ok(!r.calls.includes('original-fs'));
});
test('raw artifact rename/replacement identity mismatch refuses the result and closes its FD (VM/plain bytes only)',{skip:!sqlite},async t=>{
  const f=await artifactFixture(t),lstat=f.raw.lstatSync;f.raw.lstatSync=(p,opts)=>{const stat=lstat(p,opts);stat.ino+=1n;return stat;};const r=simulate(f.options);assert.deepEqual(r.report.problems,['ARTIFACT_CHANGED']);assert.deepEqual(r.exits,[2]);assert.equal(f.closed.length,1);
});
test('over-limit artifact size blocks before hashing and closes its FD (VM/plain bytes only)',{skip:!sqlite},async t=>{
  const f=await artifactFixture(t);f.raw.fstatSync=(fd,opts)=>{const stat=fs.fstatSync(fd,opts);stat.size=1024n*1024n*1024n;return stat;};const r=simulate(f.options);assert.deepEqual(r.report.problems,['ARTIFACT_TOO_LARGE']);assert.equal(f.closed.length,1);
});
test('artifact primary failure and close failure both survive sanitized reporting (VM only)',{skip:!sqlite},async t=>{
  const f=await artifactFixture(t);f.raw.readSync=()=>{throw Object.assign(Error('not public'),{code:'EIO'});};const close=f.raw.closeSync;f.raw.closeSync=fd=>{close(fd);throw Error('not public close failure');};const r=simulate(f.options);assert.deepEqual(r.report.problems,['EIO','ARTIFACT_CLOSE_FAILED']);assert.equal(f.closed.length,1);assert.ok(!r.writes[0].includes('not public'));
});
test('SQLite primary failure and close failure both survive sanitized reporting (VM only)',()=>{
  class BrokenDatabase {exec(){throw Object.assign(Error('private SQL error'),{code:'ERR_SQLITE_ERROR'});}close(){throw Error('private close error');}}
  const r=simulate({loader:n=>n==='node:sqlite'?{DatabaseSync:BrokenDatabase}:undefined});assert.deepEqual(r.report.problems,['ERR_SQLITE_ERROR','SQLITE_CLOSE_FAILED']);assert.deepEqual(r.exits,[2]);assert.ok(!r.writes[0].includes('private SQL error'));
});
