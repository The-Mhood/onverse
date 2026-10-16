import { scoreAnalysis, buildIssues, buildFixPlan, targetFromFeatures } from "./audio/analyzer.js"
import { analysisService } from "./application/analysis/analysisService.js"
import { matchGenre, GENRES, CATEGORIES, categoryById, categoryProfile, BAND_KEYS, BAND_META } from "./audio/genre.js"
import { decodeFile, convert, masterFix, saveBlob, saveText, supportedRecorders, encodeWav } from "./audio/processor.js"
import { resolveStreamUrl, fetchPreviewBuffer, profileForResolved } from "./audio/reference.js"
import { buildProcessingPlan } from "./domain/processors/buildProcessingPlan.js"

/* ================= state ================= */
const state = {
  buffer: null,
  fileName: "",
  fileSize: 0,
  isDemo: false,
  mode: "converse",
  analysis: null,
  scores: null,
  issues: null,
  fixPlan: null,
  fixed: null,
  fixedFast: null,
  converted: null,
  playing: false,
  ab: "orig",
  pos: 0,
  rate: 1,
  crop: null,
  busy: false,
  /* the reference this session compares against:
   * src: "auto" (platform catalog) | "file" (own track) | "url" (stream link)
   * targetUsed: resolved analysis target + display meta for the UI */
  ref: { src: "auto", cat: null, sub: null, file: null, url: null },
  targetUsed: null,
  /* master-fix adjustment sliders (0/100 = exactly the automatic fix) */
  autoPlan: null,
  tweaks: { trimDb: 0, gluePct: 100, width: 0, band: { sub: 0, bass: 0, low: 0, mid: 0, high: 0, presence: 0, air: 0 } },
  tweakBusy: false,
  tweakEpoch: 0,
  hasCustomTweaks: false,
}

/* ================= audio plumbing ================= */
let actx = null
let analyser = null
let currentSource = null
let startedAt = 0
let startPos = 0
let rafPlayer = 0
let lastSeekRestart = 0

function ensureCtx() {
  if (!actx) {
    actx = new AudioContext()
    analyser = actx.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.82
    analyser.connect(actx.destination)
  }
  if (actx.state === "suspended") actx.resume()
  return actx
}function updateAbUI() {
  document.querySelectorAll(".ab-btn").forEach((b) => {
    b.classList.toggle("tab-active", b.dataset.ab === state.ab)
    if (b.dataset.ab === "fixed") b.classList.toggle("disabled", !state.fixed)
  })
}

function activeBuffer() {
  return state.ab === "fixed" && state.fixed ? state.fixed : state.buffer
}
function activeDuration() {
  const b = activeBuffer()
  return b ? b.duration : 0
}

function updateTransportUI() {
  const play = $("#btnPlay")
  if (play) play.innerHTML = state.playing ? ICONS.stop : ICONS.play
  const rate = $("#btnRate")
  if (rate) rate.textContent = `${state.rate}×`
  const crop = $("#btnCrop")
  if (crop) crop.classList.toggle("active", !!state.crop)
  const side = $("#playSide")
  if (side) side.textContent = state.ab === "fixed" && state.fixed ? "B · FIXED" : "A · ORIGINAL"
  const nameEl = $("#playName")
  if (nameEl) nameEl.textContent = state.fileName || "—"
}

function stopPlayback() {
  cancelAnimationFrame(rafPlayer)
  rafPlayer = 0
  if (currentSource) {
    try { currentSource.onended = null; currentSource.stop() } catch { /* noop */ }
    currentSource = null
  }
  state.playing = false
  stage?.setSpectrum(new Float32Array(56))
  stage?.setEnergy(0)
  stage?.setPlaying(false)
  updateTransportUI()
  updateAbUI()
}

function playBuffer(buf, tag, offset = 0) {
  ensureCtx()
  stopPlayback()
  const dur = buf.duration
  const start = Math.max(0, Math.min(offset || 0, Math.max(0, dur - 0.02)))
  const src = actx.createBufferSource()
  src.buffer = buf
  if (state.rate !== 1) src.playbackRate.value = state.rate
  src.connect(analyser)
  currentSource = src
  state.pos = start
  startPos = start
  startedAt = actx.currentTime
  state.playing = true
  state.ab = tag
  src.onended = () => {
    if (currentSource === src) {
      currentSource = null
      state.playing = false
      state.pos = state.crop && state.crop.out < dur - 0.05 ? state.crop.in : 0
      cancelAnimationFrame(rafPlayer)
      rafPlayer = 0
      stage?.setPlaying(false)
      paintPlayhead(state.pos)
      updateTransportUI()
      updateAbUI()
    }
  }
  src.start(0, start)
  stage?.setPlaying(true)
  updateTransportUI()
  updateAbUI()
  const data = new Uint8Array(analyser.frequencyBinCount)
  const loop = () => {
    rafPlayer = requestAnimationFrame(loop)
    if (!state.playing || currentSource !== src || !actx) return
    analyser.getByteFrequencyData(data)
    const arr = new Float32Array(data.length)
    let e = 0
    for (let i = 0; i < data.length; i++) { arr[i] = data[i] / 255; if (i < 12) e += data[i] }
    stage?.setSpectrum(arr)
    stage?.setEnergy(e / (12 * 255))
    const pos = startPos + (actx.currentTime - startedAt) * state.rate
    // loop inside the crop region
    if (state.crop && state.crop.out < dur - 0.05 && pos >= state.crop.out - 0.02) {
      playBuffer(buf, tag, state.crop.in)
      return
    }
    paintPlayhead(Math.min(pos, dur))
  }
  loop()
}

/* ---------- playhead / seek ---------- */
function paintPlayhead(pos) {
  const b = activeBuffer()
  if (!b) return
  const dur = b.duration || 1
  state.pos = Math.max(0, Math.min(pos, dur))
  if (document.activeElement && document.activeElement.id === "seekBar") return // scrubber drives the UI while dragging
  renderWaveform(state.pos / dur)
  updateTime(state.pos)
  syncSeekUI()
}

function updateTime(pos) {
  const b = activeBuffer()
  if (!b) return
  $("#timeNow").textContent = fmtTime(Math.max(0, Math.min(pos, b.duration)))
  $("#timeTotal").textContent = fmtTime(b.duration)
}

function syncSeekUI() {
  const bar = $("#seekBar")
  const fill = $("#seekFill")
  const cursor = $("#seekCursor")
  const b = activeBuffer()
  const dur = b ? b.duration : 0
  const posFrac = dur ? Math.min(state.pos, dur) / dur : 0
  if (bar) {
    bar.min = 0
    bar.max = Math.max(0.05, dur)
    bar.step = 0.05
    if (document.activeElement !== bar) bar.value = Math.min(state.pos, dur)
  }
  if (fill && dur) fill.style.width = `${posFrac * 100}%`
  if (cursor) {
    cursor.style.display = dur ? "block" : "none"
    cursor.style.left = `${posFrac * 100}%`
  }
  paintRegionOverlay()
}

function paintRegionOverlay() {
  const strip = $("#seekRegion")
  const mIn = $("#seekMarkIn")
  const mOut = $("#seekMarkOut")
  const dur = activeDuration()
  const els = [strip, mIn, mOut].filter(Boolean)
  if (state.crop && dur > 0.05) {
    const cin = Math.min(Math.max(state.crop.in, 0), dur)
    const cout = Math.min(Math.max(state.crop.in, state.crop.out), dur)
    const l = (cin / dur) * 100
    const w = Math.max(0, ((cout - cin) / dur) * 100)
    if (strip) { strip.style.display = "block"; strip.style.left = `${l}%`; strip.style.width = `${w}%` }
    if (mIn) { mIn.style.display = "block"; mIn.style.left = `${l}%` }
    if (mOut) { mOut.style.display = "block"; mOut.style.left = `${Math.min(100, l + w)}%` }
  } else {
    for (const el of els) el.style.display = "none"
  }
}

function renderWaveform(progress) {
  const base = state.buffer
  if (!base) return
  const fixed = state.fixed
  const same = fixed && Math.abs(fixed.duration - base.duration) < 0.05
  const showFixed = state.ab === "fixed" && fixed
  const primary = showFixed && !same ? fixed : base
  const overlay = showFixed && same ? fixed : null
  const dur = primary.duration || 1
  let region = null
  if (state.crop) {
    const cin = Math.min(Math.max(state.crop.in, 0), dur)
    const cout = Math.min(Math.max(state.crop.in, state.crop.out), dur)
    region = { in: cin / dur, out: cout / dur }
  }
  if (waveformEl) drawWaveform?.(waveformEl, primary, { progress, overlay, region })
  paintRegionOverlay()
}

function seekTo(pos, { restart = true } = {}) {
  const b = activeBuffer()
  if (!b) return
  const dur = b.duration
  let v = Math.max(0, Math.min(pos, Math.max(0, dur - 0.02)))
  if (state.crop) v = Math.max(state.crop.in, Math.min(v, Math.max(state.crop.in, state.crop.out - 0.05)))
  state.pos = v
  const tag = state.ab === "fixed" && state.fixed ? "fixed" : "orig"
  if (state.playing && restart) {
    const now = performance.now()
    if (now - lastSeekRestart > 160) {
      lastSeekRestart = now
      playBuffer(b, tag, v)
    } else {
      renderWaveform(v / dur)
      updateTime(v)
      syncSeekUI()
    }
  } else {
    renderWaveform(v / dur)
    updateTime(v)
    syncSeekUI()
  }
}

function seekBy(delta) { seekTo(state.pos + delta) }

function cycleRate() {
  const rates = [1, 1.5, 2, 0.5]
  state.rate = rates[(Math.max(0, rates.indexOf(state.rate)) + 1) % rates.length]
  if (state.playing) {
    const b = activeBuffer()
    const tag = state.ab === "fixed" && state.fixed ? "fixed" : "orig"
    playBuffer(b, tag, state.pos)
  } else {
    updateTransportUI()
  }
}

function togglePlay() {
  const b = activeBuffer()
  if (!b) return
  if (state.playing) {
    stopPlayback() // freeze at the current position
    renderWaveform(state.pos / b.duration)
    updateTime(state.pos)
    syncSeekUI()
    return
  }
  const dur = b.duration
  let start = state.pos
  if (start >= dur - 0.02) start = state.crop ? state.crop.in : 0
  if (state.crop) start = Math.max(state.crop.in, Math.min(start, Math.max(state.crop.in, state.crop.out - 0.05)))
  const tag = state.ab === "fixed" && state.fixed ? "fixed" : "orig"
  state.ab = tag
  playBuffer(b, tag, start)
}

/* ---------- crop region ---------- */
function toggleCrop() {
  if (!activeBuffer()) return
  if (state.crop) {
    state.crop = null
  } else {
    const dur = activeDuration()
    if (dur < 0.3) { toast("Track too short to crop."); return }
    state.crop = { in: 0, out: dur }
  }
  renderCropPanel()
  updateTransportUI()
  const b = activeBuffer()
  renderWaveform(b ? state.pos / b.duration : 0)
  syncSeekUI()
}

function renderCropPanel() {
  const panel = $("#cropPanel")
  const b = activeBuffer()
  const dur = b ? b.duration : 0
  if (!panel) return
  if (!state.crop || !dur) {
    panel.classList.add("hidden")
    paintRegionOverlay()
    return
  }
  panel.classList.remove("hidden")
  let cin = Math.max(0, Math.min(state.crop.in, Math.max(0, dur - 0.25)))
  let cout = Math.max(cin + 0.25, Math.min(state.crop.out, dur))
  state.crop = { in: cin, out: cout }
  const rIn = $("#cropIn")
  const rOut = $("#cropOut")
  if (rIn) { rIn.min = 0; rIn.max = Math.max(0.05, dur); rIn.value = Math.min(cin, dur); rIn.step = 0.05 }
  if (rOut) { rOut.min = 0; rOut.max = Math.max(0.05, dur); rOut.value = Math.min(cout, dur); rOut.step = 0.05 }
  $("#cropInTime").textContent = fmtTime(cin)
  $("#cropOutTime").textContent = fmtTime(cout)
  const fIn = $("#cropFillIn")
  const fOut = $("#cropFillOut")
  if (fIn && dur) fIn.style.width = `${(cin / dur) * 100}%`
  if (fOut && dur) fOut.style.width = `${(cout / dur) * 100}%`
  paintRegionOverlay()
}

function onCropSlide(which) {
  if (!state.crop) return
  const dur = activeDuration()
  const v = Math.max(0, Math.min(parseFloat($(`#crop${which}`).value || "0"), dur))
  if (which === "In") state.crop.in = Math.min(v, state.crop.out - 0.25)
  else state.crop.out = Math.max(v, state.crop.in + 0.25)
  renderCropPanel()
  renderWaveform(activeBuffer() ? state.pos / activeDuration() : 0)
}

function cropBuffer(buf, inSec, outSec) {
  const sr = buf.sampleRate
  const ch = buf.numberOfChannels
  const s0 = Math.max(0, Math.floor(inSec * sr))
  const s1 = Math.min(buf.length, Math.ceil(outSec * sr))
  const len = Math.max(1, s1 - s0)
  const nb = new AudioBuffer({ length: len, numberOfChannels: ch, sampleRate: sr })
  for (let c = 0; c < ch; c++) {
    const srcD = buf.getChannelData(c)
    const dstD = nb.getChannelData(c)
    for (let i = 0; i < len; i++) dstD[i] = srcD[s0 + i]
  }
  return nb
}

function exportCropRegion() {
  const b = activeBuffer()
  if (!b || !state.crop) return
  const dur = b.duration
  const cin = Math.min(Math.max(state.crop.in, 0), dur)
  const cout = Math.min(Math.max(state.crop.in, state.crop.out), dur)
  if (cout - cin < 0.05) return
  const region = cropBuffer(b, cin, cout)
  const base = (state.fileName || "audio").replace(/\.[^.]+$/, "")
  saveBlob(encodeWav(region, { float: true }), `${base}_region_${cin.toFixed(1)}-${cout.toFixed(1)}s.wav`)
  toast(`Exported region ${fmtTime(cin)} → ${fmtTime(cout)} as WAV.`)
}

async function applyCrop() {
  const b = activeBuffer()
  if (!b || !state.crop || state.busy) return
  const dur = b.duration
  const cin = Math.max(0, Math.min(state.crop.in, dur - 0.05))
  const cout = Math.min(state.crop.out, dur)
  if (cout - cin < 0.25) { toast("Crop too short — spread IN and OUT apart first."); return }
  const isFixed = state.ab === "fixed" && state.fixed
  const btn = $("#btnApplyCrop")
  if (btn) btn.disabled = true
  try {
    if (isFixed) {
      stopPlayback()
      const trimmed = cropBuffer(state.fixed, cin, cout)
      state.fixed = trimmed
      state.ab = "fixed"
      state.pos = 0
      state.crop = null
      renderCropPanel()
      updateAbUI()
      updateTransportUI()
      renderWaveform(0)
      updateTime(0)
      syncSeekUI()
      toast("Cropped B · FIXED — re-measuring the mastered copy…")
      const ffast = await analysisService.analyzeFast(trimmed, () => {})
      if (state.fixed === trimmed) {
        state.fixedFast = ffast
        renderFixSummary()
      }
      playBuffer(trimmed, "fixed", 0)
      toast(`B · FIXED cropped to ${fmtTime(cout - cin)} — playing.`)
    } else {
      stopPlayback()
      const cropped = cropBuffer(b, cin, cout)
      state.crop = null
      renderCropPanel()
      const base = (state.fileName || "audio").replace(/\.[^.]+$/, "")
      const ext = (state.fileName.split(".").pop() || "wav")
      await loadBuffer(cropped, `${base}_cropped.${ext}`, cropped.length * cropped.numberOfChannels * 4, state.isDemo)
      toast(`Cropped to ${fmtTime(cout - cin)} — re-analyzing the region.`)
    }
  } catch (err) {
    console.error(err)
    toast(`Crop failed: ${err.message || err}`)
  } finally {
    if (btn) btn.disabled = false
  }
}

function placePlayer() {
  const el = document.getElementById("player")
  if (!el) return
  if (!state.buffer || state.mode !== "converse") {
    el.classList.add("hidden")
    return
  }
  const host = state.scores ? document.getElementById("panelAnalysis") : document.getElementById("panelFile")
  if (host && el.parentElement !== host) host.appendChild(el)
  el.classList.remove("hidden")
  updateTransportUI()
  syncSeekUI()
}

/* ================= dom ================= */
const $ = (sel) => document.querySelector(sel)
const app = $("#app")

const ICONS = {
  folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><path d="M3 10h18"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>`,
  stop: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>`,
  wave: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 12h2l2-6 3 12 3-9 2 5 2-2h4"/></svg>`,
  spark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M13 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/></svg>`,
  music: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 18V6l11-2v11"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="15" r="2.5"/></svg>`,
  reset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 10a8 8 0 1 1 2 6"/><path d="M4 4v6h6"/></svg>`,
  doc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/></svg>`,
}

/* Old UI template removed during UI reset. Minimal non-designed shell only. */

/* ================= stage ================= */

/* ================= refs ================= */
const fileInput = $("#fileInput")
const waveformEl = $("#waveform")
const scoreRing = $("#scoreRing")
const verdictEl = $("#verdict")
const radarEl = $("#radar")
const metersEl = $("#meters")
const matchRow = $("#matchRow")
const reportRail = $("#reportRail")
const reportBody = $("#reportBody")

const fmtTime = (s) => {
  if (!isFinite(s)) return "0:00.0"
  const m = Math.floor(s / 60)
  const sec = s - m * 60
  return `${m}:${sec.toFixed(1).padStart(4, "0")}`
}
const fmtBytes = (n) => {
  if (!n) return ""
  const u = ["B", "KB", "MB", "GB"]
  let i = 0
  let v = n
  while (v > 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${u[i]}`
}
const fmtHz = (hz) => (hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`)

/* ================= toasts ================= */
let toastTimer = 0
function toast(msg, ms = 3200) {
  const wrap = $("#toast")
  $("#toastInner").textContent = msg
  wrap.classList.add("show")
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => wrap.classList.remove("show"), ms)
}

/* ================= panels ================= */
function showPanel(name) {
  for (const p of document.querySelectorAll(".panel")) p.classList.add("hidden")
  const el = $(`#panel${name}`)
  if (el) el.classList.remove("hidden")
  placePlayer()
  if (name === "Analysis") {
    requestAnimationFrame(() => {
      if (radarEl) drawRadar?.(radarEl, state.scores || {})
      renderWaveform(0)
      updateTime(state.pos)
      syncSeekUI()
    })
  }
}

function setMode(mode) {
  state.mode = mode
  document.querySelectorAll(".mode-btn").forEach((b) => b.classList.toggle("tab-active", b.dataset.mode === mode))
  renderPanels()
}

function renderPanels() {
  if (!state.buffer) {
    showPanel("Idle")
    return
  }
  if (state.mode === "converse") {
    if (state.scores) showPanel("Analysis")
    else showPanel("File")
  } else {
    showPanel("Convert")
    renderConvertPanel()
  }
}

/* ================= file loading ================= */
async function loadBuffer(buffer, name, size, isDemo = false) {
  stopPlayback()
  state.buffer = buffer
  state.fileName = name
  state.fileSize = size
  state.isDemo = isDemo
  state.analysis = null
  state.scores = null
  state.issues = null
  state.fixPlan = null
  state.autoPlan = null
  state.fixed = null
  state.fixedFast = null
  state.converted = null
  state.targetUsed = null
  state.ab = "orig"
  state.pos = 0
  state.rate = 1
  state.crop = null
  state.tweaks = { trimDb: 0, gluePct: 100, width: 0, band: { sub: 0, bass: 0, low: 0, mid: 0, high: 0, presence: 0, air: 0 } }
  state.hasCustomTweaks = false
  renderCropPanel()
  renderTweakPanel()
  renderFileInfo()
  renderPanels()
  if (state.mode === "converse" && buffer) runAnalysis()
}

function renderFileInfo() {
  const b = state.buffer
  $("#fileName").textContent = state.fileName
  $("#fileMeta").textContent = b
    ? `${fmtTime(b.duration)} · ${b.sampleRate / 1000} kHz · ${b.numberOfChannels === 1 ? "mono" : "stereo"} · ${fmtBytes(state.fileSize)}`
    : ""
  const badges = $("#fileBadges")
  badges.innerHTML = ""
  const chips = []
  if (b) {
    chips.push(`${b.numberOfChannels === 1 ? "MONO" : "STEREO"}`)
    chips.push(`${b.sampleRate / 1000} KHZ`)
    chips.push(state.isDemo ? "SYNTHESIZED" : state.fileName.split(".").pop().toUpperCase())
  }
  for (const c of chips) {
    const s = document.createElement("span")
    s.className = "badge badge-ghost badge-sm"
    s.textContent = c
    badges.appendChild(s)
  }
  renderWaveform(0)
  updateTime(state.pos)
  syncSeekUI()
}


/* ================= analysis ================= */
/* make sure the selected reference (uploaded track / stream link) is
 * measured and ready before the main analysis runs */
async function ensureReferenceReady() {
  const r = state.ref
  if (r.src === "auto") return { ok: true, kind: "auto" }
  if (r.src === "file") {
    if (!r.file) { toast("Upload a reference track first."); return { ok: false } }
    if (!r.file.feat) {
      showProgress(true, "Analyzing your reference track…")
      try {
        const feat = await analysisService.analyze(r.file.buf, (v) => {
          setProgress(v)
          if (v < 0.68) setProgressLabel("Analyzing your reference track…")
          else if (v < 0.96) setProgressLabel("Scanning reference spectrum…")
        })
        r.file.feat = feat
      } catch (err) {
        console.error(err)
        toast(`Couldn't analyze the reference track: ${err.message || err}`)
        showProgress(false)
        return { ok: false }
      }
      showProgress(false)
    }
    return { ok: true, kind: "file" }
  }
  // stream url
  if (!r.url) { toast("Paste a stream link first."); return { ok: false } }
  const u = r.url
  if (u.error) { toast("That stream link couldn't be resolved — check it and try again."); return { ok: false } }
  if (!u.prepared) {
    if (u.meta.previewUrl) {
      // Apple Music exposes an official 30 s preview as real audio — that becomes the reference
      showProgress(true, "Fetching Apple Music preview…")
      try {
        const ab = await fetchPreviewBuffer(u.meta.previewUrl)
        setProgress(0.35)
        setProgressLabel("Analyzing reference preview…")
        u.buf = ab
        u.feat = await analysisService.analyze(ab, (v) => setProgress(0.35 + v * 0.65))
      } catch (err) {
        console.error(err)
        toast("Couldn't fetch the Apple preview audio — using the mastered profile for its genre instead.")
        u.prepared = true
        showProgress(false)
        return { ok: true, kind: "profile" }
      }
      showProgress(false)
    } else if (!u.meta.identityKnown) {
      toast("We couldn't identify that link. Try a direct track link, or upload the reference file instead.")
      return { ok: false }
    }
    u.prepared = true
  }
  return { ok: true, kind: u.feat ? "url" : "profile" }
}

/* build the object the main file gets scored & fixed against */
function makeTarget(kind, analysis) {
  const r = state.ref
  const t = { kind }
  if (kind === "auto") {
    const catOverride = r.cat ? categoryById(r.cat) : null
    let gm
    if (catOverride) {
      const subName = r.sub && catOverride.subs.includes(r.sub) ? r.sub : catOverride.subs[0]
      const g = GENRES.find((x) => x.name === subName) || categoryProfile(catOverride.id)
      gm = { top: g, category: catOverride, confidence: null, manual: true }
    } else {
      gm = matchGenre(analysis)
    }
    t.g = gm.top
    t.gm = gm
    t.meta = { title: gm.top.name, catName: (gm.category && gm.category.name) || gm.top.name, subName: gm.category && gm.category.subs.length > 1 ? gm.top.name : null, manual: !!gm.manual }
    return t
  }
  if (kind === "file") {
    const name = state.ref.file.name
    t.g = targetFromFeatures(state.ref.file.feat, { name: `"${name}"`, realm: "your reference track" })
    t.meta = { title: `Your reference — "${name}"`, kindLabel: "YOUR REFERENCE TRACK", note: "analyzed sample-by-sample from your uploaded audio" }
    return t
  }
  const u = state.ref.url
  if (kind === "url" && u && u.feat) {
    const label = `${u.meta.title || "reference"}${u.meta.artist ? ` — ${u.meta.artist}` : ""}`
    t.g = targetFromFeatures(u.feat, { name: `"${label}"`, realm: "the Apple Music preview reference" })
    t.meta = { title: label, kindLabel: "STREAM REFERENCE · APPLE PREVIEW", note: "official 30 s preview decoded and measured — sample-level matching", platform: u.meta.platform }
    return t
  }
  // resolved stream link without audio → closest mastered profile for its platform genre
  if (u && u.meta && u.meta.cat) {
    const base = profileForResolved(u.meta)
    if (base) {
      const label = `${u.meta.title || "track"}${u.meta.artist ? ` — ${u.meta.artist}` : ""}`.slice(0, 46)
      t.g = { ...base, name: `"${label}"`, realm: "the mastered profile for its platform genre", urlTarget: true }
      t.meta = { title: label, kindLabel: "STREAM REFERENCE · RESOLVED TRACK", note: "full streamed audio can't be decoded in the browser — matched the mastered profile for its genre on the platforms", platform: u.meta.platform, genre: u.meta.genre, cat: categoryById(u.meta.cat) }
      return t
    }
  }
  // fall back to auto detection when the link gave no usable genre
  const auto = makeTarget("auto", analysis)
  auto.meta.fallback = true
  return auto
}

async function runAnalysis() {
  if (!state.buffer || state.busy) return
  state.busy = true
  try {
    stopPlayback()
    state.ab = "orig"
    updateAbUI()
    renderRefAreas()
    const prep = await ensureReferenceReady()
    if (!prep.ok) return
    showProgress(true, "Analyzing…")
    const analysis = await analysisService.analyze(state.buffer, (v) => {
      setProgress(v)
      const labels = ["Reading waveform…", "Measuring loudness…", "Scanning spectrum…", "Checking pitch…", "Analyzing stereo…", "Finding tempo…", "Finalizing…"]
      const i = Math.min(labels.length - 1, Math.floor(v * labels.length))
      setProgressLabel(labels[i])
    })
    const target = makeTarget(prep.kind, analysis)
    const g = target.g
    const scores = scoreAnalysis(analysis, g)
    const { issues, positives } = buildIssues(analysis, g, scores)
    const fixPlan = buildFixPlan(analysis, g)
    state.analysis = analysis
    state.scores = scores
    state.issues = { issues, positives }
    state.autoPlan = fixPlan
    state.fixPlan = fixPlan
    state.targetUsed = target
    state.fixed = null
    state.fixedFast = null
    state.tweaks = { trimDb: 0, gluePct: 100, width: 0, band: { sub: 0, bass: 0, low: 0, mid: 0, high: 0, presence: 0, air: 0 } }
    state.hasCustomTweaks = false
    renderAnalysis()
    renderReport()
    renderRefAreas()
    renderTweakPanel()
    showPanel("Analysis")
    const shown = (target.meta.title || g.name).length > 42 ? (target.meta.title || g.name).slice(0, 42) + "…" : target.meta.title || g.name
    toast(`Analysis complete — ${shown} · ${scores.overall}/100`)
  } catch (err) {
    console.error(err)
    toast(`Analysis failed: ${err?.message || String(err)}`)
  } finally {
    state.busy = false
    showProgress(false)
    renderRefAreas()
  }
}

function setProgress(v) {
  $("#progressBar").value = Math.round(v * 100)
}
function setProgressLabel(t) {
  $("#progressLabel").textContent = t
}
function showProgress(show, label) {
  $("#progressWrap").classList.toggle("hidden", !show)
  if (label) setProgressLabel(label)
  if (!show) setProgress(0)
}

const clampPct = (p) => Math.max(2, Math.min(100, p))

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
const shortName = (s, n = 26) => (s.length > n ? s.slice(0, n - 1) + "…" : s)

function meterDisplay(k) {
  const a = state.analysis
  const g = state.targetUsed ? state.targetUsed.g : null
  if (!a || !g) return { value: "—", pct: 0, ref: "", refPct: 0 }
  if (k === "loudness") {
    return { value: `${a.lufs.toFixed(1)} LUFS`, pct: clampPct(100 - Math.abs(a.lufs - g.lufs) * 8), ref: `ref ${g.lufs.toFixed(1)}`, refPct: clampPct(100 - Math.abs(a.lufs - g.lufs) * 8) }
  }
  if (k === "dynamics") {
    return { value: `${a.crestDb.toFixed(1)} dB crest`, pct: clampPct(100 - Math.abs(a.crestDb - g.crest) * 8), ref: `ref ${g.crest} dB`, refPct: clampPct(100 - Math.abs(a.crestDb - g.crest) * 8) }
  }
  const v = a.bands[k]
  return {
    value: `${v >= 0 ? "+" : ""}${v.toFixed(1)} dB`,
    pct: clampPct(100 - Math.abs(v - g.bands[k]) * 14),
    ref: `ref ${g.bands[k] >= 0 ? "+" : ""}${g.bands[k].toFixed(1)}`,
    refPct: clampPct(100 - Math.abs(a.bands[k] - g.bands[k]) * 14),
  }
}

function renderMeters() {
  const g = state.targetUsed ? state.targetUsed.g : null
  if (!g) return
  const all = [
    { k: "loudness", label: "LOUDNESS" },
    { k: "dynamics", label: "DYNAMICS" },
    ...BAND_KEYS.map((k) => ({ k, label: BAND_META[k].name.toUpperCase() })),
  ]
  const header = `
    <div class="font-mono text-[0.55rem] tracking-[0.22em] text-base-content/50 mb-1">REFERENCE MATCH · vs ${esc(shortName(g.name))} TARGET</div>`
  const meter = (m, d) => `
    <div class="meter">
      <div class="flex items-center justify-between font-mono text-[0.6rem] tracking-[0.12em] text-base-content/70">
        <span>${m.label}</span><span class="text-accent">${d.value}</span>
      </div>
      <div class="relative h-2 overflow-visible rounded-full border border-base-300/70 bg-base-300">
        <div class="absolute inset-y-0 left-0 rounded-full ${d.pct < 50 ? "bg-gradient-to-r from-warning to-error" : "bg-gradient-to-r from-secondary to-accent"}" style="width:${d.pct}%"></div>
        <div class="absolute -top-[3px] h-3.5 w-[2px] rounded-full bg-info" style="left:${d.refPct}%"></div>
      </div>
      <div class="text-right font-mono text-[0.55rem] tracking-[0.1em] text-base-content/40">${d.ref}</div>
    </div>`
  metersEl.innerHTML = header + all.map((m) => meter(m, meterDisplay(m.k))).join("")
}

function renderAnalysis() {
  const s = state.scores
  const t = state.targetUsed
  if (!s || !t) return
  const a = state.analysis
  const g = t.g
  scoreRing.textContent = s.overall
  if (scoreRing) scoreRing.style.setProperty("--value", s.overall)
  scoreRing.setAttribute("aria-valuenow", s.overall)
  const grade = s.overall >= 85 ? "MASTERPIECE" : s.overall >= 70 ? "BROADCAST-READY" : s.overall >= 50 ? "NEEDS WORK" : "RESTORE FROM STEMS"
  verdictEl.innerHTML = `<span class="grade">${grade}</span><span class="vs">vs ${esc(shortName(g.name, 34))} reference</span>`

  if (radarEl) drawRadar?.(radarEl, s)
  renderMeters()

  const fixedBtn = document.querySelector('.ab-btn[data-ab="fixed"]')
  if (fixedBtn) fixedBtn.classList.toggle("disabled", !state.fixed)
  matchRow.innerHTML = matchRowHtml(t)
}

function platformChips(cat) {
  if (!cat) return ""
  const chips = [
    ["Spotify", cat.spotify],
    ["Apple Music", cat.apple],
    ["YouTube Music", cat.ytm],
  ]
  return `<div class="platform-chips">${chips.map(([p, label]) => `<span class="badge badge-ghost badge-xs font-mono">${p} · ${esc(label)}</span>`).join("")}</div>`
}

function genreChipHtml(meta) {
  const cn = meta && meta.cat ? (categoryById(meta.cat) || {}).name || meta.cat : null
  const g = meta && meta.genre ? String(meta.genre) : ""
  if (!g) return `<span class="badge badge-ghost badge-xs font-mono">genre unmapped</span>`
  const show = cn && cn.toLowerCase() !== g.toLowerCase()
  return `<span class="badge ${cn ? "badge-accent" : "badge-ghost"} badge-xs font-mono">${esc(g)}${show ? ` → ${esc(cn)}` : ""}</span>`
}

function matchRowHtml(t) {
  const m = t.meta || {}
  if (t.kind === "auto") {
    const g = t.g
    const cat = t.gm ? t.gm.category : null
    const showSub = cat && cat.subs.length > 1 && m.subName
    const conf = t.gm && !t.gm.manual && t.gm.confidence != null
      ? `<span class="match-conf">${t.gm.confidence}% MATCH</span>` : ""
    const cands = t.gm && t.gm.candidates && !t.gm.manual
      ? `<div class="match-cands">${t.gm.candidates.map((c) => `
        <div class="cand">
          <span class="cand-name">${esc(c.genre.name)}</span>
          <div class="cand-bar"><div class="cand-fill" style="width:${Math.max(8, Math.min(100, 100 - c.distance * 30))}%"></div></div>
        </div>`).join("")}</div>`
      : `<div class="match-cands lock">${cat ? `<span class="cand-name">${cat.subs.join(" · ")}</span>` : `<span class="cand-name">${esc(g.name)}</span>`}</div>`
    return `
      <div class="match-main">
        <div class="match-label">${t.gm && t.gm.manual ? "REFERENCE · PLATFORM CATEGORY" : "DETECTED GENRE"}${m.fallback ? " · auto-fallback" : ""}</div>
        <div class="match-genre">${cat ? esc(cat.name) : esc(g.name)}${showSub ? `<span class="match-sub">${esc(m.subName)}</span>` : ""}${conf}</div>
        ${platformChips(cat)}
        <div class="match-ref">${t.gm && t.gm.manual ? "manual lock — metadata-selected built-in profile (full streamed track was not analyzed)" : "built-in genre profile — illustrative comparison target; not a verified measured chart-track fingerprint"}</div>
      </div>
      ${cands}`
  }
  const kindIcon = t.kind === "file" ? "📁" : t.kind === "url" && m.platform === "apple" ? "♪" : t.kind === "url" ? "↗" : "◈"
  const plat = m.platform ? `<span class="badge badge-ghost badge-xs font-mono">${m.platform === "apple" ? "APPLE MUSIC" : m.platform === "spotify" ? "SPOTIFY" : "YOUTUBE MUSIC"}</span>` : ""
  const genreChip = (m.genre || m.cat) ? genreChipHtml({ genre: m.genre, cat: m.cat ? m.cat.id : null }) : ""
  return `
    <div class="match-main custom">
      <div class="match-label">${esc(m.kindLabel || "CUSTOM REFERENCE")}</div>
      <div class="match-genre ref-title">${kindIcon} ${esc(shortName(m.title || "", 44))}</div>
      <div class="ref-meta">${plat} ${genreChip}</div>
      <div class="match-ref">${esc(m.note || "")}</div>
    </div>`
}

function renderReport() {
  if (!state.issues) return
  reportRail.classList.remove("hidden")
  const { issues, positives } = state.issues
  const cards = [
    ...issues.map((it) => `
      <div class="report-card card card-border sev-${it.severity}">
        <div class="card-body p-4 gap-1">
          <div class="report-card-head"><span class="sev-dot"></span><span class="rc-feature">${it.feature}</span><span class="rc-title">${it.title}</span></div>
          <p class="rc-detail">${it.detail}</p>
          <div class="rc-fix">↳ ${it.fixLabel}</div>
        </div>
      </div>`),
    ...(positives.length ? `<div class="report-card card card-border sev-good"><div class="card-body p-4 gap-1"><div class="report-card-head"><span class="sev-dot"></span><span class="rc-feature">WHAT'S ALREADY GREAT</span></div>${positives.map((p) => `<p class="rc-detail good">${p}</p>`).join("")}</div></div>` : []),
  ].join("")
  reportBody.innerHTML = cards || "<p class='rc-detail'>No issues found. Pristine mix!</p>"
}

/* ================= master fix ================= */
async function runFix() {
  if (!state.buffer || !state.analysis || !state.targetUsed || state.busy) return
  state.busy = true
  stopPlayback()
  $("#fixWrap").classList.remove("hidden")
  $("#fixLabel").textContent = "Reading the analysis…"
  try {
    const plan = state.autoPlan || state.fixPlan
    const fixed = await masterFix(state.buffer, plan, (stage) => { $("#fixLabel").textContent = stage + "…" })
    const fixedFast = await analysisService.analyzeFast(fixed, () => {})
    state.fixed = fixed
    state.fixedFast = fixedFast
    state.tweaks = { trimDb: 0, gluePct: 100, width: 0, band: { sub: 0, bass: 0, low: 0, mid: 0, high: 0, presence: 0, air: 0 } }
    state.hasCustomTweaks = false
    renderAnalysis()
    renderReport()
    renderFixSummary()
    renderTweakPanel()
    // auto play B
    state.ab = "fixed"
    updateAbUI()
    playBuffer(fixed, "fixed")
    toast("Master fix complete — a corrected copy is ready. Listening to B · FIXED.")
  } catch (err) {
    console.error(err)
    toast(`Master fix failed: ${err.message || err}`)
  } finally {
    state.busy = false
    $("#fixWrap").classList.add("hidden")
  }
}

function renderFixSummary() {
  // card pinned at the top of the report; refreshed in place on re-balance
  if (!state.fixedFast || !state.targetUsed) return
  const a = state.analysis
  const f = state.fixedFast
  const g = state.targetUsed.g
  const deltaLufs = (f.lufs - a.lufs).toFixed(1)
  const bandDelta = BAND_KEYS.map((k) => Math.abs(f.bands[k] - g.bands[k]))
  const beforeBand = BAND_KEYS.map((k) => Math.abs(a.bands[k] - g.bands[k]))
  const avgBefore = (beforeBand.reduce((s, v) => s + v, 0) / 7).toFixed(1)
  const avgAfter = (bandDelta.reduce((s, v) => s + v, 0) / 7).toFixed(1)
  const customTag = state.hasCustomTweaks ? ` <span class="badge badge-accent badge-xs font-mono">CUSTOM ADJUSTMENTS</span>` : ""
  let card = document.getElementById("fixSummaryCard")
  if (!card) {
    card = document.createElement("div")
    card.id = "fixSummaryCard"
    card.className = "report-card card card-border sev-fixed"
    reportBody.prepend(card)
  }
  card.innerHTML = `
    <div class="card-body p-4 gap-1">
      <div class="report-card-head"><span class="sev-dot"></span><span class="rc-feature">MASTER FIX APPLIED${customTag}</span></div>
      <p class="rc-detail">Loudness moved <b>${deltaLufs >= 0 ? "+" : ""}${deltaLufs} LUFS</b> toward the ${esc(shortName(g.name, 30))} reference (${f.lufs.toFixed(1)} now vs ${g.lufs.toFixed(1)} target) · EQ balance error fell from <b>${avgBefore} dB</b> to <b>${avgAfter} dB</b> avg per band · true peak ${f.truePeakDb.toFixed(1)} dBFS.</p>
      <div class="rc-fix">Use A/B above to compare, then SAVE FIXED to download the corrected file — or drag the FINE-TUNE pins below.</div>
    </div>`
}

/* ================= conversion ================= */
const FORMATS = [
  { fmt: "wav", name: "WAV", sub: "Lossless · studio" },
  { fmt: "mp3", name: "MP3", sub: "Universal · compressed" },
  { fmt: "m4a", name: "M4A", sub: "AAC · Apple-ready" },
  { fmt: "ogg", name: "OGG", sub: "Opus · web-ready" },
  { fmt: "webm", name: "WEBM", sub: "Opus · browser" },
]
let convTarget = "mp3"

function renderConvertPanel() {
  const b = state.buffer
  $("#convFrom").innerHTML = b
    ? `<span class="badge badge-ghost badge-sm">SOURCE</span> <b>${state.fileName}</b> — ${fmtTime(b.duration)} · ${b.sampleRate / 1000} kHz · ${b.numberOfChannels === 1 ? "mono" : "stereo"}`
    : `<span class="badge badge-ghost badge-sm">NO FILE</span> open an audio file first`
  const grid = $("#convGrid")
  grid.innerHTML = FORMATS.map((f) => `
    <button class="fmt-card card card-border ${f.fmt === convTarget ? "active" : ""}" data-fmt="${f.fmt}" type="button">
      <span class="fmt-name">${f.name}</span>
      <span class="fmt-sub">${f.sub}</span>
    </button>`).join("")
  grid.querySelectorAll(".fmt-card").forEach((el) => {
    el.onclick = () => {
      convTarget = el.dataset.fmt
      grid.querySelectorAll(".fmt-card").forEach((x) => x.classList.toggle("active", x === el))
    }
  })
  const recs = supportedRecorders()
  if (recs.length === 0) {
    grid.querySelector('[data-fmt="m4a"]').disabled = true
    grid.querySelector('[data-fmt="ogg"]').disabled = true
    grid.querySelector('[data-fmt="webm"]').disabled = true
  }
}

async function runConvert() {
  if (!state.buffer || state.busy) return
  state.busy = true
  $("#convProgress").classList.remove("hidden")
  $("#convLabel").textContent = "Converting…"
  try {
    const kbps = Number($("#convKbps").value)
    const floatWav = $("#convWav").value === "float"
    const out = await convert(state.buffer, { format: convTarget, kbps, floatWav })
    state.converted = out
    const base = state.fileName.replace(/\.[^.]+$/, "") || "audio"
    saveBlob(out.blob, `${base}.${out.ext}`)
    toast(`Converted to ${out.label} — download started.`)
  } catch (err) {
    console.error(err)
    toast(`Conversion failed: ${err.message || err}`)
  } finally {
    state.busy = false
    $("#convProgress").classList.add("hidden")
  }
}

/* ================= download actions ================= */
function downloadOutput() {
  const base = state.fileName.replace(/\.[^.]+$/, "") || "audio"
  if (state.mode === "convert" && state.converted) {
    saveBlob(state.converted.blob, `${base}.${state.converted.ext}`)
    return
  }
  if (state.mode === "converse") {
    if (state.fixed) {
      saveBlob(encodeWav(state.fixed, { float: true }), `${base}_masterfixed.wav`)
      toast("Saved fixed copy (32-bit WAV).")
      return
    }
    if (state.issues) downloadReport()
  }
}

function downloadReport() {
  if (!state.analysis) return
  const t = state.targetUsed
  const g = t ? t.g : null
  const s = state.scores
  const refMd = () => {
    if (!t) return ""
    if (t.kind === "auto") {
      const cat = t.gm ? t.gm.category : null
      const conf = t.gm && t.gm.confidence != null ? `${t.gm.confidence}% match` : t.gm && t.gm.manual ? "manual category lock" : ""
      const plat = cat ? ` — listed on Spotify as "${cat.spotify}", Apple Music as "${cat.apple}", YouTube Music as "${cat.ytm}"` : ""
      return `**Genre:** ${cat ? cat.name : g.name}${cat && cat.subs.length > 1 ? ` · ${g.name}` : ""} (${conf})${plat}`
    }
    const m = t.meta || {}
    return `**Reference:** ${m.kindLabel || "Custom"} — "${(m.title || "").replace(/\n/g, " ")}" — ${m.note || ""}${m.platform ? ` (${m.platform})` : ""}`
  }
  const lines = [
    `# MusicOnVerse Master's Report — ${state.fileName}`,
    ``,
    refMd(),
    `**Overall mix score:** ${s.overall}/100`,
    ``,
    `| Feature | Score |`,
    `| --- | --- |`,
    `| Loudness | ${s.loudness}/100 |`,
    `| EQ Balance | ${s.eq}/100 |`,
    `| Pitch Stability | ${s.pitch}/100 |`,
    `| Stereo Image | ${s.width}/100 |`,
    `| Dynamics | ${s.dynamics}/100 |`,
    `| Clarity | ${s.clarity}/100 |`,
    ``,
    `## Measurements`,
    ``,
    `- Loudness: **${state.analysis.lufs.toFixed(1)} LUFS** (reference ${g.lufs.toFixed(1)})`,
    `- True peak: **${state.analysis.truePeakDb.toFixed(1)} dBFS**`,
    `- Dynamic crest: **${state.analysis.crestDb.toFixed(1)} dB** (reference ${g.crest} dB)`,
    `- Spectral centroid: **${Math.round(state.analysis.centroid)} Hz** (reference ${g.centroid} Hz)`,
    `- Tempo: **${state.analysis.tempo.bpm} BPM**`,
    `- Stereo correlation: **${state.analysis.stereo.corr.toFixed(2)}**, width **${state.analysis.stereo.widthDb.toFixed(1)} dB** (reference ${g.width} dB)`,
    state.analysis.pitch.voicedRatio > 0.15 ? `- Pitch: median **${Math.round(state.analysis.pitch.medianHz)} Hz**, drift **${state.analysis.pitch.stdSemitones.toFixed(2)} st**, tuning **${state.analysis.pitch.tuningCents.toFixed(0)} cents**` : `- Pitch: no strong pitched content detected`,
    ``,
    `## What's wrong`,
    ``,
    ...state.issues.issues.map((it, i) => `### ${i + 1}. ${it.feature} — ${it.title}\n\n${it.detail}\n\n**Fix:** ${it.fixLabel}`),
    ``,
    `## What's already great`,
    ``,
    ...state.issues.positives.map((p) => `- ${p}`),
    ``,
    `---`,
    `Generated by MusicOnVerse Audio Intelligence Studio.`,
  ]
  saveText(lines.join("\n"), `${state.fileName.replace(/\.[^.]+$/, "")}_report.md`)
}

/* ================= reference picker (catalog / own track / stream URL) ================= */
const REF_TABS = [
  { kind: "auto", name: "AUTO", tip: "platform category catalog", desc: "Compare against the mastered fingerprint of the closest platform category & sub-genre (Spotify / Apple Music / YouTube Music top tracks)." },
  { kind: "file", name: "MY TRACK", tip: "upload a reference file", desc: "Use your own audio as the reference — MusicOnVerse measures it sample-by-sample and matches your mix to it exactly." },
  { kind: "url", name: "STREAM URL", tip: "paste a music link", desc: "Paste a Spotify, Apple Music or YouTube Music link — the track is resolved and used as the reference." },
]

function buildRefHtml(sfx) {
  const r = state.ref
  const busy = state.busy || r.busy || (r.url && (r.url.resolving || r.url.measuring))
  const tabs = REF_TABS.map((tab) => `
    <button class="ref-src-btn ${r.src === tab.kind ? "active" : ""}" data-rk="${tab.kind}" data-sfx="${sfx}" type="button" ${busy ? "disabled" : ""} title="${tab.desc}">
      <span class="rs-name">${tab.name}</span><span class="rs-tip">${tab.tip}</span>
    </button>`).join("")
  let body = ""
  const current = state.targetUsed

  if (r.src === "auto") {
    const detected = current && current.kind === "auto"
      ? `${current.gm && current.gm.category ? esc(current.gm.category.name) + " · " : ""}${esc(current.g.name)}`
      : null
    const catOpts = [`<option value="">detect closest category</option>`,
      ...CATEGORIES.map((c) => `<option value="${c.id}" ${r.cat === c.id ? "selected" : ""}>${esc(c.name)}</option>`)].join("")
    const chosen = r.cat ? categoryById(r.cat) : null
    const subOpts = chosen
      ? chosen.subs.map((s) => `<option value="${esc(s)}" ${r.sub === s ? "selected" : ""}>${esc(s)}</option>`).join("")
      : ""
    body = `
      <div class="ref-caption">${detected ? `Comparing against <b>${detected}</b> — lock a category below to override detection.` : esc(REF_TABS[0].desc)}</div>
      <div class="ref-row2">
        <select id="refCat${sfx}" class="select select-xs select-ghost" ${busy ? "disabled" : ""} aria-label="Genre category">${catOpts}</select>
        ${chosen ? `<select id="refSub${sfx}" class="select select-xs select-ghost" ${busy ? "disabled" : ""} aria-label="Sub-genre">${subOpts}</select>` : ""}
      </div>`
  } else if (r.src === "file") {
    if (r.file) {
      const f = r.file
      const meas = f.feat
        ? `measured · ${f.feat.lufs.toFixed(1)} LUFS · ${f.feat.tempo.bpm} BPM · centroid ${fmtHz(f.feat.centroid)}`
        : "queued — will be measured on analysis"
      body = `
      <div class="ref-resolved file-chip">
        <span class="ref-x" data-clr="file" data-sfx="${sfx}" role="button" title="Clear reference">×</span>
        <div class="ref-res-head">${esc(f.name)}</div>
        <div class="ref-res-sub"><span class="badge badge-ghost badge-xs font-mono">REFERENCE TRACK</span><span class="font-mono text-[0.6rem]">${meas}</span></div>
      </div>`
    } else {
      body = `
      <div class="ref-caption">${esc(REF_TABS[1].desc)}</div>
      <button class="ref-upload btn btn-outline btn-sm" data-up="${sfx}" type="button">＋ UPLOAD REFERENCE AUDIO</button>
      <div class="ref-hint">wav · mp3 · m4a · ogg · flac · aiff — everything stays on your machine</div>
      <input type="file" id="refFilePick${sfx}" class="hidden" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.oga,.opus,.flac,.webm,.aiff,.aif,.wma" />`
    }
  } else {
    // stream URL
    const u = r.url
    let status = ""
    if (u && u.resolving) {
      status = `<div class="ref-status"><span class="loading loading-spinner loading-xs"></span> Resolving the track on ${esc(u.meta && u.meta.platform ? (u.meta.platform === "apple" ? "Apple Music" : u.meta.platform === "spotify" ? "Spotify" : "YouTube") : "the platform")}…</div>`
    } else if (u && u.error) {
      status = `<div class="ref-status err">⚠ ${esc(u.error)}</div>`
    } else if (u && u.meta && u.meta.identityKnown) {
      const meta = u.meta
      const platBadge = meta.platform === "apple" ? "APPLE MUSIC" : meta.platform === "spotify" ? "SPOTIFY" : "YOUTUBE MUSIC"
      const genreChip = genreChipHtml(meta)
      const audioChip = u.feat
        ? `<span class="badge badge-success badge-xs font-mono">♪ PREVIEW MEASURED</span>`
        : meta.previewUrl
          ? `<span class="badge badge-info badge-xs font-mono">♪ 30 s OFFICIAL PREVIEW AVAILABLE</span>`
          : `<span class="badge badge-warning badge-xs font-mono">MASTERED PROFILE MATCH</span>`
      status = `
      <div class="ref-resolved">
        <span class="ref-x" data-clr="url" data-sfx="${sfx}" role="button" title="Clear reference">×</span>
        <div class="ref-res-head">${esc(meta.title || "Track")}${meta.artist ? ` — <span class="ref-artist">${esc(meta.artist)}</span>` : ""}</div>
        <div class="ref-res-sub"><span class="badge badge-ghost badge-xs font-mono">${platBadge}</span>${genreChip}${audioChip}</div>
        ${u.prepared && !u.feat ? `<div class="ref-hint">Streamed audio can't be decoded in the browser — this run matches the mastered profile above. Upload the track's file for exact sample-level matching.</div>` : ""}
      </div>`
    }
    body = `
      <div class="ref-caption">${esc(REF_TABS[2].desc)}</div>
      <div class="ref-row2 url-row">
        <input id="refUrlInput${sfx}" class="input input-sm input-ghost url-input" type="url" placeholder="https://open.spotify.com/track/… · music.apple.com/… · music.youtube.com/watch?v=…" value="${esc((u && (u.meta && u.meta.inputUrl) || (u && u.inputUrl)) || "")}" ${busy ? "disabled" : ""} />
        <button id="refUrlGo${sfx}" class="btn btn-primary btn-sm" type="button" ${busy ? "disabled" : ""}>RESOLVE</button>
      </div>
      ${status}`
  }

  return `
  <div class="refcard card card-border bg-base-300/30">
    <div class="refcard-head">
      <span class="refcard-title">REFERENCE</span>
      <span class="refcard-sub">what your mix is compared &amp; fixed against</span>
    </div>
    <div class="ref-tabs">${tabs}</div>
    <div class="ref-body-wrap">${body}</div>
  </div>`
}

function renderRefAreas() {
  if (!state.buffer) return
  const html = buildRefHtml("File")
  const a2 = buildRefHtml("Analysis")
  const f = document.getElementById("refAreaFile")
  const a = document.getElementById("refAreaAnalysis")
  if (f && f.innerHTML !== html) f.innerHTML = html
  if (a && a.innerHTML !== a2) a.innerHTML = a2
  wireRefArea("File")
  wireRefArea("Analysis")
}

function wireRefArea(sfx) {
  const zone = document.getElementById(`refArea${sfx}`)
  if (!zone) return
  zone.querySelectorAll(".ref-src-btn").forEach((b) => {
    b.onclick = () => {
      if (state.busy) return
      const kind = b.dataset.rk
      const prev = state.ref.src
      state.ref.src = kind
      renderRefAreas()
      // only re-run when a real reference exists for the new source
      const hasRef = kind === "auto" || (kind === "file" && state.ref.file) || (kind === "url" && state.ref.url && !state.ref.url.error)
      if (kind !== prev && hasRef && state.buffer) runAnalysis()
    }
  })
  const catSel = zone.querySelector(`#refCat${sfx}`)
  if (catSel) {
    catSel.onchange = () => {
      state.ref.cat = catSel.value || null
      state.ref.sub = null
      renderRefAreas()
      if (state.buffer && !state.busy) runAnalysis()
    }
    const subSel = zone.querySelector(`#refSub${sfx}`)
    if (subSel) subSel.onchange = () => {
      state.ref.sub = subSel.value || null
      if (state.buffer && !state.busy) runAnalysis()
    }
  }
  const upBtn = zone.querySelector(`[data-up="${sfx}"]`)
  const pick = zone.querySelector(`#refFilePick${sfx}`)
  if (upBtn && pick) upBtn.onclick = () => pick.click()
  if (pick) pick.onchange = () => {
    const file = pick.files && pick.files[0]
    pick.value = ""
    if (file) pickReferenceFile(file, sfx)
  }
  zone.querySelectorAll("[data-clr]").forEach((x) => {
    x.onclick = () => {
      const which = x.dataset.clr
      if (which === "file") { state.ref.file = null; state.ref.src = "auto" }
      if (which === "url") { state.ref.url = null; state.ref.src = "auto" }
      renderRefAreas()
      if (state.buffer && !state.busy) runAnalysis()
    }
  })
  const go = zone.querySelector(`#refUrlGo${sfx}`)
  const input = zone.querySelector(`#refUrlInput${sfx}`)
  const fireResolve = () => { const v = (input && input.value) || ""; if (v.trim()) resolveReferenceUrl(v.trim(), sfx) }
  if (go) go.onclick = fireResolve
  if (input) input.onkeydown = (e) => { if (e.key === "Enter") fireResolve() }
}

async function pickReferenceFile(file, sfx) {
  state.ref.src = "file"
  try {
    const buf = await decodeFile(file)
    state.ref.file = { name: file.name, buf }
    renderRefAreas()
    toast("Reference track loaded — measuring it, then re-analyzing your mix.")
    if (state.buffer) runAnalysis()
  } catch (err) {
    console.error(err)
    toast("Couldn't decode that reference file.")
  }
}

async function resolveReferenceUrl(raw, sfx) {
  const u = state.ref.url || {}
  u.resolving = true
  u.error = null
  u.prepared = false
  u.feat = null
  state.ref.src = "url"
  renderRefAreas()
  const meta = await resolveStreamUrl(raw)
  const nu = { inputUrl: raw, meta: meta.error ? null : meta, error: meta.error || null, prepared: false, resolving: false, buf: null, feat: null }
  state.ref.url = nu
  renderRefAreas()
  if (meta.error) {
    toast(meta.error)
    return
  }
  if (meta.previewUrl) toast(`Resolved “${meta.title}” on Apple Music — fetching its official preview as the reference…`)
  else if (meta.identityKnown) toast(`Resolved “${meta.title}” — will match the ${meta.genre || "detected"} mastered profile.`)
  if (state.buffer && !state.busy) runAnalysis()
}

/* ================= fix fine-tune (adjustable pins) ================= */
const clampNum = (v, a, b) => Math.min(b, Math.max(a, v))
const tweakDefaults = { trimDb: 0, gluePct: 100, width: 0, band: { sub: 0, bass: 0, low: 0, mid: 0, high: 0, presence: 0, air: 0 } }
const fmtDb = (v) => `${v > 0 ? "+" : ""}${Number.isInteger(v) ? v.toFixed(1) : v.toFixed(1)} dB`
const TWEAK_DEFS = [
  { k: "trimDb", label: "LOUDNESS", min: -6, max: 6, step: 0.5, auto: 0, tip: "Offset on the automatic loudness trim toward the reference.", fmt: (v) => fmtDb(v) },
  { k: "gluePct", label: "DYNAMICS", min: 0, max: 200, step: 5, auto: 100, tip: "Glue-compression strength applied toward the reference crest — 100% is the automatic amount.", fmt: (v) => (v === 100 ? "AUTO" : `${Math.round(v)}%`) },
  ...BAND_KEYS.map((k) => ({ k: `band:${k}`, label: BAND_META[k].name.toUpperCase(), min: -9, max: 9, step: 0.5, auto: 0, tip: `${BAND_META[k].name} (${BAND_META[k].range}) — offset on the automatic EQ correction.`, fmt: (v) => fmtDb(v) })),
  { k: "width", label: "STEREO WIDTH", min: -6, max: 6, step: 0.5, auto: 0, tip: "Offset on the automatic stereo-width correction.", fmt: (v) => fmtDb(v) },
]

function tweakVal(k) {
  if (k.startsWith("band:")) return state.tweaks.band[k.slice(5)] || 0
  return state.tweaks[k] ?? tweakDefaults[k]
}
function tweakSet(k, v) {
  if (k.startsWith("band:")) state.tweaks.band[k.slice(5)] = v
  else state.tweaks[k] = v
}
function tweakIsCustom() {
  const b = state.tweaks.band
  return state.tweaks.trimDb !== 0 || state.tweaks.gluePct !== 100 || state.tweaks.width !== 0 ||
    Object.values(b).some((v) => v !== 0)
}

function renderTweakPanel() {
  const panel = document.getElementById("fixTweakPanel")
  if (!panel) return
  if (!state.fixed) {
    panel.classList.add("hidden")
    return
  }
  panel.classList.remove("hidden")
  const resetBtn = document.getElementById("btnTweakReset")
  if (resetBtn) resetBtn.classList.toggle("hidden", !state.hasCustomTweaks)
  const box = document.getElementById("tweakSliders")
  if (!box) return
  const pct = (d, v) => clampNum(((v - d.min) / (d.max - d.min)) * 100, 0, 100)
  box.innerHTML = TWEAK_DEFS.map((d) => {
    const v = tweakVal(d.k)
    return `
    <div class="tweak-row" data-k="${d.k}">
      <span class="tweak-lab" title="${d.tip}">${d.label}</span>
      <div class="tweak-ctl">
        <div class="tweak-fill" style="width:${pct(d, v)}%"></div>
        <span class="tweak-auto" style="left:${pct(d, d.auto)}%"></span>
        <input type="range" class="tweak-range" min="${d.min}" max="${d.max}" step="${d.step}" value="${v}" aria-label="${d.label} adjustment" />
      </div>
      <span class="tweak-val">${d.fmt(v)}</span>
    </div>`
  }).join("")
  box.querySelectorAll(".tweak-range").forEach((input) => {
    const row = input.closest(".tweak-row")
    const def = TWEAK_DEFS.find((x) => x.k === row.dataset.k)
    const paint = () => {
      const v = parseFloat(input.value)
      row.querySelector(".tweak-fill").style.width = `${pct(def, v)}%`
      row.querySelector(".tweak-val").textContent = def.fmt(v)
    }
    input.addEventListener("input", () => {
      tweakSet(def.k, parseFloat(input.value))
      paint()
    })
    input.addEventListener("change", () => {
      tweakSet(def.k, parseFloat(input.value))
      state.hasCustomTweaks = tweakIsCustom()
      const resetBtn = document.getElementById("btnTweakReset")
      if (resetBtn) resetBtn.classList.toggle("hidden", !state.hasCustomTweaks)
      scheduleTweak()
    })
  })
}

function setTweakStatus(t) {
  const el = document.getElementById("tweakStatus")
  if (el) el.textContent = t || ""
}

/* rebuild the fix plan with the user's slider offsets on top of the automatic one */
function currentPlan() {
  return buildProcessingPlan(state.autoPlan || state.fixPlan, state.tweaks, BAND_KEYS)
}

let tweakTimer = 0
let tweakQueued = false
function scheduleTweak() {
  clearTimeout(tweakTimer)
  tweakTimer = setTimeout(rerenderFixed, 400)
}

async function rerenderFixed() {
  if (state.tweakBusy) { tweakQueued = true; return }
  if (!state.fixed || !state.buffer || !state.autoPlan || state.busy) return
  const plan = currentPlan()
  if (!plan) return
  state.tweakBusy = true
  setTweakStatus("RE-BALANCING B · FIXED…")
  const epoch = ++state.tweakEpoch
  const wasPlaying = state.playing && state.ab === "fixed"
  const resumeAt = wasPlaying ? state.pos : 0
  stopPlayback()
  try {
    const fixed = await masterFix(state.buffer, plan, (st) => setTweakStatus((st || "").toUpperCase() + "…"))
    if (epoch !== state.tweakEpoch) return
    const fixedFast = await analysisService.analyzeFast(fixed, () => {})
    if (epoch !== state.tweakEpoch) return
    state.fixed = fixed
    state.fixedFast = fixedFast
    state.hasCustomTweaks = tweakIsCustom()
    renderFixSummary()
    if (wasPlaying && state.fixed) {
      state.ab = "fixed"
      updateAbUI()
      playBuffer(state.fixed, "fixed", resumeAt)
    } else {
      renderWaveform(0)
    }
  } catch (err) {
    console.error(err)
    toast(`Re-balance failed: ${err.message || err}`)
  } finally {
    if (epoch === state.tweakEpoch) {
      state.tweakBusy = false
      setTweakStatus("")
    }
  }
  if (tweakQueued && epoch === state.tweakEpoch) {
    tweakQueued = false
    scheduleTweak()
  }
}

/* ================= demo track ================= */
function makeDemoBuffer() {
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

/* ================= events ================= */
$("#btnIdleUpload").onclick = () => fileInput.click()
$("#btnUpload").onclick = () => fileInput.click()
document.querySelectorAll('[data-action="upload"]').forEach((b) => (b.onclick = () => fileInput.click()))
fileInput.onchange = async () => {
  const f = fileInput.files[0]
  fileInput.value = ""
  if (f) await openFile(f)
}

async function openFile(file) {
  try {
    const buffer = await decodeFile(file)
    loadBuffer(buffer, file.name, file.size)
    toast(`Loaded ${file.name}`)
  } catch (err) {
    console.error(err)
    toast(`Couldn't decode that file. Try a WAV, MP3, M4A, OGG, FLAC or AIFF.`)
  }
}

$("#btnIdleDemo").onclick = () => {
  const buf = makeDemoBuffer()
  loadBuffer(buf, "MusicOnVerse_Demo_126BPM.wav", Math.round(buf.length * 8), true)
  toast("Synthesized a demo track — analysis running.")
}
document.querySelectorAll('[data-action="demo"]').forEach((b) => (b.onclick = () => $("#btnIdleDemo").click()))

$("#btnAnalyze").onclick = runAnalysis
document.querySelectorAll('[data-action="analyze"]').forEach((b) => (b.onclick = runAnalysis))

$("#btnFix").onclick = runFix
document.querySelectorAll('[data-action="fix"]').forEach((b) => (b.onclick = runFix))

$("#btnConvertGo").onclick = () => { setMode("convert") }
$("#btnConvert").onclick = runConvert

$("#btnPlay").onclick = togglePlay
$("#btnBack10").onclick = () => seekBy(-10)
$("#btnFwd10").onclick = () => seekBy(10)
$("#btnFwd30").onclick = () => seekBy(30)
$("#btnRate").onclick = cycleRate
$("#btnCrop").onclick = toggleCrop
$("#btnPlayRegion").onclick = () => {
  const b = activeBuffer()
  if (!b || !state.crop) return
  const tag = state.ab === "fixed" && state.fixed ? "fixed" : "orig"
  state.ab = tag
  playBuffer(b, tag, state.crop.in)
}
$("#btnApplyCrop").onclick = applyCrop
$("#btnSaveCrop").onclick = exportCropRegion
$("#btnCancelCrop").onclick = toggleCrop
$("#btnTransportReset").onclick = () => { stopPlayback(); state.pos = 0; renderWaveform(0); updateTime(0); syncSeekUI() }
$("#seekBar").addEventListener("input", () => seekTo(Number($("#seekBar").value), { restart: false }))
$("#seekBar").addEventListener("change", () => seekTo(Number($("#seekBar").value)))
$("#cropIn").addEventListener("input", () => onCropSlide("In"))
$("#cropOut").addEventListener("input", () => onCropSlide("Out"))

document.querySelectorAll(".ab-btn").forEach((b) => {
  b.onclick = () => {
    if (b.classList.contains("disabled")) return
    document.querySelectorAll(".ab-btn").forEach((x) => x.classList.toggle("tab-active", x === b))
    state.ab = b.dataset.ab
    if (state.playing) {
      const buf = activeBuffer()
      if (buf) playBuffer(buf, state.ab, state.pos)
    } else {
      renderWaveform(0)
      updateTime(state.pos)
      syncSeekUI()
    }
  }
})

$("#btnDownload").onclick = downloadOutput
document.querySelectorAll('[data-action="download"]').forEach((b) => (b.onclick = downloadOutput))
$("#btnDownloadFixed").onclick = () => {
  if (!state.fixed) return
  const base = state.fileName.replace(/\.[^.]+$/, "") || "audio"
  saveBlob(encodeWav(state.fixed, { float: true }), `${base}_masterfixed.wav`)
  toast("Saved fixed copy (32-bit WAV).")
}
$("#btnDownloadReport").onclick = downloadReport

$("#btnReportToggle").onclick = () => reportRail.classList.toggle("hidden")

document.querySelectorAll(".mode-btn").forEach((b) => (b.onclick = () => setMode(b.dataset.mode)))

document.querySelectorAll('[data-action="reset"]').forEach((b) => (b.onclick = () => {
  stopPlayback()
  state.buffer = null
  state.fixed = null
  state.scores = null
  state.issues = null
  state.converted = null
  state.analysis = null
  state.targetUsed = null
  state.fixPlan = null
  state.autoPlan = null
  state.ref = { src: "auto", cat: null, sub: null, file: null, url: null }
  state.tweaks = { ...tweakDefaults }
  state.hasCustomTweaks = false
  state.ab = "orig"
  state.pos = 0
  state.rate = 1
  state.crop = null
  renderCropPanel()
  renderRefAreas()
  renderTweakPanel()
  reportRail.classList.add("hidden")
  renderPanels()
}))

/* fix fine-tune reset + report toggle keeps ref zones tidy on every render */
$("#btnTweakReset").onclick = () => {
  state.tweaks = { ...tweakDefaults }
  state.hasCustomTweaks = false
  renderTweakPanel()
  scheduleTweak()
}

/* drag & drop */
let dragDepth = 0
window.addEventListener("dragenter", (e) => { e.preventDefault(); dragDepth++; document.body.classList.add("dragging") })
window.addEventListener("dragleave", (e) => { e.preventDefault(); dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) document.body.classList.remove("dragging") })
window.addEventListener("dragover", (e) => e.preventDefault())
window.addEventListener("drop", (e) => {
  e.preventDefault()
  dragDepth = 0
  document.body.classList.remove("dragging")
  const f = e.dataTransfer.files && e.dataTransfer.files[0]
  if (f) openFile(f)
})

/* keyboard */
window.addEventListener("keydown", (e) => {
  if (e.target.matches("input, select, textarea")) return
  if (e.code === "Space" && !e.target.matches("button")) {
    e.preventDefault()
    togglePlay()
  } else if (e.code === "ArrowRight" && e.shiftKey) { e.preventDefault(); seekBy(10) }
  else if (e.code === "ArrowLeft" && e.shiftKey) { e.preventDefault(); seekBy(-10) }
  else if (e.code === "ArrowRight") { e.preventDefault(); seekBy(5) }
  else if (e.code === "ArrowLeft") { e.preventDefault(); seekBy(-5) }
})

/* resize */
let resizeTimer = 0
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    renderWaveform(0)
    if (state.scores && radarEl) drawRadar?.(radarEl, state.scores)
  }, 120)
})

/* boot */
function dismissBoot() {
  const boot = $("#boot")
  boot.classList.add("done")
  setTimeout(() => boot.remove(), 900)
}

/* keep the CSS var on the score ring in sync on load */

/* ---- desktop auto-update banner (electron-updater via preload) ---- */
if (window.movUpdate) {
  let updToast = null
  let updLine = null
  let updActions = null
  let updLater = null
  let updBtn = null
  let updDismissed = false

  function updEnsure() {
    if (updToast) return
    updToast = document.createElement("div")
    updToast.className = "toast toast-end"
    updToast.style.bottom = "6.5rem"
    updToast.style.zIndex = "120"
    const alert = document.createElement("div")
    alert.className = "alert alert-soft alert-info gap-2 text-sm shadow-2xl"
    alert.style.width = "min(21rem, 90vw)"
    updLine = document.createElement("span")
    updLine.className = "font-semibold"
    updActions = document.createElement("div")
    updActions.className = "flex gap-2 mt-0.5"
    updLater = document.createElement("button")
    updLater.className = "btn btn-ghost btn-xs"
    updLater.textContent = "LATER"
    updBtn = document.createElement("button")
    updBtn.className = "btn btn-primary btn-xs"
    updBtn.textContent = "UPDATE NOW"
    updActions.append(updLater, updBtn)
    alert.append(updLine, updActions)
    updToast.append(alert)
    document.body.append(updToast)
    updLater.onclick = () => { updDismissed = true; updToast.remove(); updToast = null }
    updBtn.onclick = () => window.movUpdate.install()
  }
  function updHide() { if (updToast) { updToast.remove(); updToast = null } }

  window.movUpdate.onStatus((s) => {
    if (s.state === "not-available" || s.state === "error") { updHide(); return }
    if (s.state === "checking") {
      updEnsure()
      updLine.textContent = "Checking for updates…"
      updActions.style.display = "none"
      return
    }
    if (s.state === "available" || s.state === "downloading") {
      updEnsure()
      updActions.style.display = "none"
      updLine.textContent = s.state === "available"
        ? `Update v${s.version} found — downloading…`
        : `Downloading update… ${s.percent}%`
      return
    }
    if (s.state === "downloaded") {
      updDismissed = false
      updEnsure()
      updLine.textContent = `v${s.version} is ready to install`
      updActions.style.display = "flex"
    }
  })
}