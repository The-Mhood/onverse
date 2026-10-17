import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodePCM, decodePCM, hashPCM } from '../../src/audio/linkedSessions/pcm.js';
import { renderSelection } from '../../src/audio/linkedSessions/renderSelection.js';

const pcm = () => encodePCM([new Float32Array([1.75, -0, 0]), new Float32Array([0, -2, 0])]);
async function fixture() {
  const bytes = pcm(), sha256 = await hashPCM(bytes);
  const track = id => ({ trackId: id, audioRevisionId: 'audio-1', label: id, assetId: id + '-pcm', sha256, frames: 3, startFrame: 64, gain: .5, muted: false });
  return { snapshot: { schemaVersion: 1, sessionId: 'source', revisionId: 'rev-1', sampleRate: 48000, layout: ['L','R'], tracks: [track('a'), track('unselected')] },
    selection: { groupId: 'drums', definitionRevisionId: 'def-1', trackIds: ['a'], rangeStartFrame: 0, rangeEndFrame: 4096 }, bytes };
}
// Wiring spy ONLY; this never proves native DSP/sample values.
function wiring() {
  const calls = [], nodes = [];
  const context = {
    destination: {},
    createBuffer(channels, frames, rate) { calls.push(['buffer', channels, frames, rate]); return { copyToChannel(data, c) { calls.push(['channel', c, Array.from(data)]); } }; },
    createBufferSource() { const n = { connect(to) { n.to = to; }, start(t) { calls.push(['start', t]); }, disconnect() { n.disconnected = true; } }; nodes.push(n); return n; },
    createGain() { const n = { gain: { value: 1 }, connect(to) { n.to = to; }, disconnect() { n.disconnected = true; } }; nodes.push(n); return n; },
    async startRendering() { return { length: 4096, sampleRate: 48000, numberOfChannels: 2, getChannelData: () => new Float32Array(4096) }; }
  };
  return { context, calls, nodes, createOfflineContext(...args) { calls.push(['context', ...args]); return context; } };
}
test('canonical PCM preserves over-range, signed zero and byte offsets', () => {
  const bytes = pcm(), padded = new Uint8Array(bytes.length + 9); padded.set(bytes, 5);
  const channels = decodePCM(padded.subarray(5, 5 + bytes.length), 3);
  assert.equal(channels[0][0], 1.75); assert.equal(channels[1][1], -2);
  assert.ok(Object.is(channels[0][1], -0)); assert.deepEqual(encodePCM(channels), bytes);
});
test('PCM rejects sparse/wrong channels, invalid geometry and nonfinite samples', () => {
  for (const x of [[], Array(2), [new Float32Array(1)], [new Float32Array(2), new Float32Array(1)], [new Float64Array(1), new Float64Array(1)]]) assert.throws(() => encodePCM(x));
  for (const x of [NaN, Infinity, -Infinity]) {
    assert.throws(() => encodePCM([new Float32Array([x]), new Float32Array(1)]));
    const bytes = new Uint8Array(8); new DataView(bytes.buffer).setFloat32(0, x, true);
    assert.throws(() => decodePCM(bytes, 1));
  }
  for (const n of [0, .5, 4097]) assert.throws(() => decodePCM(new Uint8Array(8), n));
  assert.throws(() => decodePCM(new Uint8Array(9), 1));
});
test('hash copies bytes before async hashing', async () => {
  const bytes = pcm(), expected = await hashPCM(bytes), hashing = hashPCM(bytes); bytes.fill(0);
  assert.equal(await hashing, expected); assert.notEqual(await hashPCM(bytes), expected);
});
test('selected media only; exact native geometry, starts, gain and disconnect wiring', async () => {
  const f = await fixture(), spy = wiring(), loaded = [];
  await renderSelection({ ...f, loadAsset: async id => { loaded.push(id); return f.bytes; }, createOfflineContext: spy.createOfflineContext });
  assert.deepEqual(loaded, ['a-pcm']);
  assert.deepEqual(spy.calls[0], ['context', 2, 4096, 48000]);
  assert.ok(spy.calls.some(c => c[0] === 'start' && c[1] === 64 / 48000));
  assert.equal(spy.nodes[1].gain.value, .5); assert.ok(spy.nodes.every(n => n.disconnected));
});
test('muted member stays a validated dependency but has zero native gain', async () => {
  const f = await fixture(), spy = wiring(); f.snapshot.tracks[0].muted = true;
  await renderSelection({ ...f, loadAsset: async () => f.bytes, createOfflineContext: spy.createOfflineContext });
  assert.equal(spy.nodes[1].gain.value, 0);
});
test('missing/corrupt/nonfinite assets reject before native graph construction', async () => {
  for (const load of [async () => undefined, async () => new Uint8Array(3), async () => new Uint8Array(24), async () => { throw Error('offline'); }]) {
    const f = await fixture(), spy = wiring();
    await assert.rejects(renderSelection({ ...f, loadAsset: load, createOfflineContext: spy.createOfflineContext }));
    assert.equal(spy.calls.length, 0);
  }
});
test('all selected assets must validate before building even the first source', async () => {
  const f = await fixture(), spy = wiring(); f.selection.trackIds.push('unselected');
  await assert.rejects(renderSelection({ ...f, loadAsset: async id => id === 'a-pcm' ? f.bytes : new Uint8Array(24), createOfflineContext: spy.createOfflineContext }), /checksum/);
  assert.equal(spy.calls.length, 0);
});
test('missing native engine is not silently replaced by JS summation', async () => {
  const f = await fixture(); assert.equal(typeof globalThis.OfflineAudioContext, 'undefined');
  await assert.rejects(renderSelection({ ...f, loadAsset: async () => f.bytes }), /OfflineAudioContext/);
});
test('render failure and invalid native geometry disconnect all created nodes', async () => {
  for (const output of [async () => { throw Error('native failure'); }, async () => ({ length: 1 })]) {
    const f = await fixture(), spy = wiring(); spy.context.startRendering = output;
    await assert.rejects(renderSelection({ ...f, loadAsset: async () => f.bytes, createOfflineContext: spy.createOfflineContext }));
    assert.ok(spy.nodes.every(n => n.disconnected));
  }
});
test('partial graph construction disconnects a source if gain creation fails', async () => {
  const f = await fixture(), spy = wiring();
  spy.context.createGain = () => { throw Error('gain setup failed'); };
  await assert.rejects(renderSelection({ ...f, loadAsset: async () => f.bytes, createOfflineContext: spy.createOfflineContext }), /gain setup failed/);
  assert.ok(spy.nodes[0].disconnected);
});
test('disconnect errors retain the primary error and do not skip remaining nodes', async () => {
  const f = await fixture(), spy = wiring(), original = spy.context.createBufferSource;
  spy.context.createBufferSource = () => { const n = original(); n.disconnect = () => { n.disconnected = true; throw Error('disconnect failed'); }; return n; };
  spy.context.startRendering = async () => { throw Error('render failed'); };
  await assert.rejects(renderSelection({ ...f, loadAsset: async () => f.bytes, createOfflineContext: spy.createOfflineContext }), error => {
    assert.ok(error instanceof AggregateError); assert.match(error.errors[0].message, /render failed/); assert.match(error.errors[1].message, /disconnect failed/); return true;
  });
  assert.ok(spy.nodes.every(n => n.disconnected));
});
