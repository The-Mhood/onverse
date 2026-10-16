// Runs in the existing trusted/synthetic production-browser proof. Tests actual
// modules with native OfflineAudioContext; this is not listening or meter accuracy.
import { build } from 'vite';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
export async function probeAudioStabilization(page) {
  const result = await build({configFile:false,logLevel:'silent',build:{write:false,minify:true,
    lib:{entry:fileURLToPath(new URL('../../tests/fixtures/audioStabilizationBridge.js',import.meta.url)),name:'OnverseAudioProbe',formats:['iife']}}});
  const outputs=Array.isArray(result)?result:[result];
  const code=outputs.flatMap(output=>output.output).find(output=>output.type==='chunk').code;
  await page.addScriptTag({content:code});
  const evidence=await page.evaluate(async()=>{
    const api=globalThis.OnverseAudioProbe, cases=[];
    for(const sampleRate of [44100,48000])for(const channels of [1,2])for(const polarity of (channels===1?[1]:[1,-1]))for(const target of [-18,-24]) {
      const source=new AudioBuffer({numberOfChannels:channels,sampleRate,length:sampleRate/2});
      for(let c=0;c<channels;c++)for(let i=0;i<source.length;i++)source.getChannelData(c)[i]=.1*Math.sin(2*Math.PI*1000*i/sampleRate)*(c===1?polarity:1);
      const before=Array.from({length:channels},(_,c)=>source.getChannelData(c).slice());
      const initial=api.quickLufs(source), gain=10**((target-initial)/20), stages=[];
      const rendered=await api.masterFix(source,{gain:1,targetLufs:target,ceiling:-1.5},s=>stages.push(s));
      const quick=api.quickLufs(rendered), full=await api.analyze(rendered), fast=await api.analyzeFast(rendered);
      let maxGainError=0,maxInputChange=0,maxPolarityError=0,peak=0,finite=true;
      for(let c=0;c<channels;c++)for(let i=0;i<source.length;i++) {
        const x=rendered.getChannelData(c)[i];finite&&=Number.isFinite(x);peak=Math.max(peak,Math.abs(x));
        maxGainError=Math.max(maxGainError,Math.abs(x-before[c][i]*gain));
        maxInputChange=Math.max(maxInputChange,Math.abs(source.getChannelData(c)[i]-before[c][i]));
        if(channels===2)maxPolarityError=Math.max(maxPolarityError,Math.abs(rendered.getChannelData(1)[i]-rendered.getChannelData(0)[i]*polarity));
      }
      cases.push({sampleRate,channels,polarity,target,initial,gain,quick,full:full.lufs,fast:fast.lufs,
        maxGainError,maxInputChange,maxPolarityError,peak,finite,distinct:source!==rendered,
        geometry:{length:rendered.length,channels:rendered.numberOfChannels,sampleRate:rendered.sampleRate},stages});
    }
    // Invalid measurement in actual native buffer must reject, never mutate PCM
    // or return a fabricated finite target to the trim consumer.
    const invalid=new AudioBuffer({numberOfChannels:2,sampleRate:48000,length:24001});invalid.getChannelData(1)[24000]=NaN;
    let invalidError;try{api.quickLufs(invalid)}catch(e){invalidError=e.message}
    const rejected=[], offlineBefore=globalThis.__audioAudit.offline;
    for(const kind of ['short','silent','below-floor','invalid-target']) {
      const b=new AudioBuffer({numberOfChannels:2,sampleRate:48000,length:kind==='short'?4799:24000});
      if(kind==='below-floor'||kind==='invalid-target')for(let c=0;c<2;c++)for(let i=0;i<b.length;i++)b.getChannelData(c)[i]=(kind==='below-floor'?1e-9:.1)*Math.sin(2*Math.PI*1000*i/48000);
      const before=Array.from({length:2},(_,c)=>b.getChannelData(c).slice());let error;
      try{await api.masterFix(b,{gain:200000,targetLufs:kind==='invalid-target'?NaN:-14})}catch(e){error=e.message}
      const immutable=before.every((d,c)=>d.every((x,i)=>x===b.getChannelData(c)[i]));
      rejected.push({kind,error,immutable});
    }
    const rejectedBeforeRender=globalThis.__audioAudit.offline===offlineBefore;
    // Real unsupported-codec constructor failure, injected at the API boundary;
    // native context/source/stream/cleanup remain real, never fake success.
    const Recorder=globalThis.MediaRecorder, before={...globalThis.__audioAudit};let stream,recorderError;
    try {
      globalThis.MediaRecorder=class extends Recorder {
        constructor(s,options){stream=s;super(s,{...options,mimeType:'audio/x-onverse-unsupported-codec'})}
      };
      await api.encodeViaRecorder(new AudioBuffer({numberOfChannels:2,length:48000,sampleRate:48000}),'m4a');
    } catch(e) { recorderError={name:e.name,message:e.message} }
    finally { globalThis.MediaRecorder=Recorder }
    const after={...globalThis.__audioAudit};
    return {cases,rejected,rejectedBeforeRender,invalidError,invalidPreserved:Number.isNaN(invalid.getChannelData(1)[24000]),
      recorderFailure:{error:recorderError,contextsCreated:after.contexts-before.contexts,contextsClosed:after.closes-before.closes,
        tracksEnded:stream?.getTracks().every(track=>track.readyState==='ended')}};
  });
  assert.equal(evidence.cases.length,12);
  for(const c of evidence.cases) {
    assert.ok(c.finite&&c.distinct);assert.equal(c.maxInputChange,0);assert.equal(c.maxPolarityError,0);
    assert.ok(c.maxGainError<=1e-6,JSON.stringify(c));
    for(const l of [c.quick,c.full,c.fast])assert.ok(Math.abs(l-c.target)<=1e-6,JSON.stringify(c));
    assert.deepEqual(c.geometry,{length:c.sampleRate/2,channels:c.channels,sampleRate:c.sampleRate});
    assert.ok(c.peak<10**(-1.5/20));assert.ok(c.gain<3); // Achievable targets, limiter intentionally inactive.
    assert.ok(c.stages.includes('Trimming to reference loudness'));
  }
  for(const c of evidence.cases.filter(c=>c.channels===2&&c.polarity===1)) {
    const opposite=evidence.cases.find(o=>o.sampleRate===c.sampleRate&&o.target===c.target&&o.channels===2&&o.polarity===-1);
    assert.ok(Math.abs(opposite.initial-c.initial)<=1e-6);assert.ok(Math.abs(opposite.peak-c.peak)<=1e-6);
  }
  assert.equal(evidence.rejectedBeforeRender,true);
  for(const r of evidence.rejected){assert.ok(r.immutable);assert.match(r.error,/Cannot normalize|finite loudness target/)}
  assert.match(evidence.invalidError,/Non-finite PCM/);assert.equal(evidence.invalidPreserved,true);
  assert.equal(evidence.recorderFailure.error?.name,'NotSupportedError');
  assert.equal(evidence.recorderFailure.contextsCreated,1);assert.equal(evidence.recorderFailure.contextsClosed,1);assert.equal(evidence.recorderFailure.tracksEnded,true);
  return {kind:'actual-module/native-OfflineAudioContext',tolerance:1e-6,bridgeSha256:createHash('sha256').update(code).digest('hex'),...evidence};
}
