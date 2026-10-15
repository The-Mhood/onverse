// RESEARCH ONLY: no production imports or native dependency. Numerical filter
// parameters cross-checked against libebur128 1.2.6 at 67b33abe... (MIT).
// See AUDIO_METERING_CONTRACT.md for provenance and unverified normative gates.
// Unlike the reference's combined fourth-order filter, this uses two separate
// second-order recurrences and four 100 ms energy sums (no subtractive window).
export const CANDIDATE_PROFILE = "research-integrated-native-mono-lr-v1"
const ABSOLUTE_ENERGY = 10 ** ((-70 + 0.691) / 10)
const toLufs = energy => -0.691 + 10 * Math.log10(energy)

function mean(values) {
  let sum = 0, correction = 0
  for (const value of values) {
    const adjusted = value / values.length - correction
    const next = sum + adjusted
    correction = (next - sum) - adjusted
    sum = next
  }
  if (!Number.isFinite(sum)) throw new RangeError("energy overflow")
  return sum
}

// Exported only for exact analytical gate-boundary tests; real PCM processing
// calls this same implementation. Never round levels before gate decisions.
export function gateWindowEnergies(energies) {
  if (!Array.isArray(energies) && !(energies instanceof Float64Array)) {
    throw new TypeError("window energies must be an array")
  }
  for (const energy of energies) {
    if (!Number.isFinite(energy) || energy < 0) throw new RangeError("invalid window energy")
  }
  const absolute = Array.from(energies).filter(value => value >= ABSOLUTE_ENERGY)
  const relativeEnergy = absolute.length ? mean(absolute) * 0.1 : null
  const retained = relativeEnergy === null ? [] : absolute.filter(value => value >= relativeEnergy)
  return Object.freeze({
    status: retained.length ? "valid" : "below-gate",
    lufs: retained.length ? toLufs(mean(retained)) : null,
    completeWindows: energies.length,
    absoluteGatedWindows: absolute.length,
    relativeGatedWindows: retained.length,
    relativeGateLufs: relativeEnergy === null ? null : toLufs(relativeEnergy),
  })
}

/* Coefficient parameterization follows the pinned libebur128 filter equations.
 * Upstream notice retained for that portion (not a license change to the app):
 * Copyright (c) 2011 Jan Kokemüller
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
function weighting(sampleRate) {
  const k = Math.tan(Math.PI * 1681.974450955533 / sampleRate)
  const q = 0.7071752369554196
  const high = 10 ** (3.999843853973347 / 20)
  const middle = high ** 0.4996667741545416
  const denominator = 1 + k / q + k * k
  const shelf = [
    (high + middle * k / q + k * k) / denominator,
    2 * (k * k - high) / denominator,
    (high - middle * k / q + k * k) / denominator,
    2 * (k * k - 1) / denominator,
    (1 - k / q + k * k) / denominator,
  ]
  const r = Math.tan(Math.PI * 38.13547087602444 / sampleRate)
  const d = 1 + r / 0.5003270373238773 + r * r
  // The RLB stage has numerator [1,-2,1], not a generic Butterworth HP.
  return [shelf, [1, -2, 1, 2 * (r * r - 1) / d, (1 - r / 0.5003270373238773 + r * r) / d]]
}

function stage(coefficients) {
  const [b0, b1, b2, a1, a2] = coefficients
  let z1 = 0, z2 = 0
  return input => {
    const output = b0 * input + z1
    z1 = b1 * input - a1 * output + z2
    z2 = b2 * input - a2 * output
    return output
  }
}

export function createIntegratedLoudnessCandidate({ sampleRate, channels } = {}) {
  if (![44100, 48000].includes(sampleRate)) throw new RangeError("unsupported sample rate")
  if (channels !== 1 && channels !== 2) throw new RangeError("unsupported channel layout")
  const coefficients = weighting(sampleRate)
  const filters = Array.from({ length: channels }, () => coefficients.map(stage))
  const hop = sampleRate / 10, windowFrames = hop * 4
  const hopEnergies = new Float64Array(4)
  const windows = []
  let frames = 0, completeHops = 0, hopEnergy = 0, correction = 0, result
  return Object.freeze({
    addFrames(data) {
      if (result) throw new Error("candidate already finalized")
      if (!Array.isArray(data) || data.length !== channels) {
        throw new TypeError("expected one Float32Array per channel")
      }
      for (let c = 0; c < channels; c++) {
        if (!(data[c] instanceof Float32Array)) throw new TypeError("expected one Float32Array per channel")
      }
      const count = data[0].length
      if (!count || data.some(c => c.length !== count)) throw new RangeError("unequal or empty channel data")
      if (frames + count > sampleRate * 30) throw new RangeError("research 30-second limit exceeded")
      // Preflight the complete chunk before touching any filter/energy state.
      for (const channel of data) {
        if (typeof SharedArrayBuffer !== "undefined" && channel.buffer instanceof SharedArrayBuffer) {
          throw new TypeError("shared mutable PCM is unsupported")
        }
        for (const sample of channel) if (!Number.isFinite(sample)) throw new RangeError("nonfinite PCM")
      }
      for (let i = 0; i < count; i++) {
        let energy = 0
        for (let c = 0; c < channels; c++) {
          const value = filters[c][1](filters[c][0](data[c][i]))
          energy += value * value
        }
        const adjusted = energy - correction
        const next = hopEnergy + adjusted
        correction = (next - hopEnergy) - adjusted
        hopEnergy = next
        frames++
        if (frames % hop === 0) {
          hopEnergies[completeHops % 4] = hopEnergy
          completeHops++
          hopEnergy = 0; correction = 0
          if (completeHops >= 4) {
            windows.push((hopEnergies[0] + hopEnergies[1] + hopEnergies[2] + hopEnergies[3]) / windowFrames)
          }
        }
      }
    },
    finish() {
      if (!result) {
        const gated = gateWindowEnergies(windows)
        result = Object.freeze({
          profile: CANDIDATE_PROFILE, sampleRate, channels, frames,
          ...gated,
          status: frames < windowFrames ? "insufficient-duration" : gated.status,
        })
      }
      return result
    },
  })
}
