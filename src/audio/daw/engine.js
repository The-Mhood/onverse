import { SAMPLE_RATE, LIMITS, validateProject, durationFrames, audibleTracks, fail } from "../../domain/daw/project.js"

// A single topology for live scheduling AND native offline mixdown. No hidden
// limiter/normalization: summation can exceed0dBFS; float export preserves it.
export function scheduleProject(context, project, assets, positionFrames = 0, startAt = context.currentTime) {
  validateProject(project)
  if (!Number.isSafeInteger(positionFrames) || positionFrames < 0 || positionFrames > durationFrames(project)) throw fail("INVALID_POSITION")
  const nodes = [], sources = []
  const stop = () => {
    for (const source of sources) { try { source.stop() } catch { /* already ended */ } }
    for (const node of nodes) { try { node.disconnect() } catch { /* already disconnected */ } }
  }
  try {
    for (const track of audibleTracks(project)) {
      const gain = context.createGain(), pan = context.createStereoPanner()
      gain.gain.value = 10 ** (track.gainDb / 20); pan.pan.value = track.pan
      gain.connect(pan); pan.connect(context.destination); nodes.push(gain, pan)
      for (const clip of project.clips.filter(c => c.trackId === track.id)) {
        if (clip.startFrame + clip.durationFrames <= positionFrames) continue
        const asset = project.assets.find(a => a.id === clip.assetId), buffer = assets.get(clip.assetId)
        if (!buffer || buffer.sampleRate !== SAMPLE_RATE || buffer.length !== asset.frames || buffer.numberOfChannels !== asset.channels) throw fail("ASSET_UNAVAILABLE")
        const elapsed = Math.max(0, positionFrames - clip.startFrame), source = context.createBufferSource()
        source.buffer = buffer; source.connect(gain); sources.push(source); nodes.push(source)
        source.start(startAt + Math.max(0, clip.startFrame - positionFrames) / SAMPLE_RATE,
          (clip.offsetFrames + elapsed) / SAMPLE_RATE, (clip.durationFrames - elapsed) / SAMPLE_RATE)
      }
    }
    return Object.freeze({ stop, sourceCount: sources.length })
  } catch (error) { stop(); throw error }
}
export function validateBuffer(buffer) {
  if (!buffer || buffer.sampleRate !== SAMPLE_RATE || !Number.isSafeInteger(buffer.length) || buffer.length < 1 || buffer.length > LIMITS.assetFrames ||
    ![1, 2].includes(buffer.numberOfChannels)) throw fail("UNSUPPORTED_AUDIO_GEOMETRY")
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    if (!(data instanceof Float32Array) || data.length !== buffer.length || !data.every(Number.isFinite)) throw fail("INVALID_PCM")
  }
  return buffer
}
export function createDawAudio({ audio, platform = globalThis }) {
  return Object.freeze({
    async decode(file) {
      const decoded = await audio.decodeFile(file)
      if (![1, 2].includes(decoded.numberOfChannels) || decoded.duration > LIMITS.assetFrames / SAMPLE_RATE) throw fail("UNSUPPORTED_AUDIO_GEOMETRY")
      if (decoded.sampleRate === SAMPLE_RATE) return validateBuffer(decoded)
      const frames = Math.max(1, Math.round(decoded.duration * SAMPLE_RATE))
      const context = new platform.OfflineAudioContext(decoded.numberOfChannels, frames, SAMPLE_RATE)
      const source = context.createBufferSource(); source.buffer = decoded; source.connect(context.destination); source.start()
      return validateBuffer(await context.startRendering())
    },
    async render(project, assets) {
      const frames = durationFrames(project)
      if (!frames) throw fail("EMPTY_ARRANGEMENT")
      const context = new platform.OfflineAudioContext(2, frames, SAMPLE_RATE)
      const graph = scheduleProject(context, project, assets, 0, 0)
      try { return await context.startRendering() } finally { graph.stop() }
    },
  })
}
// Float32 WAV, intentionally NOT processor.encodeWav's clipped delivery policy.
// Keeps over-range finite PCM so the mix can be inspected/mastered without loss.
export function encodeMixWav(buffer) {
  const channels = buffer.numberOfChannels, frames = buffer.length, sampleRate = buffer.sampleRate
  if (![1, 2].includes(channels) || sampleRate !== SAMPLE_RATE || !Number.isSafeInteger(frames) || frames < 1 || frames > LIMITS.timelineFrames) throw fail("INVALID_MIX")
  const bytes = new ArrayBuffer(44 + frames * channels * 4), view = new DataView(bytes)
  const text = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)) }
  text(0, "RIFF"); view.setUint32(4, bytes.byteLength - 8, true); text(8, "WAVE"); text(12, "fmt ")
  view.setUint32(16, 16, true); view.setUint16(20, 3, true); view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels * 4, true); view.setUint16(32, channels * 4, true); view.setUint16(34, 32, true)
  text(36, "data"); view.setUint32(40, frames * channels * 4, true)
  let peak = 0
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c)
    for (let n = 0; n < frames; n++) {
      if (!Number.isFinite(data[n])) throw fail("INVALID_PCM")
      peak = Math.max(peak, Math.abs(data[n])); view.setFloat32(44 + (n * channels + c) * 4, data[n], true)
    }
  }
  return { blob: new Blob([bytes], { type: "audio/wav" }), peak }
}
