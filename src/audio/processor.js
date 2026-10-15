/* MusicOnVerse — output processor.
 * Format conversion (WAV / MP3 / M4A-AAC / OGG-Opus / WebM-Opus) and the
 * one-click "Master Fix" that reverse-engineers every issue the analysis
 * found and renders a corrected copy of the file.
 */
import lameAllSource from "lamejs/lame.all.js?raw"
import { resampleBuffer, retuneBuffer, widthProcess, ceilingProcess, clamp, dbToLin } from "./dsp.js"
import { BAND_META } from "./genre.js"
import { quickLufs } from "./analyzer.js"

/* lamejs 1.2.1's CJS build is broken (missing requires); the self-contained
 * lame.all.js build defines everything in one scope, so we evaluate it once. */
let _lame = null
function getLame() {
  if (!_lame) {
    const fn = new Function(lameAllSource + "\nreturn lamejs;")
    _lame = fn()
  }
  return _lame
}

/* ---------------- decode ---------------- */
export async function decodeFile(file) {
  const ab = await file.arrayBuffer()
  const ctx = new AudioContext()
  try {
    return await ctx.decodeAudioData(ab)
  } finally {
    await ctx.close()
  }
}

/* ---------------- WAV encode ---------------- */
function writeStr(dv, off, s) {
  for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i))
}

export function encodeWav(buffer, { float = true } = {}) {
  const ch = buffer.numberOfChannels
  const sr = buffer.sampleRate
  const len = buffer.length
  const bytesPerSample = float ? 4 : 2
  const dataSize = len * ch * bytesPerSample
  const ab = new ArrayBuffer(44 + dataSize)
  const dv = new DataView(ab)
  writeStr(dv, 0, "RIFF")
  dv.setUint32(4, 36 + dataSize, true)
  writeStr(dv, 8, "WAVE")
  writeStr(dv, 12, "fmt ")
  dv.setUint32(16, 16, true)
  dv.setUint16(20, float ? 3 : 1, true)
  dv.setUint16(22, ch, true)
  dv.setUint32(24, sr, true)
  dv.setUint32(28, sr * ch * bytesPerSample, true)
  dv.setUint16(32, ch * bytesPerSample, true)
  dv.setUint16(34, float ? 32 : 16, true)
  writeStr(dv, 36, "data")
  dv.setUint32(40, dataSize, true)
  let o = 44
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const s = clamp(buffer.getChannelData(c)[i], -1, 1)
      if (float) dv.setFloat32(o, s, true)
      else dv.setInt16(o, Math.round(s * 32767), true)
      o += bytesPerSample
    }
  }
  return new Blob([ab], { type: "audio/wav" })
}

/* ---------------- MP3 encode (lamejs) ---------------- */
export function encodeMp3(buffer, kbps = 320) {
  const b = resampleBuffer(buffer, 44100)
  const ch = b.numberOfChannels >= 2 ? 2 : 1
  const L = b.getChannelData(0)
  const R = ch === 2 ? b.getChannelData(1) : null
  const enc = new (getLame().Mp3Encoder)(ch, 44100, kbps)
  const toInt16 = (arr) => {
    const out = new Int16Array(arr.length)
    for (let i = 0; i < arr.length; i++) out[i] = Math.round(clamp(arr[i], -1, 1) * 32767)
    return out
  }
  const blockSize = 1152
  const chunks = []
  for (let i = 0; i < L.length; i += blockSize) {
    const l = toInt16(L.subarray(i, i + blockSize))
    const r = R ? toInt16(R.subarray(i, i + blockSize)) : null
    const buf = ch === 2 ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l)
    if (buf.length) chunks.push(new Uint8Array(buf))
  }
  const end = enc.flush()
  if (end.length) chunks.push(new Uint8Array(end))
  return new Blob(chunks, { type: "audio/mpeg" })
}

/* ---------------- MediaRecorder-based encode (AAC / Opus) ---------------- */
const RECORDERS = [
  { fmt: "m4a", ext: "m4a", mime: "audio/mp4", label: "M4A · AAC" },
  { fmt: "ogg", ext: "ogg", mime: "audio/ogg; codecs=opus", label: "OGG · Opus" },
  { fmt: "webm", ext: "webm", mime: "audio/webm; codecs=opus", label: "WEBM · Opus" },
]

export function supportedRecorders() {
  if (typeof MediaRecorder === "undefined") return []
  return RECORDERS.filter((r) => MediaRecorder.isTypeSupported(r.mime))
}

export async function encodeViaRecorder(buffer, fmt) {
  const rec = RECORDERS.find((r) => r.fmt === fmt)
  if (!rec) throw new Error(`Unsupported format: ${fmt}`)
  const ctx = new AudioContext({ sampleRate: Math.min(buffer.sampleRate, 48000) })
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const dest = ctx.createMediaStreamDestination()
  src.connect(dest)
  const recorder = new MediaRecorder(dest.stream, { mimeType: rec.mime, audioBitsPerSecond: 256000 })
  const chunks = []
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
  const stopped = new Promise((r) => { recorder.onstop = r })
  recorder.start()
  src.start(0)
  await new Promise((r) => setTimeout(r, buffer.duration * 1000 + 500))
  recorder.stop()
  await stopped
  await ctx.close()
  return new Blob(chunks, { type: recorder.mimeType || rec.mime })
}

/* soft limiter: shaves peaks above `db` while preserving integrated loudness */
function softLimit(buffer, db) {
  const T = dbToLin(db)
  const k = 6
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c)
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i])
      if (a > T) {
        const s = Math.sign(d[i])
        const y = T + (a - T) / (1 + ((a - T) / T) * k)
        d[i] = s * Math.min(y, T * 1.06)
      }
    }
  }
  return buffer
}

/* ---------------- convert ---------------- */
export async function convert(buffer, { format, kbps = 320, floatWav = true }) {
  switch (format) {
    case "wav":
      return { blob: encodeWav(buffer, { float: floatWav }), ext: "wav", mime: "audio/wav", label: "WAV · PCM" }
    case "mp3":
      return { blob: encodeMp3(buffer, kbps), ext: "mp3", mime: "audio/mpeg", label: `MP3 · ${kbps}k` }
    case "m4a":
    case "ogg":
    case "webm": {
      const blob = await encodeViaRecorder(buffer, format)
      const meta = RECORDERS.find((r) => r.fmt === format)
      return { blob, ext: meta.ext, mime: meta.mime, label: meta.label }
    }
    default:
      throw new Error(`Unknown target format: ${format}`)
  }
}

/* ---------------- one-click Master Fix ---------------- */
export async function masterFix(buffer, plan, onStage) {
  let work = buffer
  if (plan.retune) {
    onStage?.("Retuning to A=440")
    work = retuneBuffer(work, plan.retune)
  }
  const sr = work.sampleRate
  const len = work.length
  const ch = work.numberOfChannels
  const ctx = new OfflineAudioContext(ch, len, sr)
  const src = ctx.createBufferSource()
  src.buffer = work
  let node = src

  if (plan.dc) {
    onStage?.("Removing DC offset")
    const f = ctx.createBiquadFilter()
    f.type = "highpass"
    f.frequency.value = 18
    node.connect(f)
    node = f
  }
  if (plan.highpass) {
    onStage?.("Rolling off sub rumble")
    const f = ctx.createBiquadFilter()
    f.type = "highpass"
    f.frequency.value = plan.highpass
    node.connect(f)
    node = f
  }
  if (plan.eq && plan.eq.length) {
    onStage?.(`Correcting ${plan.eq.length} EQ band${plan.eq.length > 1 ? "s" : ""}`)
    for (const e of plan.eq) {
      const f = ctx.createBiquadFilter()
      f.type = BAND_META[e.k].kind === "ls" ? "lowshelf" : BAND_META[e.k].kind === "hs" ? "highshelf" : "peaking"
      f.frequency.value = BAND_META[e.k].freq
      f.Q.value = 1.1
      f.gain.value = clamp(e.gain, -9, 9)
      node.connect(f)
      node = f
    }
  }
  if (plan.dehiss) {
    onStage?.("Smoothing high-end noise")
    const f = ctx.createBiquadFilter()
    f.type = "highshelf"
    f.frequency.value = 8000
    f.gain.value = clamp(plan.dehiss, -8, 0)
    node.connect(f)
    node = f
  }
  if (plan.compress) {
    onStage?.("Applying glue compression")
    const c = ctx.createDynamicsCompressor()
    c.threshold.value = plan.compress.threshold
    c.ratio.value = plan.compress.ratio
    c.attack.value = 0.015
    c.release.value = 0.25
    node.connect(c)
    node = c
  }
  if (plan.gain && Math.abs(plan.gain - 1) > 0.001) {
    onStage?.("Normalizing loudness")
    const g = ctx.createGain()
    g.gain.value = plan.gain
    node.connect(g)
    node = g
  }
  node.connect(ctx.destination)
  src.start(0)

  let rendered = await ctx.startRendering()

  if (plan.width) {
    onStage?.("Correcting stereo image")
    rendered = widthProcess(rendered, clamp(plan.width, -6, 6))
  }
  if (plan.targetLufs) {
    onStage?.("Trimming to reference loudness")
    const now = quickLufs(rendered)
    const trim = dbToLin(plan.targetLufs - now)
    for (let c = 0; c < rendered.numberOfChannels; c++) {
      const d = rendered.getChannelData(c)
      for (let i = 0; i < d.length; i++) d[i] *= trim
    }
    onStage?.("Applying true-peak limiter")
    return softLimit(rendered, plan.ceiling ?? -1.5)
  }
  onStage?.("Applying true-peak ceiling")
  return ceilingProcess(rendered, plan.ceiling ?? -1)
}

/* ---------------- download helpers ---------------- */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function saveText(text, filename) {
  saveBlob(new Blob([text], { type: "text/markdown;charset=utf-8" }), filename)
}