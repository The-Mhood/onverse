import assert from 'node:assert/strict';
import { it } from 'node:test';
import { loadAudioProcessor } from '../fixtures/loadAudioProcessor.js';
import { createToneBuffer } from '../fixtures/audioBuffers.js';
const {masterFix} = await loadAudioProcessor();
for (const [name,options] of [['one frame',{length:1}],['incomplete window',{length:4799}],['silence',{amplitude:0}],['below meter floor',{amplitude:1e-9}]]) {
  it(`automatic normalization rejects ${name} before rendering, preserving PCM`,async()=>{
    const source=createToneBuffer(options),before=[source.getChannelData(0).slice(),source.getChannelData(1).slice()];
    // No OfflineAudioContext exists in Node: a late check would fail this assertion.
    await assert.rejects(()=>masterFix(source,{gain:200000,targetLufs:-14}),/Cannot normalize/);
    for(let c=0;c<2;c++) assert.deepEqual(source.getChannelData(c),before[c]);
  });
}
for(const targetLufs of [NaN,Infinity,-Infinity]) it(`normalization rejects non-finite target ${targetLufs} before rendering`,async()=>{
  await assert.rejects(()=>masterFix(createToneBuffer(),{targetLufs}),/finite loudness target/);
});
it('a rendered-silent result rejects before post-render multiplication and preserves A',async t=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'OfflineAudioContext');
  const silent=createToneBuffer({amplitude:0});
  class Offline { destination={};createBufferSource(){return{connect(){},start(){}}}async startRendering(){return silent} }
  Object.defineProperty(globalThis,'OfflineAudioContext',{configurable:true,value:Offline});
  t.after(()=>previous?Object.defineProperty(globalThis,'OfflineAudioContext',previous):delete globalThis.OfflineAudioContext);
  const source=createToneBuffer(),before=source.getChannelData(0).slice();
  await assert.rejects(()=>masterFix(source,{gain:1,targetLufs:-14}),/Cannot normalize/);
  assert.deepEqual(source.getChannelData(0),before);assert.ok(silent.getChannelData(0).every(x=>x===0));
});
