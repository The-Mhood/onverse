import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { recipe, sourceChannels, expectedGroup, encode, decode, fromTransport, peaking, response,
  expectedDestination, compare, MAX_ERROR, GROUP_FRAMES, DEST_FRAMES, requireNative, nativeRender,
  createMediaRoot, storeMedia, reopenMedia, reader } from '../../scripts/validation/offline-render-fixtures.mjs';
import { auditTools } from '../../scripts/validation/run-offline-render-probe.mjs';
const linux={skip:process.platform!=='linux'?'Linux file fixture only':false};
const original=()=>encode(expectedGroup(recipe()));
const put=(ctx,name,bytes)=>fs.writeFile(path.join(ctx.root,name),bytes);
async function stored() {const ctx=await createMediaRoot();await storeMedia(ctx,'original',original());return ctx;}

test('recipes are independent objects with exact selection and source boundaries',()=>{
  const a=recipe(),b=recipe();a.sources[0].gain=7;a.selected.push('vocal');
  assert.equal(b.sources[0].gain,.5);assert.deepEqual(b.selected,['conga','other']);
  assert.deepEqual(b.sources.map(s=>[s.frames,s.start]),[[2048,0],[3072,128],[2048,64]]);
  assert.throws(()=>recipe('unknown'));
});
test('source Float32/gain/sum oracle has exact original and updated peaks/alignment',()=>{
  for(const [id,peak] of [['original',1.375],['updated',2]]) {
    const r=recipe(id),out=expectedGroup(r);
    assert.equal(compare(out,out).peak,peak);assert.equal(out[0].length,GROUP_FRAMES);
    const s=sourceChannels(r.sources[0]);assert.equal(out[0][32],Math.fround(s[0][32]*r.sources[0].gain));
    assert.equal(out[0][3328],0); assert.equal(out[0][4095],0);
  }
});
test('unselected Vocal edit leaves source bytes identical',()=>assert.deepEqual(encode(expectedGroup(recipe('unrelated-edit'))),original()));
test('silence is finite exact zero',()=>assert.equal(compare(expectedGroup(recipe('silence')),expectedGroup(recipe('silence'))).peak,0));
test('independent over-range L/R impulses preserve signs/positions without crossfeed',()=>{
  const out=expectedGroup(recipe('channels'));
  assert.equal(out[0][64],1.75);assert.equal(out[1][128],-2);assert.equal(out[1][64],0);assert.equal(out[0][128],0);
  assert.equal(out.flatMap(c=>Array.from(c)).filter(x=>x!==0).length,2);
});
test('Float32 codec preserves over-range samples and negative-zero exact bytes',()=>{
  const channels=[new Float32Array([1.75,-0]),new Float32Array([-2,0])];
  const bytes=encode(channels),back=decode(bytes,2);
  assert.deepEqual(encode(back),bytes);assert.ok(Object.is(back[0][1],-0));assert.equal(bytes.readFloatLE(4),-2);
});
test('codec rejects mismatched channel counts, lengths and unsupported/truncated dimensions',()=>{
  for(const channels of [[],[new Float32Array(1)],[new Float32Array(2),new Float32Array(1)],[[],[]]]) assert.throws(()=>encode(channels),/dimensions/);
  for(const [bytes,frames] of [[Buffer.alloc(7),1],[Buffer.alloc(8),0],[Buffer.alloc(8),1.5],[Buffer.alloc(8),DEST_FRAMES+1]]) assert.throws(()=>decode(bytes,frames),/dimensions/);
});
test('encoder rejects NaN, Infinity AND finite Float64 that overflows Float32',()=>{
  for(const x of [NaN,Infinity,-Infinity,Number.MAX_VALUE]) assert.throws(()=>encode([new Float64Array([x]),new Float64Array([0])]),/Nonfinite\/overflow/);
});
test('decoder rejects nonfinite encoded Float32',()=>{
  for(const x of [NaN,Infinity]) {const b=Buffer.alloc(8);b.writeFloatLE(x);assert.throws(()=>decode(b,1),/Nonfinite/);}
});
test('canonical complete base64 transport only',()=>{
  const b=original(),text=b.toString('base64');assert.deepEqual(fromTransport(text,b.length),b);
  for(const invalid of [text.slice(1),text+'\n',text.slice(0,-1),'!!!!','AB==']) assert.throws(()=>fromTransport(invalid,b.length));
  assert.throws(()=>fromTransport('AB==',1),/Noncanonical/); // nonzero discarded pad bits
});
test('independent RBJ oracle DC unity, zero gain identity, +3dB centre response',()=>{
  const k=peaking();assert.ok(Math.abs(response(k,0)-1)<1e-12);
  assert.ok(Math.abs(response(k,1500)-10**(3/20))<1e-12);
  const zero=peaking(1500,1,0);
  for(const f of [0,375,1500,10000,23999]) assert.ok(Math.abs(response(zero,f)-1)<1e-12);
  assert.equal(zero.b0,1);assert.equal(zero.b1,zero.a1);assert.equal(zero.b2,zero.a2);
});
test('destination oracle preserves unrelated audio before linked placement and filter tail',()=>{
  const out=expectedDestination(original());assert.equal(out[0].length,DEST_FRAMES);
  for(const c of [0,1]) for(let n=0;n<256;n++) assert.equal(out[c][n],Math.fround((c===0?.125:.0625)*Math.sin(2*Math.PI*(c===0?1500:750)*n/48000)));
  assert.ok(out.some(c=>c.slice(4352,4608).some(x=>x!==0)));
});
test('unchanged numeric gate rejects errors above 2e-6 and invalid comparison data',()=>{
  assert.equal(MAX_ERROR,2e-6);
  assert.equal(compare([[0],[0]],[[0],[0]]).passed,true);
  assert.equal(compare([[MAX_ERROR*1.01],[0]],[[0],[0]]).passed,false);
  assert.throws(()=>compare([[NaN],[0]],[[0],[0]]),/Nonfinite/);
  assert.throws(()=>compare([[0],[0]],[[0,0],[0,0]]),/dimensions/);
});
test('native absence is an explicit failure, not a JS substitute',async()=>{
  assert.throws(()=>requireNative({}),/Native OfflineAudioContext unavailable/);
  if(typeof globalThis.OfflineAudioContext==='undefined') await assert.rejects(nativeRender({}),/Native OfflineAudioContext unavailable/);
});
test('separate-process reopening equals stored bytes; metadata contains no audio arrays',linux,async()=>{
  const ctx=await stored(),r=reader(ctx,'original');assert.deepEqual(fromTransport(r.base64,GROUP_FRAMES*8),original());
  assert.deepEqual(Object.keys(r.metadata),['profile','id','format','sampleRate','layout','frames','bytes','sha256']);
  assert.equal(JSON.stringify(r.metadata).includes('base64'),false);assert.ok((await fs.stat(path.join(ctx.root,'original.json'))).size<512);
});
test('existing media or metadata is never overwritten',linux,async()=>{
  const ctx=await stored(),before=await fs.stat(path.join(ctx.root,'original.f32'));
  await assert.rejects(storeMedia(ctx,'original',original()),/existing/);
  assert.equal((await fs.stat(path.join(ctx.root,'original.f32'))).ino,before.ino);
  const other=await createMediaRoot();await put(other,'original.json','{}');
  await assert.rejects(storeMedia(other,'original',original()),/existing/);
  await assert.rejects(fs.stat(path.join(other.root,'original.f32')),{code:'ENOENT'});
});
test('validate complete media input BEFORE any file is written',linux,async()=>{
  const ctx=await createMediaRoot(),before=await fs.readdir(ctx.root);
  const invalid=Buffer.from(original());invalid.writeFloatLE(Infinity);
  await assert.rejects(storeMedia(ctx,'original',invalid),/Nonfinite/);
  await assert.rejects(storeMedia(ctx,'../bad',original()),/Invalid media ID/);
  await assert.rejects(storeMedia(ctx,'original',Buffer.alloc(8)),/dimensions/);
  assert.deepEqual(await fs.readdir(ctx.root),before);
});
test('same-length corrupted media rejected by separate process',linux,async()=>{
  const ctx=await stored(),b=original();b[0]^=1;await put(ctx,'original.f32',b);
  assert.throws(()=>reader(ctx,'original'),/integrity mismatch/);
});
test('truncated media rejected',linux,async()=>{
  const ctx=await stored();await put(ctx,'original.f32',original().subarray(0,32));await assert.rejects(reopenMedia(ctx,'original'),/dimensions/);
});
for(const [key,value] of [['layout',['R','L']],['sampleRate',44100],['frames',4095]]) test(`altered ${key} metadata rejected`,linux,async()=>{
  const ctx=await stored(),m=JSON.parse(await fs.readFile(path.join(ctx.root,'original.json')));m[key]=value;
  await put(ctx,'original.json',JSON.stringify(m));await assert.rejects(reopenMedia(ctx,'original'),/metadata\/integrity mismatch/);
});
test('oversized/malformed manifests rejected',linux,async()=>{
  const ctx=await stored();await put(ctx,'original.json',Buffer.alloc(2049));await assert.rejects(reopenMedia(ctx,'original'),/Oversized/);
  await put(ctx,'original.json','{');await assert.rejects(reopenMedia(ctx,'original'),SyntaxError);
});
test('matching-byte symlink to foreign media is rejected',linux,async()=>{
  const ctx=await stored(),foreign=await stored();await fs.unlink(path.join(ctx.root,'original.f32'));
  await fs.symlink(path.join(foreign.root,'original.f32'),path.join(ctx.root,'original.f32'));
  await assert.rejects(reopenMedia(ctx,'original'),{code:'ELOOP'});
});
test('traversal, wrong ownership, non-temporary root rejected',linux,async()=>{
  const ctx=await stored();await assert.rejects(reopenMedia(ctx,'../original'),/Invalid media request/);
  await assert.rejects(reopenMedia({...ctx,owner:'00000000-0000-4000-8000-000000000000'},'original'),/Ownership mismatch/);
  await assert.rejects(reopenMedia({...ctx,root:process.cwd()},'original'),/temporary probe root/);
});
test('arbitrary toolkit directory refused before importing code',linux,async()=>{
  await assert.rejects(auditTools(process.cwd()),/approved private temporary toolkit/);
  const root=await fs.mkdtemp('/tmp/onverse-browser-tools-invalid-');await fs.chmod(root,0o700);
  await fs.writeFile(path.join(root,'package.json'),'{"private":true}');await fs.writeFile(path.join(root,'package-lock.json'),'{"lockfileVersion":3}');
  await assert.rejects(auditTools(root),/Unexpected toolkit manifest/);
});

test('toolkit audit refuses TMPDIR redirection before loading a toolkit',linux,async()=>{
  const ctx=await createMediaRoot(),old=process.env.TMPDIR;
  try {
    process.env.TMPDIR=ctx.root;
    await assert.rejects(auditTools(path.join(ctx.root,'onverse-browser-tools-forged')),/Unapproved temporary parent/);
  } finally {
    if(old===undefined)delete process.env.TMPDIR;else process.env.TMPDIR=old;
  }
});
test('toolkit lock entries cannot traverse outside the private toolkit root',linux,async()=>{
  const root=await fs.mkdtemp('/tmp/onverse-browser-tools-locktest-');await fs.chmod(root,0o700);
  // Metadata-only fake install: nothing here is imported or executed.
  const pins={
    '@sparticuz/chromium':['153.0.0','sha512-jiGWqSvPMdu4+P9TilYqAR7yEGPEHINx+lCvE/NqNO/EHYzF/x1hUiI5T6ioVIt7dEy7n88byyT0vk+dnsgQwA=='],
    'puppeteer-core':['25.14.0','sha512-LQitnes3tBeVbdZ7V/4iwJPLZGgkl9uBVK0W7YYMh68j/3Y9eNuvj4yl+Fdo7zN0SuajOMrhd7aPj3DifK8k6A=='],
  };
  const dependencies={},packages={};
  for(const [name,[version,integrity]] of Object.entries(pins)) {
    dependencies[name]=version;packages[`node_modules/${name}`]={version,integrity,resolved:`https://registry.npmjs.org/${name}/fixture.tgz`};
    const folder=path.join(root,'node_modules',name);await fs.mkdir(folder,{recursive:true});
    await fs.writeFile(path.join(folder,'package.json'),JSON.stringify({name,version}));
  }
  for(const name of ['@sparticuz/chromium/build/index.js','puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    const file=path.join(root,'node_modules',name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,'// Never execute this test fixture.\n');
  }
  const foreign=await createMediaRoot();await put(foreign,'package.json','{"version":"1.0.0"}');
  packages[`node_modules/../../${path.basename(foreign.root)}`]={version:'1.0.0',integrity:Object.values(pins)[0][1],resolved:'https://registry.npmjs.org/fixture.tgz'};
  await fs.writeFile(path.join(root,'package.json'),JSON.stringify({private:true,dependencies}));
  await fs.writeFile(path.join(root,'package-lock.json'),JSON.stringify({lockfileVersion:3,packages}));
  await assert.rejects(auditTools(root),/Unapproved lock URL\/integrity\/path/);
});
