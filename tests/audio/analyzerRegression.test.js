import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { analysisService } from "../../src/application/analysis/analysisService.js"
import { quickLufs } from "../../src/audio/analyzer.js"
import { createPcmBuffer, createToneBuffer } from "../fixtures/audioBuffers.js"

// TODO assertions execute and expose known defects, rather than asserting that
// today's incorrect values are desirable. Strict mode makes them ordinary
// failures. Remove the TODO for each case when its separately reviewed fix lands.
// These tests do not certify BS.1770 loudness, true peak, or perceptual quality.
const strict = process.env.MUSICONVERSE_STRICT_AUDIO_REGRESSIONS === "1"
const knownDefect = (reason) => strict ? {} : { todo: reason }
const toleranceDb = 1e-6
const methods = ["analyze", "analyzeFast"]

// Captured from the unmodified analyzer for the deterministic mono fixture.
// These snapshots protect existing complete-window behavior, not meter accuracy.
const completeWindowFingerprints = {
  4096: {
    bands: { sub: -9.752776029878532, bass: -3.056840082433908, low: 5.591473612522954,
      mid: 107.06701981279107, high: -8.90943908833107, presence: -38.64928357277308, air: -52.29015465189746 },
    centroid: 999.999999996514,
    flatness: 3.304482095785942e-13,
  },
  8192: {
    bands: { sub: -9.46685313874643, bass: -2.86863308781858, low: 5.608340383295882,
      mid: 107.02073171555982, high: -9.002440381385085, presence: -38.90834001169594, air: -52.382805479209665 },
    centroid: 999.999999995094,
    flatness: 3.1916766859063047e-13,
  },
}

function near(actual, expected, tolerance = toleranceDb) {
  assert.ok(Number.isFinite(actual), `Expected a finite value, got ${actual}`)
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`)
}

function finiteSpectrum(result) {
  assert.equal(Object.keys(result.bands).length, 7)
  for (const [band, value] of Object.entries(result.bands)) {
    assert.ok(Number.isFinite(value), `${band} must be finite, got ${value}`)
  }
  assert.ok(Number.isFinite(result.centroid), "Spectral centroid must be finite")
  assert.ok(Number.isFinite(result.flatness), "Spectral flatness must be finite")
  if (result.spectrum) assert.ok(result.spectrum.every(Number.isFinite), "Spectrum must be finite")
}

describe("deterministic PCM fixture controls", () => {
  it("reproduces identical samples without sharing channel or fixture storage", () => {
    const first = createToneBuffer()
    const second = createToneBuffer()
    assert.deepEqual(first.getChannelData(0), second.getChannelData(0))
    assert.notEqual(first.getChannelData(0), second.getChannelData(0))
    assert.notEqual(first.getChannelData(0), first.getChannelData(1))
    assert.equal(first.getChannelData(0)[12], 0.5)
    first.getChannelData(0)[12] = 0
    assert.equal(first.getChannelData(1)[12], 0.5)
    assert.equal(second.getChannelData(0)[12], 0.5)
  })

  it("copies input PCM and exposes the requested metadata", () => {
    const samples = new Float32Array([0.25, -0.5, 0.125])
    const buffer = createPcmBuffer([samples], 44100)
    samples[0] = 0
    assert.equal(buffer.getChannelData(0)[0], 0.25)
    assert.equal(buffer.length, 3)
    assert.equal(buffer.sampleRate, 44100)
    assert.equal(buffer.numberOfChannels, 1)
    assert.equal(buffer.duration, 3 / 44100)
  })

  it("rejects malformed fixture geometry and invalid channel access", () => {
    assert.throws(() => createPcmBuffer([]), TypeError)
    assert.throws(() => createPcmBuffer([[], []]), RangeError)
    assert.throws(() => createPcmBuffer([[0], [0, 1]]), RangeError)
    assert.throws(() => createPcmBuffer([[0]], 0), RangeError)
    assert.throws(() => createToneBuffer().getChannelData(2), RangeError)
  })
})

for (const method of methods) {
  describe(`real ${method}: control cases`, () => {
    it("measures the sample-aligned in-phase tone peak and finite spectrum", async () => {
      const result = await analysisService[method](createToneBuffer())
      near(result.peakDb, 20 * Math.log10(0.5))
      if (method === "analyze") assert.equal(result.clipCount, 0)
      assert.ok(Number.isFinite(result.lufs))
      finiteSpectrum(result)
    })

    it("preserves every source channel during measurement", async () => {
      const buffer = createToneBuffer()
      const before = [buffer.getChannelData(0).slice(), buffer.getChannelData(1).slice()]
      await analysisService[method](buffer)
      assert.deepEqual(buffer.getChannelData(0), before[0])
      assert.deepEqual(buffer.getChannelData(1), before[1])
    })

    it("returns finite spectral values for a full-length silent buffer", async () => {
      const result = await analysisService[method](createPcmBuffer([new Float32Array(24000)]))
      finiteSpectrum(result)
    })

    for (const length of [4096, 4097]) {
      it(`handles an input of ${length} frames at or above the FFT window`, async () => {
        finiteSpectrum(await analysisService[method](createToneBuffer({ length, channelGains: [1] })))
      })
    }

    for (const length of [4096, 4097, 8192]) {
      it(`preserves the pre-fix complete-window spectral fingerprint at ${length} frames`, async () => {
        const result = await analysisService[method](createToneBuffer({ length, channelGains: [1] }))
        const expected = completeWindowFingerprints[length === 4097 ? 4096 : length]
        for (const [band, value] of Object.entries(expected.bands)) near(result.bands[band], value, 1e-5)
        near(result.centroid, expected.centroid)
        near(result.flatness, expected.flatness, 1e-16)
      })
    }
  })

  describe(`real ${method}: short-input FFT regressions`, () => {
    for (const length of [1, 100, 4095]) {
      it(`zero-pads ${length} frames without changing source samples or metadata`, async () => {
        // A nonzero final sample catches accidental truncation before padding.
        const samples = new Float32Array(length)
        samples[length - 1] = 0.5
        const buffer = createPcmBuffer([samples])
        const before = buffer.getChannelData(0).slice()
        const padded = new Float32Array(4096)
        padded.set(samples)
        const result = await analysisService[method](buffer)
        const explicitPadding = await analysisService[method](createPcmBuffer([padded]))
        finiteSpectrum(result)
        assert.deepEqual(result.bands, explicitPadding.bands)
        assert.equal(result.centroid, explicitPadding.centroid)
        assert.equal(result.flatness, explicitPadding.flatness)
        if (result.spectrum) assert.deepEqual(result.spectrum, explicitPadding.spectrum)
        assert.deepEqual(buffer.getChannelData(0), before)
        assert.equal(buffer.length, length)
        assert.equal(buffer.sampleRate, 48000)
        assert.equal(buffer.numberOfChannels, 1)
        if (method === "analyze") {
          assert.equal(result.duration, length / 48000)
          assert.equal(result.sampleRate, 48000)
          assert.equal(result.channels, 1)
        }
      })
    }
  })

  describe(`real ${method}: channel-aware sample measurements`, () => {
    it("keeps sample peak when only the right channel polarity is inverted", async () => {
      const result = await analysisService[method](createToneBuffer({ channelGains: [1, -1] }))
      // Per-channel samples still reach +/-0.5; there is no analog summing here.
      near(result.peakDb, 20 * Math.log10(0.5))
    })

    it("uses the strongest channel regardless of channel order", async () => {
      const left = [0, 0.25, 0, -0.5]
      const right = [0, 0.75, 0, -0.25]
      for (const channels of [[left, right], [right, left]]) {
        near((await analysisService[method](createPcmBuffer(channels))).peakDb, 20 * Math.log10(0.75))
      }
    })

    it("keeps RMS and derived crest stable under channel polarity inversion", async () => {
      const aligned = await analysisService[method](createToneBuffer())
      const inverted = await analysisService[method](createToneBuffer({ channelGains: [1, -1] }))
      const expectedRmsDb = 20 * Math.log10(0.5 / Math.sqrt(2))
      const expectedCrestDb = 20 * Math.log10(Math.sqrt(2))
      near(aligned.crestDb, expectedCrestDb)
      near(inverted.crestDb, expectedCrestDb)
      if (method === "analyze") {
        near(aligned.rmsDb, expectedRmsDb)
        near(inverted.rmsDb, expectedRmsDb)
      }
    })

    it("computes RMS from mean channel energy, not a mono channel average", async () => {
      const result = await analysisService[method](createPcmBuffer([
        [0.5, -0.5, 0.5, -0.5],
        [0.25, -0.25, 0.25, -0.25],
      ]))
      // Both channels have constant squared amplitude; mean energy is 0.15625.
      const expectedRmsDb = 10 * Math.log10((0.5 ** 2 + 0.25 ** 2) / 2)
      near(result.peakDb, 20 * Math.log10(0.5))
      near(result.crestDb, 20 * Math.log10(0.5) - expectedRmsDb)
      if (method === "analyze") near(result.rmsDb, expectedRmsDb)
    })

    it("examines all channels, not just the stereo pair", async () => {
      const result = await analysisService[method](createPcmBuffer([
        [0.25, -0.25, 0.25, -0.25],
        [0, 0, 0, 0],
        [0.75, -0.75, 0.75, -0.75],
      ]))
      near(result.peakDb, 20 * Math.log10(0.75))
      const expectedRmsDb = 10 * Math.log10((0.25 ** 2 + 0.75 ** 2) / 3)
      near(result.crestDb, 20 * Math.log10(0.75) - expectedRmsDb)
      if (method === "analyze") near(result.rmsDb, expectedRmsDb)
    })

    it("preserves sample peak and crest when a mono channel is duplicated", async () => {
      const mono = await analysisService[method](createToneBuffer({ channelGains: [1] }))
      const stereo = await analysisService[method](createToneBuffer())
      assert.equal(stereo.peakDb, mono.peakDb)
      assert.equal(stereo.crestDb, mono.crestDb)
      if (method === "analyze") assert.equal(stereo.rmsDb, mono.rmsDb)
    })
  })

  describe(`real ${method}: known defects (not resolved)`, () => {
    it("keeps channel-energy loudness invariant under right-channel polarity inversion",
      knownDefect("STEREO-LOUDNESS: mono fold-down erases opposite-polarity channel energy"), async () => {
        const aligned = await analysisService[method](createToneBuffer())
        const inverted = await analysisService[method](createToneBuffer({ channelGains: [1, -1] }))
        // This is an invariance check, not an assertion of an absolute LUFS value.
        near(inverted.lufs, aligned.lufs)
      })

  })
}

describe("full analysis metadata and stereo controls", () => {
  it("reports source geometry and detects opposite-polarity stereo correlation", async () => {
    const result = await analysisService.analyze(createToneBuffer({ channelGains: [1, -1] }))
    assert.equal(result.duration, 0.5)
    assert.equal(result.sampleRate, 48000)
    assert.equal(result.channels, 2)
    assert.equal(result.stereo.mono, false)
    near(result.stereo.corr, -1)
  })

  it("detects clipping for an in-phase tone exceeding full scale", async () => {
    const result = await analysisService.analyze(createToneBuffer({ amplitude: 1.1 }))
    assert.ok(result.clipCount > 0)
  })

  it("does not lose clipping when only right-channel polarity changes", async () => {
    const aligned = await analysisService.analyze(createToneBuffer({ amplitude: 1.1 }))
    const inverted = await analysisService.analyze(createToneBuffer({ amplitude: 1.1, channelGains: [1, -1] }))
    assert.ok(inverted.clipCount > 0, "Opposite-polarity channels still contain samples over full scale")
    assert.equal(inverted.clipCount, aligned.clipCount)
  })

  it("counts a clipped frame once even when both channels clip", async () => {
    const result = await analysisService.analyze(createPcmBuffer([
      [1.1, 0, 1.1, 0],
      [1.1, 1.1, 0, 0],
    ]))
    assert.equal(result.clipCount, 3)
  })

  it("preserves the existing clipping threshold for positive and negative samples", async () => {
    const result = await analysisService.analyze(createPcmBuffer([
      [0.9990, 0, -0.9995, 0],
      [0, 0.9995, 0, -0.9990],
    ]))
    // Values intentionally straddle 0.9992 without Float32 boundary ambiguity.
    assert.equal(result.clipCount, 2)
  })

  it("detects negative clipping in a single active channel", async () => {
    const result = await analysisService.analyze(createPcmBuffer([
      [0, 0, 0, 0],
      [-1.2, 0, -1.2, 0],
    ]))
    assert.equal(result.clipCount, 2)
    near(result.peakDb, 20 * Math.log10(1.2))
  })
})

describe("real quickLufs post-render measurement", () => {
  it("returns a finite result for an in-phase tone", () => {
    assert.ok(Number.isFinite(quickLufs(createToneBuffer())))
  })

  it("keeps channel-energy loudness invariant under right-channel polarity inversion",
    knownDefect("STEREO-QUICK-LUFS: post-render trim uses the same cancelling mono fold-down"), () => {
      near(quickLufs(createToneBuffer({ channelGains: [1, -1] })), quickLufs(createToneBuffer()))
    })
})
