import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderLinkedDestination,validateDestinationProcessing} from '../../src/audio/linkedSessions/renderLinkedDestination.js';
const params=()=>({startFrame:256,gain:.5,eq:{type:'peaking',frequency:1500,Q:1,gainDb:3}});
test('destination profile rejects unsupported imported processing before graph construction',async()=>{
  for(const change of [p=>{p.gain=Infinity;},p=>{p.eq.type='script';},p=>{p.eq.gainDb=20;},p=>{p.startFrame=.5;},p=>{p.extra='path';}]){
    const p=params();change(p);assert.throws(()=>validateDestinationProcessing(p));
    let made=false;await assert.rejects(renderLinkedDestination({linkedBytes:new Uint8Array(32768),unrelatedBytes:new Uint8Array(8),unrelatedFrames:1,processing:p,createOfflineContext:()=>{made=true;}}));assert.equal(made,false);
  }
});
test('destination profile is an immutable copy; invalid media fails before native context',async()=>{
  const p=params(),v=validateDestinationProcessing(p);p.eq.gainDb=1;assert.equal(v.eq.gainDb,3);assert.ok(Object.isFrozen(v.eq));
  let made=false;await assert.rejects(renderLinkedDestination({linkedBytes:new Uint8Array(3),unrelatedBytes:new Uint8Array(8),unrelatedFrames:1,processing:params(),createOfflineContext:()=>{made=true;}}));assert.equal(made,false);
});
