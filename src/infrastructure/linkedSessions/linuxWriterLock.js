// Linux-only kernel lock adapter. No shell/PID liveness guesses/native npm addon.
// flock(2) belongs to the inherited OPEN FILE DESCRIPTION, not the short-lived
// helper PID: this Node process retains the lock until its FD closes or it dies.
import * as fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
export const LOCK_PROFILE='linux-flock-fd-v1';
export const lockMarker=owner=>Buffer.from(`${LOCK_PROFILE}:${owner}\n`);
const fail=code=>Object.assign(Error(code),{code});
export async function acquireLinuxWriterLock({root,owner}) {
  if(process.platform!=='linux')throw fail('LINUX_PROFILE_ONLY');
  const helper='/usr/bin/flock',real=await fs.realpath(helper),hs=await fs.lstat(real);
  if(real!==helper||!hs.isFile()||hs.uid!==0||(hs.mode&0o022))throw fail('UNSAFE_LOCK_HELPER');
  const name=path.join(root,'.writer-lock');let h;
  try {
    h=await fs.open(name,constants.O_RDWR|constants.O_NOFOLLOW|constants.O_NONBLOCK);
    const expected=lockMarker(owner),original=await h.stat();
    const validate=async()=>{
      const s=await h.stat(),named=await fs.lstat(name);
      if(!s.isFile()||s.uid!==process.getuid()||s.nlink!==1||(s.mode&0o077)||s.size!==expected.length||named.isSymbolicLink()||
        s.dev!==original.dev||s.ino!==original.ino||named.dev!==s.dev||named.ino!==s.ino)throw fail('LOCK_IDENTITY_CHANGED');
      const b=Buffer.alloc(expected.length+1),r=await h.read(b,0,b.length,0);
      if(r.bytesRead!==expected.length||!b.subarray(0,r.bytesRead).equals(expected))throw fail('UNKNOWN_LOCK_PROFILE');
    };
    await validate();
    const out=spawnSync(helper,['--exclusive','--nonblock','--conflict-exit-code','73','3'],{
      stdio:['ignore','pipe','pipe',h.fd],timeout:3000,maxBuffer:4096,env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'}});
    if(out.error)throw out.error;
    if(out.status===73)throw fail('WRITER_BUSY');
    if(out.status!==0||out.signal||out.stdout.length||out.stderr.length)throw fail('LOCK_HELPER_FAILED');
    await validate();let closing;
    return Object.freeze({assertHeld:validate,close(){if(!closing)closing=h.close();return closing;}});
  } catch(error) {
    try{if(h)await h.close();}catch(cleanup){throw new AggregateError([error,cleanup],'Lock acquisition and cleanup failed');}
    throw error;
  }
}
