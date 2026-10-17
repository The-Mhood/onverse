import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSnapshot, createSelection, projectDependencies, dependencyKey, observeCurrentness } from '../../src/domain/linkedSessions/linkedSessionContract.js';
const track = (trackId, gain = 1) => ({ trackId, audioRevisionId: `${trackId}-r1`, label: trackId,
  assetId: `${trackId}-pcm`, sha256: 'a'.repeat(64), frames: 2048, startFrame: 0, gain, muted: false });
const source = () => ({ schemaVersion: 1, sessionId: 'source-a', revisionId: 'snapshot-1',
  sampleRate: 48000, layout: ['L','R'], tracks: [track('conga', .5), track('other'), track('vocal')] });
const selection = () => ({ groupId: 'drums', definitionRevisionId: 'drums-def-1', trackIds: ['conga','other'], rangeStartFrame: 0, rangeEndFrame: 4096 });
const observe = (used, next, selected = selection(), availableSelection = selected) => observeCurrentness(used, selected, next, availableSelection, 123);

test('validated snapshots and selections are independent deeply immutable metadata', () => {
  const input = source(), chosen = selection(), snapshot = createSnapshot(input), selected = createSelection(chosen);
  input.tracks[0].gain = 3; chosen.trackIds.push('vocal');
  assert.equal(snapshot.tracks[0].gain, .5); assert.deepEqual(selected.trackIds, ['conga','other']);
  assert.throws(() => { snapshot.tracks[0].gain = 2; }, TypeError);
  assert.throws(() => { selected.trackIds.push('vocal'); }, TypeError);
});
test('exact selected IDs/order, immutable asset identities and revision dependencies are projected', () => {
  const projection = projectDependencies(source(), selection());
  assert.deepEqual(projection.members.map(t => t.trackId), ['conga','other']);
  assert.equal(projection.members[0].audioRevisionId, 'conga-r1');
  assert.equal(projection.members[0].assetId, 'conga-pcm');
  assert.equal(projection.members[0].sha256, 'a'.repeat(64));
  assert.equal(Object.hasOwn(projection, 'revisionId'), false);
  assert.equal(Object.hasOwn(projection.members[0], 'label'), false);
  assert.ok(Object.isFrozen(projection.members[0]));
});
test('unrelated Vocal edit advances observed revision but does not stale Drums', () => {
  const used = source(), next = source(); next.revisionId = 'snapshot-2'; next.tracks[2].gain = 4; next.tracks[2].audioRevisionId = 'vocal-r2';
  assert.equal(dependencyKey(used, selection()), dependencyKey(next, selection()));
  assert.deepEqual(observe(used, next), { usedRevisionId: 'snapshot-1', availableRevisionId: 'snapshot-2', observedAt: 123, status: 'current' });
});
test('relevant Conga edit marks update available without mutating the used snapshot', () => {
  const used = createSnapshot(source()), next = source(); next.revisionId = 'snapshot-2'; next.tracks[0].gain = 1; next.tracks[0].audioRevisionId = 'conga-r2';
  assert.equal(observe(used, next).status, 'update-available'); assert.equal(used.tracks[0].gain, .5);
  // No destination object/pointer is accepted by this observation operation.
});
test('rename alone is metadata-only even when the session revision advances', () => {
  const next = source(); next.revisionId = 'renamed'; next.tracks[0].label = 'New Conga Name';
  assert.equal(observe(source(), next).status, 'current');
});
test('same-name deleted/recreated source cannot rebind the selection', () => {
  const next = source(); next.tracks[0].trackId = 'replacement-conga';
  assert.equal(observe(source(), next).status, 'unavailable');
  assert.throws(() => projectDependencies(next, selection()), /Missing selected track/);
});
test('group membership, definition revision or order changes require explicit review', () => {
  for (const change of [s => { s.trackIds.push('vocal'); }, s => { s.definitionRevisionId = 'drums-def-2'; }, s => { s.trackIds.reverse(); }]) {
    const nextSelection = selection(); change(nextSelection);
    assert.equal(observe(source(), source(), selection(), nextSelection).status, 'review-required');
  }
});
test('offline source remains unknown, not an instruction to replace owned committed media', () => {
  assert.deepEqual(observe(source(), null), { usedRevisionId: 'snapshot-1', availableRevisionId: null, observedAt: 123, status: 'unknown', reason: 'source-unavailable' });
});
test('another session identity requires explicit review', () => {
  const next = source(); next.sessionId = 'another-source';
  assert.equal(observe(source(), next).reason, 'source-identity-changed');
});
test('all supported audio/control changes affect relevant dependencies', () => {
  for (const [key, value] of [['audioRevisionId','r2'], ['assetId','replacement-pcm'], ['sha256','b'.repeat(64)], ['frames',1024], ['startFrame',64], ['gain',.25], ['muted',true]]) {
    const next = source(); next.tracks[0][key] = value;
    assert.notEqual(dependencyKey(source(),selection()),dependencyKey(next,selection()), key);
  }
});
test('malformed/imported unsupported fields fail before mutation', () => {
  for (const mutate of [s => { s.sampleRate = 44100; }, s => { s.layout = ['R','L']; }, s => { s.tracks[0].gain = Infinity; }, s => { s.tracks[0].gain = 5; }, s => { s.tracks[0].startFrame = .5; }, s => { s.tracks[0].frames = 4097; }, s => { s.tracks[0].routing = ['hidden-sidechain']; }, s => { s.tracks[0].sha256 = '../media'; }, s => { s.tracks.push({...s.tracks[0]}); }, s => { s.rawAudio = [1,2]; }]) {
    const candidate = source(); mutate(candidate); const before = structuredClone(candidate);
    assert.throws(() => createSnapshot(candidate)); assert.deepEqual(candidate, before);
  }
});
test('invalid or ambiguous selections reject and never infer names/membership', () => {
  for (const mutate of [s => { s.trackIds = []; }, s => { s.trackIds = ['conga','conga']; }, s => { s.trackIds = ['../conga']; }, s => { s.rangeEndFrame = 8192; }, s => { s.rangeStartFrame = 1; }, s => { s.tap = 'bus'; }]) {
    const candidate = selection(); mutate(candidate); assert.throws(() => createSelection(candidate));
  }
});
test('observation time and source/selection validation failures are not swallowed', () => {
  assert.throws(() => observeCurrentness(source(), selection(), source(), selection(), -1));
  const invalid = source(); invalid.tracks[0].gain = NaN;
  assert.throws(() => observe(source(), invalid), /gain/);
});

test('sparse source and selection arrays fail closed instead of passing validation', () => {
  const snapshot = source(); snapshot.tracks = Array(1);
  assert.throws(() => createSnapshot(snapshot), /track fields/);
  const selected = selection(); selected.trackIds = Array(1);
  assert.throws(() => createSelection(selected), /stable ID/);
});
