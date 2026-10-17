// Fixed, read-only PR8 review. This is NOT a browser, bundler, app endpoint or
// security sandbox. It executes inspected repository code with a tiny DOM model.
// Requires the exact fetched Git object; never substitutes current/main source.
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {BAND_KEYS,BAND_META} from '../../src/audio/genre.js';
const HEAD='995306c927c6d0e71fb6483013f141ffd31ecb4b',BASE='2faa3939b9e109e5a9ed2e0d53130dc51c5abc9e';
const SHA={
  'src/main.js':'d732400d047e45ea2ae9118636fbe8ef8a3916111f857833e5a637475d2927c6',
  'index.html':'8765dbba9ba37beea110ba2be13ea8fd56c0915739b1f5e36fa59ba21dc04843',
  'src/audio/waveformPeaks.js':'98112ea172760d3929472809ded37e86b79ae6a594cd3341c320a78b9c5f29cf'
};
const hash=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',timeout:10000,maxBuffer:2*1024*1024});
function source(file){const text=git('show',`${HEAD}:${file}`);assert.equal(hash(text),SHA[file],`Reviewed source changed: ${file}`);return text;}
function run(){
  assert.equal(process.argv.length,2,'No arguments accepted; fixed review commit only.');
  const main=source('src/main.js'),index=source('index.html'),peaks=source('src/audio/waveformPeaks.js');
  assert.deepEqual([...index.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]),['app']);
  const queries=[],events=[],engineCalls=[];
  const document={querySelector:s=>{queries.push(s);return s==='#app'?{id:'app'}:null;},querySelectorAll:()=>[],activeElement:null};
  const engineStub=name=>(..._args)=>{engineCalls.push(name);throw Error(`Unexpected engine execution: ${name}`);};
  // Imports are single-line here; blank them, retaining exact source line numbers.
  // No ESM loader/bundler/browser/native decoding/provider behavior is modelled.
  const imports=main.match(/^import .+$/gm);assert.equal(imports.length,6);
  const context=vm.createContext({document,window:{addEventListener:(...args)=>events.push(args[0])},BAND_KEYS,BAND_META,
    cancelAnimationFrame:()=>{},requestAnimationFrame:()=>0,setTimeout:()=>0,clearTimeout:()=>{},console,
    decodeFile:engineStub('decode'),convert:engineStub('convert'),masterFix:engineStub('masterFix'),
    analysisService:{analyze:engineStub('analyze'),analyzeFast:engineStub('analyzeFast')}});
  let bootError;
  try{new vm.Script(main.replace(/^import .+$/gm,''),{filename:'PR8-src/main.js'}).runInContext(context,{timeout:1000});}catch(error){bootError=error;}
  assert.equal(bootError?.name,'TypeError');assert.match(bootError.message,/null/);assert.match(bootError.stack,/PR8-src\/main.js:1477/);
  assert.equal(queries.at(-1),'#btnIdleUpload');assert.deepEqual(events,[]);assert.deepEqual(engineCalls,[]);
  let stopError;
  try{vm.runInContext('stopPlayback()',context,{timeout:1000});}catch(error){stopError=error;}
  assert.equal(stopError?.name,'ReferenceError');assert.match(stopError.message,/stage is not defined/);
  // Verify the retained peak math without importing any audio/UI dependency.
  const oldDraw=git('show',`${BASE}:src/ui/draw.js`),start=oldDraw.indexOf('function peaksFor('),end=oldDraw.indexOf('\nexport function drawRadar(',start);
  assert.ok(start>0&&end>start);assert.equal(peaks.slice(peaks.indexOf('export function')).replace('export ', '').trim(),oldDraw.slice(start,end).trim());
  const peakContext=vm.createContext({});new vm.Script(peaks.replace('export function','function')+'\nglobalThis.calculate=peaksFor').runInContext(peakContext,{timeout:1000});
  const a=new Float32Array([1,-.5,0,.25]),b=new Float32Array([0,.2,-.8,0]),before=[new Float32Array(a),new Float32Array(b)],buffer={length:4,numberOfChannels:2,getChannelData:c=>[a,b][c]};
  for(const width of [1,2,4,9]){
    const result=peakContext.calculate(buffer,width);assert.equal(result.length,width);assert.ok([...result].every(Number.isFinite));assert.equal(peakContext.calculate(buffer,width),result);
  }
  assert.deepEqual([...peakContext.calculate(buffer,2)],[1,b[2]*-1]);assert.deepEqual(a,before[0]);assert.deepEqual(b,before[1]);
  const protectedDiff=git('diff','--name-status',BASE,HEAD,'--','src/audio','src/application','src/domain','src/infrastructure','electron','tests','scripts','package.json','package-lock.json','vite.config.ts');
  assert.equal(protectedDiff.trim(),'A\tsrc/audio/waveformPeaks.js');
  const tree=git('ls-tree','-r','--name-only',HEAD).trim().split('\n');
  const retainedAssets=tree.filter(p=>p.startsWith('src/assets/fonts/')||p.startsWith('build/icon')||p==='public/favicon.svg'||p==='scripts/make-icon.mjs');
  const oldRenderers=['ICONS','renderReport','buildRefHtml','renderTweakPanel','renderConvertPanel','renderAnalysis','updEnsure'].filter(n=>main.includes(n));
  assert.ok(retainedAssets.includes('public/favicon.svg'));assert.ok(index.includes('href="/favicon.svg"'));assert.ok(retainedAssets.some(p=>p.endsWith('.woff2')));assert.equal((main.match(/<svg\b/g)||[]).length,9);
  return {profile:'fixed-pr8-reset-review-v1',base:BASE,head:HEAD,sourceSha256:SHA,status:'changes-requested',
    boot:{method:'Node-VM-tiny-DOM-not-browser',indexIds:['app'],error:{name:bootError.name,message:bootError.message,line:1477},missingElement:'#btnIdleUpload',engineCalls,windowEventsBeforeFailure:events},
    preservedController:{method:'same-VM-context-after-initialization-failure-not-a-functional-audio-test',stopPlaybackError:{name:stopError.name,message:stopError.message},optionalChainingDoesNotGuardUndeclaredBindings:true},
    peakExtraction:{bodyByteIdenticalToOriginal:true,widthCases:[1,2,4,9],syntheticInputsUnchanged:true,sameWidthCacheIdentity:true,productionConsumerAdded:false,existingEngineModified:false,protectedPathDiff:protectedDiff.trim()},
    residuals:{retainedAssets,oldRenderers,inlineSvgCount:9,oldFaviconStillLinked:true},
    limits:['not a browser/actual app boot','imports blanked and audio calls trapped; no decoded audio or listening','VM is a contract execution tool, not an untrusted-code security boundary','no build/native/Electron/Mac/provider verification','no candidate or protected code changes applied to working tree']};
}
try{console.log(JSON.stringify(run(),null,2));process.exitCode=1;}catch(error){console.error(error);process.exitCode=2;}
