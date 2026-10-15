/* MusicOnVerse — shared DSP kernels (biquads, FFT, resampling) */

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
export const dbToLin = (db) => Math.pow(10, db / 20)
export const linToDb = (v) => 20 * Math.log10(Math.max(v, 1e-12))

/* ---- RBJ biquad coefficients ----
 * type: "lp" | "hp" | "hs" (high shelf) | "ls" (low shelf) | "pk" (peaking)
 */
export function biquad(type, f0, sr, Q = 0.707, gainDb = 0) {
  const A = Math.pow(10, gainDb / 40)
  const w0 = (2 * Math.PI * f0) / sr
  const cosw = Math.cos(w0)
  const sinw = Math.sin(w0)
  let b0, b1, b2, a0, a1, a2
  if (type === "lp" || type === "hp") {
    const alpha = (sinw / 2) * Math.sqrt(2) // butterworth
    if (type === "lp") {
      b0 = (1 - cosw) / 2; b1 = 1 - cosw; b2 = b0
    } else {
      b0 = (1 + cosw) / 2; b1 = -(1 + cosw); b2 = b0
    }
    a0 = 1 + alpha; a1 = -2 * cosw; a2 = 1 - alpha
  } else if (type === "hs" || type === "ls") {
    const alpha = (sinw / 2) * Math.sqrt(2)
    if (type === "hs") {
      b0 = A * ((A + 1) + (A - 1) * cosw + 2 * Math.sqrt(A) * alpha)
      b1 = -2 * A * ((A - 1) + (A + 1) * cosw)
      b2 = A * ((A + 1) + (A - 1) * cosw - 2 * Math.sqrt(A) * alpha)
      a0 = (A + 1) - (A - 1) * cosw + 2 * Math.sqrt(A) * alpha
      a1 = 2 * ((A - 1) - (A + 1) * cosw)
      a2 = (A + 1) - (A - 1) * cosw - 2 * Math.sqrt(A) * alpha
    } else {
      b0 = A * ((A + 1) - (A - 1) * cosw + 2 * Math.sqrt(A) * alpha)
      b1 = 2 * A * ((A - 1) - (A + 1) * cosw)
      b2 = A * ((A + 1) - (A - 1) * cosw - 2 * Math.sqrt(A) * alpha)
      a0 = (A + 1) + (A - 1) * cosw + 2 * Math.sqrt(A) * alpha
      a1 = -2 * ((A - 1) + (A + 1) * cosw)
      a2 = (A + 1) + (A - 1) * cosw - 2 * Math.sqrt(A) * alpha
    }
  } else {
    // peaking
    const alpha = sinw / (2 * Q)
    b0 = 1 + alpha * A; b1 = -2 * cosw; b2 = 1 - alpha * A
    a0 = 1 + alpha / A; a1 = -2 * cosw; a2 = 1 - alpha / A
  }
  const inv = 1 / a0
  return { b0: b0 * inv, b1: b1 * inv, b2: b2 * inv, a1: a1 * inv, a2: a2 * inv }
}

/* transposed direct-form II — in-place filter on a Float32Array */
export function filterData(data, f) {
  const { b0, b1, b2, a1, a2 } = f
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < data.length; i++) {
    const x = data[i]
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1; x1 = x
    y2 = y1; y1 = y
    data[i] = y
  }
  return data
}

/* ---- radix-2 FFT (forward). re/im are Float64Arrays of length n (power of 2) */
export function makeFFT(n) {
  const bits = Math.round(Math.log2(n))
  const cos = new Float64Array(n / 2)
  const sin = new Float64Array(n / 2)
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n)
    sin[i] = Math.sin((2 * Math.PI * i) / n)
  }
  const rev = new Uint32Array(n)
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    rev[i] = j
  }
  return function fft(re, im) {
    for (let i = 0; i < n; i++) {
      const r = rev[i]
      if (r > i) {
        let t = re[i]; re[i] = re[r]; re[r] = t
        t = im[i]; im[i] = im[r]; im[r] = t
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1
      const step = n / len
      for (let i = 0; i < n; i += len) {
        let k = 0
        for (let j = 0; j < half; j++) {
          const wc = cos[k], ws = sin[k]
          const uRe = re[i + j], uIm = im[i + j]
          const vRe = re[i + j + half] * wc - im[i + j + half] * ws
          const vIm = re[i + j + half] * ws + im[i + j + half] * wc
          re[i + j] = uRe + vRe; im[i + j] = uIm + vIm
          re[i + j + half] = uRe - vRe; im[i + j + half] = uIm - vIm
          k += step
        }
      }
    }
  }
}

/* ---- linear resample of an AudioBuffer to targetRate ---- */
export function resampleBuffer(buffer, targetRate) {
  if (buffer.sampleRate === targetRate) return buffer
  const ratio = targetRate / buffer.sampleRate
  const len = Math.max(1, Math.floor(buffer.length * ratio))
  const out = new AudioBuffer({
    length: len,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: targetRate,
  })
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c)
    const dst = out.getChannelData(c)
    for (let i = 0; i < len; i++) {
      const pos = i / ratio
      const i0 = Math.floor(pos)
      const i1 = Math.min(i0 + 1, src.length - 1)
      const frac = pos - i0
      dst[i] = src[i0] + (src[i1] - src[i0]) * frac
    }
  }
  return out
}

/* retune an AudioBuffer by `cents` (positive = sharper) via resampling */
export function retuneBuffer(buffer, cents) {
  if (Math.abs(cents) < 0.5) return buffer
  const factor = Math.pow(2, cents / 1200)
  return resampleBuffer(buffer, Math.max(1, Math.round(buffer.sampleRate * factor)))
}

/* stereo width: apply gain (dB) to the side signal */
export function widthProcess(buffer, sideDb) {
  if (buffer.numberOfChannels < 2) return buffer
  const g = dbToLin(sideDb)
  const L = buffer.getChannelData(0)
  const R = buffer.getChannelData(1)
  const n = buffer.length
  for (let i = 0; i < n; i++) {
    const m = (L[i] + R[i]) * 0.5
    const s = (L[i] - R[i]) * 0.5 * g
    L[i] = m + s
    R[i] = m - s
  }
  return buffer
}

/* soft ceiling: scale so the peak lands at `db` (e.g. -0.5) */
export function ceilingProcess(buffer, db) {
  let peak = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c)
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i])
      if (a > peak) peak = a
    }
  }
  const target = dbToLin(db)
  if (peak > target) {
    const g = target / peak
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const d = buffer.getChannelData(c)
      for (let i = 0; i < d.length; i++) d[i] *= g
    }
  }
  return buffer
}