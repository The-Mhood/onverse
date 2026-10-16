// Controlled Web Audio/MediaRecorder collaborators for error/ownership paths;
// successful browser encoding/decode is verified separately on real constructors.
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { loadAudioProcessor } from '../fixtures/loadAudioProcessor.js';
import { createToneBuffer } from '../fixtures/audioBuffers.js';
const {encodeViaRecorder} = await loadAudioProcessor();
function setup(t,fault) {
  const calls=[], failure=new Error(`synthetic ${fault}`), timers=[]; let recorder;
  const record=name=>()=>{calls.push(name)};
  const src={connect:record('connect'),disconnect:record('disconnect'),stop:record('stop-source'),start(){calls.push('start-source');if(fault==='source-start')throw failure}};
  class Context {
    createBufferSource(){return src}
    createMediaStreamDestination(){return {stream:{getTracks:()=>[{stop:record('stop-track')}]}}}
    async close(){calls.push('close');if(fault==='close'||fault==='runtime-and-close')throw Error('synthetic close failure')}
  }
  class Recorder {
    state='inactive'; mimeType='audio/mp4;codecs=opus';
    constructor(){if(fault==='constructor')throw failure;recorder=this}
    start(){if(fault==='start')throw failure;this.state='recording'}
    stop(){calls.push('stop-recorder');this.state='inactive';if(fault==='stop')throw failure;if(fault!=='empty')this.ondataavailable?.({data:new Blob(['synthetic recorded bytes'])});this.onstop?.()}
  }
  for(const [key,value]of Object.entries({AudioContext:Context,MediaRecorder:Recorder})){
    const previous=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
    t.after(()=>previous?Object.defineProperty(globalThis,key,previous):delete globalThis[key]);
  }
  t.mock.method(globalThis,'setTimeout',(fn,delay)=>{const timer={fn,delay};timers.push(timer);return timer});
  t.mock.method(globalThis,'clearTimeout',timer=>{if(timer)timer.cleared=true});
  return {calls,failure,timers,get recorder(){return recorder}};
}
for(const fault of ['constructor','start','source-start']) {
  it(`recorder ${fault} failure closes its context/tracks and preserves the real error`,async t=>{
    const f=setup(t,fault);
    await assert.rejects(()=>encodeViaRecorder(createToneBuffer(),'m4a'),e=>e===f.failure);
    assert.equal(f.calls.filter(c=>c==='close').length,1);
    assert.equal(f.calls.filter(c=>c==='stop-track').length,1);
    assert.ok(f.calls.includes('disconnect'));
  });
}
it('runtime recorder error rejects promptly, cancels timer and releases ownership',async t=>{
  const f=setup(t,'runtime'); const job=encodeViaRecorder(createToneBuffer(),'m4a');
  const rejected=assert.rejects(job,e=>e===f.failure);
  f.recorder.onerror({error:f.failure}); await rejected;
  assert.ok(f.timers.every(timer=>timer.cleared));assert.ok(f.calls.includes('stop-track'));assert.ok(f.calls.includes('close'));
  assert.equal(f.recorder.onerror,null);assert.equal(f.recorder.onstop,null);
});
it('timer stop failure rejects instead of hanging and still closes context',async t=>{
  const f=setup(t,'stop');const job=encodeViaRecorder(createToneBuffer(),'m4a');const rejected=assert.rejects(job,e=>e===f.failure);
  f.timers[0].fn();await rejected;assert.ok(f.calls.includes('close'));assert.ok(f.calls.includes('stop-track'));
});
it('successful recorder owns its timer, source, tracks and context through onstop',async t=>{
  const f=setup(t);const job=encodeViaRecorder(createToneBuffer(),'m4a');
  assert.equal(f.timers[0].delay,1000);f.timers[0].fn();const blob=await job;
  assert.equal(blob.type,'audio/mp4;codecs=opus');assert.ok(blob.size>0);
  for(const name of ['close','stop-source','stop-track','disconnect'])assert.equal(f.calls.filter(c=>c===name).length,1);
  assert.equal(f.recorder.ondataavailable,null);assert.ok(f.timers[0].cleared);
});

it('empty recording rejects rather than fabricating successful output',async t=>{
  const f=setup(t,'empty');const job=encodeViaRecorder(createToneBuffer(),'m4a');const rejected=assert.rejects(job,/no audio data/);
  f.timers[0].fn();await rejected;assert.ok(f.calls.includes('close'));assert.ok(f.calls.includes('stop-track'));
});
it('primary recorder error remains the cause when close also fails; every release is attempted',async t=>{
  const f=setup(t,'runtime-and-close');const job=encodeViaRecorder(createToneBuffer(),'m4a');
  const rejected=assert.rejects(job,e=>e instanceof AggregateError&&e.cause===f.failure&&e.errors[0]===f.failure&&e.message.includes(f.failure.message));
  f.recorder.onerror({error:f.failure});await rejected;
  for(const name of ['stop-source','disconnect','stop-track','close'])assert.ok(f.calls.includes(name));
});
