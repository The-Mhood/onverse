import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {QUALIFICATION_PROFILE,CRASH_BOUNDARIES,parseQualificationArgs,runtimeFacts,missingProductionGates,digest,
  createQualificationRoot,createQualificationCase,assertFixtureIdentity,pinFixtureFiles,removeQualificationRoot} from '../../scripts/validation/session-runtime-contract.mjs';
import {qualifySessionRuntime,inspectQualificationCase} from '../../scripts/validation/run-session-runtime-qualification.mjs';
const SCRIPT=fileURLToPath(new URL('../../scripts/validation/run-session-runtime-qualification.mjs',import.meta.url));
const posix=['linux','darwin'].includes(process.platform),os={skip:!posix};
let Database;try{Database=(await import('node:sqlite')).DatabaseSync;}catch{}
const sqlite={skip:!posix||!Database};
async function fixture(t){const run=await createQualificationRoot();t.after(()=>removeQualificationRoot(run));const c=await createQualificationCase(run);return {run,c};}
function child(args,{env={},timeout=10000}={}){
  return new Promise((resolve,reject)=>{const c=spawn(process.execPath,args,{stdio:['ignore','pipe','pipe'],env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',TZ:'UTC',...env}});let stdout='',stderr='';const timer=setTimeout(()=>{c.kill('SIGKILL');reject(Error('Qualification test child timeout'));},timeout);
    c.stdout.on('data',b=>{stdout+=b;if(stdout.length>65536){c.kill('SIGKILL');reject(Error('Oversize test output'));}});c.stderr.on('data',b=>{stderr+=b;if(stderr.length>65536){c.kill('SIGKILL');reject(Error('Oversize test errors'));}});
    c.once('error',e=>{clearTimeout(timer);reject(e);});c.once('close',(code,signal)=>{clearTimeout(timer);resolve({code,signal,stdout,stderr});});});
}
const cli=c=>[SCRIPT,'--fixture',c.root,c.runId,c.nonce];
function seedOwnership(c,{version=1,mode='DELETE',nonce=c.nonce}={}){
  const db=new Database(path.join(c.root,'ownership.sqlite'));try{db.exec(`PRAGMA application_id=1297045073;PRAGMA user_version=${version};PRAGMA journal_mode=${mode};CREATE TABLE fixture_identity(id INTEGER PRIMARY KEY,profile TEXT,run_id TEXT,nonce TEXT)`);db.prepare('INSERT INTO fixture_identity VALUES(1,?,?,?)').run(QUALIFICATION_PROFILE,c.runId,nonce);}finally{db.close();}
}
test('qualification CLI is fixed; cannot select SQL, project paths, runtime or production status',()=>{
  assert.deepEqual(parseQualificationArgs([]),{mode:'run'});const id=randomUUID();assert.equal(parseQualificationArgs(['--fixture','/tmp/case-a',id,id,'hold']).mode,'fixture');
  for(const args of [['--project','/private/user'],['--sql','DROP TABLE head'],['--production-ready'],['--runtime','/bin/sh'],['--fixture','relative',id,id,'hold'],['--fixture','/tmp/../case',id,id,'hold'],['--fixture','/tmp/case',id,id,'arbitrary'],Array(5)])assert.throws(()=>parseQualificationArgs(args));
});
test('runtime facts are observed, frozen and cannot be promoted by caller-provided claims',()=>{
  const r=runtimeFacts({platform:'darwin',electron:'44.2.0',packagedApplicationVerified:true});assert.equal(r.platform,process.platform);assert.equal(r.electron,process.versions.electron??null);assert.equal(r.packagedApplicationVerified,false);assert.equal(r.apfsVerified,false);assert.ok(Object.isFrozen(r));
  assert.ok(Object.isFrozen(missingProductionGates()));assert.ok(missingProductionGates().includes('actual-packaged-Electron-main-runtime'));assert.equal(CRASH_BOUNDARIES.length,8);
});
test('private marked fixture creation and removal are identity-scoped',os,async()=>{
  const run=await createQualificationRoot(),c=await createQualificationCase(run);await assertFixtureIdentity(c);const s=await fs.lstat(run.root);assert.equal(s.mode&0o077,0);
  const pin=await pinFixtureFiles(c);await pin.assertUnchanged();await pin.close();await removeQualificationRoot(run);await assert.rejects(fs.stat(run.root),e=>e.code==='ENOENT');
});
test('wrong run identity/nonce reject before opening database',os,async t=>{
  const {c}=await fixture(t);await assert.rejects(assertFixtureIdentity({...c,nonce:randomUUID()}),/INVALID_FIXTURE_IDENTITY/);await assert.rejects(assertFixtureIdentity({...c,runId:randomUUID()}),/INVALID_FIXTURE_IDENTITY/);
  const before=await fs.readFile(path.join(c.root,'ownership.sqlite'));await assert.rejects(pinFixtureFiles({...c,root:'/tmp'}),/INVALID_FIXTURE_ROOT/);assert.deepEqual(await fs.readFile(path.join(c.root,'ownership.sqlite')),before);
});
test('symlink directory aliases cannot authorize a fixture',os,async t=>{
  const {run,c}=await fixture(t),alias=path.join(run.root,'case-alias');await fs.symlink(c.root,alias);await assert.rejects(assertFixtureIdentity({...c,root:alias}),/UNSAFE_FIXTURE_DIRECTORY/);await assertFixtureIdentity(c);
});
test('missing ownership file never auto-creates a replacement',os,async t=>{
  const {c}=await fixture(t),file=path.join(c.root,'ownership.sqlite');await fs.unlink(file);const before=await fs.readdir(c.root);await assert.rejects(pinFixtureFiles(c),e=>e.code==='ENOENT');assert.deepEqual(await fs.readdir(c.root),before);
});
test('database symlinks and hardlinks fail before SQLite can follow them',os,async t=>{
  for(const kind of ['symlink','hardlink']){const {c}=await fixture(t),target=path.join(c.root,'ownership.sqlite'),other=path.join(c.root,'outside-sentinel');await fs.writeFile(other,'unchanged',{mode:0o600});await fs.unlink(target);
    if(kind==='symlink')await fs.symlink(other,target);else await fs.link(other,target);await assert.rejects(pinFixtureFiles(c));assert.equal(await fs.readFile(other,'utf8'),'unchanged');}
});
test('overbroad file or directory permissions fail closed',os,async t=>{
  const {c}=await fixture(t);await fs.chmod(path.join(c.root,'ownership.sqlite'),0o644);await assert.rejects(pinFixtureFiles(c),/UNSAFE_FIXTURE_FILE/);await fs.chmod(path.join(c.root,'ownership.sqlite'),0o600);await fs.chmod(c.root,0o755);await assert.rejects(assertFixtureIdentity(c),/UNSAFE_FIXTURE_DIRECTORY/);
});
test('held file identity detects rename/replacement, not just same filename',os,async t=>{
  const {c}=await fixture(t),file=path.join(c.root,'ownership.sqlite'),pin=await pinFixtureFiles(c);
  try{await fs.rename(file,file+'.old');await fs.writeFile(file,new Uint8Array(0),{flag:'wx',mode:0o600});await assert.rejects(pin.assertUnchanged(),/FIXTURE_FILE_REPLACED/);}finally{await pin.close();}
});
test('fixture deletion requires original root inode/run marker, not a forged removal handle',os,async t=>{
  const {run}=await fixture(t);await assert.rejects(removeQualificationRoot({...run,ino:run.ino+1n}),/FIXTURE_ROOT_CHANGED/);await assert.rejects(removeQualificationRoot({...run,runId:randomUUID()}),/INVALID_FIXTURE_IDENTITY/);assert.ok((await fs.stat(run.root)).isDirectory());
});
test('unknown ownership schema is refused without touching session data',sqlite,async t=>{
  const {c}=await fixture(t);seedOwnership(c,{version:2});const file=path.join(c.root,'session.sqlite'),before=digest(await fs.readFile(file)),r=await child([...cli(c),'read']);assert.equal(r.code,2);assert.equal(JSON.parse(r.stdout).code,'UNKNOWN_OWNERSHIP_SCHEMA');assert.equal(digest(await fs.readFile(file)),before);
});
test('unknown ownership identity and WAL mutex mode cannot be silently adopted',sqlite,async t=>{
  for(const options of [{nonce:randomUUID()},{mode:'WAL'}]){const {c}=await fixture(t);seedOwnership(c,options);const r=await child([...cli(c),'hold']);assert.equal(r.code,2);const e=JSON.parse(r.stdout);assert.equal(e.code,options.mode?'UNKNOWN_OWNERSHIP_MODE':'UNKNOWN_OWNERSHIP_IDENTITY');}
});
test('future session schema is refused before journal-mode or data mutation',sqlite,async t=>{
  const {c}=await fixture(t);seedOwnership(c);const file=path.join(c.root,'session.sqlite'),db=new Database(file);db.exec('PRAGMA application_id=1297045073;PRAGMA user_version=99;CREATE TABLE sentinel(value TEXT);INSERT INTO sentinel VALUES(\'preserved\')');db.close();
  const before=digest(await fs.readFile(file)),r=await child([...cli(c),'read']);assert.equal(r.code,2);assert.equal(JSON.parse(r.stdout).code,'UNKNOWN_SESSION_SCHEMA');assert.equal(digest(await fs.readFile(file)),before);
  const read=new Database(file,{readOnly:true});try{assert.equal(read.prepare('PRAGMA journal_mode').get().journal_mode,'delete');assert.equal(read.prepare('SELECT value FROM sentinel').get().value,'preserved');}finally{read.close();}
});
test('child command rejects an invalid fixture with no raw path/error leakage',os,async t=>{
  const {c}=await fixture(t),r=await child([...cli({...c,nonce:randomUUID()}),'read']);assert.equal(r.code,2);assert.deepEqual(JSON.parse(r.stdout),{status:'rejected',code:'FIXTURE_REJECTED'});assert.ok(!r.stdout.includes(c.root));
});
test('disabled builtin is an actionable blocked result, with no dependency fallback or temp fixture',os,async()=>{
  const dir=await fs.mkdtemp('/tmp/onverse-no-sqlite-');try{const r=await child(['--no-experimental-sqlite',SCRIPT],{env:{TMPDIR:dir}});assert.equal(r.code,2,r.stderr);const report=JSON.parse(r.stdout);assert.equal(report.code,'BUILTIN_SQLITE_UNAVAILABLE');assert.equal(report.productionReady,false);assert.equal(report.builtinSqliteAvailable,false);assert.deepEqual(await fs.readdir(dir),[]);}finally{await fs.rm(dir,{recursive:true});}
});
test('Electron-looking context is refused, never launched using an assumed dev-script command (negative simulation only)',os,async()=>{
  const code=`Object.defineProperty(process.versions,'electron',{value:'test-negative-only'});const {qualifySessionRuntime}=await import(${JSON.stringify(new URL('../../scripts/validation/run-session-runtime-qualification.mjs',import.meta.url).href)});console.log(JSON.stringify(await qualifySessionRuntime()));`;
  const r=await child(['--input-type=module','-e',code]);assert.equal(r.code,0);const report=JSON.parse(r.stdout);assert.equal(report.status,'blocked');assert.equal(report.code,'REVIEWED_ELECTRON_ENTRY_REQUIRED');assert.equal(report.productionReady,false);assert.equal(report.productionAdapterImplemented,false);
});
test('actual builtin SQLite diagnostic uses useful PCM and atomic receipt/history crash boundaries, never claims product qualification',sqlite,async()=>{
  const report=await qualifySessionRuntime();assert.equal(report.status,'diagnostic-pass');assert.equal(report.productionReady,false);assert.equal(report.productionAdapterImplemented,false);assert.equal(report.runtime.electron,null);assert.equal(report.runtime.packagedApplicationVerified,false);
  assert.deepEqual(report.evidence.ownership,{liveWriterExcluded:true,killedOwnerReleases:true,oneCompetingWinner:true});assert.deepEqual(report.evidence.boundaries.map(b=>b.at),CRASH_BOUNDARIES);assert.equal(report.evidence.boundaries.filter(b=>b.committed).length,1);
  assert.ok(report.evidence.boundaries.every(b=>b.signal==='SIGKILL'&&b.mediaHeadHistoryReceiptAtomic&&b.audioBytesVerified));assert.deepEqual(report.evidence.history.frames,[384000,576000]);assert.equal(report.evidence.history.absentReceipt,'unknown-not-failed');
  assert.equal(report.evidence.configuration.session.journalMode,'wal');assert.equal(report.evidence.configuration.ownership.journalMode,'delete');assert.equal(report.durability.hardwareFlushProven,false);assert.equal(report.durability.powerLossProven,false);
  assert.ok(report.evidence.conflicts.some(c=>c.kind==='deferred-history-foreign-key'));assert.equal(report.evidence.corruption.structurallyValidBlobChecksumRejected,true);assert.deepEqual(report.fixtureCleanup,{childrenClosed:true,rootRemoved:true});
});

test('failed session open releases lifetime ownership while the parent process stays alive',sqlite,async t=>{
  const {c}=await fixture(t);seedOwnership(c);await assert.rejects(inspectQualificationCase(c),/UNKNOWN_SESSION_SCHEMA/);
  const r=await child([...cli(c),'hold']);assert.equal(r.code,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),{status:'acquired'});
});
test('case creation validates its retained run handle before creating any child files',os,async t=>{
  const {run}=await fixture(t),before=await fs.readdir(run.root);await assert.rejects(createQualificationCase({...run,ino:run.ino+1n}),/FIXTURE_ROOT_CHANGED/);assert.deepEqual(await fs.readdir(run.root),before);
});
