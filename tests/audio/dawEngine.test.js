// Controlled graph-policy/encoding tests. Native Chromium rendering is separate.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scheduleProject, encodeMixWav, validateBuffer } from '../../src/audio/daw/engine.js'
import { applyCommand } from '../../src/domain/daw/project.js'
import { dawFixture } from '../fixtures/dawFixture.js'
function context() {
  const calls = [], nodes = []
  const make = type => { const node = { gain: {}, pan: {}, connect: x => calls.push(['connect', type, x]), disconnect: () => calls.push(['disconnect', type]), start: (...args) => calls.push(['start', ...args]), stop: () => calls.push(['stop']) }; nodes.push([type, node]); return node }
  return { calls, nodes, currentTime: 10, destination: {}, createGain: () => make('gain'), createStereoPanner: () => make('pan'), createBufferSource: () => make('source') }
}
test('native schedule uses exact clip offsets/durations and shared gain-pan topology', () => {
  const f = dawFixture(), ctx = context()
  const project = applyCommand(f.project, { type: 'editClip', clipId: 'clip-a', trackId: 'track-a', startFrame: 2400, offsetFrames: 1200, durationFrames: 2400 })
  const graph = scheduleProject(ctx, project, f.assets, 3600, 12)
  assert.deepEqual(ctx.calls.find(c => c[0] === 'start'), ['start', 12, .05, .025]); assert.equal(graph.sourceCount, 1)
  assert.equal(ctx.nodes.find(n => n[0] === 'gain')[1].gain.value, 1); assert.equal(ctx.nodes.find(n => n[0] === 'pan')[1].pan.value, 0)
  graph.stop(); assert.ok(ctx.calls.some(c => c[0] === 'stop'))
})
test('future clips schedule against the same absolute audio clock, not sequential timers', () => {
  const f = dawFixture(), ctx = context()
  const project = applyCommand(f.project, { type: 'moveClip', clipId: 'clip-a', trackId: 'track-a', startFrame: 48000 })
  scheduleProject(ctx, project, f.assets, 0, 10); assert.deepEqual(ctx.calls.find(c => c[0] === 'start'), ['start', 11, 0, .1])
})
test('muted/ended clips are not scheduled; missing assets fail closed and stop partial graph', () => {
  const f = dawFixture(), ctx = context()
  assert.equal(scheduleProject(ctx, f.project, f.assets, 4800).sourceCount, 0)
  const muted = applyCommand(f.project, { type: 'setTrack', trackId: 'track-a', patch: { muted: true } })
  assert.equal(scheduleProject(ctx, muted, f.assets).sourceCount, 0)
  assert.throws(() => scheduleProject(ctx, f.project, new Map()), /ASSET_UNAVAILABLE/)
  assert.ok(ctx.calls.some(c => c[0] === 'disconnect')); assert.throws(() => scheduleProject(ctx, f.project, f.assets, -.5))
})
test('float WAV preserves over-range, signed zero, exact geometry and input bytes', async () => {
  const { buffer } = dawFixture(); buffer.getChannelData(0)[0] = 1.5; buffer.getChannelData(1)[0] = -0
  const result = encodeMixWav(buffer), view = new DataView(await result.blob.arrayBuffer())
  assert.equal(result.peak, 1.5); assert.equal(view.getUint16(20, true), 3); assert.equal(view.getUint32(24, true), 48000)
  assert.equal(view.getFloat32(44, true), 1.5); assert.ok(Object.is(view.getFloat32(48, true), -0)); assert.equal(buffer.getChannelData(0)[0], 1.5)
})
test('nonfinite PCM is rejected instead of silently normalized', () => {
  const { buffer } = dawFixture(); buffer.getChannelData(0)[2] = NaN
  assert.throws(() => validateBuffer(buffer)); assert.throws(() => encodeMixWav(buffer))
})
