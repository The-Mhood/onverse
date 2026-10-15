// Isolated Linux fixture, not an application repository or power-loss guarantee.
import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const SCRIPT = fileURLToPath(import.meta.url);
export const BOUNDARIES = Object.freeze(['media-partial', 'media-synced', 'media-published',
  'generation-synced', 'generation-published', 'journal-synced', 'journal-published',
  'pointer-synced', 'pointer-renamed', 'directory-synced']);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const profiles = new Set(['linked-media', 'offline-render']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
export function pcm(values) {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((x, i) => { if (!Number.isFinite(x) || !Number.isFinite(Math.fround(x))) throw Error('Nonfinite Float32'); bytes.writeFloatLE(x, i * 4); });
  return bytes;
}
export const OLD = pcm([.25,-.25,0,0,1.25,-1.5,.125,-.0625]);
export const NEW = pcm([.5,-.5,0,0,1.75,-2,.25,-.125]);
export const UNRELATED = pcm([.125,.125,0,0,.25,.25,0,0]);
export async function createRoot(profile = 'linked-media') {
  if (process.platform !== 'linux') throw Error('Linux fixture only');
  if (!profiles.has(profile)) throw Error('Unknown profile');
  const parent = await fs.realpath(tmpdir());
  const root = await fs.mkdtemp(path.join(parent, `onverse-${profile}-probe-`));
  await fs.chmod(root, 0o700);
  const owner = randomUUID();
  await fs.writeFile(path.join(root, '.probe-owner'), owner, { flag: 'wx', mode: 0o600 });
  return { root, owner, profile };
}
function basename(name) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(name)) throw Error('Unsafe fixture filename');
  return name;
}
export async function checkRoot(ctx) {
  if (process.platform !== 'linux') throw Error('Linux fixture only');
  if (!ctx || !profiles.has(ctx.profile) || !uuid.test(ctx.owner)) throw Error('Invalid owner/profile');
  const parent = await fs.realpath(tmpdir());
  if (path.dirname(ctx.root) !== parent || !path.basename(ctx.root).startsWith(`onverse-${ctx.profile}-probe-`)) throw Error('Not a private temporary probe root');
  const stat = await fs.lstat(ctx.root);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) || await fs.realpath(ctx.root) !== ctx.root) throw Error('Unsafe root');
  const h = await fs.open(path.join(ctx.root, '.probe-owner'), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const s = await h.stat();
    if (!s.isFile() || s.size !== 36 || (s.mode & 0o077) || await h.readFile('utf8') !== ctx.owner) throw Error('Ownership mismatch');
  } finally { await h.close(); }
}
export async function readOwned(ctx, name, max = 65536) {
  await checkRoot(ctx);
  const h = await fs.open(path.join(ctx.root, basename(name)), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const s = await h.stat();
    if (!s.isFile() || s.size > max) throw Error('Oversized/non-file fixture');
    // Fixed allocation/read bound even if a file grows after stat.
    const buffer = Buffer.alloc(max + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await h.read(buffer, length, buffer.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length !== s.size || length > max) throw Error('Changed/oversized file');
    return buffer.subarray(0, length);
  } finally { await h.close(); }
}
export async function exclusiveWrite(ctx, name, bytes) {
  await checkRoot(ctx);
  const h = await fs.open(path.join(ctx.root, basename(name)), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await writeAll(h, bytes); await h.sync(); } finally { await h.close(); }
}
async function writeAll(h, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const { bytesWritten } = await h.write(bytes, offset, bytes.length - offset, null);
    if (bytesWritten <= 0) throw Error('No write progress');
    offset += bytesWritten;
  }
}
async function syncDir(ctx) {
  await checkRoot(ctx);
  const h = await fs.open(ctx.root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { await h.sync(); } finally { await h.close(); }
}
function boundary(stop, at) {
  if (stop === at) {
    // Synchronous write guarantees parent sees the marker before SIGKILL.
    process.stdout.write(`REACHED:${at}\n`, () => process.kill(process.pid, 'SIGKILL'));
    return new Promise(() => {});
  }
}
async function publish(ctx, name, bytes, stop, kind) {
  try {
    const existing = await readOwned(ctx, name, bytes.length);
    if (!existing.equals(bytes)) throw Error(`Immutable collision: ${name}`);
    return;
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const stage = `${name}.stage-${randomUUID()}`;
  await checkRoot(ctx);
  const h = await fs.open(path.join(ctx.root, stage), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    if (kind === 'media') {
      await writeAll(h, bytes.subarray(0, 16));
      await boundary(stop, 'media-partial');
      await writeAll(h, bytes.subarray(16));
    } else await writeAll(h, bytes);
    await h.sync();
    await boundary(stop, `${kind}-synced`);
  } finally { await h.close(); }
  try { await fs.link(path.join(ctx.root, stage), path.join(ctx.root, name)); }
  catch (e) { if (e.code !== 'EEXIST' || !(await readOwned(ctx, name, bytes.length)).equals(bytes)) throw e; }
  await syncDir(ctx);
  await boundary(stop, `${kind}-published`);
}
const mediaMeta = (name, bytes) => ({ name, bytes: bytes.length, format: 'f32le-interleaved', frames: 4, sampleRate: 48000, layout: ['L','R'], sha256: sha256(bytes) });
export function generation(id) {
  if (!['g0','g1'].includes(id)) throw Error('Invalid generation ID');
  return { profile: 'linked-media-v1-reconstruction', id, operationId: id === 'g0' ? 'initial' : 'explicit-update-1',
    sourceRevision: id === 'g0' ? 'drums-r1' : 'drums-r2', media: mediaMeta(`${id}.f32`, id === 'g0' ? OLD : NEW),
    destination: { gainDb: -3, eq: [{ frequencyHz: 1000, gainDb: -2 }], placementFrame: 120 },
    unrelated: mediaMeta('unrelated.f32', UNRELATED), history: id === 'g0' ? [] : [pointer('g0')] };
}
export const generationBytes = id => json(generation(id));
export function pointer(id) { return { generation: id, sha256: sha256(generationBytes(id)) }; }
export const journalBytes = () => json({ operationId: 'explicit-update-1', previous: pointer('g0'), next: pointer('g1') });
async function validatePointer(ctx, p) {
  if (!p || !['g0','g1'].includes(p.generation) || JSON.stringify(p) !== JSON.stringify(pointer(p.generation))) throw Error('Invalid pointer/checksum');
  const bytes = await readOwned(ctx, `${p.generation}.json`);
  if (sha256(bytes) !== p.sha256 || !bytes.equals(generationBytes(p.generation))) throw Error('Invalid generation');
  const g = JSON.parse(bytes);
  for (const m of [g.media, g.unrelated]) {
    const audio = await readOwned(ctx, m.name, 32);
    if (audio.length !== m.bytes || sha256(audio) !== m.sha256) throw Error('Invalid media');
    for (let i = 0; i < audio.length; i += 4) if (!Number.isFinite(audio.readFloatLE(i))) throw Error('Nonfinite media');
  }
  for (const prior of g.history) await validatePointer(ctx, prior);
  return g;
}
export async function recover(ctx) {
  await checkRoot(ctx);
  let headError;
  try { return { generation: await validatePointer(ctx, JSON.parse(await readOwned(ctx, 'HEAD.json', 1024))), needsRepair: false }; }
  catch (e) { headError = e.message; }
  try {
    const bytes = await readOwned(ctx, 'journal.json', 2048);
    if (!bytes.equals(journalBytes())) throw Error('Invalid journal');
    return { generation: await validatePointer(ctx, JSON.parse(bytes).previous), needsRepair: true, headError };
  } catch (e) { throw Error(`No complete recovery route: HEAD: ${headError}; previous: ${e.message}`); }
}
export async function initialize() {
  const ctx = await createRoot();
  await exclusiveWrite(ctx, 'g0.f32', OLD);
  await exclusiveWrite(ctx, 'unrelated.f32', UNRELATED);
  await exclusiveWrite(ctx, 'g0.json', generationBytes('g0'));
  await exclusiveWrite(ctx, 'HEAD.json', json(pointer('g0')));
  await syncDir(ctx);
  return ctx;
}
export async function update(ctx, stop = '') {
  if (ctx.profile !== 'linked-media' || (stop && !BOUNDARIES.includes(stop))) throw Error('Invalid writer request');
  const current = await recover(ctx);
  if (current.needsRepair) throw Error('Explicit repair required before writes');
  if (current.generation.id === 'g1') return { alreadyCommitted: true };
  await publish(ctx, 'g1.f32', NEW, stop, 'media');
  await publish(ctx, 'g1.json', generationBytes('g1'), stop, 'generation');
  await publish(ctx, 'journal.json', journalBytes(), stop, 'journal');
  await validatePointer(ctx, pointer('g1'));
  const stage = `HEAD.json.stage-${randomUUID()}`;
  await exclusiveWrite(ctx, stage, json(pointer('g1')));
  await boundary(stop, 'pointer-synced');
  await fs.rename(path.join(ctx.root, stage), path.join(ctx.root, 'HEAD.json'));
  await boundary(stop, 'pointer-renamed');
  await syncDir(ctx);
  await boundary(stop, 'directory-synced');
  return { alreadyCommitted: false };
}
export function child(ctx, mode, stop = '') {
  return spawnSync(process.execPath, [SCRIPT, '--child', mode, ctx.root, ctx.owner, stop], { encoding: 'utf8', timeout: 20000, env: { PATH: process.env.PATH, TMPDIR: tmpdir() }, maxBuffer: 1024 * 1024 });
}
export function requireChild(result) {
  if (result.error || result.signal || result.status !== 0) throw Error(`Child failed: ${result.error?.message || result.signal || result.stderr}`);
  return JSON.parse(result.stdout);
}
async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--child') {
    if (args.length !== 5 || !['read','write'].includes(args[1])) throw Error('Invalid child invocation');
    const ctx = { root: args[2], owner: args[3], profile: 'linked-media' };
    console.log(JSON.stringify(args[1] === 'read' ? await recover(ctx) : await update(ctx, args[4])));
    return;
  }
  if (args.length) throw Error('No arbitrary root/options accepted');
  if (process.platform !== 'linux') { console.log(JSON.stringify({ skipped: true, reason: 'Linux only' })); return; }
  const rows = [];
  for (const stop of [...BOUNDARIES, '']) {
    const ctx = await initialize();
    const writer = child(ctx, 'write', stop);
    if (stop ? writer.signal !== 'SIGKILL' || !writer.stdout.includes(`REACHED:${stop}\n`) : writer.status !== 0) throw Error(`Writer did not reach ${stop}: ${writer.stderr}`);
    const recovered = requireChild(child(ctx, 'read'));
    const expected = !stop || ['pointer-renamed','directory-synced'].includes(stop) ? 'g1' : 'g0';
    if (recovered.generation.id !== expected || recovered.needsRepair) throw Error('Unexpected recovery');
    rows.push({ boundary: stop || 'complete', root: ctx.root, recovered: expected });
  }
  console.log(JSON.stringify({ kind: 'CORE-009-reconstruction', platform: process.platform, filesystemType: `0x${(await fs.statfs(rows[0].root)).type.toString(16)}`, rows }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) main().catch(e => { console.error(e.stack); process.exitCode = 1; });
