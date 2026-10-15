/* MusicOnVerse — canvas renderers: radar chart + waveform (with peak caching) */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const peakCache = new WeakMap() // AudioBuffer -> { w, peaks }

function peaksFor(buffer, w) {
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

export function drawRadar(canvas, scores) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = canvas.clientWidth || 300
  const h = canvas.clientHeight || 300
  if (!w || !h) return
  canvas.width = w * dpr
  canvas.height = h * dpr
  const ctx = canvas.getContext("2d")
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, w, h)

  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) / 2 - 20
  const keys = ["loudness", "eq", "pitch", "width", "dynamics", "clarity"]
  const labels = ["LOUDNESS", "EQ BALANCE", "PITCH", "STEREO", "DYNAMICS", "CLARITY"]
  const n = keys.length

  const pt = (i, r) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
  }

  // rings
  for (let ring = 1; ring <= 4; ring++) {
    const r = (R * ring) / 4
    ctx.beginPath()
    for (let i = 0; i <= n; i++) {
      const [x, y] = pt(i % n, r)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.strokeStyle = "rgba(127,169,204,0.10)"
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // spokes
  for (let i = 0; i < n; i++) {
    const [x, y] = pt(i, R)
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(x, y)
    ctx.strokeStyle = "rgba(127,169,204,0.12)"
    ctx.stroke()
  }

  // data polygon
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
  grad.addColorStop(0, "rgba(127,169,204,0.45)")
  grad.addColorStop(1, "rgba(74,111,143,0.28)")
  ctx.beginPath()
  for (let i = 0; i <= n; i++) {
    const r = R * clamp((scores[keys[i % n]] || 0) / 100, 0.05, 1)
    const [x, y] = pt(i % n, r)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = "rgba(127,169,204,0.9)"
  ctx.lineWidth = 1.6
  ctx.shadowColor = "rgba(127,169,204,0.45)"
  ctx.shadowBlur = 12
  ctx.stroke()
  ctx.shadowBlur = 0

  // vertices + labels
  ctx.font = "600 9px 'Share Tech Mono', monospace"
  ctx.textAlign = "center"
  for (let i = 0; i < n; i++) {
    const [x, y] = pt(i, R * clamp((scores[keys[i]] || 0) / 100, 0.05, 1))
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fillStyle = "#b89d84"
    ctx.shadowColor = "rgba(184,157,132,0.7)"
    ctx.shadowBlur = 8
    ctx.fill()
    ctx.shadowBlur = 0
    const [lx, ly] = pt(i, R + 15)
    ctx.fillStyle = "rgba(223,230,238,0.62)"
    ctx.fillText(labels[i], lx, ly + 3)
  }
}

export function drawWaveform(canvas, buffer, { progress = 0, overlay = null, region = null } = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = canvas.clientWidth || 600
  const h = canvas.clientHeight || 120
  if (!w || !h) return
  canvas.width = w * dpr
  canvas.height = h * dpr
  const ctx = canvas.getContext("2d")
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, w, h)

  if (!buffer) return

  const draw = (buf, color, alpha) => {
    const peaks = peaksFor(buf, w)
    const mid = h / 2
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    ctx.beginPath()
    for (let i = 0; i < w; i++) {
      const barH = Math.max(1.5, peaks[i] * mid * 1.7)
      const x = i
      ctx.moveTo(x, mid - barH)
      ctx.lineTo(x + 0.7, mid - barH)
      ctx.lineTo(x + 0.7, mid + barH)
      ctx.lineTo(x, mid + barH)
    }
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // crop region shading (fractions of the primary buffer)
  if (region && region.in < region.out) {
    const x0 = clamp(region.in, 0, 1) * w
    const x1 = clamp(region.out, 0, 1) * w
    ctx.fillStyle = "rgba(127,169,204,0.10)"
    ctx.fillRect(x0, 0, Math.max(1, x1 - x0), h)
    ctx.strokeStyle = "rgba(127,169,204,0.85)"
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.moveTo(Math.round(x0) + 0.5, 0)
    ctx.lineTo(Math.round(x0) + 0.5, h)
    ctx.moveTo(Math.round(x1) + 0.5, 0)
    ctx.lineTo(Math.round(x1) + 0.5, h)
    ctx.stroke()
    ctx.setLineDash([])
  }

  draw(buffer, "rgba(127,169,204,0.85)", 0.9)
  if (overlay) draw(overlay, "rgba(111,184,168,0.7)", 0.7)

  // progress glow
  if (progress > 0) {
    const x = clamp(progress, 0, 1) * w
    const g = ctx.createLinearGradient(x - 22, 0, x, 0)
    g.addColorStop(0, "rgba(184,157,132,0)")
    g.addColorStop(1, "rgba(184,157,132,0.85)")
    ctx.fillStyle = g
    ctx.fillRect(x - 22, 0, 22, h)
    ctx.fillStyle = "#b89d84"
    ctx.shadowColor = "rgba(184,157,132,0.7)"
    ctx.shadowBlur = 10
    ctx.fillRect(x - 1, 0, 2, h)
    ctx.shadowBlur = 0
  }
}