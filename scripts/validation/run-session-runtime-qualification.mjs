// Fixture-only runtime evidence. NOT a production repository, migration, IPC or
// an adapter fallback. Opens only newly generated, private marked temp cases.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {writeSync} from 'node:fs';
import assert from 'node:assert/strict';
import {encodePCM,decodePCM} from '../../src/audio/linkedSessions/pcm.js';
import {RANGE_PROFILE} from '../../src/domain/linkedSessions/renderProfiles.js';
import {QUALIFICATION_PROFILE,CRASH_BOUNDARIES,qualificationError,requireQualification,digest,runtimeFacts,missingProductionGates,
  parseQualificationArgs,createQualificationRoot,createQualificationCase,assertFixtureIdentity,pinFixtureFiles,removeQualificationRoot} from './session-runtime-contract.mjs';
const SCRIPT=fileURLToPath(import.meta.url),APP_ID=0x4d4f5651,SCHEMA=1;
const OLD='version-old',NEW='version-new',OP='operation-new';
function pcm(frames,amplitude){const bytes=encodePCM([0,1].map(c=>Float32Array.from({length:frames},(_,n)=>(c===0?amplitude:-amplitude)*Math.sin(2*Math.PI*375*n/48000))),RANGE_PROFILE);return {bytes,frames,sha:digest(bytes)};}
function media(kind){return kind==='old'?pcm(8*48000,.25):pcm(12*48000,.5);}
async function builtin(){try{return (await import('node:sqlite')).DatabaseSync;}catch{throw qualificationError('BUILTIN_SQLITE_UNAVAILABLE');}}
function scalar(db,sql){return Object.values(db.prepare(sql).get())[0];}
function settings(db,owner=false){
  db.exec(`PRAGMA busy_timeout=0; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL; PRAGMA fullfsync=ON; PRAGMA checkpoint_fullfsync=ON; PRAGMA journal_mode=${owner?'DELETE':'WAL'}`);
  const values={journalMode:scalar(db,'PRAGMA journal_mode'),synchronous:scalar(db,'PRAGMA synchronous'),foreignKeys:scalar(db,'PRAGMA foreign_keys'),busyTimeout:scalar(db,'PRAGMA busy_timeout'),fullfsync:scalar(db,'PRAGMA fullfsync'),checkpointFullfsync:scalar(db,'PRAGMA checkpoint_fullfsync')};
  requireQualification(values.journalMode===(owner?'delete':'wal')&&values.synchronous===2&&values.foreignKeys===1&&values.busyTimeout===0&&values.fullfsync===1&&values.checkpointFullfsync===1,'SQLITE_SETTINGS_MISMATCH');return values;
}
function owner(Database,c){
  const db=new Database(path.join(c.root,'ownership.sqlite'));
  try{
    requireQualification(scalar(db,'PRAGMA journal_mode')==='delete','UNKNOWN_OWNERSHIP_MODE');const configuration=settings(db,true);db.exec('BEGIN EXCLUSIVE');
    requireQualification(scalar(db,'PRAGMA application_id')===APP_ID&&scalar(db,'PRAGMA user_version')===SCHEMA,'UNKNOWN_OWNERSHIP_SCHEMA');
    const row=db.prepare('SELECT profile,run_id,nonce FROM fixture_identity WHERE id=1').get();
    requireQualification(row?.profile===QUALIFICATION_PROFILE&&row.run_id===c.runId&&row.nonce===c.nonce,'UNKNOWN_OWNERSHIP_IDENTITY');
    return {db,configuration};
  }catch(e){try{db.close();}catch(close){throw new AggregateError([e,close],'Ownership open and cleanup failed');}throw e;}
}
function releaseOwnership(lock){
  const errors=[];try{lock.db.exec('ROLLBACK');}catch(e){errors.push(e);}try{lock.db.close();}catch(e){errors.push(e);}
  if(errors.length)throw new AggregateError(errors,'Ownership release failed');
}
// Fixed read-only verification of a marked validation case, never an app port.
export async function inspectQualificationCase(c){return scoped(await builtin(),c,db=>snapshot(db));}
async function scoped(Database,c,fn){
  const pin=await pinFixtureFiles(c);let ownership,db,primary;
  try{ownership=owner(Database,c);await pin.assertUnchanged();db=new Database(path.join(c.root,'session.sqlite'));
    requireQualification(scalar(db,'PRAGMA application_id')===APP_ID&&scalar(db,'PRAGMA user_version')===SCHEMA,'UNKNOWN_SESSION_SCHEMA');
    const configuration=settings(db);await pin.assertUnchanged();return await fn(db,pin,{ownership:ownership.configuration,session:configuration});
  }catch(e){primary=e;throw e;}
  finally{const errors=[];if(db)try{db.close();}catch(e){errors.push(e);}if(ownership)try{releaseOwnership(ownership);}catch(e){errors.push(e);}try{await pin.close();}catch(e){errors.push(e);}
    if(errors.length)throw new AggregateError([...(primary?[primary]:[]),...errors],'Scoped fixture cleanup failed');}
}
async function initialize(Database,c){
  await assertFixtureIdentity(c);const pin=await pinFixtureFiles(c);let lock,db,primary;
  try{
    const ownership=new Database(path.join(c.root,'ownership.sqlite'));let setupError;
    try{settings(ownership,true);ownership.exec(`PRAGMA application_id=${APP_ID}; PRAGMA user_version=1; CREATE TABLE fixture_identity(id INTEGER PRIMARY KEY CHECK(id=1),profile TEXT NOT NULL,run_id TEXT NOT NULL,nonce TEXT NOT NULL) STRICT;`);
      ownership.prepare('INSERT INTO fixture_identity VALUES(1,?,?,?)').run(QUALIFICATION_PROFILE,c.runId,c.nonce);
    }catch(e){setupError=e;throw e;}finally{try{ownership.close();}catch(e){throw setupError?new AggregateError([setupError,e],'Ownership initialization and close failed'):e;}}
    lock=owner(Database,c);db=new Database(path.join(c.root,'session.sqlite'));settings(db);
    db.exec(`PRAGMA application_id=${APP_ID};PRAGMA user_version=1;
      CREATE TABLE media(sha TEXT PRIMARY KEY,frames INTEGER NOT NULL CHECK(frames>0 AND frames<=1440000),bytes BLOB NOT NULL CHECK(length(bytes)=frames*8)) STRICT;
      CREATE TABLE versions(id TEXT PRIMARY KEY,media_sha TEXT NOT NULL REFERENCES media(sha),provenance TEXT NOT NULL) STRICT;
      CREATE TABLE history(position INTEGER PRIMARY KEY,version_id TEXT NOT NULL REFERENCES versions(id),UNIQUE(position,version_id)) STRICT;
      CREATE TABLE head(id INTEGER PRIMARY KEY CHECK(id=1),source_key TEXT NOT NULL,target_revision TEXT NOT NULL,version_id TEXT NOT NULL REFERENCES versions(id),history_position INTEGER NOT NULL,
        FOREIGN KEY(history_position,version_id) REFERENCES history(position,version_id) DEFERRABLE INITIALLY DEFERRED) STRICT;
      CREATE TABLE receipts(operation_id TEXT PRIMARY KEY,status TEXT NOT NULL CHECK(status='committed'),version_id TEXT NOT NULL REFERENCES versions(id),target_revision TEXT NOT NULL) STRICT;`);
    const m=media('old');db.exec('BEGIN IMMEDIATE');
    db.prepare('INSERT INTO media VALUES(?,?,?)').run(m.sha,m.frames,m.bytes);db.prepare('INSERT INTO versions VALUES(?,?,?)').run(OLD,m.sha,JSON.stringify({fixture:QUALIFICATION_PROFILE,frames:m.frames}));
    db.prepare('INSERT INTO history VALUES(1,?)').run(OLD);db.prepare("INSERT INTO head VALUES(1,'source-old','revision-old',?,1)").run(OLD);db.prepare("INSERT INTO receipts VALUES('operation-old','committed',?,'revision-old')").run(OLD);
    await pin.assertUnchanged();db.exec('COMMIT');await pin.assertUnchanged();
  }catch(e){primary=e;throw e;}
  finally{const errors=[];if(db)try{db.close();}catch(e){errors.push(e);}if(lock)try{releaseOwnership(lock);}catch(e){errors.push(e);}try{await pin.close();}catch(e){errors.push(e);}
    if(errors.length)throw new AggregateError([...(primary?[primary]:[]),...errors],'Initialize cleanup failed');}
}
function snapshot(db){
  assert.equal(scalar(db,'PRAGMA integrity_check'),'ok');assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  const head={...db.prepare('SELECT * FROM head WHERE id=1').get()},rows=db.prepare('SELECT v.id,m.sha,m.frames,m.bytes FROM versions v JOIN media m ON m.sha=v.media_sha ORDER BY v.id').all();
  for(const r of rows){decodePCM(r.bytes,r.frames,RANGE_PROFILE);assert.equal(digest(r.bytes),r.sha);const expected=media(r.id===OLD?'old':'new');assert.equal(r.frames,expected.frames);assert.ok(Buffer.from(r.bytes).equals(Buffer.from(expected.bytes)));}
  const history=db.prepare('SELECT * FROM history ORDER BY position').all().map(r=>({...r})),receipts=db.prepare('SELECT * FROM receipts ORDER BY operation_id').all().map(r=>({...r}));
  assert.equal(history.find(r=>r.position===head.history_position)?.version_id,head.version_id);
  return {head,versions:rows.map(({id,sha,frames})=>({id,sha,frames})),history,receipts,mediaCount:scalar(db,'SELECT count(*) FROM media'),integrity:'ok',foreignKeys:'ok',audioBytesVerified:true};
}
async function transaction(db,pin,at,{guardConflict=false,targetConflict=false,duplicate=false,failConstraint=false}={}){
  const m=media('new'),extending=duplicate||failConstraint,version=failConstraint?'version-constraint':duplicate?'version-replay':NEW;let began=false;
  try{
    await pin.assertUnchanged();db.exec('BEGIN IMMEDIATE');began=true;await at('before-media');
    db.prepare('INSERT INTO media VALUES(?,?,?) ON CONFLICT(sha) DO NOTHING').run(m.sha,m.frames,m.bytes);await at('after-media');
    db.prepare('INSERT INTO versions VALUES(?,?,?)').run(version,m.sha,JSON.stringify({fixture:QUALIFICATION_PROFILE,frames:m.frames}));await at('after-version');
    const r=db.prepare('UPDATE head SET version_id=?,target_revision=?,history_position=? WHERE id=1 AND source_key=? AND target_revision=? AND version_id=?').run(
      version,extending?'revision-replay':'revision-new',extending?3:2,guardConflict?'source-wrong':'source-old',targetConflict?'revision-wrong':extending?'revision-new':'revision-old',extending?NEW:OLD);
    requireQualification(r.changes===1,'SOURCE_TARGET_CONFLICT');await at('after-head');
    db.prepare('INSERT INTO history VALUES(?,?)').run(extending?3:2,version);await at('after-history');
    db.prepare("INSERT INTO receipts VALUES(?,'committed',?,?)").run(failConstraint?'operation-constraint':OP,version,extending?'revision-replay':'revision-new');await at('after-receipt');
    if(failConstraint)db.prepare('DELETE FROM history WHERE position=?').run(extending?3:2);
    await pin.assertUnchanged();await at('before-commit');db.exec('COMMIT');began=false;await at('after-commit');await pin.assertUnchanged();
  }catch(e){if(began)try{db.exec('ROLLBACK');}catch(rollback){throw new AggregateError([e,rollback],'Transaction and rollback failed');}throw e;}
}
async function runFixture(Database,c,action){
  if(action==='hold'){
    const pin=await pinFixtureFiles(c);let lock,primary;
    try{lock=owner(Database,c);await pin.assertUnchanged();writeSync(1,JSON.stringify({status:'acquired'})+'\n');process.stdin.resume();await new Promise(r=>process.stdin.once('end',r));await pin.assertUnchanged();}
    catch(e){primary=e;throw e;}finally{const errors=[];if(lock)try{releaseOwnership(lock);}catch(e){errors.push(e);}try{await pin.close();}catch(e){errors.push(e);}if(errors.length)throw new AggregateError([...(primary?[primary]:[]),...errors],'Hold cleanup failed');}return;
  }
  const result=await scoped(Database,c,async(db,pin)=>{
    if(action==='read')return {status:'read',snapshot:snapshot(db)};
    if(['guard-conflict','target-conflict','duplicate-receipt'].includes(action)){
      const before=snapshot(db);let caught;try{await transaction(db,pin,async()=>{},{guardConflict:action==='guard-conflict',targetConflict:action==='target-conflict',duplicate:action==='duplicate-receipt'});}catch(e){caught=e;}
      requireQualification(caught&&(action!=='duplicate-receipt'?caught.code==='SOURCE_TARGET_CONFLICT':caught.errcode===1555||caught.errcode===2067),'EXPECTED_CONFLICT_NOT_SEEN');assert.deepEqual(snapshot(db),before);return {status:'conflict-rejected',kind:action,rollbackExact:true};
    }
    await transaction(db,pin,async boundary=>{if(boundary===action){writeSync(1,JSON.stringify({status:'boundary',at:boundary})+'\n');process.kill(process.pid,'SIGKILL');await new Promise(()=>{});}});throw qualificationError('EXPECTED_CRASH_NOT_REACHED');
  });writeSync(1,JSON.stringify(result)+'\n');
}
function launch(c,action,children){
  // Fixed current Node executable + fixed local fixture file only. Never launch
  // a packaged app as though it accepted a dev-script path. No command adapter.
  requireQualification(!process.versions.electron,'REVIEWED_ELECTRON_ENTRY_REQUIRED');
  const child=spawn(process.execPath,[SCRIPT,'--fixture',c.root,c.runId,c.nonce,action],{stdio:['pipe','pipe','pipe'],env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',TZ:'UTC',HOME:c.root,TMPDIR:c.root}});
  let resolveReady,rejectReady,resolveExit,settled=false,stdout='',stderr='',protocolError=null;
  const ready=new Promise((r,j)=>{resolveReady=r;rejectReady=j;});ready.catch(()=>{});
  const exited=new Promise(r=>{resolveExit=r;});const ticket={child,ready,exited};children.add(ticket);
  const fail=code=>{protocolError=code;if(!settled){settled=true;rejectReady(qualificationError(code));}child.kill('SIGKILL');};
  const timer=setTimeout(()=>fail('FIXTURE_TIMEOUT'),20000);
  child.stdout.on('data',bytes=>{stdout+=bytes;if(stdout.length>16384)return fail('FIXTURE_OUTPUT_LIMIT');if(!settled&&stdout.includes('\n')){try{const value=JSON.parse(stdout.split('\n')[0]);settled=true;resolveReady(value);}catch{fail('FIXTURE_PROTOCOL');}}});
  child.stderr.on('data',bytes=>{stderr+=bytes;if(stderr.length>16384)fail('FIXTURE_OUTPUT_LIMIT');});
  child.once('error',()=>{clearTimeout(timer);if(!settled){settled=true;rejectReady(qualificationError('FIXTURE_SPAWN_FAILED'));}children.delete(ticket);resolveExit({code:null,signal:null,protocolError:'FIXTURE_SPAWN_FAILED'});});
  child.once('close',(code,signal)=>{clearTimeout(timer);if(!settled){settled=true;rejectReady(qualificationError('FIXTURE_EXITED_WITHOUT_RESULT'));}children.delete(ticket);resolveExit({code,signal,protocolError});});return ticket;
}
async function childResult(c,action,children){const p=launch(c,action,children),ready=await p.ready,exit=await p.exited;assert.equal(exit.protocolError,null);return {ready,exit};}
async function stopChildren(children){const errors=[];await Promise.all([...children].map(async c=>{try{c.child.kill('SIGKILL');await c.exited;}catch(e){errors.push(e);}}));if(errors.length)throw new AggregateError(errors,'Qualification children cleanup failed');}
export async function qualifySessionRuntime(){
  const facts=runtimeFacts(),base={profile:QUALIFICATION_PROFILE,runtime:facts,productionReady:false,productionAdapterImplemented:false,builtinSqliteAvailable:null,missingGates:missingProductionGates()};
  if(process.versions.electron)return {...base,status:'blocked',code:'REVIEWED_ELECTRON_ENTRY_REQUIRED',reason:'No reviewed packaged entry/child protocol is included; will not launch an application using a guessed development-script command.'};
  if(!['linux','darwin'].includes(process.platform))return {...base,status:'blocked',code:'UNSUPPORTED_FIXTURE_PLATFORM'};
  let Database;try{Database=await builtin();}catch{return {...base,status:'blocked',builtinSqliteAvailable:false,code:'BUILTIN_SQLITE_UNAVAILABLE'};}
  base.builtinSqliteAvailable=true;
  const run=await createQualificationRoot(),children=new Set(),fixtureCleanup={childrenClosed:false,rootRemoved:false};let primary;
  try{
    const evidence={ownership:{},boundaries:[],conflicts:[],history:null,corruption:null,configuration:null};
    const c=await createQualificationCase(run);await initialize(Database,c);
    const live=launch(c,'hold',children);assert.equal((await live.ready).status,'acquired');
    const peer=await childResult(c,'hold',children);assert.equal(peer.ready.status,'rejected');assert.equal(peer.ready.sqliteErrcode,5);assert.equal(peer.exit.code,2);
    live.child.kill('SIGKILL');assert.equal((await live.exited).signal,'SIGKILL');await scoped(Database,c,async()=>{});evidence.ownership={liveWriterExcluded:true,killedOwnerReleases:true};
    const racers=[launch(c,'hold',children),launch(c,'hold',children)],results=await Promise.all(racers.map(c=>c.ready));assert.equal(results.filter(r=>r.status==='acquired').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.sqliteErrcode===5).length,1);
    const winner=racers[results.findIndex(r=>r.status==='acquired')];winner.child.stdin.end();assert.equal((await winner.exited).code,0);await Promise.all(racers.map(c=>c.exited));evidence.ownership.oneCompetingWinner=true;
    for(const action of ['guard-conflict','target-conflict']){const conflict=await childResult(c,action,children);assert.equal(conflict.exit.code,0);assert.deepEqual(conflict.ready,{status:'conflict-rejected',kind:action,rollbackExact:true});evidence.conflicts.push(conflict.ready);}
    let committedCase;
    for(const boundary of CRASH_BOUNDARIES){const c=await createQualificationCase(run);await initialize(Database,c);const killed=await childResult(c,boundary,children);assert.deepEqual(killed.ready,{status:'boundary',at:boundary});assert.equal(killed.exit.signal,'SIGKILL');
      const read=await childResult(c,'read',children);assert.equal(read.exit.code,0);const s=read.ready.snapshot,committed=boundary==='after-commit';
      assert.deepEqual(s.head,{id:1,source_key:'source-old',target_revision:committed?'revision-new':'revision-old',version_id:committed?NEW:OLD,history_position:committed?2:1});
      assert.deepEqual(s.versions.map(r=>r.id),committed?[NEW,OLD]:[OLD]);assert.equal(s.mediaCount,committed?2:1);
      assert.deepEqual(s.history,[{position:1,version_id:OLD},...(committed?[{position:2,version_id:NEW}]:[])]);
      assert.deepEqual(s.receipts,[...(committed?[{operation_id:OP,status:'committed',version_id:NEW,target_revision:'revision-new'}]:[]),{operation_id:'operation-old',status:'committed',version_id:OLD,target_revision:'revision-old'}]);
      evidence.boundaries.push({at:boundary,signal:'SIGKILL',committed,mediaHeadHistoryReceiptAtomic:true,audioBytesVerified:true,integrity:s.integrity});if(committed)committedCase=c;
    }
    const duplicate=await childResult(committedCase,'duplicate-receipt',children);assert.equal(duplicate.exit.code,0);evidence.conflicts.push(duplicate.ready);
    await scoped(Database,committedCase,async(db,pin,configuration)=>{evidence.configuration=configuration;
      const before=snapshot(db);let caught;try{await transaction(db,pin,async()=>{},{duplicate:true,failConstraint:true});}catch(e){caught=e;}assert.equal(caught?.errcode,787);assert.deepEqual(snapshot(db),before);evidence.conflicts.push({kind:'deferred-history-foreign-key',rollbackExact:true});
      const missing=db.prepare('SELECT status,version_id FROM receipts WHERE operation_id=?').get('never-recorded');assert.equal(missing,undefined);
      db.exec('BEGIN IMMEDIATE');db.prepare("UPDATE head SET version_id=?,history_position=1,target_revision='revision-undo' WHERE id=1").run(OLD);await pin.assertUnchanged();db.exec('COMMIT');assert.equal(snapshot(db).head.version_id,OLD);
      db.exec('BEGIN IMMEDIATE');db.prepare("UPDATE head SET version_id=?,history_position=2,target_revision='revision-redo' WHERE id=1").run(NEW);await pin.assertUnchanged();db.exec('COMMIT');assert.equal(snapshot(db).head.version_id,NEW);
      evidence.history={undoRedoStoredExactBytes:true,frames:[8*48000,12*48000],absentReceipt:'unknown-not-failed'};
    });
    const bad=await createQualificationCase(run);await initialize(Database,bad);await scoped(Database,bad,async db=>{const row=db.prepare('SELECT sha,frames,bytes FROM media LIMIT 1').get(),bytes=Buffer.from(row.bytes);bytes[123]^=1;decodePCM(bytes,row.frames,RANGE_PROFILE);assert.notEqual(digest(bytes),row.sha);db.prepare('UPDATE media SET bytes=? WHERE sha=?').run(bytes,row.sha);assert.equal(scalar(db,'PRAGMA integrity_check'),'ok');assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);});
    const corrupt=await childResult(bad,'read',children);assert.equal(corrupt.ready.status,'rejected');assert.equal(corrupt.exit.code,2);evidence.corruption={structurallyValidBlobChecksumRejected:true};
    const info=await fs.statfs(run.root);const identity={};for(const file of ['scripts/validation/session-runtime-contract.mjs','scripts/validation/run-session-runtime-qualification.mjs','src/audio/linkedSessions/pcm.js','src/domain/linkedSessions/renderProfiles.js'])identity[file]=digest(await fs.readFile(new URL('../../'+file,import.meta.url)));
    const compileOptions=await scoped(Database,c,async db=>db.prepare('PRAGMA compile_options').all().map(r=>Object.values(r)[0]));requireQualification(compileOptions.length<=512,'SQLITE_COMPILE_OPTIONS_LIMIT');
    return {...base,status:'diagnostic-pass',evidence,fixtureCleanup,sqliteCompileOptions:compileOptions,filesystem:{type:'0x'+info.type.toString(16),blockSize:info.bsize,temporaryFixtureOnly:true},codeIdentity:identity,
      durability:{settingsReadBack:true,hardwareFlushProven:false,powerLossProven:false},limitations:['fixture SQL is not the application storage adapter or a second live store','generated PCM is a byte-integrity fixture, not native rendering or listening','no existing project or user-selected directory opened','Node-mode evidence never qualifies Electron main or packaged macOS','no migration/backup/space-failure/platform/security/release certification']};
  }catch(e){primary=e;throw e;}
  finally{const errors=[];try{await stopChildren(children);fixtureCleanup.childrenClosed=!children.size;}catch(e){errors.push(e);}if(!children.size)try{await removeQualificationRoot(run);fixtureCleanup.rootRemoved=true;}catch(e){errors.push(e);}else errors.push(qualificationError('CHILDREN_STILL_RUNNING'));
    if(errors.length)throw new AggregateError([...(primary?[primary]:[]),...errors],'Qualification and cleanup failed');}
}
async function main(){
  const parsed=parseQualificationArgs(process.argv.slice(2));
  if(parsed.mode==='fixture'){
    try{await runFixture(await builtin(),parsed,parsed.action);}catch(e){writeSync(1,JSON.stringify({status:'rejected',code:['SOURCE_TARGET_CONFLICT','UNKNOWN_OWNERSHIP_SCHEMA','UNKNOWN_OWNERSHIP_MODE','UNKNOWN_SESSION_SCHEMA','UNKNOWN_OWNERSHIP_IDENTITY','FIXTURE_FILE_REPLACED'].includes(e.code)?e.code:'FIXTURE_REJECTED',...(Number.isSafeInteger(e.errcode)?{sqliteErrcode:e.errcode}:{})})+'\n');process.exitCode=2;}return;
  }
  const result=await qualifySessionRuntime();console.log(JSON.stringify(result,null,2));if(result.status==='blocked')process.exitCode=2;
}
if(process.argv[1]&&path.resolve(process.argv[1])===SCRIPT)main().catch(e=>{console.error(e);process.exitCode=1;});
