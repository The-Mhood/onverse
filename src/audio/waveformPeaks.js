/* MusicOnVerse — waveform peak calculation (preserved from src/ui/draw.js).
 * Pure calculation over an AudioBuffer; no canvas/presentation dependency.
 * Returns a Float32Array of per-column peak amplitudes for `w` columns.
 */
const peakCache = new WeakMap() // AudioBuffer -> { w, peaks }

export function peaksFor(buffer, w) {
  const hit = peakCache.get(buffer)
  if (hit && hit.w === w) return hit.peaks
  const ch = buffer.numberOfChannels
  const data = []
  for (let c = 0; c < ch; c++) data.push(buffer.getChannelData(c))
  const peaks = new Float32Array(w)
  for (let i = 0; i < w; i++) {
    const s = Math.floor((i / w) * buffer.length)
    const e = Math.max(s + 1, Math.floor(((i + 1) / w) * buffer.length))
    let max = 0
    for (let c = 0; c < ch; c++) {
      const d = data[c]
      for (let j = s; j < e; j++) {
        const v = Math.abs(d[j])
        if (v > max) max = v
      }
    }
    peaks[i] = max
  }
  peakCache.set(buffer, { w, peaks })
  return peaks
}
