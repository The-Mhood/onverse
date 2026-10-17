// Validation-only contract. Never imported by application/storage/IPC code.
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import * as fs from 'node:fs/promises';
import {constants} from 'node:fs';
import {tmpdir} from 'node:os';
export const QUALIFICATION_PROFILE='session-sqlite-runtime-qualification-v1';
export const CRASH_BOUNDARIES=Object.freeze(['before-media','after-media','after-version','after-head','after-history','after-receipt','before-commit','after-commit']);
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
export const qualificationError=code=>Object.assign(Error(code),{code});
export const requireQualification=(x,code)=>{if(!x)throw qualificationError(code);};
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function runtimeFacts(){
  return Object.freeze({node:process.version,sqlite:process.versions.sqlite??null,electron:process.versions.electron??null,
    processType:process.type??'node',platform:process.platform,arch:process.arch,runAsNode:process.env.ELECTRON_RUN_AS_NODE==='1',
    packagedApplicationVerified:false,apfsVerified:false});
}
export function missingProductionGates(){return Object.freeze([
  'actual-packaged-Electron-main-runtime','macOS-arm64-and-x64-APFS','reviewed-package-and-entry-inclusion',
  'production-repository-and-full-operation-ledger','migration-backup-disk-full-and-I/O-fault-matrix',
  'hardware-flush-power-loss-and-app-quit-reopen','authenticated-IPC-and-real-UI-provider-workflow'
]);}
export function parseQualificationArgs(args){
  requireQualification(Array.isArray(args)&&args.every(a=>typeof a==='string'),'INVALID_ARGUMENTS');
  if(args.length===0)return Object.freeze({mode:'run'});
  requireQualification(args.length===5&&args[0]==='--fixture'&&path.isAbsolute(args[1])&&path.normalize(args[1])===args[1]&&uuid(args[2])&&uuid(args[3])&&
    ['hold','read','guard-conflict','target-conflict','duplicate-receipt',...CRASH_BOUNDARIES].includes(args[4]),'INVALID_ARGUMENTS');
  return Object.freeze({mode:'fixture',root:args[1],runId:args[2],nonce:args[3],action:args[4]});
}
function exact(x,keys){requireQualification(x&&Object.getPrototypeOf(x)===Object.prototype&&Reflect.ownKeys(x).length===keys.length&&keys.every(k=>{
  const d=Object.getOwnPropertyDescriptor(x,k);return d&&Object.hasOwn(d,'value');}),'INVALID_FIXTURE_IDENTITY');}
export async function createQualificationRoot(){
  requireQualification(['linux','darwin'].includes(process.platform)&&typeof process.getuid==='function','UNSUPPORTED_FIXTURE_PLATFORM');
  const parent=await fs.realpath(tmpdir()),root=await fs.mkdtemp(path.join(parent,'onverse-sqlite-qualification-'));await fs.chmod(root,0o700);
  const runId=randomUUID();await fs.writeFile(path.join(root,'.qualification-run.json'),JSON.stringify({profile:QUALIFICATION_PROFILE,runId}),{flag:'wx',mode:0o600});
  const stat=await fs.lstat(root,{bigint:true});return Object.freeze({root,runId,dev:stat.dev,ino:stat.ino});
}
async function safeDirectory(root){
  const s=await fs.lstat(root,{bigint:true});requireQualification(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===BigInt(process.getuid())&&!(s.mode&0o077n)&&await fs.realpath(root)===root,'UNSAFE_FIXTURE_DIRECTORY');return s;
}
export async function safeFixtureFile(file,max=1024){
  const h=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{const s=await h.stat({bigint:true});requireQualification(s.isFile()&&s.uid===BigInt(process.getuid())&&s.nlink===1n&&!(s.mode&0o077n)&&s.size<=BigInt(max),'UNSAFE_FIXTURE_FILE');
    const b=Buffer.alloc(max+1);let n=0;while(n<b.length){const r=await h.read(b,n,b.length-n,n);if(!r.bytesRead)break;n+=r.bytesRead;}
    requireQualification(BigInt(n)===s.size&&n<=max,'CHANGED_FIXTURE_FILE');return b.subarray(0,n);
  }finally{await h.close();}
}
export async function assertFixtureIdentity({root,runId,nonce}){
  requireQualification(['linux','darwin'].includes(process.platform)&&typeof process.getuid==='function','UNSUPPORTED_FIXTURE_PLATFORM');
  requireQualification(path.isAbsolute(root)&&path.normalize(root)===root&&/^case-[A-Za-z0-9]+$/.test(path.basename(root))&&
    /^onverse-sqlite-qualification-[A-Za-z0-9]+$/.test(path.basename(path.dirname(root)))&&uuid(runId)&&uuid(nonce),'INVALID_FIXTURE_ROOT');
  await safeDirectory(path.dirname(root));await safeDirectory(root);
  const parent=JSON.parse(await safeFixtureFile(path.join(path.dirname(root),'.qualification-run.json'))),child=JSON.parse(await safeFixtureFile(path.join(root,'.qualification-case.json')));
  exact(parent,['profile','runId']);exact(child,['profile','runId','nonce']);
  requireQualification(parent.profile===QUALIFICATION_PROFILE&&child.profile===QUALIFICATION_PROFILE&&parent.runId===runId&&child.runId===runId&&child.nonce===nonce,'INVALID_FIXTURE_IDENTITY');
}
export async function createQualificationCase(run){
  await assertQualificationRoot(run);
  const root=await fs.mkdtemp(path.join(run.root,'case-'));await fs.chmod(root,0o700);const c=Object.freeze({root,runId:run.runId,nonce:randomUUID()});
  await fs.writeFile(path.join(root,'.qualification-case.json'),JSON.stringify({profile:QUALIFICATION_PROFILE,runId:c.runId,nonce:c.nonce}),{flag:'wx',mode:0o600});
  for(const name of ['ownership.sqlite','session.sqlite']){const h=await fs.open(path.join(root,name),'wx',0o600);await h.close();}
  return c;
}
async function assertQualificationRoot(run){
  const s=await safeDirectory(run.root);requireQualification(/^onverse-sqlite-qualification-[A-Za-z0-9]+$/.test(path.basename(run.root))&&s.dev===run.dev&&s.ino===run.ino,'FIXTURE_ROOT_CHANGED');
  const marker=JSON.parse(await safeFixtureFile(path.join(run.root,'.qualification-run.json')));exact(marker,['profile','runId']);requireQualification(marker.profile===QUALIFICATION_PROFILE&&marker.runId===run.runId,'INVALID_FIXTURE_IDENTITY');
}
export async function removeQualificationRoot(run){
  await assertQualificationRoot(run);await fs.rm(run.root,{recursive:true});
}
export async function pinFixtureFiles(c){
  await assertFixtureIdentity(c);const handles=[];
  try{
    for(const name of ['ownership.sqlite','session.sqlite']){
      const file=path.join(c.root,name),h=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);handles.push({h,file});
      const s=await h.stat({bigint:true});requireQualification(s.isFile()&&s.uid===BigInt(process.getuid())&&s.nlink===1n&&!(s.mode&0o077n),'UNSAFE_FIXTURE_FILE');handles.at(-1).stat=s;
    }
    async function assertUnchanged(){await assertFixtureIdentity(c);for(const {h,file,stat}of handles){const held=await h.stat({bigint:true}),named=await fs.lstat(file,{bigint:true});
      requireQualification(!named.isSymbolicLink()&&held.isFile()&&named.isFile()&&held.nlink===1n&&named.nlink===1n&&held.uid===BigInt(process.getuid())&&named.uid===BigInt(process.getuid())&&!(named.mode&0o077n)&&held.dev===stat.dev&&held.ino===stat.ino&&named.dev===stat.dev&&named.ino===stat.ino,'FIXTURE_FILE_REPLACED');}}
    await assertUnchanged();return Object.freeze({assertUnchanged,async close(){const errors=[];for(const {h}of handles)try{await h.close();}catch(e){errors.push(e);}if(errors.length)throw new AggregateError(errors,'Fixture descriptor close failed');}});
  }catch(error){const errors=[error];for(const {h}of handles)try{await h.close();}catch(e){errors.push(e);}throw errors.length===1?error:new AggregateError(errors,'Fixture pin and cleanup failed');}
}
