// Opt-in, trusted synthetic pages only. Never reuse these browser flags in Electron.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { sha256 } from './linked-media-recovery-probe.mjs';
import { CASES, GROUP_FRAMES, DEST_FRAMES, MAX_ERROR, recipe, expectedGroup, expectedDestination,
  decode, fromTransport, compare, createMediaRoot, storeMedia, reader, nativeRender } from './offline-render-fixtures.mjs';

const PINS = {
  '@sparticuz/chromium': { version:'153.0.0', integrity:'sha512-jiGWqSvPMdu4+P9TilYqAR7yEGPEHINx+lCvE/NqNO/EHYzF/x1hUiI5T6ioVIt7dEy7n88byyT0vk+dnsgQwA==' },
  'puppeteer-core': { version:'25.14.0', integrity:'sha512-LQitnes3tBeVbdZ7V/4iwJPLZGgkl9uBVK0W7YYMh68j/3Y9eNuvj4yl+Fdo7zN0SuajOMrhd7aPj3DifK8k6A==' },
};
export async function auditTools(root) {
  const parent=await fs.realpath(tmpdir());
  if(typeof root!=='string' || path.dirname(root)!==parent || !path.basename(root).startsWith('onverse-browser-tools-') || await fs.realpath(root)!==root) throw Error('Only approved private temporary toolkit directory accepted');
  const stat=await fs.lstat(root);
  if(!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw Error('Toolkit root must be private');
  const read=async relative=>{
    const p=path.join(root,relative); const s=await fs.lstat(p);
    if(!s.isFile() || s.isSymbolicLink() || s.size>1024*1024 || await fs.realpath(p)!==p) throw Error('Unsafe toolkit file');
    return JSON.parse(await fs.readFile(p,'utf8'));
  };
  const manifest=await read('package.json'),lock=await read('package-lock.json');
  if(JSON.stringify(Object.keys(manifest.dependencies || {}).sort())!==JSON.stringify(Object.keys(PINS).sort()) || manifest.private!==true || manifest.scripts || lock.lockfileVersion!==3) throw Error('Unexpected toolkit manifest');
  for(const [name,pin] of Object.entries(PINS)) {
    const entry=lock.packages[`node_modules/${name}`], installed=await read(`node_modules/${name}/package.json`);
    if(manifest.dependencies[name]!==pin.version || entry?.version!==pin.version || entry?.integrity!==pin.integrity || installed.version!==pin.version || installed.name!==name) throw Error('Toolkit pin mismatch');
  }
  for(const [name,entry] of Object.entries(lock.packages)) if(name) {
    if(!/^node_modules\/(?:[a-zA-Z0-9@._-]+\/)*[a-zA-Z0-9._-]+$/.test(name) || !entry.resolved?.startsWith('https://registry.npmjs.org/') || !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(entry.integrity || '')) throw Error('Unapproved lock URL/integrity/path');
    const installed=await read(`${name}/package.json`);
    if(installed.version!==entry.version) throw Error('Transitive version mismatch');
  }
  // Fixed entry points only, never paths supplied by report/metadata or package scripts.
  for(const relative of ['node_modules/@sparticuz/chromium/build/index.js','node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    const p=path.join(root,relative),s=await fs.lstat(p);
    if(!s.isFile() || s.isSymbolicLink() || await fs.realpath(p)!==p) throw Error('Unsafe toolkit entry point');
  }
  return {packages:Object.keys(lock.packages).length-1, lockSha256:sha256(await fs.readFile(path.join(root,'package-lock.json'))),pins:PINS};
}
function gate(actual,expected,label) {
  const result=compare(actual,expected);
  if(!result.passed) throw Error(`${label}: max sample error ${result.maxError} exceeds predeclared ${MAX_ERROR}`);
  return result;
}
export async function run(tools) {
  if(process.platform!=='linux' || process.arch!=='x64') throw Error('Native probe requires approved Linux x64 runtime');
  const audit=await auditTools(tools);
  const runtime=await fs.mkdtemp(path.join(await fs.realpath(tmpdir()),'onverse-browser-runtime-'));
  await fs.chmod(runtime,0o700);
  for(const name of ['home','cache','profile','fonts']) await fs.mkdir(path.join(runtime,name),{mode:0o700});
  const originalEnv={...process.env};
  let browser, primaryError;
  const requests=[],errors=[];
  try {
    // Restrict browser AND package import side effects to this private runtime.
    for(const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env,{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',TZ:'UTC',TMPDIR:runtime,HOME:path.join(runtime,'home'),XDG_CACHE_HOME:path.join(runtime,'cache'),FONTCONFIG_PATH:path.join(runtime,'fonts')});
    if(tmpdir()!==runtime) throw Error('Native temporary environment was not updated');
    const chromiumModule=await import(pathToFileURL(path.join(tools,'node_modules/@sparticuz/chromium/build/index.js')));
    const chromium=chromiumModule.default;
    await chromiumModule.inflate(path.join(tools,'node_modules/@sparticuz/chromium/bin/al2023.tar.br'));
    chromiumModule.setupLambdaEnvironment(path.join(runtime,'al2023/lib'));
    const executablePath=await chromium.executablePath();
    if(!executablePath.startsWith(`${runtime}/`)) throw Error('Unexpected shared browser extraction');
    const puppeteer=await import(pathToFileURL(path.join(tools,'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')));
    browser=await puppeteer.default.launch({executablePath,headless:true,pipe:true,userDataDir:path.join(runtime,'profile'),env:{...process.env},args:[...chromium.args,
      '--disable-background-networking','--disable-component-update','--disable-domain-reliability','--disable-sync','--no-first-run','--no-default-browser-check',
      '--host-resolver-rules=MAP * ~NOTFOUND','--disk-cache-dir='+path.join(runtime,'cache')]});
    const page=await browser.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request',r=>{requests.push(r.url());r.abort().catch(e=>errors.push(`request abort: ${e.message}`));});
    await page.setOfflineMode(true);
    const ctx=await createMediaRoot();
    const sources=[],destinations=[],negatives=[];
    const reopened={};
    for(const id of CASES) {
      const r=recipe(id),out=await page.evaluate(nativeRender,{operation:'source',recipe:r});
      if(out.frames!==GROUP_FRAMES || out.sampleRate!==48000 || out.channels!==2) throw Error('Native source geometry');
      const bytes=fromTransport(out.base64,GROUP_FRAMES*8);
      const metrics=gate(decode(bytes,GROUP_FRAMES),expectedGroup(r),`source ${id}`);
      const metadata=await storeMedia(ctx,id,bytes);
      const separate=reader(ctx,id),readBytes=fromTransport(separate.base64,GROUP_FRAMES*8);
      if(!readBytes.equals(bytes)) throw Error('Separate-process bytes differ');
      reopened[id]=separate.base64;
      sources.push({id,...metrics,sha256:metadata.sha256,byteExactReopen:true});
    }
    if(reopened.original!==reopened['unrelated-edit']) throw Error('Unselected source edit changed intended output');
    for(const id of ['original','updated']) {
      const bytes=fromTransport(reopened[id],GROUP_FRAMES*8);
      const out=await page.evaluate(nativeRender,{operation:'destination',base64:reopened[id]});
      if(out.frames!==DEST_FRAMES || out.sampleRate!==48000 || out.channels!==2) throw Error('Native destination geometry');
      const expectedParams={gain:.5,type:'peaking',frequency:1500,Q:1,eqGain:3,startFrame:256};
      if(JSON.stringify(out.params)!==JSON.stringify(expectedParams)) throw Error('Native processing parameters changed');
      const rendered=fromTransport(out.base64,DEST_FRAMES*8);
      destinations.push({id,...gate(decode(rendered,DEST_FRAMES),expectedDestination(bytes),`destination ${id}`),params:out.params,sha256:sha256(rendered)});
    }
    for(const fault of ['clip','vocal','bypass']) {
      const dest=fault==='bypass',frames=dest?DEST_FRAMES:GROUP_FRAMES;
      const selected=dest?'updated':'original';
      const out=await page.evaluate(nativeRender,{operation:dest?'destination':'source',recipe:recipe(),base64:reopened[selected],fault});
      const metrics=compare(decode(fromTransport(out.base64,frames*8),frames),dest?expectedDestination(fromTransport(reopened[selected],GROUP_FRAMES*8)):expectedGroup(recipe()));
      if(metrics.passed) throw Error(`Native negative ${fault} was not detected`);
      negatives.push({fault,sourceCase:selected,...metrics,detected:!metrics.passed});
    }
    if(errors.length || requests.length) throw Error(`Unexpected page activity: ${JSON.stringify({errors,requests})}`);
    const codeHashes={};
    for(const name of ['linked-media-recovery-probe.mjs','offline-render-fixtures.mjs','run-offline-render-probe.mjs']) codeHashes[name]=sha256(await fs.readFile(new URL(name,import.meta.url)));
    return {kind:'CORE-010-reconstruction',codeHashes,node:process.version,platform:process.platform,arch:process.arch,browser:await browser.version(),
      maxAllowedError:MAX_ERROR,tools:audit,runtime,mediaRoot:ctx.root,requests,errors,sources,destinations,negatives};
  } catch(error) {
    primaryError=error;
    throw error;
  } finally {
    try {
      if(browser) await browser.close();
    } catch(closeError) {
      if(primaryError) throw new AggregateError([primaryError,closeError],'Probe and browser cleanup both failed');
      throw closeError;
    } finally {
      for(const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env,originalEnv);
    }
  }
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  (async()=>{
    const args=process.argv.slice(2);if(args.length!==2 || args[0]!=='--tools-dir') throw Error('Usage: node run-offline-render-probe.mjs --tools-dir <approved-private-temp-directory>');
    console.log(JSON.stringify(await run(args[1]),null,2));
  })().catch(e=>{console.error(e.stack);process.exitCode=1;});
}
