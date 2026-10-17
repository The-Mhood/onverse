import { SAMPLE_RATE, LIMITS, createProject, applyCommand, durationFrames, fail } from "../../domain/daw/project.js"
import { createDawAudio, scheduleProject, validateBuffer, encodeMixWav } from "../../audio/daw/engine.js"
import { serializeProject, deserializeProject, MAX_PROJECT_FILE_BYTES } from "./projectFile.js"

// The sole live DAW authority. Views hold selection/zoom, not project/PCM copies.
// Existing linked-session experiments are not mounted as a duplicate repository.
export function createDawController({ audio, platform = globalThis, onChange = () => {}, beforePlay = () => {}, onMix = null, engine = createDawAudio({ audio, platform }) }) {
  const id = () => platform.crypto.randomUUID()
  let project = createProject(id()), assets = new Map(), past = [], future = [], context = null, graph = null
  let positionFrames = 0, playing = false, busy = false, error = null, disposed = false, epoch = 0, frame = 0, clockStart = 0, startPosition = 0, disposal, playEpoch = 0
  let fileStatus = "new-session", preparedFingerprint = JSON.stringify(project)
  const waveCache = new Map()
  const fingerprints = new WeakMap()
  const fingerprint = (value = project) => { if (!fingerprints.has(value)) fingerprints.set(value, JSON.stringify(value)); return fingerprints.get(value) }
  const getSnapshot = () => Object.freeze({ project, positionFrames, playing, busy, error, canUndo: past.length > 0, canRedo: future.length > 0,
    dirty: fingerprint() !== preparedFingerprint, fileStatus })
  const publish = () => { if (!disposed) onChange(getSnapshot()) }
  const requireReady = () => { if (disposed) throw fail("DAW_DISPOSED"); if (busy) throw fail("OPERATION_IN_PROGRESS") }
  const position = () => playing ? Math.max(startPosition, Math.min(durationFrames(project), startPosition + Math.floor((context.currentTime - clockStart) * SAMPLE_RATE))) : positionFrames
  function pause() {
    ++playEpoch
    positionFrames = position(); playing = false
    platform.cancelAnimationFrame(frame); frame = 0; graph?.stop(); graph = null; publish()
  }
  function replace(next) {
    if (fingerprint(next) === fingerprint()) return
    pause(); past.push(project); if (past.length > LIMITS.history) past.shift()
    future = []; project = next; positionFrames = Math.min(positionFrames, durationFrames(project)); waveCache.clear(); error = null; publish()
  }
  function command(input) {
    try {
      requireReady()
      if (input?.type === "addTracks") throw fail("PRIVATE_IMPORT_OPERATION")
      // Only application generates new IDs; no display-name rebinding.
      const command = ["duplicateClip", "splitClip"].includes(input?.type) ? { ...input, newId: id() } : input
      replace(applyCommand(project, command)); return true
    } catch (e) { error = e.code || e.message; publish(); return false }
  }
  async function operation(task) {
    if (disposed || busy) return false
    busy = true; error = null; const token = ++epoch; publish()
    const current = () => !disposed && token === epoch
    try { await task(current); return current() }
    catch (e) { if (current()) { error = e.code || e.message; publish() } return false }
    finally { if (current()) { busy = false; publish() } }
  }
  function importBuffers(items) {
    const tracks = [], clips = [], metadata = [], pending = new Map()
    let retainedBytes = [...assets.values()].reduce((sum, b) => sum + b.length * b.numberOfChannels * 4, 0)
    for (const { name, buffer } of items) {
      validateBuffer(buffer); retainedBytes += buffer.length * buffer.numberOfChannels * 4
      if (retainedBytes > LIMITS.pcmBytes) throw fail("RETAINED_MEDIA_BUDGET")
      const assetId = id(), trackId = id()
      metadata.push({ id: assetId, name: String(name).slice(0, 160) || "Audio", sampleRate: SAMPLE_RATE, frames: buffer.length, channels: buffer.numberOfChannels })
      tracks.push({ id: trackId, name: String(name).slice(0, 160) || "Audio", gainDb: 0, pan: 0, muted: false, solo: false })
      clips.push({ id: id(), trackId, assetId, startFrame: 0, offsetFrames: 0, durationFrames: buffer.length }); pending.set(assetId, buffer)
    }
    const next = applyCommand(project, { type: "addTracks", tracks, clips, assets: metadata })
    // Publish only after ALL files/metadata pass; prior project survives any failure.
    for (const [key, value] of pending) assets.set(key, value)
    replace(next)
  }
  async function importFiles(files) {
    const batch = Array.from(files || [])
    return operation(async current => {
      if (!batch.length || batch.length + project.tracks.length > LIMITS.tracks) throw fail("TRACK_LIMIT")
      let decodedBytes = [...assets.values()].reduce((sum, b) => sum + b.length * b.numberOfChannels * 4, 0)
      const decoded = []
      for (const file of batch) {
        if (file.size > MAX_PROJECT_FILE_BYTES) throw fail("AUDIO_FILE_LIMIT")
        const buffer = validateBuffer(await engine.decode(file)); if (!current()) return
        decodedBytes += buffer.length * buffer.numberOfChannels * 4
        if (decodedBytes > LIMITS.pcmBytes) throw fail("RETAINED_MEDIA_BUDGET")
        decoded.push({ name: file.name, buffer })
      }
      if (current()) importBuffers(decoded)
    })
  }
  async function demo() {
    return operation(async current => {
      const items = [["Pulse", 110, .2], ["Bass", 55, .16], ["Atmosphere", 330, .08]].map(([name, frequency, level], i) => {
        const buffer = new platform.AudioBuffer({ length: SAMPLE_RATE * 8, numberOfChannels: 2, sampleRate: SAMPLE_RATE })
        for (let c = 0; c < 2; c++) {
          const data = buffer.getChannelData(c)
          for (let n = 0; n < data.length; n++) {
            const t = n / SAMPLE_RATE, envelope = i === 0 ? Math.exp(-((t * 2) % 1) * 13) : Math.min(1, t / .03) * Math.min(1, (8 - t) / .1)
            data[n] = level * envelope * Math.sin(2 * Math.PI * frequency * t + (i === 2 ? c * .4 : 0))
          }
        }
        return { name, buffer }
      })
      if (current()) importBuffers(items)
    })
  }
  async function play() {
    try {
      requireReady(); if (!project.clips.length) throw fail("EMPTY_ARRANGEMENT")
      beforePlay(); pause()
      const transportEpoch = ++playEpoch
      if (!context) context = new platform.AudioContext({ sampleRate: SAMPLE_RATE })
      if (context.state === "suspended") await context.resume()
      if (disposed || transportEpoch !== playEpoch) return false
      if (positionFrames >= durationFrames(project)) positionFrames = 0
      clockStart = context.currentTime + .025; startPosition = positionFrames
      graph = scheduleProject(context, project, assets, positionFrames, clockStart); playing = true; error = null
      const tick = () => {
        if (!playing || disposed) return
        positionFrames = Math.max(startPosition, position())
        if (positionFrames >= durationFrames(project)) { pause(); return }
        publish(); frame = platform.requestAnimationFrame(tick)
      }
      tick(); return true
    } catch (e) { pause(); error = e.code || e.message; publish(); return false }
  }
  function seek(target) {
    if (disposed || busy) return false
    if (!Number.isSafeInteger(target) || target < 0 || target > durationFrames(project)) return false
    const resume = playing; pause(); positionFrames = target; publish(); if (resume) void play(); return true
  }
  function moveHistory(from, to) {
    try {
      requireReady(); if (!from.length) return false
      pause(); to.push(project); project = from.pop(); positionFrames = Math.min(positionFrames, durationFrames(project)); waveCache.clear(); error = null; publish(); return true
    } catch (e) { error = e.code || e.message; publish(); return false }
  }
  const slug = () => project.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "session"
  function renderAndDeliver(deliver) {
    return operation(async current => {
      pause(); const rendered = await engine.render(project, assets)
      if (!current()) return
      const result = encodeMixWav(rendered); await deliver(result, current)
    })
  }
  return Object.freeze({ getSnapshot, command, importFiles, demo, play, pause,
    stop() { pause(); positionFrames = 0; publish() }, seek,
    undo: () => moveHistory(past, future), redo: () => moveHistory(future, past),
    exportMix: () => renderAndDeliver(async ({ blob, peak }) => {
      audio.saveBlob(blob, `${slug()}-mix.wav`)
      if (peak > 1) error = "Mix exceeds0dBFS: float WAV preserves headroom; reduce track gains or master the mix."
    }),
    mixToWorkbench: () => renderAndDeliver(async ({ blob }, current) => { if (!onMix) throw fail("WORKBENCH_BRIDGE_UNAVAILABLE"); if (current()) await onMix(blob, `${slug()}-mix.wav`) }),
    saveProject: () => operation(async current => {
      const text = await serializeProject(project, assets, platform)
      if (!current()) return
      audio.saveBlob(new Blob([text], { type: "application/json" }), `${slug()}.movproject.json`)
      preparedFingerprint = fingerprint(); fileStatus = "download-prepared" // NOT a verified filesystem save receipt.
    }),
    openProject: file => operation(async current => {
      if (!file || file.size > MAX_PROJECT_FILE_BYTES) throw fail("PROJECT_FILE_LIMIT")
      const loaded = await deserializeProject(await file.text(), platform)
      if (!current()) return
      pause(); project = loaded.project; assets = loaded.assets; past = []; future = []; waveCache.clear(); positionFrames = 0
      preparedFingerprint = fingerprint(); fileStatus = "opened-file"
    }),
    getWaveform(clipId, width = 240) {
      if (disposed) return new Float32Array()
      const clip = project.clips.find(c => c.id === clipId), buffer = clip && assets.get(clip.assetId)
      if (!buffer || !Number.isSafeInteger(width) || width < 1 || width > 2048) return new Float32Array()
      const key = `${clip.assetId}:${clip.offsetFrames}:${clip.durationFrames}:${width}`
      if (!waveCache.has(key)) {
        const peaks = new Float32Array(width)
        for (let i = 0; i < width; i++) {
          const start = clip.offsetFrames + Math.floor(i * clip.durationFrames / width)
          const end = clip.offsetFrames + Math.min(clip.durationFrames, Math.max(Math.floor((i + 1) * clip.durationFrames / width), Math.floor(i * clip.durationFrames / width) + 1))
          for (let c = 0; c < buffer.numberOfChannels; c++) for (let n = start; n < end; n++) peaks[i] = Math.max(peaks[i], Math.abs(buffer.getChannelData(c)[n]))
        }
        if (waveCache.size > 256) waveCache.clear(); waveCache.set(key, peaks)
      }
      return new Float32Array(waveCache.get(key)) // Caller cannot mutate cached waveform/audio.
    },
    dispose() {
      if (!disposal) {
        disposed = true; ++epoch; busy = false; pause(); const closing = context; context = null
        assets.clear(); waveCache.clear(); past = []; future = []
        disposal = Promise.resolve().then(() => closing?.close())
      }
      return disposal
    },
  })
}
