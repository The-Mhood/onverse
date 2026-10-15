import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createPcmBuffer, createToneBuffer } from "../fixtures/audioBuffers.js"
import { createIntegratedLoudnessCandidate, gateWindowEnergies, CANDIDATE_PROFILE }
  from "../../scripts/validation/integrated-loudness-candidate.mjs"
import { compareLoudnessCandidateReport } from "../../scripts/validation/compare-loudness-candidate.mjs"

const near = (actual, expected, tolerance = 1e-6) => {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${actual} versus ${expected}`)
}
const level = value => -0.691 + 10 * Math.log10(value)
function measure(buffer, chunk = buffer.length) {
  const meter = createIntegratedLoudnessCandidate({ sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels })
  for (let offset = 0; offset < buffer.length; offset += chunk) {
    meter.addFrames(Array.from({ length: buffer.numberOfChannels }, (_, c) =>
      buffer.getChannelData(c).subarray(offset, offset + chunk)))
  }
  return meter.finish()
}

describe("isolated candidate mathematical gates", () => {
  it("uses inclusive absolute energy threshold without rounding", () => {
    const a = 10 ** ((-70 + 0.691) / 10)
    const r = gateWindowEnergies([a, a * (1 - 1e-6), a * (1 + 1e-6)])
    assert.equal(r.absoluteGatedWindows, 2)
    near(r.lufs, level(a * (1 + 0.5e-6)), 1e-10)
    near(gateWindowEnergies([a]).lufs, -70, 1e-10)
  })
  it("includes equality at the relative gate", () => {
    const r = gateWindowEnergies([19, 1]) // mean=10; relative threshold=1
    assert.equal(r.relativeGatedWindows, 2)
    near(r.lufs, level(10))
    near(r.relativeGateLufs, level(1))
  })
  it("excludes a value below the relative gate", () => {
    const r = gateWindowEnergies([19, 1 - 1e-10])
    assert.equal(r.relativeGatedWindows, 1)
    near(r.lufs, level(19))
  })
  it("includes a value above the relative gate", () => {
    assert.equal(gateWindowEnergies([19, 1 + 1e-10]).relativeGatedWindows, 2)
  })
  it("averages energy rather than dB readings", () => near(gateWindowEnergies([1, 9]).lufs, level(5)))
  it("removes quiet windows through the relative gate", () => {
    const r = gateWindowEnergies([1, 1, 0.001, 0.001])
    assert.equal(r.absoluteGatedWindows, 4)
    assert.equal(r.relativeGatedWindows, 2)
    near(r.lufs, level(1))
  })
  it("represents no above-gate evidence without a numeric floor", () => {
    for (const input of [[], [0], [0, 1e-12]]) {
      const r = gateWindowEnergies(input)
      assert.equal(r.status, "below-gate")
      assert.equal(r.lufs, null)
      assert.equal(r.relativeGateLufs, null)
    }
  })
  it("does not mutate energy inputs", () => {
    const input = Object.freeze([1, 2, 3])
    gateWindowEnergies(input)
    assert.deepEqual(input, [1, 2, 3])
  })
  for (const input of [[-1], [NaN], [Infinity], [undefined], new Array(2), null, {}]) {
    it(`rejects invalid energy input ${String(input)}`, () => assert.throws(() => gateWindowEnergies(input)))
  }
})

for (const sampleRate of [44100, 48000]) {
  describe(`isolated candidate actual PCM at ${sampleRate}`, () => {
    const tone = options => createToneBuffer({ sampleRate, length: sampleRate, channelGains: [1], ...options })
    it("sums duplicate stereo energy without changing mono to dual-mono", () => {
      near(measure(tone({ channelGains: [1, 1] })).lufs - measure(tone()).lufs, 10 * Math.log10(2))
    })
    it("preserves energy through channel polarity inversion", () => {
      near(measure(tone({ channelGains: [1, -1] })).lufs, measure(tone({ channelGains: [1, 1] })).lufs)
    })
    it("handles active left/right channels", () => {
      const mono = measure(tone()).lufs
      near(measure(tone({ channelGains: [0, 1] })).lufs, mono)
      near(measure(tone({ channelGains: [1, 0] })).lufs, mono)
    })
    it("obeys linear-amplitude gain law above the gates", () => {
      near(measure(tone({ amplitude: 0.25 })).lufs - measure(tone()).lufs, 20 * Math.log10(0.5))
    })
    it("returns below-gate status for silence and very quiet PCM", () => {
      for (const amplitude of [0, 1e-5]) {
        const r = measure(tone({ amplitude }))
        assert.equal(r.status, "below-gate")
        assert.equal(r.lufs, null)
      }
    })
    it("does not invent a 400 ms window for short PCM", () => {
      const r = measure(tone({ length: sampleRate * 0.4 - 1 }))
      assert.equal(r.status, "insufficient-duration")
      assert.equal(r.completeWindows, 0)
      assert.equal(r.lufs, null)
    })
    it("counts complete overlapping windows and ignores the incomplete tail", () => {
      const exact = measure(tone({ length: sampleRate * 0.4 }))
      const extra = measure(tone({ length: sampleRate * 0.4 + 1 }))
      assert.equal(exact.status, "valid")
      assert.equal(exact.completeWindows, 1)
      assert.equal(extra.completeWindows, 1)
      assert.equal(extra.lufs, exact.lufs)
      assert.equal(measure(tone({ length: sampleRate * 0.5 })).completeWindows, 2)
    })
    it("retains filter/window state across arbitrary chunk boundaries", () => {
      const buffer = tone({ length: sampleRate + 17, channelGains: [1, -0.5], frequencyHz: 38 })
      const whole = measure(buffer)
      for (const chunk of [1, 127, 128, 4096]) assert.deepEqual(measure(buffer, chunk), whole)
    })
    it("weights frequencies rather than treating PCM RMS as LUFS", () => {
      assert.ok(measure(tone({ frequencyHz: 4000 })).lufs - measure(tone({ frequencyHz: 20 })).lufs > 10)
    })
    it("preserves over-full-scale source PCM and freezes research evidence", () => {
      const buffer = tone({ amplitude: 1.2, channelGains: [1, -0.5] })
      const before = [buffer.getChannelData(0).slice(), buffer.getChannelData(1).slice()]
      const r = measure(buffer)
      assert.equal(r.status, "valid")
      assert.equal(r.profile, CANDIDATE_PROFILE)
      assert.ok(Object.isFrozen(r))
      before.forEach((data, c) => assert.deepEqual(buffer.getChannelData(c), data))
    })
  })
}

describe("candidate validation and lifecycle", () => {
  for (const sampleRate of [undefined, 0, 32000, 96000, NaN]) {
    it(`rejects unsupported sample rate ${sampleRate}`, () =>
      assert.throws(() => createIntegratedLoudnessCandidate({ sampleRate, channels: 1 }), /sample rate/))
  }
  for (const channels of [undefined, 0, 3, 1.5]) {
    it(`rejects unsupported channels ${channels}`, () =>
      assert.throws(() => createIntegratedLoudnessCandidate({ sampleRate: 48000, channels }), /channel layout/))
  }
  it("represents an empty stream as insufficient duration, not silence", () => {
    assert.equal(createIntegratedLoudnessCandidate({ sampleRate: 48000, channels: 1 }).finish().status, "insufficient-duration")
  })
  it("finalizes idempotently and refuses more input", () => {
    const meter = createIntegratedLoudnessCandidate({ sampleRate: 48000, channels: 1 })
    meter.addFrames([new Float32Array(19200)])
    assert.equal(meter.finish(), meter.finish())
    assert.throws(() => meter.addFrames([new Float32Array(1)]), /finalized/)
  })
  it("rejects malformed or nonfinite chunks atomically, leaving prior state intact", () => {
    const buffer = createToneBuffer({ length: 24000, channelGains: [1, -1] })
    const meter = createIntegratedLoudnessCandidate({ sampleRate: 48000, channels: 2 })
    const pcm = [buffer.getChannelData(0), buffer.getChannelData(1)]
    meter.addFrames(pcm.map(c => c.subarray(0, 6000)))
    const sparse = new Array(2); sparse[0] = new Float32Array(2)
    for (const bad of [null, [], [pcm[0]], [[], []], [new Float64Array(2), new Float64Array(2)],
      [new Float32Array(0), new Float32Array(0)], [new Float32Array(2), new Float32Array(1)], sparse,
      [new Float32Array([0.5, 1]), new Float32Array([0, NaN])],
      [new Float32Array([0, Infinity]), new Float32Array(2)]]) {
      assert.throws(() => meter.addFrames(bad))
    }
    meter.addFrames(pcm.map(c => c.subarray(6000)))
    assert.deepEqual(meter.finish(), measure(buffer))
  })
  it("refuses shared mutable storage without consuming any frames", () => {
    const meter = createIntegratedLoudnessCandidate({ sampleRate: 48000, channels: 1 })
    assert.throws(() => meter.addFrames([new Float32Array(new SharedArrayBuffer(8))]), /shared mutable/)
    assert.equal(meter.finish().frames, 0)
  })
  it("bounds research input duration without partially accepting an oversized chunk", () => {
    const meter = createIntegratedLoudnessCandidate({ sampleRate: 48000, channels: 1 })
    assert.throws(() => meter.addFrames([new Float32Array(48000 * 30 + 1)]), /30-second/)
    assert.equal(meter.finish().frames, 0)
  })
  it("can measure a single over-full-scale sample without mutating it", () => {
    const r = measure(createPcmBuffer([[1.2]]))
    assert.equal(r.status, "insufficient-duration")
    assert.equal(r.frames, 1)
  })
})

describe("offline comparison preflight", () => {
  it("rejects an absent or unrelated report before measurements", () => {
    for (const report of [null, {}, { kind: "other" }]) {
      assert.throws(() => compareLoudnessCandidateReport(report), /wrong reference report kind/)
    }
  })
  it("rejects a different repository rather than resolving an imported path", () => {
    assert.throws(() => compareLoudnessCandidateReport({
      kind: "test-only-independent-reference", upstream: { repository: "../untrusted" },
    }), /wrong reference repository/)
  })
  it("rejects a different reference revision", () => {
    assert.throws(() => compareLoudnessCandidateReport({
      kind: "test-only-independent-reference",
      upstream: { repository: "jiixyj/libebur128", commit: "unapproved" },
    }), /wrong reference commit/)
  })
})
