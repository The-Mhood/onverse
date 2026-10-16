import { createAnalysisController } from "../analysis/analysisController.js"
import { analysisService } from "../analysis/analysisService.js"
import { buildProcessingPlan } from "../../domain/processors/buildProcessingPlan.js"
import { BAND_KEYS } from "../../audio/genre.js"
import { makeDemoBuffer } from "./demo.js"

const defaults = () => ({ trimDb: 0, gluePct: 100, width: 0, band: Object.fromEntries(BAND_KEYS.map(k => [k, 0])) })

/** Single-buffer operations extracted from the former mixed entry. Not a session,
 * plugin, provider or IPC API. The renderer receives the SAME workbench state.
 * Audio implementations are required; main supplies the unchanged real processor.
 */
export function createWorkbenchController({ view, audio, reference, analysis = analysisService, platform = globalThis }) {
  for (const key of ["render", "progress", "toast", "showPanel"]) {
    if (typeof view?.[key] !== "function") throw new TypeError(`Missing view effect: ${key}`)
  }
  for (const key of ["decodeFile", "masterFix", "convert", "encodeWav", "saveBlob", "saveText"]) {
    if (typeof audio?.[key] !== "function") throw new TypeError(`Missing real audio operation: ${key}`)
  }
  if (typeof reference?.resolveStreamUrl !== "function" || typeof reference?.fetchPreviewBuffer !== "function") throw new TypeError("Missing reference operations")
  const state = {
    buffer: null, fileName: "", fileSize: 0, isDemo: false, mode: "converse",
    analysis: null, scores: null, issues: null, fixPlan: null, autoPlan: null,
    fixed: null, fixedFast: null, converted: null, targetUsed: null,
    playing: false, ab: "orig", pos: 0, rate: 1, crop: null, busy: false,
    ref: { src: "auto", cat: null, sub: null, file: null, url: null },
    tweaks: defaults(), tweakBusy: false, tweakEpoch: 0, hasCustomTweaks: false,
  }
  let actx = null, analyser = null, currentSource = null, startedAt = 0, startPos = 0, rafPlayer = 0, lastSeekRestart = 0
  let disposed = false, disposal
  let tweakTimer = 0, tweakQueued = false
  const render = () => { if (!disposed) view.render(state) }
  const toast = message => { if (!disposed) view.toast(message) }
  const progress = (...args) => { if (!disposed) view.progress(...args) }
  const fail = (label, error) => { if (disposed) return; console.error(error); toast(`${label}: ${error?.message || String(error)}`) }
  const activeBuffer = () => state.ab === "fixed" && state.fixed ? state.fixed : state.buffer
  const activeDuration = () => activeBuffer()?.duration || 0

  function ensureCtx() {
    if (!actx) {
      actx = new platform.AudioContext()
      analyser = actx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = .82
      analyser.connect(actx.destination)
    }
    if (actx.state === "suspended") actx.resume()
    return actx
  }
  function stopPlayback() {
    platform.cancelAnimationFrame(rafPlayer); rafPlayer = 0
    if (currentSource) {
      try { currentSource.onended = null; currentSource.stop() } catch { /* already stopped */ }
      currentSource = null
    }
    state.playing = false
    render()
  }
  function playBuffer(buf, tag, offset = 0) {
    if (disposed) return
    ensureCtx(); stopPlayback()
    const dur = buf.duration, start = Math.max(0, Math.min(offset || 0, Math.max(0, dur - .02)))
    const src = actx.createBufferSource(); src.buffer = buf
    if (state.rate !== 1) src.playbackRate.value = state.rate
    src.connect(analyser); currentSource = src
    state.pos = start; startPos = start; startedAt = actx.currentTime; state.playing = true; state.ab = tag
    src.onended = () => {
      if (currentSource !== src) return
      currentSource = null; state.playing = false
      state.pos = state.crop && state.crop.out < dur - .05 ? state.crop.in : 0
      platform.cancelAnimationFrame(rafPlayer); rafPlayer = 0; render()
    }
    src.start(0, start); render()
    const loop = () => {
      rafPlayer = platform.requestAnimationFrame(loop)
      if (!state.playing || currentSource !== src || !actx) return
      const pos = startPos + (actx.currentTime - startedAt) * state.rate
      if (state.crop && state.crop.out < dur - .05 && pos >= state.crop.out - .02) {
        playBuffer(buf, tag, state.crop.in); return
      }
      state.pos = Math.min(pos, dur); render()
    }
    loop()
  }
  function seekTo(pos, { restart = true } = {}) {
    if (disposed) return
    const b = activeBuffer(); if (!b) return
    let v = Math.max(0, Math.min(pos, Math.max(0, b.duration - .02)))
    if (state.crop) v = Math.max(state.crop.in, Math.min(v, Math.max(state.crop.in, state.crop.out - .05)))
    state.pos = v
    if (state.playing && restart) {
      const now = platform.performance.now()
      if (now - lastSeekRestart > 160) { lastSeekRestart = now; playBuffer(b, state.ab, v) }
      else render()
    } else render()
  }
  function togglePlay() {
    if (disposed) return
    const b = activeBuffer(); if (!b) return
    if (state.playing) { stopPlayback(); return }
    let start = state.pos
    if (start >= b.duration - .02) start = state.crop ? state.crop.in : 0
    if (state.crop) start = Math.max(state.crop.in, Math.min(start, Math.max(state.crop.in, state.crop.out - .05)))
    playBuffer(b, state.ab === "fixed" && state.fixed ? "fixed" : "orig", start)
  }
  function cycleRate() {
    if (disposed) return
    const rates = [1, 1.5, 2, .5]; state.rate = rates[(Math.max(0, rates.indexOf(state.rate)) + 1) % rates.length]
    if (state.playing) playBuffer(activeBuffer(), state.ab, state.pos)
    else render()
  }
  function selectSide(side) {
    if (disposed) return
    if (side !== "orig" && side !== "fixed") return
    if (side === "fixed" && !state.fixed) return
    state.ab = side
    if (state.playing) playBuffer(activeBuffer(), side, state.pos)
    else render()
  }
  const analysisController = createAnalysisController({
    state, analysisService: analysis, fetchPreviewBuffer: reference.fetchPreviewBuffer, isActive: () => !disposed,
    stopPlayback, updateAbUI: render, renderRefAreas: render,
    showProgress: (visible, label) => progress(visible, label),
    setProgress: value => progress(true, undefined, value),
    setProgressLabel: label => progress(true, label),
    renderAnalysis: render, renderReport: render, renderTweakPanel: render,
    showPanel: name => { if (!disposed) view.showPanel(name) }, toast,
  })
  async function loadBuffer(buffer, name, size, isDemo = false) {
    if (disposed) return
    stopPlayback()
    Object.assign(state, { buffer, fileName: name, fileSize: size, isDemo,
      analysis: null, scores: null, issues: null, fixPlan: null, autoPlan: null,
      fixed: null, fixedFast: null, converted: null, targetUsed: null,
      ab: "orig", pos: 0, rate: 1, crop: null, tweaks: defaults(), hasCustomTweaks: false })
    render()
    if (state.mode === "converse" && buffer) return analysisController.runAnalysis()
  }
  async function openFile(file) {
    if (disposed) return
    if (!file || state.busy || state.tweakBusy) return
    try {
      const buffer = await audio.decodeFile(file)
      if (disposed) return
      await loadBuffer(buffer, file.name, file.size)
    } catch (error) { fail("Couldn't decode that file. Try WAV, MP3, M4A, OGG, FLAC or AIFF", error) }
  }
  async function demo() {
    if (disposed) return
    if (state.busy || state.tweakBusy) return
    try {
      const buf = makeDemoBuffer()
      await loadBuffer(buf, "MusicOnVerse_Demo_126BPM.wav", Math.round(buf.length * 8), true)
    } catch (error) { fail("Demo failed", error) }
  }
  async function runFix() {
    if (disposed) return
    if (!state.buffer || !state.analysis || !state.targetUsed || state.busy || state.tweakBusy) return
    state.busy = true; stopPlayback(); progress(true, "Reading the analysis…")
    try {
      const fixed = await audio.masterFix(state.buffer, state.autoPlan || state.fixPlan, stage => progress(true, stage))
      if (disposed) return
      const fixedFast = await analysis.analyzeFast(fixed, () => {})
      if (disposed) return
      state.fixed = fixed; state.fixedFast = fixedFast; state.tweaks = defaults(); state.hasCustomTweaks = false
      state.ab = "fixed"; render(); playBuffer(fixed, "fixed")
      toast("Master Fix rendered a separate copy. Playing B · fixed; compare before saving.")
    } catch (error) { fail("Master Fix failed", error) }
    finally { state.busy = false; progress(false); render() }
  }
  function cropBuffer(buf, inSec, outSec) {
    const sr = buf.sampleRate, ch = buf.numberOfChannels
    const s0 = Math.max(0, Math.floor(inSec * sr)), s1 = Math.min(buf.length, Math.ceil(outSec * sr)), len = Math.max(1, s1 - s0)
    const nb = new platform.AudioBuffer({ length: len, numberOfChannels: ch, sampleRate: sr })
    for (let c = 0; c < ch; c++) {
      const srcD = buf.getChannelData(c), dstD = nb.getChannelData(c)
      for (let i = 0; i < len; i++) dstD[i] = srcD[s0 + i]
    }
    return nb
  }
  function toggleCrop() {
    if (disposed) return
    if (!activeBuffer()) return
    if (state.crop) state.crop = null
    else {
      if (activeDuration() < .3) { toast("Track too short to crop."); return }
      state.crop = { in: 0, out: activeDuration() }
    }
    render()
  }
  function setCrop(which, value) {
    if (disposed) return
    if (!state.crop || !Number.isFinite(value)) return
    const v = Math.max(0, Math.min(value, activeDuration()))
    if (which === "in") state.crop.in = Math.max(0, Math.min(v, state.crop.out - .25))
    if (which === "out") state.crop.out = Math.min(activeDuration(), Math.max(v, state.crop.in + .25))
    render()
  }
  const baseName = () => (state.fileName || "audio").replace(/\.[^.]+$/, "") || "audio"
  function exportCropRegion() {
    if (disposed) return
    const b = activeBuffer(); if (!b || !state.crop) return
    const cin = Math.min(Math.max(state.crop.in, 0), b.duration), cout = Math.min(Math.max(state.crop.in, state.crop.out), b.duration)
    if (cout - cin < .05) return
    audio.saveBlob(audio.encodeWav(cropBuffer(b, cin, cout), { float: true }), `${baseName()}_region_${cin.toFixed(1)}-${cout.toFixed(1)}s.wav`)
    toast("Region exported as 32-bit WAV.")
  }
  async function applyCrop() {
    if (disposed) return
    const b = activeBuffer(); if (!b || !state.crop || state.busy || state.tweakBusy) return
    const cin = Math.max(0, Math.min(state.crop.in, b.duration - .05)), cout = Math.min(state.crop.out, b.duration)
    if (cout - cin < .25) { toast("Crop too short — spread IN and OUT apart first."); return }
    try {
      if (state.ab === "fixed" && state.fixed) {
        // Replace the old crop-button disabled flag with the shared UI busy port.
        state.busy = true
        stopPlayback(); const trimmed = cropBuffer(state.fixed, cin, cout)
        const fast = await analysis.analyzeFast(trimmed, () => {})
        if (disposed) return
        // Publish only after successful measurement; failure retains last valid B.
        state.fixed = trimmed; state.fixedFast = fast; state.pos = 0; state.crop = null; render()
        playBuffer(trimmed, "fixed"); toast("B cropped and re-measured. Original A is unchanged.")
      } else {
        stopPlayback(); const cropped = cropBuffer(b, cin, cout); state.crop = null
        await loadBuffer(cropped, `${baseName()}_cropped.${state.fileName.split('.').pop() || 'wav'}`, cropped.length * cropped.numberOfChannels * 4, state.isDemo)
      }
    } catch (error) { fail("Crop failed", error) }
    finally { state.busy = false; render() }
  }
  async function runConvert({ format, kbps = 320, floatWav = true }) {
    if (disposed) return
    if (!state.buffer || state.busy || state.tweakBusy) return
    state.busy = true; progress(true, "Converting…"); render()
    try {
      const out = await audio.convert(state.buffer, { format, kbps, floatWav })
      if (disposed) return
      state.converted = out; audio.saveBlob(out.blob, `${baseName()}.${out.ext}`)
      toast(`Converted to ${format === "m4a" ? "M4A (browser-selected codec)" : out.label} — download started.`)
    } catch (error) { fail("Conversion failed", error) }
    finally { state.busy = false; progress(false); render() }
  }
  function downloadFixed() {
    if (disposed) return
    if (!state.fixed) return
    audio.saveBlob(audio.encodeWav(state.fixed, { float: true }), `${baseName()}_masterfixed.wav`)
    toast("Saved fixed copy (32-bit WAV).")
  }
  function downloadReport() {
    if (disposed) return
    if (!state.analysis) return
    const target = state.targetUsed
    const lines = ["MusicOnVerse — analysis report", state.fileName,
      `Target: ${target?.meta?.title || target?.g?.name || 'none'}`,
      `Reference kind: ${target?.kind || 'none'}. Built-in profiles are hand-authored heuristics, not measured chart tracks.`,
      `Score: ${state.scores?.overall}/100 · LUFS: ${state.analysis.lufs} · true peak: ${state.analysis.truePeakDb}`,
      ...[...(state.issues?.issues || []), ...(state.issues?.positives || [])].map(i => `${i.title || i.feature}: ${i.detail || ''}`),
      "Known stereo LUFS/peak/gain limitations remain; not a standards or audible-quality certification."]
    audio.saveText(lines.join("\n\n"), `${baseName()}_analysis.txt`)
  }
  async function pickReferenceFile(file) {
    if (disposed) return
    if (!file || state.busy || state.tweakBusy) return
    try {
      const buf = await audio.decodeFile(file)
      if (disposed) return
      state.ref.src = "file"; state.ref.file = { name: file.name, buf }; render()
      if (state.buffer) await analysisController.runAnalysis()
    } catch (error) { fail("Couldn't decode the reference file", error) }
  }
  async function resolveReferenceUrl(raw) {
    if (disposed) return
    if (state.busy || state.tweakBusy) return
    const u = state.ref.url || {}; u.resolving = true; u.error = null; u.prepared = false; u.feat = null
    state.ref.src = "url"; state.ref.url = u; render()
    try {
      const meta = await reference.resolveStreamUrl(raw)
      if (disposed) return
      state.ref.url = { inputUrl: raw, meta: meta.error ? null : meta, error: meta.error || null, prepared: false, resolving: false, buf: null, feat: null }
      render()
      if (meta.error) { toast(meta.error); return }
      if (state.buffer) await analysisController.runAnalysis()
    } catch (error) { if (disposed) return; state.ref.url = { inputUrl: raw, error: error?.message || String(error), resolving: false }; fail("Reference resolution failed", error); render() }
  }
  function setReference({ src, cat, sub }) {
    if (disposed) return
    if (state.busy || state.tweakBusy) return
    if (["auto", "file", "url"].includes(src)) state.ref.src = src
    if (cat !== undefined) { state.ref.cat = cat || null; state.ref.sub = null }
    if (sub !== undefined) state.ref.sub = sub || null
    render()
  }
  function tweakIsCustom() { return state.tweaks.trimDb !== 0 || state.tweaks.gluePct !== 100 || state.tweaks.width !== 0 || Object.values(state.tweaks.band).some(v => v !== 0) }
  async function rerenderFixed() {
    if (disposed) return
    if (state.tweakBusy) { tweakQueued = true; return }
    if (!state.fixed || !state.buffer || !state.autoPlan || state.busy) return
    const plan = buildProcessingPlan(state.autoPlan || state.fixPlan, state.tweaks, BAND_KEYS); if (!plan) return
    state.tweakBusy = true; progress(true, "Rebalancing fixed copy…"); render()
    const epoch = ++state.tweakEpoch, wasPlaying = state.playing && state.ab === "fixed", resumeAt = wasPlaying ? state.pos : 0
    stopPlayback()
    try {
      const fixed = await audio.masterFix(state.buffer, plan, stage => progress(true, stage))
      if (epoch !== state.tweakEpoch) return
      const fast = await analysis.analyzeFast(fixed, () => {})
      if (epoch !== state.tweakEpoch) return
      state.fixed = fixed; state.fixedFast = fast; state.hasCustomTweaks = tweakIsCustom(); render()
      if (wasPlaying && state.fixed) playBuffer(state.fixed, "fixed", resumeAt)
    } catch (error) { fail("Rebalance failed", error) }
    finally { if (epoch === state.tweakEpoch) { state.tweakBusy = false; progress(false); render() } }
    if (tweakQueued && epoch === state.tweakEpoch) { tweakQueued = false; scheduleTweak() }
  }
  function scheduleTweak() { platform.clearTimeout(tweakTimer); tweakTimer = platform.setTimeout(rerenderFixed, 400) }
  function setTweak(key, value) {
    if (disposed) return
    if (!state.fixed || state.busy || !Number.isFinite(value)) return
    const ranges = { trimDb: [-6, 6], gluePct: [0, 200], width: [-6, 6] }
    if (key.startsWith("band:") && BAND_KEYS.includes(key.slice(5))) state.tweaks.band[key.slice(5)] = Math.max(-9, Math.min(9, value))
    else if (ranges[key]) state.tweaks[key] = Math.max(ranges[key][0], Math.min(ranges[key][1], value))
    else return
    scheduleTweak()
  }
  function resetTweaks() {
    if (disposed || !state.fixed || state.busy) return
    state.tweaks = defaults(); state.hasCustomTweaks = false; render(); scheduleTweak()
  }
  function reset() {
    if (disposed) return
    if (state.busy || state.tweakBusy) return
    stopPlayback(); platform.clearTimeout(tweakTimer)
    Object.assign(state, { buffer: null, fixed: null, fixedFast: null, scores: null, issues: null, converted: null, analysis: null,
      targetUsed: null, fixPlan: null, autoPlan: null, ref: { src: "auto", cat: null, sub: null, file: null, url: null },
      tweaks: defaults(), hasCustomTweaks: false, ab: "orig", pos: 0, rate: 1, crop: null, fileName: "", fileSize: 0, isDemo: false })
    render()
  }
  function dispose() {
    if (disposal) return disposal
    // Invalidate publication BEFORE awaiting close. This is lifecycle suppression,
    // not cancellation of in-flight analysis/offline computation or a new UI API.
    disposed = true
    ++state.tweakEpoch; tweakQueued = false
    state.busy = false; state.tweakBusy = false
    platform.clearTimeout(tweakTimer); stopPlayback()
    const closing = actx; actx = null; analyser = null
    disposal = Promise.resolve().then(() => closing?.close())
    return disposal
  }
  return Object.freeze({ state, openFile, demo, runAnalysis: analysisController.runAnalysis, runFix, runConvert, downloadFixed, downloadReport,
    stopPlayback, togglePlay, cycleRate, selectSide, seekTo, seekBy: delta => seekTo(state.pos + delta),
    toggleCrop, setCrop, applyCrop, exportCropRegion, playRegion: () => { if (state.crop && activeBuffer()) playBuffer(activeBuffer(), state.ab, state.crop.in) },
    pickReferenceFile, resolveReferenceUrl, setReference, setTweak, resetTweaks, reset, dispose })
}
