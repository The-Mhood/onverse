// Fixed trusted subprocess fixture: no supplied script/module/command execution.
import { writeSync } from 'node:fs';
import { openGenerationStore } from '../../src/infrastructure/linkedSessions/generationStore.js';
const input=JSON.parse(Buffer.from(process.argv[2],'base64').toString());
let store;
try {
  store=await openGenerationStore(input.descriptor,{writable:true,onBoundary:async(at,op)=>{
    if(input.stop===at&&['recovery','quarantine'].includes(op)) {writeSync(1,JSON.stringify({status:'boundary',at})+'\n');process.kill(process.pid,'SIGKILL');await new Promise(()=>{});}
  }});
  if(input.quarantine)await store.quarantineOrphans(await store.inspectOrphans());
  writeSync(1,JSON.stringify({status:'acquired'})+'\n');
  process.stdin.resume();process.stdin.on('end',async()=>{try{await store.close();}catch(e){console.error(e.stack);process.exitCode=1;}});
} catch(e) {
  writeSync(1,JSON.stringify({status:'rejected',code:e.code||e.message})+'\n');process.exitCode=2;
  if(store)await store.close();
}
