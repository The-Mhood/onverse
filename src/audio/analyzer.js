/* MusicOnVerse — analysis engine.
 * Extracts a full mix fingerprint from a decoded AudioBuffer:
 * loudness (LUFS), true peak, dynamics, spectral balance (7 EQ bands),
 * spectral centroid & flatness, pitch stability & tuning, stereo image,
 * tempo, clipping, DC offset and noise floor.
 */
import { biquad, filterData, makeFFT, clamp, dbToLin, linToDb } from "./dsp.js"
import { BAND_KEYS, BAND_META, matchGenre } from "./genre.js"

const nextFrame = () => new Promise((r) => setTimeout(r, 0))
const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length)
const percentile = (arr, p) => {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}
const round = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d)

export function hann(n) {
  const w = new Float64Array(n)
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))
  return w
}

/* ---------------- time domain ---------------- */
function timeDomain(mono, chData) {
  const n = mono.length
  let peak = 0, peakIdx = 0, dcSum = 0, clip = 0, energy = 0
  for (let i = 0; i < n; i++) {
    let clipped = false, frameEnergy = 0
    // Inspect channel samples before downmixing; opposite polarities can cancel.
    for (const channel of chData) {
      const sample = channel[i]
      const magnitude = Math.abs(sample)
      if (magnitude > peak) { peak = magnitude; peakIdx = i }
      if (magnitude >= 0.9992) clipped = true
      frameEnergy += sample * sample
    }
    if (clipped) clip++ // Count affected frames, not duplicated stereo samples.
    energy += frameEnergy / chData.length
    dcSum += mono[i]
  }
  const peakDb = linToDb(peak)
  const dcOffset = dcSum / n
  // Keep crest's RMS denominator consistent with the channel-aware sample peak.
  const rms = Math.sqrt(energy / n)
  const rmsDb = linToDb(rms)

  // true peak via 4x linear oversampling
  let tp = 0
  for (let i = 1; i < n; i++) {
    const a = mono[i - 1], b = mono[i]
    for (let k = 1; k <= 3; k++) {
      const v = a + (b - a) * (k / 4)
      const av = Math.abs(v)
      if (av > tp) tp = av
    }
  }

  // block RMS → crest + noise floor
  const block = Math.floor(mono.length / 1000) // 1000 blocks
  const blockRms = []
  for (let b = 0; b < 1000; b++) {
    let e = 0
    const start = b * block
    const end = Math.min((b + 1) * block, n)
    for (let i = start; i < end; i++) e += mono[i] * mono[i]
    blockRms.push(Math.sqrt(e / (end - start)))
  }
  const sortedRms = [...blockRms].sort((x, y) => x - y)
  const p10 = sortedRms[Math.floor(sortedRms.length * 0.1)] || 1e-6
  const p95 = sortedRms[Math.floor(sortedRms.length * 0.95)] || 1e-6
  const noiseFloorDb = linToDb(sortedRms[0] || 1e-9)
  const dynamicRangeDb = linToDb(p95) - linToDb(p10)
  const crestDb = peakDb - rmsDb
  return { peakDb, peakIdx, dcOffset, rmsDb, truePeakDb: linToDb(tp), clipCount: clip, crestDb, dynamicRangeDb, noiseFloorDb }
}

/* ---------------- loudness (ITU-R BS.1770 K-weighted) ---------------- */
function measureLoudness(mono, sr) {
  const hp = biquad("hp", 38, sr)
  const hs = biquad("hs", 1681.97, sr, 0.707, 1.0047)
  const x = filterData(filterData(mono.slice(), hp), hs)
  const block = Math.max(1, Math.floor(sr * 0.1))
  const blocks = Math.floor(x.length / block)
  const energies = new Float64Array(blocks)
  for (let b = 0; b < blocks; b++) {
    let e = 0
    for (let i = b * block; i < (b + 1) * block; i++) e += x[i] * x[i]
    energies[b] = e / block
  }
  const meanE = mean(energies)
  const lufs = -0.691 + 10 * Math.log10(Math.max(meanE, 1e-12))
  return { lufs, blocks: energies }
}

/* ---------------- spectral (FFT) ---------------- */
async function spectral(mono, sr, onProgress) {
  const FFT_SIZE = 4096
  const HOP = 2048
  const win = hann(FFT_SIZE)
  const n = mono.length
  const frames = Math.max(1, Math.floor((n - FFT_SIZE) / HOP))
  let stride = 1
  while (frames / stride > 4800) stride *= 2
  const total = Math.ceil(frames / stride)
  const mag = new Float64Array(FFT_SIZE / 2)
  const re = new Float64Array(FFT_SIZE)
  const im = new Float64Array(FFT_SIZE)
  const fft = makeFFT(FFT_SIZE)
  let count = 0, done = 0
  for (let f = 0; f < frames; f += stride) {
    const off = f * HOP
    // Short inputs still use one FFT window; zero-pad without reading past PCM.
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = off + i < n ? mono[off + i] * win[i] : 0
      im[i] = 0
    }
    fft(re, im)
    for (let k = 1; k < FFT_SIZE / 2; k++) mag[k] += re[k] * re[k] + im[k] * im[k]
    count++
    if (++done % 220 === 0) {
      onProgress?.(0.2 + 0.45 * (done / total))
      await nextFrame()
    }
  }
  for (let k = 0; k < mag.length; k++) mag[k] /= count

  const binHz = sr / FFT_SIZE
  const edges = [20, 60, 250, 500, 2000, 5000, 10000, 20000]
  const bands = {}
  const raw = {}
  for (let b = 0; b < 7; b++) {
    let e = 0
    const k0 = Math.max(1, Math.floor(edges[b] / binHz))
    const k1 = Math.min(mag.length - 1, Math.ceil(edges[b + 1] / binHz))
    for (let k = k0; k <= k1; k++) e += mag[k]
    raw[BAND_KEYS[b]] = Math.max(e, 1e-18)
  }
  const rawDb = BAND_KEYS.map((k) => 10 * Math.log10(raw[k]))
  const meanDb = mean(rawDb)
  for (const k of BAND_KEYS) bands[k] = rawDb[BAND_KEYS.indexOf(k)] - meanDb

  // centroid
  let num = 0, den = 0
  for (let k = 1; k < mag.length; k++) {
    const freq = k * binHz
    if (freq < 20 || freq > 20000) continue
    num += freq * mag[k]
    den += mag[k]
  }
  const centroid = den > 0 ? num / den : 0

  // spectral flatness (100 Hz – 10 kHz)
  const kA = Math.max(1, Math.floor(100 / binHz))
  const kB = Math.min(mag.length - 1, Math.ceil(10000 / binHz))
  let sum = 0, logSum = 0, cnt = 0
  for (let k = kA; k <= kB; k++) {
    const v = Math.max(mag[k], 1e-14)
    sum += v
    logSum += Math.log(v)
    cnt++
  }
  const flatness = cnt ? Math.exp(logSum / cnt) / (sum / cnt) : 0

  return { bands, centroid, flatness, spectrum: mag.slice(1, 129) }
}

/* ---------------- pitch stability (autocorrelation) ---------------- */
function pitchAnalysis(mono, sr) {
  const dec = Math.max(1, Math.round(sr / 2000))
  const lp = biquad("lp", 700, sr)
  const lpSig = filterData(mono.slice(), lp)
  const dl = new Float32Array(Math.floor(lpSig.length / dec))
  for (let i = 0; i < dl.length; i++) dl[i] = lpSig[i * dec]
  const srd = sr / dec
  const win = 512, hop = 256
  const minLag = Math.max(2, Math.floor(srd / 550))
  const maxLag = Math.min(win / 2, Math.ceil(srd / 28))
  const freqs = []
  let voiced = 0, frames = 0
  for (let off = 0; off + win <= dl.length; off += hop) {
    frames++
    let m = 0
    for (let i = 0; i < win; i++) m += dl[off + i]
    m /= win
    let bestLag = 0, bestVal = 0
    for (let lag = minLag; lag <= maxLag; lag++) {
      let num = 0, d1 = 0, d2 = 0
      for (let i = 0; i < win - lag; i++) {
        const a = dl[off + i] - m
        const b = dl[off + i + lag] - m
        num += a * b
        d1 += a * a
        d2 += b * b
      }
      const v = num / Math.sqrt(d1 * d2 + 1e-12)
      if (v > bestVal) { bestVal = v; bestLag = lag }
    }
    if (bestVal > 0.42 && bestLag > 0) {
      voiced++
      freqs.push(srd / bestLag)
    }
  }
  if (!freqs.length) {
    return { medianHz: 0, stability: 0, tuningCents: 0, voicedRatio: 0, frames, stdSemitones: 0, voicing: 0 }
  }
  const median = percentile(freqs, 0.5)
  const close = freqs.filter((f) => f > median / 2.3 && f < median * 2.3)
  const logs = close.map((f) => Math.log2(f))
  const mLog = mean(logs)
  const sd = Math.sqrt(mean(logs.map((l) => (l - mLog) ** 2)))
  const stdSemitones = sd * 12
  const stability = clamp(1 - stdSemitones / 1.6, 0, 1)
  let cents = 1200 * Math.log2(median / 440)
  cents = ((cents + 600) % 1200 + 1200) % 1200 - 600
  const voicing = voiced / frames
  return {
    medianHz: median,
    stability,
    tuningCents: Math.abs(cents) < 250 ? cents : 0,
    voicedRatio: voicing,
    frames,
    stdSemitones,
    voicing,
  }
}

/* ---------------- stereo ---------------- */
function stereoAnalysis(chData) {
  if (chData.length < 2) {
    return { corr: 1, widthDb: -40, mono: true }
  }
  const L = chData[0], R = chData[1]
  const n = Math.min(L.length, R.length)
  let lr = 0, ll = 0, rr = 0, mid = 0, side = 0
  for (let i = 0; i < n; i++) {
    const l = L[i], r = R[i]
    lr += l * r; ll += l * l; rr += r * r
    const m = (l + r) * 0.5, s = (l - r) * 0.5
    mid += m * m; side += s * s
  }
  const corr = lr / Math.sqrt(ll * rr + 1e-12)
  const widthDb = 10 * Math.log10(side / mid + 1e-12)
  return { corr: clamp(corr, -1, 1), widthDb, mono: false }
}

/* ---------------- tempo ---------------- */
function tempoAnalysis(mono, sr) {
  const hop = Math.max(1, Math.floor(sr * 0.01))
  const env = []
  for (let i = 0; i < mono.length; i += hop) {
    let e = 0
    const end = Math.min(i + hop, mono.length)
    for (let j = i; j < end; j++) e += mono[j] * mono[j]
    env.push(Math.sqrt(e / (end - i)))
  }
  const minL = Math.max(2, Math.floor(0.28 / 0.01))
  const maxL = Math.min(env.length - 2, Math.ceil(1.2 / 0.01))
  let bestLag = minL, best = 0
  for (let lag = minL; lag <= maxL; lag++) {
    let num = 0, d1 = 0, d2 = 0
    for (let i = 0; i < env.length - lag; i++) {
      num += env[i] * env[i + lag]
      d1 += env[i] * env[i]
      d2 += env[i + lag] * env[i + lag]
    }
    const v = num / Math.sqrt(d1 * d2 + 1e-12)
    if (v > best) { best = v; bestLag = lag }
  }
  let bpm = 60 / ((bestLag * hop) / sr)
  while (bpm < 70) bpm *= 2
  while (bpm > 200) bpm /= 2
  return { bpm: Math.round(bpm), confidence: clamp(best, 0, 1) }
}

/* ---------------- main entry ---------------- */
export async function analyze(buffer, onProgress) {
  onProgress?.(0.05)
  const sr = buffer.sampleRate
  const len = buffer.length
  const channels = buffer.numberOfChannels
  const chData = []
  for (let c = 0; c < channels; c++) chData.push(buffer.getChannelData(c))
  const mono = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    let s = 0
    for (let c = 0; c < channels; c++) s += chData[c][i]
    mono[i] = s / channels
  }

  const td = timeDomain(mono, chData)
  onProgress?.(0.14)
  await nextFrame()

  const { lufs, blocks: lufsBlocks } = measureLoudness(mono, sr)
  onProgress?.(0.2)
  await nextFrame()

  const sp = await spectral(mono, sr, onProgress)
  onProgress?.(0.66)
  await nextFrame()

  const pitch = pitchAnalysis(mono, sr)
  onProgress?.(0.8)
  await nextFrame()

  const stereo = stereoAnalysis(chData)
  onProgress?.(0.88)
  await nextFrame()

  const tempo = tempoAnalysis(mono, sr)
  onProgress?.(0.96)
  await nextFrame()

  const blockLoud = Array.from(lufsBlocks, (e) => -0.691 + 10 * Math.log10(Math.max(e, 1e-12)))
  const shortTermMax = percentile(blockLoud, 0.95)
  const shortTermMin = percentile(blockLoud, 0.1)
  const dynamicLufs = shortTermMax - shortTermMin

  const features = {
    duration: len / sr,
    sampleRate: sr,
    channels,
    peakDb: td.peakDb,
    truePeakDb: td.truePeakDb,
    rmsDb: td.rmsDb,
    lufs,
    crestDb: td.crestDb,
    dynamicRangeDb: td.dynamicRangeDb,
    dynamicLufs,
    noiseFloorDb: td.noiseFloorDb,
    dcOffset: td.dcOffset,
    clipCount: td.clipCount,
    centroid: sp.centroid,
    flatness: sp.flatness,
    bands: sp.bands,
    spectrum: sp.spectrum,
    pitch,
    stereo,
    tempo,
  }
  onProgress?.(1)
  await nextFrame()
  return features
}

/* ---------------- scoring + issues ---------------- */
const scorePct = (v) => Math.round(clamp(v, 0, 100))

export function scoreAnalysis(f, g) {
  const loudnessScore = scorePct(100 - Math.abs(f.lufs - g.lufs) * 7)
  const bandDevs = BAND_KEYS.map((k) => Math.abs(f.bands[k] - g.bands[k]))
  const eqScore = scorePct(100 - mean(bandDevs) * 16)
  const pitchScore = scorePct(
    f.pitch.stability * 80 +
    (1 - Math.min(Math.abs(f.pitch.tuningCents) / 60, 1)) * 10 +
    f.pitch.voicedRatio * 10,
  )
  const corrDev = Math.abs(f.stereo.corr - g.corr)
  const widthScore = scorePct(100 - (corrDev * 40 + Math.abs(f.stereo.widthDb - g.width) * 1.5))
  const crestScore = scorePct(100 - Math.abs(f.crestDb - g.crest) * 6)
  const centDev = Math.abs(Math.log2(Math.max(f.centroid, 60) / g.centroid))
  const clarityScore = scorePct(100 - (centDev * 28 + f.flatness * 35 + Math.max(0, -55 - f.noiseFloorDb) * 0.5))
  const overall = Math.round(
    0.18 * loudnessScore + 0.24 * eqScore + 0.12 * pitchScore +
    0.12 * widthScore + 0.14 * crestScore + 0.2 * clarityScore,
  )
  return { overall, loudness: loudnessScore, eq: eqScore, pitch: pitchScore, width: widthScore, dynamics: crestScore, clarity: clarityScore }
}

/* friendly, specific findings + the fix directive each one maps to */
export function buildIssues(f, g, s) {
  const issues = []
  const positives = []
  /* what this run is being matched against (platform profiles vs user reference) */
  const platformPhrase = g.realm || "Spotify's top tracks in this genre"
  const besidePhrase = g.realm || "Spotify's top tracks"

  // loudness
  const ld = f.lufs - g.lufs
  if (Math.abs(ld) > 1.5) {
    issues.push({
      severity: Math.abs(ld) > 4 ? "critical" : "warning",
      feature: "Loudness",
      title: ld > 0 ? `Too loud for ${g.name} (${round(f.lufs)} LUFS vs ${round(g.lufs)} reference)` : `Too quiet for ${g.name} (${round(f.lufs)} LUFS vs ${round(g.lufs)} reference)`,
      detail: ld > 0
        ? `Your track sits ${round(Math.abs(ld))} dB hotter than the ${g.name} reference. Streaming platforms will turn it DOWN, flattening dynamics and making it feel harsh next to ${platformPhrase}.`
        : `Your track sits ${round(Math.abs(ld))} dB quieter than the ${g.name} reference. Streaming services will turn it UP, which pushes the noise floor and can make transients sound mushy.`,
      fix: { type: "gain", amount: round(-ld) },
      fixLabel: ld > 0 ? `Trim level ${round(Math.abs(ld))} dB` : `Boost level ${round(Math.abs(ld))} dB`,
    })
  } else {
    positives.push(`Loudness is spot-on for ${g.name} (${round(f.lufs)} LUFS vs ${round(g.lufs)} reference) — it will sit perfectly beside ${besidePhrase}.`)
  }

  // EQ balance
  const devs = BAND_KEYS.map((k) => ({ k, dev: f.bands[k] - g.bands[k] }))
  const badBands = devs.filter((d) => Math.abs(d.dev) > 1.8)
  if (badBands.length) {
    const worst = badBands.sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev))[0]
    const bandName = BAND_META[worst.k].name
    issues.push({
      severity: badBands.length >= 3 || Math.abs(worst.dev) > 4 ? "critical" : "warning",
      feature: "EQ Balance",
      title: `${badBands.length} frequency range${badBands.length > 1 ? "s" : ""} out of balance (worst: ${bandName} ${worst.dev > 0 ? "+" : ""}${round(worst.dev)} dB)`,
      detail: badBands.map(({ k, dev }) =>
        `${BAND_META[k].name} (${BAND_META[k].range}) is ${Math.abs(dev) > 2.5 ? "well " : ""}${dev > 0 ? "over-represented" : "under-represented"} by ${round(Math.abs(dev))} dB vs the ${g.name} reference.`
      ).join(" ") + ` In this genre the reference tracks' ${badBands[0] ? BAND_META[badBands[0].k].name.toLowerCase() : "spectrum"} sits differently — matching it is what makes a mix translate on phone speakers, cars and clubs.`,
      fix: { type: "eq", bands: badBands.map(({ k, dev }) => ({ k, gain: -dev })) },
      fixLabel: `Correct ${badBands.length} band${badBands.length > 1 ? "s" : ""} toward ${g.name} reference`,
    })
  } else {
    positives.push("The 7-band EQ balance hugs the genre reference curve — nothing is fighting for the same frequencies.")
  }

  // sub rumble / mud
  const subDev = f.bands.sub - g.bands.sub
  if (subDev > 2.5) {
    issues.push({
      severity: "warning",
      feature: "Sub & Rumble",
      title: `Sub bass is ${round(subDev)} dB too heavy (${round(f.bands.sub, 0)} dB vs ${round(g.bands.sub, 0)} dB)`,
      detail: "Excess energy below 60 Hz usually means room rumble, a boomy kick or over-aggressive sub bass. It eats headroom and sounds muddy on speakers that can't reproduce it.",
      fix: { type: "highpass", freq: 26 },
      fixLabel: "Roll off rumble below 26 Hz",
    })
  }

  // dynamics
  const cd = f.crestDb - g.crest
  if (cd > 4) {
    issues.push({
      severity: cd > 8 ? "critical" : "warning",
      feature: "Dynamics",
      title: `Too dynamic — crest ${round(f.crestDb)} dB vs ${round(g.crest)} dB reference`,
      detail: "The gap between your quietest and loudest moments is wider than the reference tracks. Quiet parts will get lost and loud parts will pump when streaming normalizes the track.",
      fix: { type: "compress", ratio: cd > 8 ? 2.6 : 1.9, threshold: -16 - Math.min(cd, 8) * 0.5 },
      fixLabel: "Apply gentle glue compression",
    })
  } else if (cd < -4) {
    issues.push({
      severity: "warning",
      feature: "Dynamics",
      title: `Over-compressed — crest ${round(f.crestDb)} dB vs ${round(g.crest)} dB reference`,
      detail: "The mix is flatter than the reference. It will sound loud but lifeless; transients (drums, plucks, syllables) won't cut through.",
      fix: { type: "note" },
      fixLabel: "Rebalance from the source stems (no fix can fully restore squashed transients)",
    })
  } else {
    positives.push(`Dynamics are in the sweet spot for ${g.name} (crest ${round(f.crestDb)} dB).`)
  }

  // clipping
  if (f.clipCount > 0) {
    issues.push({
      severity: f.clipCount > 1000 ? "critical" : "warning",
      feature: "Headroom & Clipping",
      title: `${f.clipCount.toLocaleString()} sample${f.clipCount > 1 ? "s" : ""} at full scale — inter-sample clipping risk`,
      detail: `Peaks touch 0 dBFS (true peak ${round(f.truePeakDb)} dB). Lossy encoding will distort these moments. Reference tracks keep true peaks around -1 dBFS.`,
      fix: { type: "ceiling", db: -1 },
      fixLabel: "Apply true-peak ceiling at -1 dBFS",
    })
  }

  // pitch stability
  if (f.pitch.voicedRatio > 0.15) {
    if (f.pitch.stability < 0.55) {
      issues.push({
        severity: "warning",
        feature: "Pitch Stability",
        title: `Pitch wanders (${round(f.pitch.stdSemitones)} semitone drift around ${Math.round(f.pitch.medianHz)} Hz)`,
        detail: "The low-end/pitched content drifts more than reference tracks. This is usually a performance take or an un-quantized synth. Slight drift is human and fine — this much reads as out of tune.",
        fix: { type: "note" },
        fixLabel: "Tune the source performance (vocal tuning / oscillator retune)",
      })
    } else {
      positives.push(`Pitch is rock-stable (${round(f.pitch.stdSemitones)} st drift around ${Math.round(f.pitch.medianHz)} Hz).`)
    }
    if (Math.abs(f.pitch.tuningCents) > 15 && f.pitch.tuningCents) {
      issues.push({
        severity: "warning",
        feature: "Tuning Offset",
        title: `Track is ${f.pitch.tuningCents > 0 ? "sharp" : "flat"} by ${round(Math.abs(f.pitch.tuningCents), 0)} cents`,
        detail: "The whole track sits off concert pitch. Compared to Spotify's top tracks (which are tuned to A=440 Hz) it will feel slightly off even when the performance is perfect.",
        fix: { type: "retune", cents: -f.pitch.tuningCents },
        fixLabel: `Retune by ${round(Math.abs(f.pitch.tuningCents), 0)} cents to A=440`,
      })
    }
  }

  // stereo
  if (!f.stereo.mono) {
    const wDev = f.stereo.widthDb - g.width
    if (wDev < -5) {
      issues.push({
        severity: "warning",
        feature: "Stereo Image",
        title: `Too narrow — width ${round(f.stereo.widthDb)} dB vs ${round(g.width)} dB reference`,
        detail: `The mix is ${round(Math.abs(wDev))} dB narrower than the ${g.name} reference. It will sound small on headphones and collapse on phone speakers.`,
        fix: { type: "width", side: Math.min(6, Math.max(2, -wDev * 0.6)) },
        fixLabel: "Widen stereo image toward reference",
      })
    } else if (wDev > 6) {
      issues.push({
        severity: "warning",
        feature: "Stereo Image",
        title: `Too wide — ${round(wDev)} dB past the ${g.name} reference`,
        detail: "Extreme width can cause phase problems when collapsed to mono (phone speakers, clubs) and smear the center vocal.",
        fix: { type: "width", side: -Math.min(6, wDev * 0.5) },
        fixLabel: "Tighten stereo image toward reference",
      })
    } else {
      positives.push(`Stereo width matches the ${g.name} reference (${round(f.stereo.widthDb)} dB, correlation ${round(f.stereo.corr, 2)}).`)
    }
  } else {
    issues.push({
      severity: "warning",
      feature: "Stereo Image",
      title: "Mono source detected",
      detail: "The file has a single channel. Reference tracks are stereo, which is part of what makes them feel wide and expensive.",
      fix: { type: "note" },
      fixLabel: "Re-export the file in stereo from your DAW",
    })
  }

  // clarity / hiss
  if (f.flatness > 0.28) {
    issues.push({
      severity: "warning",
      feature: "Clarity & Noise",
      title: `High noise character (spectral flatness ${round(f.flatness, 2)})`,
      detail: `The spectrum is flatter than the ${g.name} reference — hiss, tape noise or a dull high end. Quiet passages will sound grainy.`,
      fix: { type: "dehiss", gain: -Math.min(4, Math.max(2, (f.flatness - 0.28) * 12)) },
      fixLabel: "Smooth high-end noise",
    })
  }
  const signedCentDev = Math.log2(Math.max(f.centroid, 60) / g.centroid)
  if (Math.abs(signedCentDev) > 0.3 && s.clarity < 70) {
    const brighter = signedCentDev > 0
    issues.push({
      severity: "warning",
      feature: "Spectral Balance",
      title: `Timbre sits ${brighter ? "brighter" : "darker"} than ${g.name} (centroid ${Math.round(f.centroid)} Hz vs ${g.centroid} Hz)`,
      detail: brighter
        ? "The mix is brighter than the reference — sibilance and harsh highs may fatigue the ear."
        : `The mix is darker than the reference — it will sound dull and muffled next to ${besidePhrase}.`,
      
      fix: { type: "note" },
      fixLabel: "Sculpt brightness in the reference direction (partially covered by EQ fix)",
    })
  }

  // dc offset
  if (Math.abs(f.dcOffset) > 0.01) {
    issues.push({
      severity: "warning",
      feature: "DC Offset",
      title: `DC offset detected (${round(f.dcOffset, 3)})`,
      detail: "A constant offset pushes the waveform off-center, wasting headroom and causing a low-end 'thump' on some systems.",
      fix: { type: "dc" },
      fixLabel: "Remove DC offset",
    })
  }

  return { issues, positives }
}

/* ---------------- fix plan ---------------- */
export function buildFixPlan(f, g) {
  const plan = { eq: [], gain: dbToLin(Math.max(0, g.lufs - f.lufs)), targetLufs: g.lufs }
  if (Math.abs(f.lufs - g.lufs) <= 1.5) plan.gain = 1
  const { issues } = buildIssues(f, g, scoreAnalysis(f, g))
  for (const it of issues) {
    const fx = it.fix
    if (fx.type === "gain") plan.gain = dbToLin(Number(fx.amount))
    if (fx.type === "highpass") plan.highpass = fx.freq
    if (fx.type === "eq") plan.eq.push(...fx.bands.map(({ k, gain }) => ({ k, gain: clamp(gain, -9, 9) })))
    if (fx.type === "compress") {
      const excess = Math.max(0, f.crestDb - g.crest)
      plan.compress = {
        ratio: fx.ratio,
        threshold: fx.threshold,
        // size the glue to the crest excess so loudness is actually reachable
        ratio: Math.min(3.2, 1.6 + excess * 0.16),
        threshold: -16 - Math.min(excess * 0.8, 8),
      }
    }
    if (fx.type === "width") plan.width = fx.side
    if (fx.type === "dehiss") plan.dehiss = fx.gain
    if (fx.type === "ceiling") plan.ceiling = fx.db
    if (fx.type === "retune") plan.retune = fx.cents
    if (fx.type === "dc") plan.dc = true
  }
  return plan
}

/* integrated loudness of a decoded AudioBuffer (for post-fix trim) */
export function quickLufs(buffer) {
  const ch = buffer.numberOfChannels
  const len = buffer.length
  const mono = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    let s = 0
    for (let c = 0; c < ch; c++) s += buffer.getChannelData(c)[i]
    mono[i] = s / ch
  }
  return measureLoudness(mono, buffer.sampleRate).lufs
}

/* Build a genre-profile-shaped target from a measured reference feature set,
 * so a user's own track (or a streamed preview) can act as the reference. */
export function targetFromFeatures(f, meta = {}) {
  return {
    name: meta.name || "Custom reference",
    source: meta.source || "custom",
    realm: meta.realm || "your reference track",
    lufs: f.lufs,
    crest: f.crestDb,
    centroid: f.centroid,
    corr: f.stereo.corr,
    width: f.stereo.widthDb,
    bands: { ...f.bands },
    measured: true,
  }
}

/* quick post-fix re-measure (loudness + bands only) */
export async function analyzeFast(buffer, onProgress) {
  const sr = buffer.sampleRate
  const ch = buffer.numberOfChannels
  const chData = []
  for (let c = 0; c < ch; c++) chData.push(buffer.getChannelData(c))
  const mono = new Float32Array(buffer.length)
  for (let i = 0; i < buffer.length; i++) {
    let s = 0
    for (let c = 0; c < ch; c++) s += chData[c][i]
    mono[i] = s / ch
  }
  const td = timeDomain(mono, chData)
  onProgress?.(0.3)
  await nextFrame()
  const { lufs } = measureLoudness(mono, sr)
  onProgress?.(0.6)
  await nextFrame()
  const sp = await spectral(mono, sr, (p) => onProgress?.(0.6 + p * 0.4))
  return { lufs, peakDb: td.peakDb, truePeakDb: td.truePeakDb, crestDb: td.crestDb, bands: sp.bands, centroid: sp.centroid, flatness: sp.flatness }
}