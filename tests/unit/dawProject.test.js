import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createProject, applyCommand, validateProject, durationFrames, audibleTracks, LIMITS } from '../../src/domain/daw/project.js'
import { dawFixture } from '../fixtures/dawFixture.js'

test('DAW project is immutable pure metadata with stable IDs and no PCM/UI store', () => {
  const { project } = dawFixture(); assert.ok(Object.isFrozen(project.clips[0])); assert.equal(project.sampleRate, 48000)
  assert.equal(durationFrames(project), 4800); assert.equal(project.assets[0].id, 'asset-a'); assert.throws(() => createProject('../path'))
})
test('move/trim are nondestructive and preserve unrelated metadata', () => {
  const { project } = dawFixture()
  const moved = applyCommand(project, { type: 'moveClip', clipId: 'clip-a', trackId: 'track-a', startFrame: 2400 })
  const trimmed = applyCommand(moved, { type: 'trimClip', clipId: 'clip-a', offsetFrames: 1200, durationFrames: 2400 })
  assert.equal(trimmed.clips[0].startFrame, 2400); assert.equal(durationFrames(trimmed), 4800)
  assert.deepEqual(trimmed.assets, project.assets); assert.deepEqual(trimmed.tracks, project.tracks); assert.equal(project.clips[0].durationFrames, 4800)
})
test('atomic edit validates position/source extent/target before publication', () => {
  const { project } = dawFixture()
  const next = applyCommand(project, { type: 'editClip', clipId: 'clip-a', trackId: 'track-a', startFrame: 100, offsetFrames: 400, durationFrames: 800 })
  assert.deepEqual(next.clips[0], { id: 'clip-a', trackId: 'track-a', assetId: 'asset-a', startFrame: 100, offsetFrames: 400, durationFrames: 800 })
  assert.throws(() => applyCommand(project, { type: 'editClip', clipId: 'clip-a', trackId: 'foreign', startFrame: 100, offsetFrames: 0, durationFrames: 100 }))
})
test('split keeps exact source closure and duplicate shares immutable asset', () => {
  const { project } = dawFixture()
  const next = applyCommand(project, { type: 'splitClip', clipId: 'clip-a', frame: 1200, newId: 'clip-b' })
  assert.equal(next.clips[0].durationFrames, 1200); assert.equal(next.clips[1].offsetFrames, 1200); assert.equal(next.clips[1].durationFrames, 3600)
  const duplicated = applyCommand(next, { type: 'duplicateClip', clipId: 'clip-b', newId: 'clip-c' })
  assert.equal(duplicated.clips[2].startFrame, 4800); assert.equal(duplicated.assets.length, 1)
  for (const frame of [0, 4800, NaN]) assert.throws(() => applyCommand(project, { type: 'splitClip', clipId: 'clip-a', frame, newId: 'clip-b' }))
})
test('gain/pan/mute/solo apply to real inclusion policy; muted solo does not unmute other tracks', () => {
  const { project } = dawFixture()
  const next = applyCommand(project, { type: 'setTrack', trackId: 'track-a', patch: { gainDb: -6, pan: -.25, solo: true, muted: true } })
  assert.equal(next.tracks[0].gainDb, -6); assert.deepEqual(audibleTracks(next), [])
  for (const patch of [{ gainDb: NaN }, { gainDb: 13 }, { pan: 2 }, { muted: 1 }, { routing: 'fake' }]) assert.throws(() => applyCommand(project, { type: 'setTrack', trackId: 'track-a', patch }))
})
test('removal does not delete retained original media', () => {
  const { project } = dawFixture()
  const next = applyCommand(project, { type: 'removeTrack', trackId: 'track-a' })
  assert.equal(next.clips.length, 0); assert.equal(next.tracks.length, 0); assert.deepEqual(next.assets, project.assets)
})
test('reject unsupported schemas, duplicate IDs, unknown fields and excessive geometry', () => {
  const { project } = dawFixture()
  for (const transform of [p => p.schemaVersion = 2, p => p.clips[0].id = 'track-a', p => p.assets[0].frames = LIMITS.assetFrames + 1, p => p.clips[0].startFrame = LIMITS.timelineFrames, p => p.extra = true, p => p.tracks[0].name = '']) {
    const copy = structuredClone(project); transform(copy); assert.throws(() => validateProject(copy))
  }
})
test('reject source overrun, negative/fractional timeline and unknown operations without changing project', () => {
  const { project } = dawFixture(), before = JSON.stringify(project)
  for (const startFrame of [-1, .5, Infinity]) assert.throws(() => applyCommand(project, { type: 'moveClip', clipId: 'clip-a', trackId: 'track-a', startFrame }))
  assert.throws(() => applyCommand(project, { type: 'trimClip', clipId: 'clip-a', offsetFrames: 4800, durationFrames: 1 }))
  assert.throws(() => applyCommand(project, { type: 'executeCode', code: 'not executed' })); assert.equal(JSON.stringify(project), before)
})
