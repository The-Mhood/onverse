import { LEGACY_PROFILE, getRenderProfile } from '../../src/domain/linkedSessions/renderProfiles.js';
// Trusted local synthetic code only. Disabled-sandbox test flags are NEVER app
// configuration. This tests real renderer/service, NOT a durable storage adapter.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { auditTools } from './run-offline-render-probe.mjs';
import { probeTempParent, sha256 } from './linked-media-recovery-probe.mjs';
import { CASES, recipe, sourceChannels, expectedGroup, compare, MAX_ERROR } from './offline-render-fixtures.mjs';
import { encodePCM, decodePCM, hashPCM } from '../../src/audio/linkedSessions/pcm.js';
import { dependencyKey } from '../../src/domain/linkedSessions/linkedSessionContract.js';
import { createLinkedUpdateService } from '../../src/application/linkedSessions/linkedUpdateService.js';

const ROOT = new URL('../../', import.meta.url);
const MODULES = ['src/domain/linkedSessions/renderProfiles.js','src/domain/linkedSessions/linkedSessionContract.js',
  'src/audio/linkedSessions/pcm.js', 'src/audio/linkedSessions/renderSelection.js',
  'src/audio/linkedSessions/renderLinkedDestination.js'];
async function input(id) {
  const r = recipe(id === 'muted' ? 'original' : id), assets = {}, tracks = [];
  // Bounded contract max gain is 4; the unrelated source remains unselected.
  if (id === 'unrelated-edit') r.sources.find(s => s.id === 'vocal').gain = 4;
  if (id === 'muted') r.sources[0].gain = 0;
  for (const s of r.sources) {
    const bytes = encodePCM(sourceChannels(s)), assetId = `${s.id}-pcm`;
    assets[assetId] = Array.from(bytes);
    tracks.push({ trackId: s.id, audioRevisionId: `${s.id}-r1`, label: s.id, assetId,
      sha256: await hashPCM(bytes), frames: s.frames, startFrame: s.start,
      gain: id === 'muted' && s.id === 'conga' ? .5 : s.gain,
      muted: id === 'muted' && s.id === 'conga' });
  }
  return { snapshot: { schemaVersion: 1, sessionId: 'source-a', revisionId: `snapshot-${id}`,
    sampleRate: 48000, layout: ['L', 'R'], tracks },
  selection: { groupId: 'drums', definitionRevisionId: 'def-1', trackIds: r.selected,
    rangeStartFrame: 0, rangeEndFrame: 4096 }, assets, expected: expectedGroup(r) };
}
export async function run(tools, exercise, {renderProfile=LEGACY_PROFILE}={}) {
  const limits=getRenderProfile(renderProfile),ranged=limits.fixedFrames===null;
  if(ranged && !exercise)throw Error('Range profile requires an explicit trusted exercise');
  if (exercise !== undefined && typeof exercise !== 'function') throw Error('Trusted exercise callback required');
  if (process.platform !== 'linux' || process.arch !== 'x64') throw Error('Approved native Linux x64 only');
  const audit = await auditTools(tools), hashes = {};
  let bundle = '(() => {\n';
  for (const name of MODULES) {
    const text = await fs.readFile(new URL(name, ROOT), 'utf8'); hashes[name] = sha256(Buffer.from(text));
    // Fixed repository module list ONLY; no URL/plan/upload contributes code.
    bundle += text.replace(/^import .*;\n/gm, '').replace(/^export /gm, '') + '\n';
  }
  bundle += 'globalThis.__linkedEncode = bytes => {let s="";for(let n=0;n<bytes.length;n+=32768)s+=String.fromCharCode(...bytes.subarray(n,n+32768));return btoa(s);};globalThis.__linkedDecode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));';
  bundle += 'globalThis.__linkedRender = renderSelection; globalThis.__linkedDestination = renderLinkedDestination; })();';
  for (const name of ['src/application/linkedSessions/linkedUpdateService.js', 'scripts/validation/run-linked-render-probe.mjs'])
    hashes[name] = sha256(await fs.readFile(new URL(name, ROOT)));
  const runtime = await fs.mkdtemp(path.join(await probeTempParent(), 'onverse-browser-runtime-'));
  await fs.chmod(runtime, 0o700);
  for (const name of ['home', 'cache', 'profile', 'fonts']) await fs.mkdir(path.join(runtime, name), { mode: 0o700 });
  const saved = { ...process.env }, requests = [], errors = [], results = [];
  let browser, primaryError;
  try {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', TZ: 'UTC', TMPDIR: runtime,
      HOME: path.join(runtime, 'home'), XDG_CACHE_HOME: path.join(runtime, 'cache'), FONTCONFIG_PATH: path.join(runtime, 'fonts') });
    if (tmpdir() !== runtime) throw Error('Private temporary environment not active');
    const cm = await import(pathToFileURL(path.join(tools, 'node_modules/@sparticuz/chromium/build/index.js')));
    await cm.inflate(path.join(tools, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'));
    cm.setupLambdaEnvironment(path.join(runtime, 'al2023/lib'));
    const executablePath = await cm.default.executablePath();
    if (!executablePath.startsWith(`${runtime}/`)) throw Error('Shared browser extraction refused');
    const pm = await import(pathToFileURL(path.join(tools, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')));
    browser = await pm.default.launch({ executablePath, headless: true, pipe: true,
      userDataDir: path.join(runtime, 'profile'), env: { ...process.env }, args: [...cm.default.args,
        '--disable-background-networking', '--disable-component-update', '--disable-domain-reliability', '--disable-sync',
        '--no-first-run', '--no-default-browser-check', '--host-resolver-rules=MAP * ~NOTFOUND', '--disk-cache-dir=' + path.join(runtime, 'cache')] });
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', r => { requests.push(r.url()); r.abort().catch(e => errors.push(e.message)); });
    await page.setOfflineMode(true);
    // Blank pages lack secure-origin SubtleCrypto. Hash through a bounded CDP
    // bridge to real Node SHA-256; audio graph still runs entirely natively.
    await page.exposeFunction('__linkedDigest', async values => {
      if (!Array.isArray(values) || values.length > 32768 || !values.every(x => Number.isInteger(x) && x >= 0 && x <= 255)) throw Error('Invalid digest bridge bytes');
      return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', Uint8Array.from(values))));
    });
    if(ranged)await page.exposeFunction('__linkedDigestBase64',async encoded=>{
      if(typeof encoded!=='string'||encoded.length>Math.ceil(limits.maxFrames*8/3)*4)throw Error('Oversize digest bridge');
      const bytes=Buffer.from(encoded,'base64');
      if(bytes.length>limits.maxFrames*8||bytes.toString('base64')!==encoded)throw Error('Invalid digest bridge');
      return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)));
    });
    await page.evaluate(bundle);
    const render = async (request, assets) => {
      if(ranged){
        if(request.renderProfile!==renderProfile)throw Error('Native proof profile mismatch');
        const encoded={};let total=0;
        for(const [id,bytes]of Object.entries(assets)){
          if(!(bytes instanceof Uint8Array)||bytes.length>limits.maxFrames*8||(total+=bytes.length)>limits.maxSelectedBytes)throw Error('Oversize native input');
          encoded[id]=Buffer.from(bytes).toString('base64');
        }
        const out=await page.evaluate(async({request,assets})=>{
          const {bytes,...meta}=await globalThis.__linkedRender({...request,
            loadAsset:async id=>assets[id]===undefined?undefined:globalThis.__linkedDecode(assets[id]),
            digest:async bytes=>Uint8Array.from(await globalThis.__linkedDigestBase64(globalThis.__linkedEncode(bytes))).buffer});
          return {...meta,base64:globalThis.__linkedEncode(bytes)};
        },{request,assets:encoded});
        if(typeof out.base64!=='string'||out.base64.length>Math.ceil(limits.maxFrames*8/3)*4)throw Error('Oversize native output');
        const {base64,...meta}=out,bytes=Buffer.from(base64,'base64');
        if(bytes.length!==out.frames*8||base64!==bytes.toString('base64'))throw Error('Invalid native output');
        return {...meta,bytes:new Uint8Array(bytes)};
      }
      const out = await page.evaluate(async ({ request, assets }) => {
        const result = await globalThis.__linkedRender({ ...request,
          loadAsset: async id => assets[id] === undefined ? undefined : Uint8Array.from(assets[id]),
          digest: async bytes => Uint8Array.from(await globalThis.__linkedDigest(Array.from(bytes))).buffer });
        return { ...result, bytes: Array.from(result.bytes) };
      }, { request, assets });
      if (!Array.isArray(out.bytes) || out.bytes.length !== 32768 || !out.bytes.every(x => Number.isInteger(x) && x >= 0 && x <= 255)) throw Error('Bad native transport');
      return { ...out, bytes: Uint8Array.from(out.bytes) };
    };
    if (exercise) {
      const renderDestination = async request => {
        if(!ranged)return page.evaluate(async r=>{
          const out=await globalThis.__linkedDestination({...r,linkedBytes:Uint8Array.from(r.linkedBytes),unrelatedBytes:Uint8Array.from(r.unrelatedBytes)});
          return {...out,channels:out.channels.map(c=>Array.from(c))};
        },request);
        const {linkedBytes,unrelatedBytes,...meta}=request;
        if(meta.renderProfile!==renderProfile||![linkedBytes,unrelatedBytes].every(b=>b instanceof Uint8Array&&b.length<=limits.maxFrames*8))throw Error('Invalid native destination input');
        const out=await page.evaluate(async r=>{
          const {linkedBase64,otherBase64,...meta}=r,out=await globalThis.__linkedDestination({...meta,
            linkedBytes:globalThis.__linkedDecode(linkedBase64),unrelatedBytes:globalThis.__linkedDecode(otherBase64)});
          return {...out,channels:out.channels.map(c=>globalThis.__linkedEncode(new Uint8Array(c.buffer,c.byteOffset,c.byteLength)))};
        },{...meta,linkedBase64:Buffer.from(linkedBytes).toString('base64'),otherBase64:Buffer.from(unrelatedBytes).toString('base64')});
        const maxFrames=limits.maxFrames+limits.maxPlacementFrames+4096;
        if(!Number.isSafeInteger(out.frames)||out.frames<1||out.frames>maxFrames||!Array.isArray(out.channels)||out.channels.length!==2)throw Error('Invalid native destination geometry');
        return {...out,channels:out.channels.map(s=>{
          if(typeof s!=='string'||s.length>Math.ceil(maxFrames*4/3)*4)throw Error('Oversize native destination output');
          const b=Buffer.from(s,'base64');if(b.length!==out.frames*4||b.toString('base64')!==s)throw Error('Invalid native destination bytes');
          return Float32Array.from({length:out.frames},(_,i)=>b.readFloatLE(i*4));
        })};
      };
      const result = await exercise({ render, renderDestination });
      if (requests.length || errors.length) throw Error('Unexpected native page activity');
      return { kind: 'CORE-012-native-durable-integration', ...result, node: process.version,
        browser: await browser.version(), tools: audit, codeHashes: hashes, requests, errors, runtime };
    }
    let originalBytes;
    for (const id of [...CASES, 'muted']) {
      const f = await input(id), calls = [];
      const target = { targetId: 'linked', linkRevisionId: 'link-1', linkedVersionId: 'old', sampleRate: 48000, layout: ['L', 'R'] };
      let media;
      const service = createLinkedUpdateService({ readSource: async () => f, readTarget: async () => target,
        render: request => render(request, f.assets), storage: {
          async prepare(value) { media = value; calls.push('prepare'); return Object.freeze({ syntheticToken: id }); },
          async commit(command) {
            if (command.expected.linkRevisionId !== target.linkRevisionId ||
                command.expectedSource.dependencyKey !== dependencyKey(f.snapshot, f.selection)) throw Error('Source/target conflict');
            calls.push('commit'); target.linkRevisionId = 'link-2'; target.linkedVersionId = 'new';
            return { targetId: 'linked', versionId: 'new' };
          }, async discard() { calls.push('discard'); }
        } });
      const job = service.start(service.approve(await service.review({ groupId: 'drums', targetId: 'linked' })));
      const completion = await job.completion;
      if (completion.status !== 'completed') throw completion.error || Error('Native service did not complete');
      const metrics = compare(decodePCM(media.bytes, 4096), f.expected);
      if (!metrics.passed || metrics.maxError > MAX_ERROR || calls.join(',') !== 'prepare,commit') throw Error('Native service/oracle mismatch');
      if (id === 'original') originalBytes = Buffer.from(media.bytes);
      if (id === 'unrelated-edit' && !originalBytes.equals(Buffer.from(media.bytes))) throw Error('Unrelated edit changed bytes');
      results.push({ id, ...metrics, sha256: media.sha256, phases: job.events.map(e => e.phase) });
    }
    const corrupt = await input('original'); corrupt.assets['conga-pcm'][0] ^= 1;
    let rejected = false;
    try { await render({ snapshot: corrupt.snapshot, selection: corrupt.selection }, corrupt.assets); }
    catch (e) { if (!/checksum/.test(e.message)) throw e; rejected = true; }
    if (!rejected || requests.length || errors.length) throw Error('Corruption gate/page isolation failed');
    return { kind: 'CORE-012-render-service-boundary', storage: 'in-memory contract double; NOT persistence/recovery proof',
      node: process.version, browser: await browser.version(), tools: audit, codeHashes: hashes,
      maxAllowedError: MAX_ERROR, results, corruptionRejected: rejected, requests, errors, runtime };
  } catch (error) { primaryError = error; throw error; }
  finally {
    const cleanupErrors=[];let browserClosed=true;
    try { if (browser) await browser.close(); }catch(error){browserClosed=false;cleanupErrors.push(error);}
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env,saved);
    // Remove ONLY the private runtime created by this invocation, after the
    // browser has closed. Keep it if browser termination is uncertain.
    if(browserClosed)try{
      const stat=await fs.lstat(runtime);
      if(!stat.isDirectory()||stat.isSymbolicLink()||(stat.mode&0o077)||stat.uid!==process.getuid()||await fs.realpath(runtime)!==runtime)throw Error('Unsafe native runtime cleanup');
      await fs.rm(runtime,{recursive:true});
    }catch(error){cleanupErrors.push(error);}
    if(cleanupErrors.length)throw new AggregateError([...(primaryError?[primaryError]:[]),...cleanupErrors],'Native run and cleanup failed');
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--tools-dir') { console.error('Usage: run-linked-render-probe.mjs --tools-dir <approved-private-toolkit>'); process.exitCode = 1; }
  else run(args[1]).then(out => console.log(JSON.stringify(out, null, 2))).catch(e => { console.error(e.stack); process.exitCode = 1; });
}
