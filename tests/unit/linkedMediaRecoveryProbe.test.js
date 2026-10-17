import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { BOUNDARIES, OLD, NEW, initialize, update, recover, child, requireChild,
  pointer, generationBytes, journalBytes, checkRoot, sha256, createRoot } from '../../scripts/validation/linked-media-recovery-probe.mjs';

const linux = { skip: process.platform !== 'linux' ? 'Linux filesystem fixture only' : false };
const put = (ctx, name, bytes) => fs.writeFile(path.join(ctx.root, name), bytes);
async function inventory(ctx) {
  return Promise.all((await fs.readdir(ctx.root)).sort().map(async name => {
    const s = await fs.lstat(path.join(ctx.root, name));
    return [name, s.ino, s.size, s.mtimeMs, sha256(await fs.readFile(path.join(ctx.root, name)))];
  }));
}
test('initial g0 reopens in another process without a journal', linux, async () => {
  const ctx = await initialize();
  const r = requireChild(child(ctx, 'read'));
  assert.equal(r.generation.id, 'g0'); assert.equal(r.needsRepair, false);
  await assert.rejects(fs.stat(path.join(ctx.root, 'journal.json')), { code: 'ENOENT' });
});
for (const [index, stop] of BOUNDARIES.entries()) test(`SIGKILL ${stop}: actual artifacts and separate-process recovery`, linux, async () => {
  const ctx = await initialize();
  const w = child(ctx, 'write', stop);
  assert.equal(w.error, undefined); assert.equal(w.signal, 'SIGKILL');
  assert.equal(w.stdout, `REACHED:${stop}\n`);
  const names = await fs.readdir(ctx.root);
  const stage = prefix => names.filter(n => n.startsWith(`${prefix}.stage-`));
  assert.equal(stage('g1.f32').length, 1);
  const stagedMedia = await fs.readFile(path.join(ctx.root, stage('g1.f32')[0]));
  assert.equal(stagedMedia.length, index === 0 ? 16 : 32);
  assert.deepEqual(stagedMedia, NEW.subarray(0, stagedMedia.length));
  assert.equal(names.includes('g1.f32'), index >= 2);
  if (index >= 2) assert.deepEqual(await fs.readFile(path.join(ctx.root, 'g1.f32')), NEW);
  assert.equal(stage('g1.json').length, index >= 3 ? 1 : 0);
  assert.equal(names.includes('g1.json'), index >= 4);
  if (index >= 4) assert.deepEqual(await fs.readFile(path.join(ctx.root, 'g1.json')), generationBytes('g1'));
  assert.equal(stage('journal.json').length, index >= 5 ? 1 : 0);
  assert.equal(names.includes('journal.json'), index >= 6);
  if (index >= 6) assert.deepEqual(await fs.readFile(path.join(ctx.root, 'journal.json')), journalBytes());
  assert.equal(stage('HEAD.json').length, index === 7 ? 1 : 0);
  if (index >= 3) assert.deepEqual(await fs.readFile(path.join(ctx.root, stage('g1.json')[0])), generationBytes('g1'));
  if (index >= 5) assert.deepEqual(await fs.readFile(path.join(ctx.root, stage('journal.json')[0])), journalBytes());
  if (index === 7) assert.deepEqual(JSON.parse(await fs.readFile(path.join(ctx.root, stage('HEAD.json')[0]))), pointer('g1'));
  const r = requireChild(child(ctx, 'read'));
  assert.equal(r.generation.id, index >= 8 ? 'g1' : 'g0'); assert.equal(r.needsRepair, false);
});
test('normal completion retains over-range Float32, destination metadata, unrelated media and g0 history', linux, async () => {
  const ctx = await initialize(); requireChild(child(ctx, 'write'));
  const r = requireChild(child(ctx, 'read'));
  assert.equal(r.generation.id, 'g1'); assert.deepEqual(r.generation.history, [pointer('g0')]);
  assert.deepEqual(r.generation.destination, { gainDb: -3, eq: [{ frequencyHz: 1000, gainDb: -2 }], placementFrame: 120 });
  assert.deepEqual(await fs.readFile(path.join(ctx.root, 'g1.f32')), NEW);
  assert.equal(NEW.readFloatLE(20), -2);
  assert.deepEqual(await fs.readFile(path.join(ctx.root, 'g0.f32')), OLD);
});
test('post-commit idempotent retry makes no extra writes or history', linux, async () => {
  const ctx = await initialize(); await update(ctx); const before = await inventory(ctx);
  assert.deepEqual(requireChild(child(ctx, 'write')), { alreadyCommitted: true });
  assert.deepEqual(await inventory(ctx), before);
});
test('explicit pre-promotion retry reuses immutable names without replacement', linux, async () => {
  const ctx = await initialize(); const w = child(ctx, 'write', 'journal-published'); assert.equal(w.signal, 'SIGKILL');
  const before = (await inventory(ctx)).filter(([n]) => ['g1.f32','g1.json','journal.json'].includes(n));
  requireChild(child(ctx, 'write'));
  assert.deepEqual((await inventory(ctx)).filter(([n]) => ['g1.f32','g1.json','journal.json'].includes(n)), before);
  assert.equal((await recover(ctx)).generation.id, 'g1');
});
const fallbackCases = [
  ['missing pointer', ctx => fs.unlink(path.join(ctx.root, 'HEAD.json'))],
  ['malformed pointer', ctx => put(ctx, 'HEAD.json', '{')],
  ['oversized pointer', ctx => put(ctx, 'HEAD.json', Buffer.alloc(1025))],
  ['missing generation', ctx => fs.unlink(path.join(ctx.root, 'g1.json'))],
  ['corrupt generation', ctx => put(ctx, 'g1.json', '{}')],
  ['truncated media', ctx => put(ctx, 'g1.f32', NEW.subarray(0, 28))],
  ['same-length corrupt media', ctx => { const b = Buffer.from(NEW); b[0] ^= 1; return put(ctx, 'g1.f32', b); }],
  ['traversal generation ID', ctx => put(ctx, 'HEAD.json', JSON.stringify({ generation: '../g0', sha256: pointer('g0').sha256 }))],
  ['forged checksum', ctx => put(ctx, 'HEAD.json', JSON.stringify({ ...pointer('g1'), sha256: '0'.repeat(64) }))],
];
for (const [name, corrupt] of fallbackCases) test(`${name}: validated previous generation, no reader mutation, writer refuses`, linux, async () => {
  const ctx = await initialize(); await update(ctx); await corrupt(ctx);
  const before = await inventory(ctx);
  const r = requireChild(child(ctx, 'read'));
  assert.equal(r.generation.id, 'g0'); assert.equal(r.needsRepair, true);
  assert.deepEqual(await inventory(ctx), before);
  const w = child(ctx, 'write'); assert.notEqual(w.status, 0); assert.match(w.stderr, /repair required/);
  assert.deepEqual(await inventory(ctx), before);
});
for (const name of ['g0.json','g0.f32','unrelated.f32']) test(`corrupt retained dependency ${name}: no complete route`, linux, async () => {
  const ctx = await initialize(); await update(ctx); await put(ctx, name, 'corrupt');
  const r = child(ctx, 'read'); assert.notEqual(r.status, 0); assert.match(r.stderr, /No complete recovery route/);
});
test('invalid pending journal cannot override valid HEAD; invalid journal cannot recover broken HEAD', linux, async () => {
  const ctx = await initialize(); await put(ctx, 'journal.json', '{}');
  assert.equal(requireChild(child(ctx, 'read')).generation.id, 'g0');
  await put(ctx, 'HEAD.json', '{}'); assert.notEqual(child(ctx, 'read').status, 0);
});
test('never scans newer orphan generation or rolls forward; fallback returns only previous', linux, async () => {
  const ctx = await initialize(); child(ctx, 'write', 'generation-published');
  assert.equal(requireChild(child(ctx, 'read')).generation.id, 'g0');
  await fs.unlink(path.join(ctx.root, 'HEAD.json'));
  assert.notEqual(child(ctx, 'read').status, 0);
  await put(ctx, 'journal.json', journalBytes());
  const r = requireChild(child(ctx, 'read')); assert.equal(r.generation.id, 'g0'); assert.equal(r.needsRepair, true);
});
test('immutable collision refuses replacement', linux, async () => {
  const ctx = await initialize(); await put(ctx, 'g1.f32', Buffer.alloc(32));
  await assert.rejects(update(ctx), /Immutable collision/);
  assert.equal((await recover(ctx)).generation.id, 'g0');
});
test('wrong ownership token and non-temporary/repository roots refused', linux, async () => {
  const ctx = await initialize();
  await assert.rejects(checkRoot({ ...ctx, owner: '00000000-0000-4000-8000-000000000000' }), /Ownership mismatch/);
  for (const root of [process.cwd(), tmpdir(), '/']) await assert.rejects(checkRoot({ ...ctx, root }), /temporary probe root/);
});
test('matching foreign media bytes behind symlink are refused', linux, async () => {
  const ctx = await initialize(); const foreign = await initialize();
  await fs.unlink(path.join(ctx.root, 'g0.f32'));
  await fs.symlink(path.join(foreign.root, 'g0.f32'), path.join(ctx.root, 'g0.f32'));
  await assert.rejects(recover(ctx), /No complete recovery route/);
});

test('environment-controlled TMPDIR cannot authorize a non-system-temp root', linux, async () => {
  // Do not create fixture files in an arbitrary path: redirect only to this
  // already-private owned fixture, then ensure rejection before any new write.
  const ctx = await initialize();
  const before = await fs.readdir(ctx.root);
  const previous = process.env.TMPDIR;
  try {
    process.env.TMPDIR = ctx.root;
    await assert.rejects(createRoot(), /Unapproved temporary parent/);
    await assert.rejects(createRoot('offline-render'), /Unapproved temporary parent/);
    await assert.rejects(checkRoot(ctx), /Unapproved temporary parent/);
    assert.deepEqual(await fs.readdir(ctx.root), before);
  } finally {
    if (previous === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previous;
  }
});
