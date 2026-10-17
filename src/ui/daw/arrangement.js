import { SAMPLE_RATE, durationFrames } from "../../domain/daw/project.js"
const seconds = frames => (frames / SAMPLE_RATE).toFixed(6)
const clock = frames => `${Math.floor(frames / SAMPLE_RATE / 60)}:${(frames / SAMPLE_RATE % 60).toFixed(2).padStart(5, "0")}`

// Functional host adapter. Project/audio authority stays in dawController.
// Selection, zoom and tentative pointer movement are view-only state.
export function mountArrangement(workspace, { onDestination, navigation = true } = {}) {
  const abort = new AbortController(), on = (el, type, callback) => el.addEventListener(type, callback, { signal: abort.signal })
  const nav = document.createElement("nav"); nav.className = "production-modes"; nav.setAttribute("aria-label", "Music production destinations")
  nav.innerHTML = `<button type="button" data-destination="daw">Arrangement <small>Multitrack</small></button><button type="button" data-destination="workbench">Audio shaping <small>Single-file tools</small></button>`
  if (navigation) workspace.querySelector(".studio-header").after(nav)
  const section = document.createElement("section"); section.className = "daw-arrangement"; section.setAttribute("aria-label", "Multitrack arrangement")
  section.innerHTML = `
    <header class="daw-project-header"><div><span class="eyebrow">MUSICONVERSE / MULTITRACK</span><label class="daw-project-label">Project <input class="daw-project-name" maxlength="160" value="Untitled session" aria-label="Project name"></label></div><div class="daw-project-actions"><button data-daw="open">Open project</button><button data-daw="save">Download project</button><button data-daw="export">Export mix · WAV</button><button data-daw="shape">Mix → audio shaping</button></div></header>
    <div class="daw-toolbar"><div class="daw-button-group"><button data-daw="import" class="primary">Import tracks</button><button data-daw="demo">Create 3-track demo</button><button data-daw="undo" aria-label="Undo project edit">Undo</button><button data-daw="redo" aria-label="Redo project edit">Redo</button></div><div class="daw-button-group"><button data-daw="stop" aria-label="Stop arrangement">■ Stop</button><button data-daw="play" aria-label="Play arrangement">▶ Play</button><output class="daw-clock" aria-label="Arrangement position">0:00.00</output></div><label class="daw-zoom-label">Zoom <input class="daw-zoom" type="range" min="18" max="140" step="2" value="50" aria-label="Timeline zoom"></label></div>
    <input class="daw-files" type="file" multiple accept="audio/*,.wav,.mp3,.flac,.aiff,.m4a,.ogg" hidden aria-label="Choose multiple audio tracks"><input class="daw-project-file" type="file" accept=".json,.movproject" hidden aria-label="Choose MusicOnVerse project">
    <div class="daw-layout"><div class="daw-timeline" tabindex="0" aria-label="Arrangement timeline, scroll horizontally to navigate"><div class="daw-ruler-row"><div class="daw-track-heading">TRACKS <output class="daw-track-count">0</output></div><div class="daw-ruler" aria-label="Timeline ruler in seconds"></div></div><div class="daw-track-rows"></div><div class="daw-empty"><strong>Build your arrangement.</strong><p>Import multiple audio files into real tracks, or create the generated three-track session.</p><p>Move and trim clips. Mix with gain, pan, mute and solo. Your original files stay untouched.</p></div></div><aside class="daw-inspector" aria-label="Selected clip inspector"><h2>Region</h2><p class="daw-no-selection">Select a waveform region to edit its position and source range.</p><form class="daw-clip-form" hidden><p class="daw-clip-name"></p><label>Track<select name="trackId" aria-label="Region track"></select></label><label>Position · seconds<input name="start" type="number" step="any" min="0" required aria-label="Region timeline position"></label><label>Source in · seconds<input name="offset" type="number" step="any" min="0" required aria-label="Region source offset"></label><label>Length · seconds<input name="length" type="number" step="any" min="0.000020833333" required aria-label="Region length"></label><button type="submit">Apply region edit</button><div class="daw-edit-buttons"><button type="button" data-daw="split">Split at playhead</button><button type="button" data-daw="duplicate">Duplicate</button><button type="button" data-daw="delete">Delete region</button></div></form><p class="daw-edit-note">Edits are non-destructive and pause playback. Drag a region to move it; Shift-drag snaps to 0.1s. Undo/redo retains original media.</p></aside></div>
    <label class="daw-seek-label">Playhead<input class="daw-seek" type="range" min="0" max="1" value="0" step="1" aria-label="Seek arrangement"></label><p class="daw-status" role="status" aria-live="polite">Ready. Audio stays local.</p><p class="daw-limits">First multitrack slice: 16 tracks · 128 regions · 10-minute timeline · 64 MiB retained PCM. Project files include audio; explicit download/open, not autosave. Recording, plugins, buses, automation, Linked Sessions UI and AI execution are not connected yet. Destination names are provisional.</p>`
  workspace.querySelector(".environment-banner").after(section)
  const $ = selector => section.querySelector(selector), controls = Object.fromEntries([...section.querySelectorAll("[data-daw]")].map(el => [el.dataset.daw, el]))
  let rowEvents = new AbortController()
  let controller, state, selected = null, previousProject, previousSelection, pixelsPerSecond = 50, gesture = null, destination = "daw"
  function setDestination(value) {
    destination = value; workspace.dataset.editor = value; section.hidden = value !== "daw"
    for (const button of nav.querySelectorAll("button")) button.setAttribute("aria-pressed", String(button.dataset.destination === value))
    workspace.querySelector(".intro h1").textContent = value === "daw" ? "Arrangement" : "Audio shaping"
    workspace.querySelector(".intro > p:last-child").textContent = value === "daw" ? "Arrange, edit and mix real audio tracks. Nothing is uploaded." : "Analyze, compare and shape your audio. Original audio stays preserved."
    workspace.querySelector(".studio-footer > span").textContent = value === "daw" ? "MusicOnVerse / LOCAL ARRANGEMENT" : "MusicOnVerse / LOCAL AUDIO SHAPING"
    onDestination?.(value)
  }
  for (const button of nav.querySelectorAll("button")) on(button, "click", () => setDestination(button.dataset.destination))
  const element = (tag, className, text) => { const el = document.createElement(tag); el.className = className; if (text !== undefined) el.textContent = text; return el }
  function select(id) { selected = id; previousSelection = undefined; if (state) render(state) }
  function drawTracks(project) {
    rowEvents.abort(); rowEvents = new AbortController()
    const onRow = (el, type, callback) => el.addEventListener(type, callback, { signal: rowEvents.signal })
    const timelineWidth = Math.max(680, (durationFrames(project) / SAMPLE_RATE + 2) * pixelsPerSecond)
    section.style.setProperty("--daw-timeline-width", `${timelineWidth}px`)
    section.style.setProperty("--daw-grid-step", `${pixelsPerSecond}px`)
    const ruler = $(".daw-ruler"); ruler.replaceChildren()
    const interval = pixelsPerSecond < 30 ? 5 : pixelsPerSecond < 70 ? 2 : 1
    for (let s = 0; s <= timelineWidth / pixelsPerSecond; s += interval) {
      const tick = element("button", "daw-tick", `${s}s`); tick.type = "button"; tick.style.left = `${s * pixelsPerSecond}px`; tick.setAttribute("aria-label", `Seek arrangement to ${s} seconds`)
      onRow(tick, "click", () => controller.seek(Math.min(durationFrames(project), s * SAMPLE_RATE))); ruler.append(tick)
    }
    const rows = $(".daw-track-rows"); rows.replaceChildren()
    for (const [index, track] of project.tracks.entries()) {
      const row = element("div", "daw-track-row"); row.style.setProperty("--track-color", `var(--mvo-color-${["amber", "glacier", "violet", "ion-teal", "rose"][index % 5]})`)
      const header = element("div", "daw-track-header"), title = element("input", "daw-track-name")
      title.value = track.name; title.maxLength = 160; title.setAttribute("aria-label", `Track ${index + 1} name`); title.dataset.focus = `${track.id}-name`
      onRow(title, "change", () => controller.command({ type: "setTrack", trackId: track.id, patch: { name: title.value } })); header.append(title)
      const mix = element("div", "daw-track-switches")
      for (const [key, text] of [["muted", "M"], ["solo", "S"]]) {
        const button = element("button", "daw-track-switch", text); button.type = "button"; button.setAttribute("aria-label", `${key === "muted" ? "Mute" : "Solo"} ${track.name}`); button.setAttribute("aria-pressed", String(track[key])); button.dataset.focus = `${track.id}-${key}`
        onRow(button, "click", () => controller.command({ type: "setTrack", trackId: track.id, patch: { [key]: !track[key] } })); mix.append(button)
      }
      const remove = element("button", "daw-remove-track", "Remove"); remove.type = "button"; remove.setAttribute("aria-label", `Remove track ${track.name}`)
      onRow(remove, "click", () => controller.command({ type: "removeTrack", trackId: track.id })); mix.append(remove); header.append(mix)
      for (const [key, labelText, min, max, step] of [["gainDb", "Gain", -60, 12, .5], ["pan", "Pan", -1, 1, .05]]) {
        const label = element("label", "daw-track-parameter", labelText), output = element("output", "", `${track[key].toFixed(key === "pan" ? 2 : 1)}${key === "gainDb" ? " dB" : ""}`)
        const input = element("input", ""); input.type = "range"; Object.assign(input, { min, max, step, value: track[key] }); input.dataset.focus = `${track.id}-${key}`; input.setAttribute("aria-label", `${labelText} ${track.name}`)
        onRow(input, "input", () => { output.textContent = `${Number(input.value).toFixed(key === "pan" ? 2 : 1)}${key === "gainDb" ? " dB" : ""}` })
        onRow(input, "change", () => controller.command({ type: "setTrack", trackId: track.id, patch: { [key]: Number(input.value) } })); label.append(output, input); header.append(label)
      }
      const lane = element("div", "daw-lane"); lane.dataset.trackId = track.id
      const playhead = element("div", "daw-lane-playhead"); playhead.setAttribute("aria-hidden", "true"); lane.append(playhead)
      for (const clip of project.clips.filter(c => c.trackId === track.id)) {
        const asset = project.assets.find(a => a.id === clip.assetId), button = element("button", "daw-clip")
        button.type = "button"; button.dataset.clipId = clip.id; button.dataset.focus = clip.id; button.setAttribute("aria-pressed", String(selected === clip.id)); button.setAttribute("aria-label", `${asset.name}, position ${seconds(clip.startFrame)} seconds, length ${seconds(clip.durationFrames)} seconds`)
        button.style.left = `${clip.startFrame / SAMPLE_RATE * pixelsPerSecond}px`; button.style.width = `${Math.max(8, clip.durationFrames / SAMPLE_RATE * pixelsPerSecond)}px`
        const label = element("span", "daw-clip-label", asset.name), canvas = element("canvas", "daw-clip-waveform")
        canvas.width = Math.max(16, Math.min(1600, Math.round(clip.durationFrames / SAMPLE_RATE * pixelsPerSecond))); canvas.height = 48; canvas.setAttribute("aria-hidden", "true")
        const context = canvas.getContext("2d"), peaks = controller.getWaveform(clip.id, canvas.width)
        context.fillStyle = getComputedStyle(workspace).getPropertyValue(`--mvo-color-${["amber", "glacier", "violet", "ion-teal", "rose"][index % 5]}`).trim()
        for (let i = 0; i < peaks.length; i++) { const h = Math.max(1, Math.min(1, peaks[i]) * 43); context.fillRect(i, (48 - h) / 2, 1, h) }
        button.append(label, canvas); lane.append(button)
        onRow(button, "click", () => select(clip.id))
        onRow(button, "pointerdown", event => {
          if (event.button !== 0 || state.busy) return
          gesture = { id: event.pointerId, x: event.clientX, clip, button, moved: false }; button.setPointerCapture(event.pointerId)
        })
        onRow(button, "pointermove", event => {
          if (gesture?.button !== button || gesture.id !== event.pointerId) return
          const delta = event.clientX - gesture.x; if (Math.abs(delta) > 3) gesture.moved = true
          if (gesture.moved) button.style.transform = `translateX(${delta}px)`
        })
        onRow(button, "pointerup", event => {
          if (gesture?.button !== button) return
          const drag = gesture; gesture = null; button.style.transform = ""; if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId)
          selected = clip.id
          if (drag.moved) {
            const raw = Math.max(0, clip.startFrame + Math.round((event.clientX - drag.x) / pixelsPerSecond * SAMPLE_RATE)), snapped = event.shiftKey ? Math.round(raw / 4800) * 4800 : raw
            const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".daw-lane")
            controller.command({ type: "moveClip", clipId: clip.id, trackId: target?.dataset.trackId || clip.trackId, startFrame: snapped })
          } else select(clip.id)
        })
        onRow(button, "pointercancel", () => { gesture = null; button.style.transform = "" })
      }
      row.append(header, lane); rows.append(row)
    }
    $(".daw-empty").hidden = !!project.tracks.length; $(".daw-track-count").textContent = project.tracks.length
  }
  function render(snapshot) {
    state = snapshot
    const project = snapshot.project, clip = project.clips.find(c => c.id === selected)
    if (!clip) selected = null
    if (project !== previousProject || selected !== previousSelection) {
      const focus = document.activeElement?.dataset.focus
      drawTracks(project)
      $(".daw-project-name").value = project.name
      $(".daw-clip-form").hidden = !clip; $(".daw-no-selection").hidden = !!clip
      if (clip) {
        $(".daw-clip-name").textContent = project.assets.find(a => a.id === clip.assetId).name
        const trackSelect = $('[name="trackId"]'); trackSelect.replaceChildren(...project.tracks.map(track => new Option(track.name, track.id))); trackSelect.value = clip.trackId
        $('[name="start"]').value = seconds(clip.startFrame); $('[name="offset"]').value = seconds(clip.offsetFrames); $('[name="length"]').value = seconds(clip.durationFrames)
      }
      previousProject = project; previousSelection = selected
      if (focus) section.querySelector(`[data-focus="${focus}"]`)?.focus({ preventScroll: true })
    }
    const end = durationFrames(project)
    $(".daw-clock").textContent = `${clock(snapshot.positionFrames)} / ${clock(end)}`
    $(".daw-seek").max = end || 1; $(".daw-seek").value = snapshot.positionFrames; $(".daw-seek").disabled = snapshot.busy || !end
    for (const line of section.querySelectorAll(".daw-lane-playhead")) line.style.left = `${snapshot.positionFrames / SAMPLE_RATE * pixelsPerSecond}px`
    for (const [key, button] of Object.entries(controls)) button.disabled = snapshot.busy || (["export", "shape", "play", "stop"].includes(key) && !end) || (["split", "duplicate", "delete"].includes(key) && !clip)
    controls.undo.disabled = snapshot.busy || !snapshot.canUndo; controls.redo.disabled = snapshot.busy || !snapshot.canRedo
    controls.play.textContent = snapshot.playing ? "Ⅱ Pause" : "▶ Play"; controls.play.setAttribute("aria-label", snapshot.playing ? "Pause arrangement" : "Play arrangement")
    for (const el of section.querySelectorAll('.daw-track-header input,.daw-track-header button,.daw-clip-form input,.daw-clip-form select,.daw-clip-form button,.daw-project-name')) el.disabled = snapshot.busy
    $(".daw-status").textContent = snapshot.error || (snapshot.busy ? "Processing local audio…" : snapshot.fileStatus === "download-prepared" && !snapshot.dirty ? "Project download prepared. Confirm it completed in your browser; this is not autosave." : snapshot.dirty ? "Project has edits not included in the last prepared project download." : "Ready. Audio stays local. Explicit project-file download/open; no autosave.")
    workspace.dataset.dawState = project.tracks.length ? "ready" : "empty"
  }
  function bind(c) {
    controller = c
    const actions = { import: () => $(".daw-files").click(), open: () => $(".daw-project-file").click(), save: () => c.saveProject(), export: () => c.exportMix(), shape: () => c.mixToWorkbench(), demo: () => c.demo(), undo: () => c.undo(), redo: () => c.redo(), stop: () => c.stop(), play: () => state.playing ? c.pause() : c.play(),
      split: () => c.command({ type: "splitClip", clipId: selected, frame: state.positionFrames }), duplicate: () => c.command({ type: "duplicateClip", clipId: selected }), delete: () => c.command({ type: "removeClip", clipId: selected }) }
    for (const [key, button] of Object.entries(controls)) on(button, "click", () => void actions[key]())
    on($(".daw-files"), "change", () => { const files = [...$(".daw-files").files]; $(".daw-files").value = ""; void c.importFiles(files) })
    on($(".daw-project-file"), "change", () => {
      const file = $(".daw-project-file").files[0]; $(".daw-project-file").value = ""
      if (file && (!state.dirty || confirm("Replace this arrangement with the opened project? Download your current project first to retain it."))) void c.openProject(file)
    })
    on($(".daw-project-name"), "change", event => c.command({ type: "setProjectName", name: event.target.value }))
    on($(".daw-clip-form"), "submit", event => {
      event.preventDefault(); c.command({ type: "editClip", clipId: selected, trackId: $('[name="trackId"]').value,
        startFrame: Math.round(Number($('[name="start"]').value) * SAMPLE_RATE), offsetFrames: Math.round(Number($('[name="offset"]').value) * SAMPLE_RATE), durationFrames: Math.round(Number($('[name="length"]').value) * SAMPLE_RATE) })
    })
    on($(".daw-seek"), "input", event => c.seek(Number(event.target.value)))
    on($(".daw-zoom"), "input", event => { pixelsPerSecond = Number(event.target.value); previousProject = undefined; render(state) })
    on(section, "dragover", event => { event.preventDefault(); event.stopPropagation() })
    on(section, "drop", event => { event.preventDefault(); event.stopPropagation(); void c.importFiles(event.dataTransfer.files) })
    on(window, "keydown", event => {
      if (event.target.closest?.(".sylune-panel")) return
      if (workspace.dataset.editor !== "daw" || event.defaultPrevented || event.target.closest("input,select,textarea,button,[contenteditable=true],summary,a") || document.querySelector("dialog[open]")) return
      if (event.code === "Space") { event.preventDefault(); void (state.playing ? c.pause() : c.play()) }
      if ((event.ctrlKey || event.metaKey) && ["KeyZ", "KeyY", "KeyS"].includes(event.code)) {
        event.preventDefault(); if (event.code === "KeyS") void c.saveProject(); else if (event.code === "KeyY" || event.shiftKey) c.redo(); else c.undo()
      }
    })
    setDestination("daw"); render(c.getSnapshot())
  }
  return Object.freeze({ bind, render, setDestination, dispose() { abort.abort(); rowEvents.abort(); gesture = null; section.remove(); nav.remove() } })
}
