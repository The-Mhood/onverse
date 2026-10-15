import { createPcmBuffer } from "./audioBuffers.js"

// Recipes describe only synthetic PCM. No user media, random generator, decoder,
// resampling, filesystem or reference-library result is used to create samples.
export function createMeteringReferenceCases() {
  const cases = []
  for (const sampleRate of [44100, 48000]) {
    const add = (name, recipe, channels) => cases.push({
      id: `${sampleRate}-${name}`, name, sampleRate, recipe,
      buffer: createPcmBuffer(channels, sampleRate),
    })
    const tone = (name, {
      frames = sampleRate * 2, frequencyHz = 1000, amplitude = 0.5,
      phase = 0, gains = [1],
    } = {}) => {
      const pcm = Float32Array.from({ length: frames }, (_, i) =>
        amplitude * Math.sin(2 * Math.PI * frequencyHz * i / sampleRate + phase))
      add(name, { kind: "sine", frames, frequencyHz, amplitude, phase, gains },
        gains.map(gain => pcm.map(value => value * gain)))
    }
    tone("mono")
    tone("stereo", { gains: [1, 1] })
    tone("inverted", { gains: [1, -1] })
    tone("left-only", { gains: [1, 0] })
    tone("right-only", { gains: [0, 1] })
    tone("unequal", { gains: [1, 0.5] })
    tone("half-amplitude", { amplitude: 0.25 })
    tone("silence", { frames: sampleRate, amplitude: 0 })
    tone("below-gate", { amplitude: 1e-5 })
    tone("over-full-scale", { amplitude: 1.2 })
    tone("phase-quarter-rate", { frequencyHz: sampleRate / 4, amplitude: 0.9, phase: Math.PI / 4 })
    for (const frequencyHz of [20, 38, 100, 4000, 12000]) {
      tone(`weight-${frequencyHz}`, { frequencyHz })
    }
    for (const ms of [100, 400]) {
      for (const offset of [-1, 0, 1]) {
        tone(`duration-${ms}ms-${offset + 1}`, { frames: sampleRate * ms / 1000 + offset })
      }
    }
    for (const [name, frames, position] of [
      ["single-frame", 1, 0],
      ["impulse-first", sampleRate / 2, 0],
      ["impulse-last", sampleRate / 2, sampleRate / 2 - 1],
      ["impulse-chunk-boundary", sampleRate / 2, 127],
    ]) {
      const pcm = new Float32Array(frames)
      pcm[position] = 1
      add(name, { kind: "impulse", frames, position, amplitude: 1 }, [pcm])
    }
    for (const [name, segments] of [
      ["programme-with-silence", [[1, 0], [2, 0.5], [2, 0]]],
      ["programme-with-quiet", [[2, 0.5], [3, 0.005]]],
    ]) {
      const frames = segments.reduce((sum, [seconds]) => sum + seconds * sampleRate, 0)
      const pcm = new Float32Array(frames)
      let offset = 0
      for (const [seconds, amplitude] of segments) {
        const end = offset + seconds * sampleRate
        for (let i = offset; i < end; i++) pcm[i] = amplitude * Math.sin(2 * Math.PI * 1000 * i / sampleRate)
        offset = end
      }
      add(name, { kind: "segmented-sine", frames, frequencyHz: 1000, segments }, [pcm])
    }
  }
  return cases
}
