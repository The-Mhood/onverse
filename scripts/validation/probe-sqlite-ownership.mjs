// Trusted synthetic feasibility check, NOT a project repository or Electron adapter.
// Uses only node:sqlite. Never executes SQL/code/paths from imported user content.
import {DatabaseSync} from 'node:sqlite';
import * as fs from 'node:fs/promises';
import {writeSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const SCRIPT=fileURLToPath(import.meta.url);
function owner(root) {
  const db=new DatabaseSync(path.join(root,'ownership.sqlite'));
  try {db.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE');return db;}
  catch(e){db.close();throw e;}
}
function data(root) {
  const db=new DatabaseSync(path.join(root,'session.sqlite'));
  try {db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=0');return db;}
  catch(e){db.close();throw e;}
}
function launch(root,mode,children) {
  const c=spawn(process.execPath,[SCRIPT,'--fixture',root,mode],{stdio:['pipe','pipe','pipe'],env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'}});children.add(c);
  const exited=new Promise((resolve,reject)=>{c.once('exit',(code,signal)=>{children.delete(c);resolve({code,signal});});c.once('error',reject);});
  const ready=new Promise((resolve,reject)=>{
    let text='',errors='';const timer=setTimeout(()=>reject(Error('SQLite fixture timed out: '+errors)),5000);
    c.stderr.on('data',b=>{errors+=b;});c.stdout.on('data',b=>{text+=b;if(text.includes('\n')){clearTimeout(timer);try{resolve(JSON.parse(text.split('\n')[0]));}catch(e){reject(e);}}});
    c.once('error',e=>{clearTimeout(timer);reject(e);});c.once('exit',()=>{clearTimeout(timer);if(!text.includes('\n'))reject(Error('SQLite fixture exited early: '+errors));});
  });
  return {c,ready,exited};
}
async function fixture(root,mode) {
  assert.equal(process.platform,'linux');assert.ok(['hold','before-commit','after-commit'].includes(mode));
  assert.equal(await fs.realpath(root),root);assert.match(root,/^\/tmp\/onverse-sqlite-candidate-[A-Za-z0-9]+$/);
  const st=await fs.lstat(root);assert.ok(st.isDirectory()&&st.uid===process.getuid()&&!(st.mode&0o077));
  for(const name of ['ownership.sqlite','session.sqlite']){const s=await fs.lstat(path.join(root,name));assert.ok(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.uid===process.getuid()&&!(s.mode&0o077));}
  let ownership,db;
  try {
    ownership=owner(root);
    if(mode==='hold') {
      writeSync(1,JSON.stringify({status:'acquired'})+'\n');process.stdin.resume();
      await new Promise(resolve=>process.stdin.once('end',resolve));
    }else {
      db=data(root);db.exec("BEGIN IMMEDIATE; INSERT INTO media VALUES ('new',X'01020304'); UPDATE head SET media_id='new' WHERE id=1;");
      if(mode==='after-commit')db.exec('COMMIT');
      writeSync(1,JSON.stringify({status:'boundary',at:mode})+'\n');process.kill(process.pid,'SIGKILL');await new Promise(()=>{});
    }
  }catch(e){writeSync(1,JSON.stringify({status:'rejected',code:e.code,errcode:e.errcode})+'\n');process.exitCode=2;}
  finally {if(db)db.close();if(ownership){ownership.exec('ROLLBACK');ownership.close();}}
}
export async function probe() {
  assert.equal(process.platform,'linux','Only observed Linux feasibility profile');
  const root=await fs.mkdtemp('/tmp/onverse-sqlite-candidate-');await fs.chmod(root,0o700);const children=new Set();
  for(const name of ['ownership.sqlite','session.sqlite']){const h=await fs.open(path.join(root,name),'wx',0o600);await h.close();}
  const init=new DatabaseSync(path.join(root,'ownership.sqlite'));init.exec('CREATE TABLE identity(profile TEXT NOT NULL); INSERT INTO identity VALUES (\'candidate-only\')');init.close();
  let db=data(root);db.exec("CREATE TABLE media(id TEXT PRIMARY KEY,bytes BLOB NOT NULL); CREATE TABLE head(id INTEGER PRIMARY KEY CHECK(id=1),media_id TEXT NOT NULL REFERENCES media(id)); INSERT INTO media VALUES ('old',X'05060708'); INSERT INTO head VALUES (1,'old');");db.close();
  try {
    const live=launch(root,'hold',children);assert.equal((await live.ready).status,'acquired');
    assert.throws(()=>owner(root),e=>e.errcode===5);live.c.kill('SIGKILL');assert.equal((await live.exited).signal,'SIGKILL');
    const next=owner(root);next.exec('ROLLBACK');next.close();
    const racers=[launch(root,'hold',children),launch(root,'hold',children)],results=await Promise.all(racers.map(c=>c.ready));
    assert.equal(results.filter(r=>r.status==='acquired').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.errcode===5).length,1);
    const winner=racers[results.findIndex(r=>r.status==='acquired')];winner.c.stdin.end();assert.equal((await winner.exited).code,0);
    await Promise.all(racers.map(r=>r.exited));
    const boundaries=[];
    for(const stop of ['before-commit','after-commit']) {
      const c=launch(root,stop,children);assert.deepEqual(await c.ready,{status:'boundary',at:stop});assert.equal((await c.exited).signal,'SIGKILL');
      const lock=owner(root);db=data(root);
      try {
        assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
        const expected=stop==='before-commit'?'old':'new',row=db.prepare('SELECT media_id,hex(bytes) bytes FROM head JOIN media ON head.media_id=media.id').get();
        assert.equal(row.media_id,expected);assert.equal(row.bytes,expected==='old'?'05060708':'01020304');
        assert.equal(db.prepare("SELECT COUNT(*) count FROM media WHERE id='new'").get().count,stop==='before-commit'?0:1);
        boundaries.push({at:stop,head:expected,integrity:'ok',blobAndPointerAtomic:true});
      }finally{db.close();lock.exec('ROLLBACK');lock.close();}
    }
    return {kind:'SQLite candidate feasibility ONLY',node:process.version,sqlite:process.versions.sqlite,platform:process.platform,liveWriterExcluded:true,deathReleasesOwnership:true,competingOwners:1,boundaries,root,limitations:['not Electron runtime','not macOS/APFS','not power-loss proof','not production storage adapter','synthetic four-byte BLOBs, not audio workflow']};
  }finally{
    await Promise.all([...children].map(c=>new Promise(resolve=>{c.once('exit',resolve);c.kill('SIGKILL');})));
    // Fixture-only ephemeral files, never an existing project or user-selected path.
    await fs.rm(root,{recursive:true,force:true});
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===SCRIPT) {
  const args=process.argv.slice(2);
  (args[0]==='--fixture'&&args.length===3?fixture(args[1],args[2]):args.length===0?probe().then(r=>console.log(JSON.stringify(r,null,2))):Promise.reject(Error('No untrusted arguments accepted'))).catch(e=>{console.error(e);process.exitCode=1;});
}
