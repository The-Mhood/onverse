export function makeDemoBuffer() {
  const sr = 44100
  const bpm = 126
  const beat = 60 / bpm
  const total = Math.floor(sr * 16)
  const buf = new AudioBuffer({ length: total, numberOfChannels: 2, sampleRate: sr })
  const L = buf.getChannelData(0)
  const R = buf.getChannelData(1)
  const n = (t) => Math.floor(t * sr)
  const add = (start, dur, fn, pan = 0) => {
    const s0 = n(start)
    const s1 = Math.min(total, n(start + dur))
    for (let i = s0; i < s1; i++) {
      const t = (i - s0) / sr
      const v = fn(t, dur)
      const p = Math.max(-1, Math.min(1, pan))
      L[i] += v * (1 - Math.max(0, p) * 0.5)
      R[i] += v * (1 + Math.min(0, p) * 0.5)
    }
  }
  const kick = (t, d) => Math.sin(2 * Math.PI * (110 - 65 * Math.min(1, t / 0.08)) * t) * Math.exp(-t * 9) * 0.85
  const snare = (t, d) => (Math.random() * 2 - 1) * Math.exp(-t * 22) * 0.42
  const hat = (t, d) => (Math.random() * 2 - 1) * Math.exp(-t * 60) * 0.16
  const bass = (t, d, f) => {
    const w = 2 * Math.PI * f
    const s = Math.sin(w * t) + 0.5 * Math.sin(w * 2 * t) + 0.25 * Math.sin(w * 3 * t)
    return s * 0.2 * Math.exp(-t * 3.2) * Math.min(1, t / 0.01)
  }
  const chord = (t, d, freqs) => {
    let s = 0
    for (const f of freqs) {
      s += Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 1.005 * t)
    }
    return s * 0.05 * Math.exp(-t * 0.55)
  }
  const prog = [
    [110, 130.8, 164.8], [87.3, 110, 130.8], [98, 123.5, 146.8], [87.3, 110, 130.8],
  ]
  const bassNotes = [55, 55, 65.4, 55, 49, 49, 55, 49, 43.65, 43.65, 55, 49, 55, 55, 65.4, 49]
  for (let bar = 0; bar < 4; bar++) {
    for (let b = 0; b < 4; b++) {
      const t0 = (bar * 4 + b) * beat
      add(t0, 0.25, kick, 0)
      if (b === 1 || b === 3) add(t0, 0.2, snare, 0)
      add(t0, 0.06, hat, b % 2 ? 0.4 : -0.4)
      add(t0 + beat / 2, 0.05, hat, 0.3)
    }
    add(bar * 4 * beat, beat * 4, (t) => chord(t, beat * 4, prog[bar]), 0.25)
    for (let s = 0; s < 4; s++) {
      const idx = bar * 4 + s
      add((bar * 4 + s) * beat, beat * 0.9, (t) => bass(t, beat * 0.9, bassNotes[idx]), -0.1)
    }
  }
  // normalize to -1 dBFS
  let peak = 0
  for (let i = 0; i < total; i++) {
    if (Math.abs(L[i]) > peak) peak = Math.abs(L[i])
    if (Math.abs(R[i]) > peak) peak = Math.abs(R[i])
  }
  const g = 0.89 / (peak || 1)
  for (let i = 0; i < total; i++) { L[i] *= g; R[i] *= g }
  return buf
}
