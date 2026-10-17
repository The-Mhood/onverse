// Collaborator/lifetime/serialization tests, not native audio or filesystem proof.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDawController } from '../../src/application/daw/dawController.js'
import { serializeProject, deserializeProject, MAX_PROJECT_FILE_BYTES } from '../../src/application/daw/projectFile.js'
import { dawFixture, TestAudioBuffer } from '../fixtures/dawFixture.js'
const deferred = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j }); return { promise, resolve, reject } }
function setup(options = {}) {
  const f = dawFixture(), downloads = [], changes = [], calls = [], frames = new Map(); let nextFrame = 1
  class Context {
    currentTime = 0; state = 'running'; destination = {}
    constructor() { calls.push(['context', this]) }
    createGain() { return { gain: {}, connect() {}, disconnect() {} } }
    createStereoPanner() { return { pan: {}, connect() {}, disconnect() {} } }
    createBufferSource() { return { connect() {}, disconnect() {}, start: (...args) => calls.push(['start', ...args]), stop: () => calls.push(['stop']) } }
    async close() { calls.push(['close']) }
  }
  const platform = { crypto: globalThis.crypto, btoa, atob, AudioBuffer: TestAudioBuffer, AudioContext: Context,
    requestAnimationFrame: callback => { const id = nextFrame++; frames.set(id, callback); return id }, cancelAnimationFrame: id => frames.delete(id), ...options.platform }
  const engine = { async decode() { return f.buffer }, async render() { return f.buffer }, ...options.engine }
  const controller = createDawController({ audio: { saveBlob: (blob, name) => downloads.push({ blob, name }) }, engine, platform,
    onChange: state => changes.push(state), beforePlay: () => calls.push(['before-play']), ...options.ports })
  return { ...f, controller, downloads, changes, calls, frames, engine, platform }
}
const files = [{ name: 'One.wav', size: 100 }, { name: 'Two.wav', size: 100 }]
test('construction is idle, has no audio context and exposes immutable metadata only', () => {
  const t = setup(); assert.deepEqual(t.changes, []); assert.deepEqual(t.calls, []); assert.ok(Object.isFrozen(t.controller.getSnapshot().project)); assert.equal(t.controller.getSnapshot().project.tracks.length, 0)
})
test('multi-file import publishes one atomic operation and undo/redo retains exact source peaks', async () => {
  const t = setup(); assert.equal(await t.controller.importFiles(files), true)
  let s = t.controller.getSnapshot(); assert.equal(s.project.tracks.length, 2); assert.equal(s.project.clips.length, 2); assert.equal(s.dirty, true)
  const key = s.project.clips[0].id, peaks = t.controller.getWaveform(key, 10); assert.equal(peaks[0], .5)
  peaks[0] = 99; assert.equal(t.controller.getWaveform(key, 10)[0], .5)
  assert.equal(t.controller.undo(), true); assert.equal(t.controller.getSnapshot().project.tracks.length, 0)
  assert.equal(t.controller.redo(), true); assert.equal(t.controller.getWaveform(key, 10)[0], .5)
})
test('one failed decode preserves the exact old project and last-valid media', async () => {
  const t = setup(); await t.controller.importFiles(files.slice(0, 1)); const before = t.controller.getSnapshot().project
  let n = 0; t.engine.decode = async () => { if (++n === 2) throw Error('decode-failed'); return t.buffer }
  assert.equal(await t.controller.importFiles(files), false); assert.equal(t.controller.getSnapshot().project, before); assert.equal(t.controller.getSnapshot().error, 'decode-failed'); assert.equal(t.controller.getSnapshot().busy, false)
})
test('invalid command/private import cannot inject missing media or mutate last valid state', async () => {
  const t = setup(); await t.controller.importFiles(files.slice(0, 1)); const before = t.controller.getSnapshot().project
  assert.equal(t.controller.command({ type: 'addTracks', tracks: [], clips: [], assets: [] }), false)
  assert.equal(t.controller.command({ type: 'trimClip', clipId: before.clips[0].id, offsetFrames: 4000, durationFrames: 4000 }), false)
  assert.equal(t.controller.getSnapshot().project, before)
})
test('dispose suppresses late decoded publication, closes context once and releases frames', async () => {
  const pending = deferred(), t = setup({ engine: { decode: () => pending.promise } })
  const operation = t.controller.importFiles(files.slice(0, 1)), count = t.changes.length
  await t.controller.dispose(); pending.resolve(t.buffer); assert.equal(await operation, false)
  assert.equal(t.changes.length, count); assert.equal(t.controller.getSnapshot().project.tracks.length, 0); assert.equal(t.frames.size, 0)
  assert.equal(await t.controller.play(), false); assert.equal(t.changes.length, count)
})
test('playback schedules simultaneous tracks, seek rebuilds against audio clock and pause stops sources', async () => {
  const t = setup(); await t.controller.importFiles(files); assert.equal(await t.controller.play(), true)
  assert.equal(t.calls.filter(c => c[0] === 'start').length, 2); assert.equal(t.controller.getSnapshot().playing, true)
  const starts = t.calls.filter(c => c[0] === 'start'); assert.equal(starts[0][1], starts[1][1]); assert.ok(t.calls.some(c => c[0] === 'before-play'))
  t.controller.pause(); assert.equal(t.controller.getSnapshot().positionFrames, 0, 'future clock lead must never produce negative position')
  assert.equal(t.controller.seek(1200), true); await t.controller.play(); t.calls.find(c => c[0] === 'context')[1].currentTime = .05
  t.controller.pause(); assert.ok(t.controller.getSnapshot().positionFrames >= 1200); assert.equal(t.frames.size, 0)
  t.controller.stop(); assert.equal(t.controller.getSnapshot().positionFrames, 0); await t.controller.dispose(); assert.equal(t.calls.filter(c => c[0] === 'close').length, 1)
})
test('resume pending then pause must not start late audio', async () => {
  const pending = deferred(), calls = []
  class Context { state = 'suspended'; currentTime = 0; resume = () => pending.promise; close = async () => {}; createGain() { calls.push('started'); throw Error('should not start') } }
  const t = setup({ platform: { AudioContext: Context } }); await t.controller.importFiles(files.slice(0, 1))
  const play = t.controller.play(); t.controller.pause(); pending.resolve(); assert.equal(await play, false); assert.deepEqual(calls, [])
})
test('rename/gain/trim and history are real operations; editing pauses transport', async () => {
  const t = setup(); await t.controller.importFiles(files.slice(0, 1)); await t.controller.play()
  const trackId = t.controller.getSnapshot().project.tracks[0].id
  assert.equal(t.controller.command({ type: 'setTrack', trackId, patch: { gainDb: -6, muted: true } }), true)
  assert.equal(t.controller.getSnapshot().playing, false); assert.equal(t.controller.getSnapshot().project.tracks[0].gainDb, -6)
  t.controller.undo(); assert.equal(t.controller.getSnapshot().project.tracks[0].gainDb, 0)
})
test('project file round-trip retains exact Float32 PCM, signed zero, IDs and metadata', async () => {
  const t = setup(); t.buffer.getChannelData(0)[0] = 1.5; t.buffer.getChannelData(1)[0] = -0
  const text = await serializeProject(t.project, t.assets, t.platform), opened = await deserializeProject(text, t.platform)
  assert.deepEqual(opened.project, t.project); assert.deepEqual(opened.assets.get('asset-a').getChannelData(0), t.buffer.getChannelData(0)); assert.ok(Object.is(opened.assets.get('asset-a').getChannelData(1)[0], -0))
})
test('corrupt PCM/foreign media/unknown schemas fail, never execute content', async () => {
  const t = setup(), text = await serializeProject(t.project, t.assets, t.platform)
  for (const mutate of [d => d.version = 99, d => d.media[0].sha256 = '0'.repeat(64), d => d.media[0].data = 'AAAA', d => d.media[0].assetId = 'foreign', d => d.project.clips[0].assetId = 'foreign', d => d.extra = 'code']) {
    const doc = JSON.parse(text); mutate(doc); await assert.rejects(deserializeProject(JSON.stringify(doc), t.platform))
  }
})
test('download/open uses actual project bytes; invalid open preserves active arrangement/history', async () => {
  const t = setup(); await t.controller.importFiles(files); assert.equal(await t.controller.saveProject(), true)
  assert.match(t.downloads[0].name, /\.movproject\.json$/); assert.equal(t.controller.getSnapshot().fileStatus, 'download-prepared')
  const text = await t.downloads[0].blob.text(), before = t.controller.getSnapshot().project
  assert.equal(await t.controller.openProject({ size: 3, text: async () => '{no' }), false); assert.equal(t.controller.getSnapshot().project, before)
  assert.equal(await t.controller.openProject({ size: MAX_PROJECT_FILE_BYTES + 1, text: () => { throw Error('must not read') } }), false)
  t.controller.command({ type: 'setProjectName', name: 'Changed' }); assert.equal(await t.controller.openProject({ size: text.length, text: async () => text }), true)
  assert.deepEqual(t.controller.getSnapshot().project, before); assert.equal(t.controller.getSnapshot().canUndo, false); assert.equal(t.controller.getSnapshot().fileStatus, 'opened-file')
})
test('failed offline render never publishes a fake download or mutates the project', async () => {
  const t = setup({ engine: { render: async () => { throw Error('render-failed') } } }); await t.controller.importFiles(files.slice(0, 1)); const before = t.controller.getSnapshot().project
  assert.equal(await t.controller.exportMix(), false); assert.equal(t.downloads.length, 0); assert.equal(t.controller.getSnapshot().project, before)
})
test('offline mix export and workbench bridge deliver actual audio blobs', async () => {
  const delivered = [], t = setup({ ports: { onMix: async (blob, name) => delivered.push({ blob, name }) } }); await t.controller.importFiles(files.slice(0, 1))
  assert.equal(await t.controller.exportMix(), true); assert.match(t.downloads[0].name, /-mix.wav$/); assert.equal(t.downloads[0].blob.size, 44 + 4800 * 8)
  assert.equal(await t.controller.mixToWorkbench(), true); assert.equal(delivered[0].blob.type, 'audio/wav')
})
test('late render after disposal cannot download or bridge', async () => {
  const pending = deferred(), t = setup({ engine: { render: () => pending.promise } }); await t.controller.importFiles(files.slice(0, 1))
  const exportPromise = t.controller.exportMix(); await t.controller.dispose(); pending.resolve(t.buffer); assert.equal(await exportPromise, false); assert.equal(t.downloads.length, 0)
})

test('generated multitrack session has sustained real energy on every track, not silent post-attack pads', async () => {
  const t = setup(); assert.equal(await t.controller.demo(), true)
  const project = t.controller.getSnapshot().project; assert.equal(project.tracks.length, 3)
  for (const clip of project.clips) {
    const peaks = t.controller.getWaveform(clip.id, 80)
    assert.ok(peaks.slice(20, 70).some(value => value > .02), 'audible content after2seconds on each track')
  }
})
