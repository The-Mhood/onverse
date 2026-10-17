import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLinkedUpdateService } from '../../src/application/linkedSessions/linkedUpdateService.js';
import { dependencyKey } from '../../src/domain/linkedSessions/linkedSessionContract.js';
import { hashPCM } from '../../src/audio/linkedSessions/pcm.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
async function setup() {
  const track = id => ({ trackId: id, audioRevisionId: 'audio-1', label: id, assetId: id + '-pcm', sha256: 'a'.repeat(64), frames: 32, startFrame: 0, gain: .5, muted: false });
  const state = { snapshot: { schemaVersion: 1, sessionId: 'source', revisionId: 'rev-1', sampleRate: 48000, layout: ['L','R'], tracks: [track('a'), track('vocal')] },
    selection: { groupId: 'drums', definitionRevisionId: 'def-1', trackIds: ['a'], rangeStartFrame: 0, rangeEndFrame: 4096 } };
  const destination = { targetId: 'linked', linkRevisionId: 'link-1', linkedVersionId: 'version-1', sampleRate: 48000, layout: ['L','R'], processors: ['eq'], unrelated: 'vocal-1' };
  const bytes = new Uint8Array(4096 * 8), rendered = { bytes, sha256: await hashPCM(bytes), sampleRate: 48000, layout: ['L','R'], frames: 4096 };
  const calls = [], renderedInputs = [];
  // Contract double, NOT filesystem/atomicity/restart proof.
  const storage = {
    async prepare(media) { calls.push(['prepare', media]); return { token: 'prepared' }; },
    async commit(command) {
      calls.push(['commit', command]);
      if (destination.linkRevisionId !== command.expected.linkRevisionId ||
          dependencyKey(state.snapshot, state.selection) !== command.expectedSource.dependencyKey) throw Error('conditional conflict');
      destination.linkRevisionId = 'link-2'; destination.linkedVersionId = 'version-2';
      return { targetId: 'linked', versionId: 'version-2' };
    },
    async discard(value) { calls.push(['discard', value]); }
  };
  let counter = 0;
  const ports = { readSource: async () => state, readTarget: async () => destination,
    render: async input => { renderedInputs.push(input); return rendered; }, storage, makeId: () => 'id-' + ++counter };
  const service = createLinkedUpdateService(ports);
  const review = () => service.review({ groupId: 'drums', targetId: 'linked' });
  const start = async () => service.start(service.approve(await review()));
  return { state, destination, rendered, calls, storage, ports, service, review, start, renderedInputs };
}
test('explicit review/approval promotes only requested link; ordered correlated lifecycle', async () => {
  const f = await setup(), job = await f.start();
  assert.equal((await job.completion).status, 'completed');
  assert.deepEqual(f.calls.map(c => c[0]), ['prepare','commit']);
  assert.deepEqual(f.destination.processors, ['eq']); assert.equal(f.destination.unrelated, 'vocal-1');
  assert.equal(f.destination.linkedVersionId, 'version-2');
  assert.deepEqual(job.events.map(e => e.phase), ['rendering','prepared','promoting','completed']);
  assert.deepEqual(job.events.map(e => e.sequence), [0,1,2,3]);
  assert.ok(job.events.every(e => e.operationId === job.operationId));
  assert.equal(f.calls[0][1].provenance.sourceRevisionId, 'rev-1');
  assert.ok(Object.isFrozen(f.renderedInputs[0].snapshot));
});
test('JSON/imported views and approval receipts cannot execute or replay', async () => {
  const f = await setup(), plan = await f.review();
  assert.throws(() => f.service.approve(structuredClone(plan)), /INVALID_APPROVAL/);
  const approval = f.service.approve(plan);
  assert.throws(() => f.service.approve(plan), /INVALID_APPROVAL/);
  assert.throws(() => f.service.start(structuredClone(approval)), /INVALID_APPROVAL/);
  const job = f.service.start(approval);
  assert.throws(() => f.service.start(approval), /INVALID_APPROVAL/);
  await job.completion;
});
test('relevant edit before execution rejects without rendering or storage', async () => {
  const f = await setup(), approval = f.service.approve(await f.review()); f.state.snapshot.tracks[0].gain = 1;
  const result = await f.service.start(approval).completion;
  assert.equal(result.error.code, 'STALE_SOURCE'); assert.equal(f.renderedInputs.length, 0); assert.deepEqual(f.calls, []);
});
test('unrelated edit/rename preserves eligibility and records the approved snapshot', async () => {
  const f = await setup(), approval = f.service.approve(await f.review());
  f.state.snapshot.tracks[1].gain = 3; f.state.snapshot.tracks[0].label = 'renamed'; f.state.snapshot.revisionId = 'rev-2';
  f.destination.processors.push('manual-compressor'); f.destination.unrelated = 'vocal-2';
  assert.equal((await f.service.start(approval).completion).status, 'completed');
  assert.equal(f.calls[0][1].provenance.sourceRevisionId, 'rev-1');
  assert.deepEqual(f.destination.processors, ['eq','manual-compressor']); assert.equal(f.destination.unrelated, 'vocal-2');
});
test('membership/identity/format/target changes and missing sources fail closed', async () => {
  for (const mutate of [f => { f.state.selection.definitionRevisionId = 'def-2'; }, f => { f.state.snapshot.sessionId = 'replacement'; },
    f => { f.state.snapshot.tracks[0].trackId = 'same-name-replacement'; }, f => { f.destination.linkRevisionId = 'manual-edit'; },
    f => { f.destination.sampleRate = 44100; }, f => { f.state.selection.groupId = 'another-group'; }]) {
    const f = await setup(), approval = f.service.approve(await f.review()); mutate(f);
    assert.equal((await f.service.start(approval).completion).status, 'failed'); assert.equal(f.calls.length, 0);
  }
  const f = await setup(); f.ports.readSource = async () => null;
  await assert.rejects(createLinkedUpdateService(f.ports).review({ groupId: 'drums', targetId: 'linked' }), /SOURCE_UNAVAILABLE/);
});
test('logical cancellation during uninterruptible render prevents preparation/promotion', async () => {
  const f = await setup(), gate = deferred(), entered = deferred();
  f.ports.render = async () => { entered.resolve(); return gate.promise; };
  const service = createLinkedUpdateService(f.ports), job = service.start(service.approve(await service.review({ groupId: 'drums', targetId: 'linked' })));
  await entered.promise; assert.equal(job.cancel(), 'accepted'); assert.equal(job.phase, 'rendering');
  gate.resolve(f.rendered); assert.equal((await job.completion).status, 'cancelled');
  assert.deepEqual(f.calls, []); assert.equal(f.destination.linkedVersionId, 'version-1');
});
test('cancel/relevant changes during preparation discard staging, preserve last-valid pointer', async () => {
  for (const mode of ['cancel','source','target']) {
    const f = await setup(), gate = deferred(), entered = deferred();
    f.storage.prepare = async media => { f.calls.push(['prepare',media]); entered.resolve(); return gate.promise; };
    const job = await f.start(); await entered.promise;
    if (mode === 'cancel') assert.equal(job.cancel(), 'accepted');
    if (mode === 'source') f.state.snapshot.tracks[0].muted = true;
    if (mode === 'target') f.destination.linkRevisionId = 'other-edit';
    gate.resolve({ token: 'prepared' }); const result = await job.completion;
    assert.equal(result.status, mode === 'cancel' ? 'cancelled' : 'failed');
    assert.deepEqual(f.calls.map(c => c[0]), ['prepare','discard']); assert.equal(f.destination.linkedVersionId, 'version-1');
  }
});
test('cancellation after promotion barrier is explicitly too-late, not cancelled/failed', async () => {
  const f = await setup(), gate = deferred(), entered = deferred(), original = f.storage.commit;
  f.storage.commit = async command => { entered.resolve(); await gate.promise; return original(command); };
  const job = await f.start(); await entered.promise;
  assert.equal(job.phase, 'promoting'); assert.equal(job.cancel(), 'too-late');
  gate.resolve(); assert.equal((await job.completion).status, 'completed'); assert.equal(job.cancel(), 'too-late');
});
test('throw/invalid receipt after entering commit is uncertain; never discard potentially promoted media', async () => {
  for (const commit of [async () => { throw Error('I/O after rename'); }, async () => ({ targetId: 'wrong', versionId: 'x' })]) {
    const f = await setup(); f.storage.commit = commit;
    const job = await f.start(), result = await job.completion;
    assert.equal(result.status, 'uncertain'); assert.equal(job.phase, 'uncertain'); assert.equal(job.cancel(), 'too-late');
    assert.deepEqual(f.calls.map(c => c[0]), ['prepare']);
  }
});
test('bad render geometry/hash/PCM never reaches staging', async () => {
  for (const mutate of [r => { r.frames = 1; }, r => { r.sha256 = 'b'.repeat(64); }, r => { new DataView(r.bytes.buffer).setFloat32(0, NaN, true); }]) {
    const f = await setup(); mutate(f.rendered);
    assert.equal((await (await f.start()).completion).status, 'failed'); assert.deepEqual(f.calls, []);
  }
});
test('primary and discard failure are both retained', async () => {
  const f = await setup(); f.storage.prepare = async () => { f.state.snapshot.tracks[0].gain = 1; return {}; };
  f.storage.discard = async () => { throw Error('cleanup failed'); };
  const result = await (await f.start()).completion;
  assert.equal(result.error.code, 'STALE_SOURCE'); assert.match(result.cleanupError.message, /cleanup failed/);
});
test('invalid ports, IDs and reused generated IDs fail before unsafe execution', async () => {
  assert.throws(() => createLinkedUpdateService({}), /ports/);
  const f = await setup(); await assert.rejects(f.service.review({ groupId: '../group', targetId: 'linked' }));
  const service = createLinkedUpdateService({ ...f.ports, makeId: () => 'constant' });
  const plan = await service.review({ groupId: 'drums', targetId: 'linked' });
  assert.throws(() => service.start(service.approve(plan)), /INVALID_OPERATION_ID/);
});
test('discard invalidates both pending plans and issued but unstarted approvals', async () => {
  const f = await setup(), plan = await f.review();
  assert.equal(f.service.discard(plan), 'discarded'); assert.throws(() => f.service.approve(plan), /INVALID_APPROVAL/);
  const another = await f.review(), receipt = f.service.approve(another);
  assert.equal(f.service.discard(another), 'discarded'); assert.throws(() => f.service.start(receipt), /INVALID_APPROVAL/);
  const third = await f.review(), job = f.service.start(f.service.approve(third));
  assert.equal(f.service.discard(third), 'too-late'); await job.completion;
});
test('uncertain promotion blocks new reviews and pre-issued approvals until durable reconciliation', async () => {
  const f = await setup(), first = f.service.approve(await f.review()), pending = f.service.approve(await f.review());
  f.storage.commit = async () => { throw Error('unknown pointer outcome'); };
  assert.equal((await f.service.start(first).completion).status, 'uncertain');
  await assert.rejects(f.review(), /RECOVERY_REQUIRED/);
  assert.throws(() => f.service.start(pending), /RECOVERY_REQUIRED/);
});

test('promotion carries exact source guard to the transaction, not only earlier async observations', async () => {
  const f = await setup(), originalRead = f.ports.readTarget;
  let reads = 0;
  f.ports.readTarget = async id => {
    // Review, pre-render, post-render, then final target read: change source
    // after service source observation but before the adapter commits.
    if (++reads === 4) f.state.snapshot.tracks[0].gain = 1;
    return originalRead(id);
  };
  const service = createLinkedUpdateService(f.ports);
  const job = service.start(service.approve(await service.review({ groupId: 'drums', targetId: 'linked' })));
  const result = await job.completion;
  assert.equal(result.status, 'uncertain'); // generic adapter error is conservative
  assert.equal(f.destination.linkedVersionId, 'version-1');
  const command = f.calls.find(c => c[0] === 'commit')[1];
  assert.equal(command.expectedSource.sessionId, 'source');
  assert.equal(command.expectedSource.groupId, 'drums');
  assert.notEqual(command.expectedSource.dependencyKey, dependencyKey(f.state.snapshot, f.state.selection));
});

test('review exposes exact bounded selected parameters, range and replaced version, not unrelated tracks', async () => {
  const f = await setup(), plan = await f.review();
  assert.equal(plan.action, 'replace-linked-version'); assert.equal(plan.previousVersionId, 'version-1');
  assert.deepEqual(plan.dependencies.members.map(t => t.trackId), ['a']);
  assert.equal(plan.dependencies.members[0].gain, .5); assert.equal(plan.dependencies.selection.rangeEndFrame, 4096);
  assert.ok(Object.isFrozen(plan.dependencies.members[0]));
  f.state.snapshot.tracks[0].gain = 1; assert.equal(plan.dependencies.members[0].gain, .5);
});
