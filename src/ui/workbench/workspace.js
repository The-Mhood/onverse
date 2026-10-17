import { mountEnvironmentMotion } from "../presentation/rebuild/environmentMotion.js"
import { CATEGORIES, BAND_KEYS, BAND_META, categoryById } from "../../audio/genre.js"
import { peaksFor } from "../../audio/waveformPeaks.js"

const time = s => `${Math.floor((s || 0) / 60)}:${((s || 0) % 60).toFixed(2).padStart(5, "0")}`
const number = (n, digits = 1) => Number.isFinite(n) ? n.toFixed(digits) : "—"

/** New semantic view, not a legacy DOM compatibility layer. Static markup only;
 * filenames, reference metadata and engine reports are always textContent.
 * Presentation can be replaced without giving it an audio/state authority.
 */
export function mountWorkspace(root, { recorders = [] } = {}) {
  if (!root) throw new Error("Missing application mount: #app")
  const template = document.createElement("template")
  template.innerHTML = `
    <div class="workspace-root">
      <div class="environment" aria-hidden="true"><div class="scene-plane scene-stars"></div><div class="scene-plane scene-celestial"></div><div class="scene-plane scene-horizon"></div><div class="scene-plane scene-foreground"></div></div>
      <a class="skip-link" href="#workbench">Skip to workspace</a>
      <header class="studio-header" data-surface="header"><a class="brand" href="#workbench"><span class="brand-mark" aria-hidden="true">m/v</span> MusicOnVerse</a>
        <span class="header-caption">A SPACE TO LISTEN CLOSELY</span><span class="local-badge"><i aria-hidden="true"></i> Local audio</span>
      </header>
      <section class="environment-banner" aria-label="Workspace introduction">
        <div class="intro"><p class="eyebrow">LISTEN · COMPARE · SHAPE</p><h1>Audio workbench</h1><p>Listen, compare and shape a single audio file. Nothing is uploaded on import.</p></div>
        <span class="environment-coordinate" aria-hidden="true">OPEN SPACE<br>CLOSE LISTENING</span>
      </section>
      <div class="workspace-heading"><div><span class="eyebrow">LOCAL WORKBENCH</span><h2>Signal workspace</h2></div><span class="scope-label">Single source <span aria-hidden="true">·</span> Original preserved</span></div>
      <div class="studio-grid" data-surface="body" id="workbench" tabindex="-1">
        <aside class="source-panel surface" aria-label="Source and comparison reference">
          <div class="section-heading"><h3>Source</h3><span class="section-index">01</span></div>
          <p class="source-name">No audio loaded</p><p class="source-meta">WAV, MP3 and browser-decodable audio</p>
          <input class="mix-picker" type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac,.aiff" hidden aria-label="Choose audio file">
          <div class="button-stack"><button type="button" data-action="import" class="primary">Import audio <span aria-hidden="true">↗</span></button><button type="button" data-action="demo">Generate demo</button></div>
          <p class="subtle small">Or drop a local audio file into this workspace.</p>
          <div class="section-heading separated"><h3>Reference</h3><span class="section-index">02</span></div>
          <label>Reference source<select class="reference-source"><option value="auto">Built-in genre profile</option><option value="file">Your reference file</option><option value="url">Stream link</option></select></label>
          <div class="profile-options"><label>Category<select class="category"><option value="">Auto-detect</option></select></label><label>Subgenre<select class="subgenre"><option value="">Category default</option></select></label></div>
          <div class="file-reference" hidden><input class="reference-picker" type="file" accept="audio/*" hidden aria-label="Choose reference file"><button type="button" data-action="reference">Choose reference audio</button></div>
          <form class="url-reference" hidden><label>Track link<input class="reference-url" type="url" placeholder="https://…" required></label><button type="submit">Resolve reference</button></form>
          <p class="reference-note small subtle">Built-in profiles are hand-authored heuristics, not measured chart-track fingerprints.</p>
          <button type="button" data-action="analyze" class="analyze-button">Analyze / compare</button>
        </aside>
        <section class="editor-panel surface" data-surface="workspace" aria-label="Single audio file editor">
          <div class="section-heading"><div><h3>Waveform</h3><p class="subtle small">One source. Original preserved during Master Fix.</p></div><span class="audio-side">A / ORIGINAL</span></div>
          <div class="timeline-scale" data-role="timeline-ruler" aria-hidden="true"><span>0:00</span><span class="quarter-time">—</span><span class="half-time">—</span><span class="end-time">—</span></div>
          <div class="waveform-well"><canvas class="audio-waveform" aria-label="Peak waveform of the selected audio copy"></canvas><div class="waveform-empty"><span class="empty-symbol" aria-hidden="true">∿</span><strong>Your audio starts here.</strong><span>Import a file or generate the real synth demo.</span></div><div class="region-highlight" data-role="selection" hidden><button type="button" class="region-handle region-handle-in" data-region-handle="in" role="slider" aria-label="Region start" aria-orientation="horizontal">IN</button><button type="button" class="region-handle region-handle-out" data-region-handle="out" role="slider" aria-label="Region end" aria-orientation="horizontal">OUT</button></div><div class="playhead" hidden></div></div>
          <label class="seek-label"><span>Playhead <output class="position-label">0:00.00 / 0:00.00</output></span><input class="position" type="range" min="0" max="1" step="0.05" value="0" aria-label="Seek in audio"></label>
          <div class="transport" data-surface="transport" role="group" aria-label="Playback transport"><div class="transport-buttons"><button type="button" data-action="back" aria-label="Seek backward 10 seconds">−10s</button><button type="button" data-action="play" class="play-button">Play</button><button type="button" data-action="forward" aria-label="Seek forward 10 seconds">+10s</button><button type="button" data-action="rate" class="rate-button" aria-label="Cycle playback speed">1×</button></div><div class="ab-switch" role="group" aria-label="Compare original and fixed audio"><button type="button" data-action="original" aria-pressed="true">A <span>Original</span></button><button type="button" data-action="fixed" aria-pressed="false">B <span>Fixed</span></button></div></div>
          <div class="edit-tools"><button type="button" data-action="crop" aria-expanded="false">Select region</button><button type="button" data-action="reset" class="text-button">Clear source</button><span class="subtle small">Space: play · ← / →: seek</span></div>
          <section class="region-controls" hidden aria-label="Region editing"><div class="region-inputs"><label>IN · seconds<input class="region-in" type="number" min="0" step="0.05"></label><label>OUT · seconds<input class="region-out" type="number" min="0" step="0.05"></label></div><div class="wrap-buttons"><button type="button" data-action="play-region">Play region</button><button type="button" data-action="export-region">Export region WAV</button><button type="button" data-action="apply-crop">Apply crop to selected copy</button></div><p class="small subtle">Cropping A replaces the working buffer and re-analyzes it. Keep your source file; this workbench has no undo or durable project save.</p></section>
          <div class="section-heading separated"><h3>Output</h3><span class="section-index">03</span></div>
          <div class="conversion-controls"><label>Format<select class="output-format"><option value="wav">WAV · lossless</option><option value="mp3">MP3</option><option value="m4a">M4A · browser codec</option><option value="ogg">OGG · Opus</option><option value="webm">WebM · Opus</option></select></label><label>MP3 bitrate<select class="output-bitrate"><option value="320">320 kbps</option><option value="192">192 kbps</option><option value="128">128 kbps</option></select></label><label>WAV depth<select class="output-depth"><option value="float">32-bit float</option><option value="pcm">16-bit PCM</option></select></label></div>
          <p class="small subtle">Conversion uses original A. Recorder formats depend on this browser and encode in real time.</p>
          <div class="wrap-buttons"><button type="button" data-action="convert">Convert & download A</button><button type="button" data-action="save-fixed">Save fixed B · WAV</button><button type="button" data-action="report" class="text-button">Save report</button></div>
        </section>
        <aside class="inspector surface" data-surface="inspector" aria-label="Analysis and mastering inspector">
          <div class="section-heading"><h3>Analysis</h3><span class="analysis-state">AWAITING AUDIO</span></div>
          <div class="score-line"><strong class="overall-score">—</strong><span>/ 100<br><span class="small subtle">profile comparison</span></span></div>
          <p class="target-label subtle small">Choose audio to inspect its signal.</p>
          <dl class="measurements"><div><dt>Loudness</dt><dd class="measurement-lufs">— LUFS</dd></div><div><dt>Peak estimate</dt><dd class="measurement-peak">— dBFS</dd></div><div><dt>Sample rate</dt><dd class="measurement-rate">— kHz</dd></div></dl>
          <button type="button" data-action="fix" class="primary fix-button">Render Master Fix</button><p class="fixed-measurement small subtle">Renders a separate copy using the existing local processor.</p>
          <details class="adjustments"><summary>Manual adjustments</summary><p class="small subtle">Offsets on the automatic plan. Original A is not overwritten.</p><div class="adjustment-inputs"></div><button type="button" data-action="reset-tweaks">Reset adjustments</button></details>
          <div class="analysis-issues" aria-label="Analysis findings"></div>
        </aside>
      </div>
      <div class="operation-progress" hidden><span class="progress-label">Working…</span><progress max="1" value="0" aria-label="Operation progress"></progress></div>
      <p class="operation-status" role="status" aria-live="polite">Ready. Audio processing stays local; resolving a stream reference requires internet access.</p>
      <div class="desktop-update" hidden role="status"><span></span><button type="button" class="install-update" hidden>Restart & install</button><button type="button" class="dismiss-update">Dismiss</button></div>
      <footer class="studio-footer"><span>MusicOnVerse <span aria-hidden="true">/</span> LOCAL WORKBENCH</span><button type="button" data-action="capabilities" aria-haspopup="dialog">Engine limits &amp; capabilities</button></footer>
      <dialog class="capability-sheet" aria-labelledby="capability-title">
      <header><h2 id="capability-title" tabindex="-1" autofocus>One source. Real processing.</h2><button data-action="close-capabilities" aria-label="Close scope and limits">Close</button></header>
      <p class="capability-limit">Loudness is an ungated estimate; peak/gain limitations remain. Check your result before delivery. This is not a standards-certified meter; no project persistence or undo is exposed.</p>
      <p>Import or generate a demo. Analyze your mix, compare a reference, play A/B, crop a region, apply Master Fix and manual adjustments, then export real audio.</p>
      <p class="capability-limit">This destination edits one source. Use Arrangement for real multitrack editing and mixdown. Plugin hosting, MIDI, a media library and SYLUNE execution are not implemented. Local browser codec support varies.</p>
      <p class="capability-limit">Browser verification is not packaged Mac qualification, device listening, or a release/standards certification.</p>
    </dialog>
  </div>`
  root.replaceChildren(template.content.cloneNode(true))
  const environmentMotion = mountEnvironmentMotion(root.querySelector(".workspace-root"))
  const must = selector => {
    const node = root.querySelector(selector)
    if (!node) throw new Error(`Workspace DOM contract missing: ${selector}`)
    return node
  }
  const elements = Object.fromEntries(["source-name", "source-meta", "mix-picker", "reference-picker", "reference-source", "category", "subgenre", "profile-options", "file-reference", "url-reference", "reference-url", "reference-note", "audio-side", "audio-waveform", "waveform-empty", "playhead", "region-highlight", "position", "position-label", "region-controls", "region-in", "region-out", "output-format", "output-bitrate", "output-depth", "overall-score", "target-label", "measurement-lufs", "measurement-peak", "measurement-rate", "analysis-state", "analysis-issues", "fixed-measurement", "adjustment-inputs", "operation-progress", "progress-label", "operation-status", "quarter-time", "half-time", "end-time", "desktop-update", "install-update", "dismiss-update"].map(k => [k, must(`.${k}`)]))
  const buttons = Object.fromEntries([...root.querySelectorAll("[data-action]")].map(b => [b.dataset.action, b]))
  for (const c of CATEGORIES) elements.category.add(new Option(c.name, c.id))
  for (const option of elements["output-format"].options) if (!["wav", "mp3"].includes(option.value) && !recorders.some(r => r.fmt === option.value)) option.disabled = true
  const defs = [{ key: "trimDb", label: "Output trim", min: -6, max: 6, step: .5, value: 0 }, { key: "gluePct", label: "Dynamics strength", min: 0, max: 200, step: 5, value: 100 },
    ...BAND_KEYS.map(k => ({ key: `band:${k}`, label: `${BAND_META[k].name} · dB`, min: -9, max: 9, step: .5, value: 0 })), { key: "width", label: "Stereo width · dB", min: -6, max: 6, step: .5, value: 0 }]
  for (const d of defs) {
    const label = document.createElement("label"), input = document.createElement("input"), out = document.createElement("output")
    label.textContent = d.label; input.type = "range"; input.min = d.min; input.max = d.max; input.step = d.step; input.value = d.value; input.dataset.tweak = d.key
    out.textContent = d.value; label.append(out, input); elements["adjustment-inputs"].append(label)
  }
  const events = new AbortController()
  let state, controller, oldRefCategory, lastIssues, lastBuffer, lastFixed, lastSide, lastCrop, lastWidth, observer
  let regionGesture = null
  let previousAnalysis, previousFixed, previousRefSource, previousCropVisible = false
  const sheet = must(".capability-sheet")
  const palette = getComputedStyle(root)
  const colors = {
    grid: palette.getPropertyValue("--mvo-border-subtle").trim(),
    original: palette.getPropertyValue("--mvo-accent-functional").trim(),
    fixed: palette.getPropertyValue("--mvo-color-amber").trim(),
  }
  function reveal(element) {
    if (!element || element.hidden || globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    // This invalidation occurs once per real content change, not on playback ticks.
    delete element.dataset.viewPhase
    void element.offsetWidth
    element.dataset.viewPhase = "enter"
  }
  function draw() {
    if (!state) return
    const canvas = elements["audio-waveform"], rect = canvas.getBoundingClientRect(), w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height)), dpr = devicePixelRatio || 1
    const selected = state.ab === "fixed" && state.fixed ? state.fixed : state.buffer
    const cropKey = state.crop ? `${state.crop.in}:${state.crop.out}` : ""
    // Audio peaks only redraw on actual buffer/side/size/region changes, not 60x/s.
    if (lastBuffer === selected && lastFixed === state.fixed && lastSide === state.ab && lastCrop === cropKey && lastWidth === `${w}:${h}:${dpr}`) return
    lastBuffer = selected; lastFixed = state.fixed; lastSide = state.ab; lastCrop = cropKey; lastWidth = `${w}:${h}:${dpr}`
    canvas.width = w * dpr; canvas.height = h * dpr
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("2D waveform rendering is unavailable")
    ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = colors.grid; ctx.lineWidth = 1
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(i * w / 8, 0); ctx.lineTo(i * w / 8, h); ctx.stroke() }
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke()
    if (selected) {
      const peaks = peaksFor(selected, Math.max(1, Math.floor(w / 3)))
      ctx.fillStyle = state.ab === "fixed" ? colors.fixed : colors.original
      for (let i = 0; i < peaks.length; i++) { const amplitude = Math.min(1, peaks[i]) * h * .43; ctx.fillRect(i * 3, h / 2 - amplitude, 1.6, Math.max(1, amplitude * 2)) }
    }
  }
  function render(s) {
    state = s
    root.querySelector(".workspace-root").dataset.sourceState = s.buffer ? "ready" : "empty"
    const b = s.ab === "fixed" && s.fixed ? s.fixed : s.buffer, duration = b?.duration || 0, busy = s.busy || s.tweakBusy
    elements["source-name"].textContent = s.fileName || "No audio loaded"
    elements["source-meta"].textContent = s.buffer ? `${time(s.buffer.duration)} · ${s.buffer.sampleRate / 1000} kHz · ${s.buffer.numberOfChannels} ch${s.isDemo ? ' · synthesized demo' : ''}` : "WAV, MP3 and browser-decodable audio"
    elements["audio-side"].textContent = s.ab === "fixed" ? "B / FIXED COPY" : "A / ORIGINAL"
    elements["waveform-empty"].hidden = !!b
    elements["playhead"].hidden = !b; elements["playhead"].style.left = `${duration ? Math.min(1, s.pos / duration) * 100 : 0}%`
    elements["position-label"].textContent = `${time(s.pos)} / ${time(duration)}`
    elements.position.max = duration || 1
    if (document.activeElement !== elements.position) elements.position.value = s.pos
    elements["quarter-time"].textContent = time(duration / 3); elements["half-time"].textContent = time(duration * 2 / 3); elements["end-time"].textContent = time(duration)
    elements["region-controls"].hidden = !s.crop; elements["region-highlight"].hidden = !s.crop
    if (s.crop) {
      for (const which of ["in", "out"]) { const el = elements[`region-${which}`]; el.max = duration; if (document.activeElement !== el) el.value = s.crop[which].toFixed(2) }
      elements["region-highlight"].style.left = `${s.crop.in / duration * 100}%`; elements["region-highlight"].style.width = `${(s.crop.out - s.crop.in) / duration * 100}%`
    }
    for (const [action, button] of Object.entries(buttons)) button.disabled = busy || (!["import", "demo", "reference", "capabilities", "close-capabilities"].includes(action) && !s.buffer)
    buttons.fixed.disabled = busy || !s.fixed; buttons.fix.disabled = busy || !s.analysis
    buttons["save-fixed"].disabled = busy || !s.fixed; buttons.report.disabled = busy || !s.analysis
    buttons["reset-tweaks"].disabled = busy || !s.fixed
    buttons.play.textContent = s.playing ? "Pause" : "Play"; buttons.rate.textContent = `${s.rate}×`
    buttons.original.setAttribute("aria-pressed", String(s.ab === "orig")); buttons.fixed.setAttribute("aria-pressed", String(s.ab === "fixed"))
    buttons.crop.setAttribute("aria-expanded", String(!!s.crop)); buttons.crop.textContent = s.crop ? "Cancel region" : "Select region"
    for (const key of ["position", "region-in", "region-out"]) elements[key].disabled = busy || !b
    for (const key of ["mix-picker", "reference-picker", "reference-source", "category", "subgenre", "reference-url", "output-format", "output-bitrate", "output-depth"]) elements[key].disabled = busy
    elements["url-reference"].querySelector("button").disabled = busy || !!s.ref.url?.resolving
    elements["reference-source"].value = s.ref.src; elements.category.value = s.ref.cat || ""
    if (oldRefCategory !== s.ref.cat) {
      oldRefCategory = s.ref.cat; elements.subgenre.replaceChildren(new Option("Category default", ""))
      for (const name of categoryById(s.ref.cat)?.subs || []) elements.subgenre.add(new Option(name, name))
    }
    elements.subgenre.value = s.ref.sub || ""; elements["profile-options"].hidden = s.ref.src !== "auto"
    elements["file-reference"].hidden = s.ref.src !== "file"; elements["url-reference"].hidden = s.ref.src !== "url"
    elements["reference-note"].textContent = s.ref.src === "file" ? s.ref.file?.name || "Choose your reference audio. It will be decoded and measured locally." : s.ref.src === "url" ? s.ref.url?.error || (s.ref.url?.resolving ? "Resolving link…" : s.ref.url?.feat ? "Official preview measured; not the full streaming track." : "Resolves online. Without available preview audio, only a built-in profile is compared.") : "Built-in profiles are hand-authored heuristics, not measured chart-track fingerprints."
    elements["overall-score"].textContent = s.scores?.overall ?? "—"
    elements["analysis-state"].textContent = busy ? "PROCESSING" : s.analysis ? "MEASURED" : "AWAITING AUDIO"
    elements["target-label"].textContent = s.targetUsed ? `${s.targetUsed.meta?.title || s.targetUsed.g.name} · ${s.targetUsed.kind === 'auto' || s.targetUsed.kind === 'profile' ? 'built-in profile' : 'measured reference'}` : "Choose audio to inspect its signal."
    elements["measurement-lufs"].textContent = `${number(s.analysis?.lufs)} LUFS`; elements["measurement-peak"].textContent = `${number(s.analysis?.truePeakDb)} dBFS`; elements["measurement-rate"].textContent = `${number(s.buffer?.sampleRate / 1000)} kHz`
    elements["fixed-measurement"].textContent = s.fixedFast ? `B: ${number(s.fixedFast.lufs)} LUFS · ${number(s.fixedFast.truePeakDb)} dBFS peak estimate. Compare and verify before delivery.` : "Renders a separate copy using the existing local processor."
    if (lastIssues !== s.issues) {
      lastIssues = s.issues; elements["analysis-issues"].replaceChildren()
      for (const issue of s.issues?.issues || []) {
        const item = document.createElement("article"), heading = document.createElement("h4"), detail = document.createElement("p")
        item.className = "finding"; heading.textContent = issue.title; detail.textContent = issue.detail; item.append(heading, detail); elements["analysis-issues"].append(item)
      }
      for (const positive of s.issues?.positives || []) { const item = document.createElement("p"); item.className = "positive"; item.textContent = typeof positive === 'string' ? positive : positive.title || positive.detail; elements["analysis-issues"].append(item) }
    }
    for (const input of elements["adjustment-inputs"].querySelectorAll("input")) {
      const key = input.dataset.tweak, v = key.startsWith("band:") ? s.tweaks.band[key.slice(5)] : s.tweaks[key]
      input.disabled = !s.fixed || s.busy
      if (document.activeElement !== input) { input.value = v; input.previousElementSibling.textContent = v }
    }
    for (const handle of root.querySelectorAll("[data-region-handle]")) {
      const which = handle.dataset.regionHandle, b = s.ab === "fixed" && s.fixed ? s.fixed : s.buffer
      handle.disabled = !s.crop || s.busy || s.tweakBusy
      handle.setAttribute("aria-valuemin", "0")
      handle.setAttribute("aria-valuemax", String(b?.duration || 0))
      handle.setAttribute("aria-valuenow", String(s.crop?.[which] || 0))
      handle.setAttribute("aria-valuetext", `${(s.crop?.[which] || 0).toFixed(2)} seconds`)
    }
    buttons.capabilities.disabled = false; buttons["close-capabilities"].disabled = false
    if (s.analysis && s.analysis !== previousAnalysis) reveal(must(".inspector"))
    if (s.fixed && s.fixed !== previousFixed) reveal(must(".editor-panel"))
    if (s.ref.src !== previousRefSource) reveal(elements[s.ref.src === "file" ? "file-reference" : s.ref.src === "url" ? "url-reference" : "profile-options"])
    if (s.crop && !previousCropVisible) reveal(elements["region-controls"])
    previousAnalysis = s.analysis; previousFixed = s.fixed; previousRefSource = s.ref.src; previousCropVisible = !!s.crop
    draw()
  }
  function toast(message) { elements["operation-status"].textContent = String(message) }
  function progress(visible, label, value) {
    elements["operation-progress"].hidden = !visible
    if (label !== undefined) elements["progress-label"].textContent = label
    if (value !== undefined) elements["operation-progress"].querySelector("progress").value = value
  }
  function showPanel(name) { elements["analysis-state"].setAttribute("aria-label", `${name} results`); root.querySelector('.inspector').classList.add('has-results') }
  function bind(c) {
    if (controller) throw new Error("Workspace actions already bound")
    controller = c; const on = (node, name, handler) => node.addEventListener(name, handler, { signal: events.signal })
    const invoke = async fn => { try { await fn() } catch (error) { console.error(error); toast(`Operation failed: ${error.message || error}`) } }
    const actions = {
      capabilities: () => { buttons.capabilities.focus({ preventScroll: true }); sheet.showModal() }, "close-capabilities": () => sheet.close(),
      import: () => elements["mix-picker"].click(), demo: c.demo, analyze: c.runAnalysis, fix: c.runFix,
      play: c.togglePlay, back: () => c.seekBy(-10), forward: () => c.seekBy(10), rate: c.cycleRate,
      original: () => c.selectSide("orig"), fixed: () => c.selectSide("fixed"), crop: c.toggleCrop,
      "play-region": c.playRegion, "export-region": c.exportCropRegion, "apply-crop": c.applyCrop,
      "save-fixed": c.downloadFixed, report: c.downloadReport, reset: c.reset,
      reference: () => elements["reference-picker"].click(), "reset-tweaks": c.resetTweaks,
      convert: () => c.runConvert({ format: elements["output-format"].value, kbps: Number(elements["output-bitrate"].value), floatWav: elements["output-depth"].value === "float" }),
    }
    on(root, "animationend", event => {
      if (event.animationName === "mvo-panel-settle-in") delete event.target.dataset.viewPhase
    })
    on(must(".adjustments"), "toggle", event => {
      if (event.target.open) reveal(elements["adjustment-inputs"])
    })
    for (const [action, button] of Object.entries(buttons)) { if (!actions[action]) throw new Error(`Unwired workspace action: ${action}`); on(button, "click", () => invoke(actions[action])) }
    on(elements["mix-picker"], "change", () => { const f = elements["mix-picker"].files[0]; elements["mix-picker"].value = ""; if (f) invoke(() => c.openFile(f)) })
    on(elements["reference-picker"], "change", () => { const f = elements["reference-picker"].files[0]; elements["reference-picker"].value = ""; if (f) invoke(() => c.pickReferenceFile(f)) })
    on(elements["reference-source"], "change", () => c.setReference({ src: elements["reference-source"].value }))
    on(elements.category, "change", () => c.setReference({ cat: elements.category.value }))
    on(elements.subgenre, "change", () => c.setReference({ sub: elements.subgenre.value }))
    on(elements["url-reference"], "submit", event => { event.preventDefault(); invoke(() => c.resolveReferenceUrl(elements["reference-url"].value)) })
    on(elements.position, "input", () => c.seekTo(Number(elements.position.value), { restart: false }))
    on(elements.position, "change", () => c.seekTo(Number(elements.position.value)))
    on(elements["audio-waveform"], "click", event => { const r = event.target.getBoundingClientRect(), b = c.state.ab === "fixed" && c.state.fixed ? c.state.fixed : c.state.buffer; if (b) c.seekTo((event.clientX - r.left) / r.width * b.duration) })
    for (const which of ["in", "out"]) on(elements[`region-${which}`], "change", () => c.setCrop(which, Number(elements[`region-${which}`].value)))
    for (const handle of root.querySelectorAll("[data-region-handle]")) {
      const which = handle.dataset.regionHandle
      const move = event => {
        const b = c.state.ab === "fixed" && c.state.fixed ? c.state.fixed : c.state.buffer
        const rect = elements["audio-waveform"].getBoundingClientRect()
        if (b && rect.width && !handle.disabled) c.setCrop(which, (event.clientX - rect.left) / rect.width * b.duration)
      }
      on(handle, "pointerdown", event => {
        if (regionGesture || handle.disabled || event.button !== 0) return
        event.preventDefault(); handle.focus({ preventScroll: true }); handle.setPointerCapture(event.pointerId)
        regionGesture = { handle, id: event.pointerId }; move(event)
      })
      on(handle, "pointermove", event => { if (regionGesture?.handle === handle && regionGesture.id === event.pointerId) move(event) })
      const release = event => {
        if (regionGesture?.handle !== handle || regionGesture.id !== event.pointerId) return
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId)
        regionGesture = null
      }
      on(handle, "pointerup", release); on(handle, "pointercancel", release); on(handle, "lostpointercapture", release)
      on(handle, "keydown", event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || handle.disabled || !c.state.crop) return
        event.preventDefault(); event.stopPropagation()
        const b = c.state.ab === "fixed" && c.state.fixed ? c.state.fixed : c.state.buffer
        const value = event.key === "Home" ? 0 : event.key === "End" ? b.duration : c.state.crop[which] + (event.key === "ArrowRight" ? 1 : -1) * (event.shiftKey ? .5 : .05)
        c.setCrop(which, value)
      })
    }

    on(elements["adjustment-inputs"], "input", event => { const input = event.target; if (!input.dataset.tweak) return; input.previousElementSibling.textContent = input.value; c.setTweak(input.dataset.tweak, Number(input.value)) })
    on(window, "keydown", event => {
      if (root.querySelector(".workspace-root").dataset.editor === "daw") return
      if (sheet.open || event.target.closest("input,select,textarea,button,[contenteditable=true],summary,a")) return
      if (event.code === "Space") { event.preventDefault(); invoke(c.togglePlay) }
      if (event.code === "ArrowRight" || event.code === "ArrowLeft") { event.preventDefault(); c.seekBy((event.code === "ArrowRight" ? 1 : -1) * (event.shiftKey ? 10 : 5)) }
    })
    on(root, "dragover", event => event.preventDefault())
    on(root, "drop", event => { event.preventDefault(); if (root.querySelector(".workspace-root").dataset.editor === "daw") return; const f = event.dataTransfer.files[0]; if (f) invoke(() => c.openFile(f)) })
    observer = new ResizeObserver(() => { lastWidth = undefined; draw() }); observer.observe(elements["audio-waveform"])
    render(c.state)
  }
  function update(status, install) {
    const box = elements["desktop-update"]
    if (["not-available"].includes(status.state)) { box.hidden = true; return }
    box.hidden = false
    box.querySelector("span").textContent = status.state === "downloaded" ? `Update ${status.version || ''} ready to install.` : status.state === "error" ? `Update check failed: ${status.error || 'unknown error'}` : status.state === "downloading" ? `Downloading update: ${status.percent}%` : `Update: ${status.state}`
    elements["install-update"].hidden = status.state !== "downloaded"
    elements["install-update"].onclick = install
    elements["dismiss-update"].onclick = () => { box.hidden = true }
  }
  return { render, toast, progress, showPanel, bind, update, dispose() { if (regionGesture?.handle.hasPointerCapture(regionGesture.id)) regionGesture.handle.releasePointerCapture(regionGesture.id); regionGesture = null; environmentMotion.dispose(); events.abort(); observer?.disconnect(); if (sheet.open) sheet.close(); elements["install-update"].onclick = null; elements["dismiss-update"].onclick = null } }
}
