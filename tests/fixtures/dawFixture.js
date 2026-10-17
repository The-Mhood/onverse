import { createPcmBuffer } from './audioBuffers.js'
import { createProject, applyCommand } from '../../src/domain/daw/project.js'
export class TestAudioBuffer {
  constructor({ length, numberOfChannels, sampleRate }) { return createPcmBuffer(Array.from({ length: numberOfChannels }, () => new Float32Array(length)), sampleRate) }
}
export function dawFixture() {
  const buffer = new TestAudioBuffer({ length: 4800, numberOfChannels: 2, sampleRate: 48000 })
  buffer.getChannelData(0).fill(.25); buffer.getChannelData(1).fill(-.5)
  const project = applyCommand(createProject('project-a'), { type: 'addTracks', assets: [{ id: 'asset-a', name: 'Tone.wav', sampleRate: 48000, frames: 4800, channels: 2 }],
    tracks: [{ id: 'track-a', name: 'Tone', gainDb: 0, pan: 0, muted: false, solo: false }],
    clips: [{ id: 'clip-a', trackId: 'track-a', assetId: 'asset-a', startFrame: 0, offsetFrames: 0, durationFrames: 4800 }] })
  return { project, buffer, assets: new Map([['asset-a', buffer]]) }
}
