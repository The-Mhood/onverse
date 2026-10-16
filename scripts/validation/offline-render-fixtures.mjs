// Synthetic research only. No application imports or production media API.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createRoot, checkRoot, readOwned, exclusiveWrite, sha256 } from './linked-media-recovery-probe.mjs';
export const RATE = 48000, GROUP_FRAMES = 4096, DEST_FRAMES = 8192, MAX_ERROR = 2e-6;
export const CASES = Object.freeze(['original','updated','unrelated-edit','silence','channels']);
const SCRIPT = fileURLToPath(import.meta.url);
export function recipe(id = 'original') {
  if (!CASES.includes(id)) throw Error('Unknown source case');
  return { id, sampleRate: RATE, frames: GROUP_FRAMES, layout: ['L','R'], selected: id === 'channels' ? ['impulses'] : ['conga','other'],
    sources: id === 'channels' ? [{ id: 'impulses', frames: 256, start: 0, gain: 1, impulses: [[64,1.75],[128,-2]] }] : [
      { id:'conga', frames:2048, start:0, gain: id === 'silence' ? 0 : id === 'updated' ? 1 : .5, frequency:375, amplitudes:[1.25,-1.25] },
      { id:'other', frames:3072, start:128, gain: id === 'silence' ? 0 : 1, frequency:375, amplitudes:[.75,.25] },
      { id:'vocal', frames:2048, start:64, gain: id === 'unrelated-edit' ? 5 : 1, frequency:1500, amplitudes:[.9,.9] },
    ] };
}
export function sourceChannels(source) {
  return [0,1].map(c => Float32Array.from({ length: source.frames }, (_, n) => source.impulses
    ? n === source.impulses[c][0] ? source.impulses[c][1] : 0
    : source.amplitudes[c] * Math.sin(2 * Math.PI * source.frequency * n / RATE)));
}
export function expectedGroup(r) {
  const out = [new Float32Array(r.frames),new Float32Array(r.frames)];
  for (const s of r.sources.filter(s => r.selected.includes(s.id))) {
    const channels = sourceChannels(s);
    for(let c=0;c<2;c++) for(let n=0;n<s.frames;n++) out[c][n+s.start] = Math.fround(out[c][n+s.start] + Math.fround(channels[c][n] * s.gain));
  }
  return out;
}
export function encode(channels) {
  if (!Array.isArray(channels) || channels.length !== 2 || !channels.every(c => ArrayBuffer.isView(c) && !(c instanceof DataView) && c.length === channels[0].length) || channels[0].length < 1 || channels[0].length > DEST_FRAMES) throw Error('Invalid channel dimensions');
  const bytes = Buffer.alloc(channels[0].length * 8);
  for(let n=0;n<channels[0].length;n++) for(let c=0;c<2;c++) {
    const x = channels[c][n];
    if(!Number.isFinite(x) || !Number.isFinite(Math.fround(x))) throw Error('Nonfinite/overflow Float32');
    bytes.writeFloatLE(x,(n*2+c)*4);
  }
  return bytes;
}
export function decode(bytes, frames) {
  if(!Buffer.isBuffer(bytes) || !Number.isSafeInteger(frames) || frames < 1 || frames > DEST_FRAMES || bytes.length !== frames*8) throw Error('Invalid PCM byte dimensions');
  const out=[new Float32Array(frames),new Float32Array(frames)];
  for(let n=0;n<frames;n++) for(let c=0;c<2;c++) {
    const x=bytes.readFloatLE((n*2+c)*4); if(!Number.isFinite(x)) throw Error('Nonfinite PCM'); out[c][n]=x;
  }
  return out;
}
export function fromTransport(text, expectedBytes) {
  if(typeof text !== 'string' || text.length !== 4*Math.ceil(expectedBytes/3) || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) throw Error('Noncanonical/incomplete transport');
  const b=Buffer.from(text,'base64'); if(b.length!==expectedBytes || b.toString('base64')!==text) throw Error('Noncanonical transport'); return b;
}
export function peaking(frequency = 1500, q = 1, gainDb = 3) {
  const A=10**(gainDb/40), w=2*Math.PI*frequency/RATE, alpha=Math.sin(w)/(2*q), a0=1+alpha/A;
  return { b0:(1+alpha*A)/a0, b1:-2*Math.cos(w)/a0, b2:(1-alpha*A)/a0, a1:-2*Math.cos(w)/a0, a2:(1-alpha/A)/a0 };
}
export function response(coeff, frequency) {
  const w=2*Math.PI*frequency/RATE;
  const mag=(a,b,c)=>Math.hypot(a+b*Math.cos(w)+c*Math.cos(2*w), -b*Math.sin(w)-c*Math.sin(2*w));
  return mag(coeff.b0,coeff.b1,coeff.b2)/mag(1,coeff.a1,coeff.a2);
}
export function expectedDestination(bytes) {
  const input=decode(bytes,GROUP_FRAMES), k=peaking();
  return [0,1].map(c=>{
    let x1=0,x2=0,y1=0,y2=0;
    return Float32Array.from({length:DEST_FRAMES},(_,n)=>{
      const x=n>=256 && n<256+GROUP_FRAMES ? Math.fround(input[c][n-256]*.5) : 0;
      const y=k.b0*x+k.b1*x1+k.b2*x2-k.a1*y1-k.a2*y2;
      x2=x1; x1=x; y2=y1; y1=y;
      const unrelated=n<4096 ? Math.fround((c===0?.125:.0625)*Math.sin(2*Math.PI*(c===0?1500:750)*n/RATE)) : 0;
      return Math.fround(Math.fround(y)+unrelated);
    });
  });
}
export function compare(actual,expected) {
  if(actual.length!==2 || expected.length!==2 || !actual.every((c,i)=>c.length===expected[i].length)) throw Error('Comparison dimensions');
  let maxError=0,peak=0;
  for(let c=0;c<2;c++) for(let n=0;n<actual[c].length;n++) {
    if(!Number.isFinite(actual[c][n]) || !Number.isFinite(expected[c][n])) throw Error('Nonfinite comparison');
    maxError=Math.max(maxError,Math.abs(actual[c][n]-expected[c][n])); peak=Math.max(peak,Math.abs(actual[c][n]));
  }
  return {maxError,peak,passed:maxError<=MAX_ERROR};
}
export function requireNative(scope=globalThis) {
  if(typeof scope.OfflineAudioContext!=='function') throw Error('Native OfflineAudioContext unavailable; no mock/polyfill fallback');
}
function meta(id,bytes) {
  if(!CASES.includes(id)) throw Error('Invalid media ID');
  decode(bytes,GROUP_FRAMES);
  return {profile:'offline-render-v1-reconstruction',id,format:'f32le-interleaved',sampleRate:RATE,layout:['L','R'],frames:GROUP_FRAMES,bytes:bytes.length,sha256:sha256(bytes)};
}
export const createMediaRoot=()=>createRoot('offline-render');
export async function storeMedia(ctx,id,bytes) {
  const m=meta(id,bytes); // Full validation before any write.
  if(ctx.profile!=='offline-render') throw Error('Wrong media root profile');
  await checkRoot(ctx);
  for(const name of [`${id}.f32`,`${id}.json`]) {
    try { await fs.lstat(path.join(ctx.root,name)); throw Error('Refusing existing media/metadata overwrite'); }
    catch(e) {if(e.code!=='ENOENT') throw e;}
  }
  await exclusiveWrite(ctx,`${id}.f32`,bytes);
  await exclusiveWrite(ctx,`${id}.json`,Buffer.from(`${JSON.stringify(m)}\n`));
  return m;
}
export async function reopenMedia(ctx,id) {
  if(ctx.profile!=='offline-render' || !CASES.includes(id)) throw Error('Invalid media request');
  const m=JSON.parse(await readOwned(ctx,`${id}.json`,2048));
  const bytes=await readOwned(ctx,`${id}.f32`,GROUP_FRAMES*8);
  if(JSON.stringify(m)!==JSON.stringify(meta(id,bytes))) throw Error('Media metadata/integrity mismatch');
  return {metadata:m,base64:bytes.toString('base64')};
}
export function reader(ctx,id) {
  const r=spawnSync(process.execPath,[SCRIPT,'--read',ctx.root,ctx.owner,id], {encoding:'utf8',timeout:20000,maxBuffer:256*1024,env:{PATH:process.env.PATH,TMPDIR:tmpdir()}});
  if(r.error || r.signal || r.status!==0) throw Error(`Reader failed: ${r.error?.message || r.signal || r.stderr}`);
  const out=JSON.parse(r.stdout); fromTransport(out.base64,GROUP_FRAMES*8); return out;
}

// Serialized as trusted fixture code by Puppeteer. No imports/free module state.
export async function nativeRender(request) {
  if(typeof OfflineAudioContext!=='function') throw Error('Native OfflineAudioContext unavailable');
  const pack=buffer=>{
    const array=new Uint8Array(buffer.length*8), view=new DataView(array.buffer);
    for(let n=0;n<buffer.length;n++) for(let c=0;c<2;c++) view.setFloat32((n*2+c)*4,buffer.getChannelData(c)[n],true);
    let s=''; for(const b of array) s+=String.fromCharCode(b); return btoa(s);
  };
  const destination=request.operation==='destination';
  const ctx=new OfflineAudioContext(2,destination?8192:4096,48000);
  const params={};
  if(!destination) {
    let output=ctx.destination;
    if(request.fault==='clip') {const wave=ctx.createWaveShaper();wave.curve=new Float32Array([-1,1]);wave.oversample='none';wave.connect(output);output=wave;}
    for(const s of request.recipe.sources.filter(s=>request.recipe.selected.includes(s.id) || request.fault==='vocal' && s.id==='vocal')) {
      const b=ctx.createBuffer(2,s.frames,48000);
      for(let c=0;c<2;c++) for(let n=0;n<s.frames;n++) b.getChannelData(c)[n]=s.impulses ? n===s.impulses[c][0]?s.impulses[c][1]:0 : s.amplitudes[c]*Math.sin(2*Math.PI*s.frequency*n/48000);
      const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=b;gain.gain.value=s.gain;
      source.connect(gain);gain.connect(output);source.start(s.start/48000);
    }
  } else {
    const binary=atob(request.base64), view=new DataView(Uint8Array.from(binary,x=>x.charCodeAt(0)).buffer);
    if(binary.length!==4096*8) throw Error('Bad reopened bytes');
    const b=ctx.createBuffer(2,4096,48000);
    for(let n=0;n<4096;n++) for(let c=0;c<2;c++) b.getChannelData(c)[n]=view.getFloat32((n*2+c)*4,true);
    const source=ctx.createBufferSource(),gain=ctx.createGain(),eq=ctx.createBiquadFilter();
    source.buffer=b;gain.gain.value=.5;eq.type='peaking';eq.frequency.value=1500;eq.Q.value=1;eq.gain.value=3;
    Object.assign(params,{gain:gain.gain.value,type:eq.type,frequency:eq.frequency.value,Q:eq.Q.value,eqGain:eq.gain.value,startFrame:256});
    if(request.fault==='bypass') source.connect(ctx.destination);
    else {source.connect(gain);gain.connect(eq);eq.connect(ctx.destination);}
    source.start(256/48000);
    const other=ctx.createBuffer(2,4096,48000);
    for(let c=0;c<2;c++) for(let n=0;n<4096;n++) other.getChannelData(c)[n]=(c===0?.125:.0625)*Math.sin(2*Math.PI*(c===0?1500:750)*n/48000);
    const unrelated=ctx.createBufferSource();unrelated.buffer=other;unrelated.connect(ctx.destination);unrelated.start(0);
  }
  const result=await ctx.startRendering();
  return {base64:pack(result),params,frames:result.length,sampleRate:result.sampleRate,channels:result.numberOfChannels};
}
if(process.argv[1] && path.resolve(process.argv[1])===SCRIPT) {
  (async()=>{
    const a=process.argv.slice(2); if(a.length!==4 || a[0]!=='--read') throw Error('Only fixed reader invocation supported');
    console.log(JSON.stringify(await reopenMedia({root:a[1],owner:a[2],profile:'offline-render'},a[3])));
  })().catch(e=>{console.error(e.stack);process.exitCode=1;});
}
