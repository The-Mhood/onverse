// Pure, bounded frame-based DAW aggregate. No PCM, browser, clock, filesystem or UI.
export const SAMPLE_RATE = 48000
export const LIMITS = Object.freeze({ tracks: 16, clips: 128, assets: 64, assetFrames: SAMPLE_RATE * 180,
  timelineFrames: SAMPLE_RATE * 600, pcmBytes: 64 * 1024 * 1024, history: 50 })
export const fail = code => Object.assign(new Error(code), { code })
const requireValue = (test, code = "INVALID_PROJECT") => { if (!test) throw fail(code) }
export const isId = value => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value)
export function record(value, keys) {
  requireValue(value && Object.getPrototypeOf(value) === Object.prototype)
  const descriptors = Object.getOwnPropertyDescriptors(value)
  requireValue(Reflect.ownKeys(descriptors).length === keys.length && keys.every(key => {
    const d = descriptors[key]; return d && Object.hasOwn(d, "value") && d.enumerable
  }))
}
const integer = (n, low, high) => Number.isSafeInteger(n) && n >= low && n <= high
const name = value => typeof value === "string" && value.trim().length > 0 && value.length <= 160
export function freeze(value) {
  if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value) }
  return value
}
export function validateProject(project) {
  record(project, ["schemaVersion", "id", "name", "sampleRate", "tracks", "clips", "assets"])
  requireValue(project.schemaVersion === 1 && isId(project.id) && name(project.name) && project.sampleRate === SAMPLE_RATE)
  requireValue(Array.isArray(project.tracks) && project.tracks.length <= LIMITS.tracks, "TRACK_LIMIT")
  requireValue(Array.isArray(project.clips) && project.clips.length <= LIMITS.clips, "CLIP_LIMIT")
  requireValue(Array.isArray(project.assets) && project.assets.length <= LIMITS.assets, "ASSET_LIMIT")
  const ids = new Set(), tracks = new Set(), assets = new Map()
  function unique(id) { requireValue(isId(id) && !ids.has(id), "DUPLICATE_OR_INVALID_ID"); ids.add(id) }
  unique(project.id)
  let bytes = 0
  for (const asset of project.assets) {
    record(asset, ["id", "name", "sampleRate", "frames", "channels"]); unique(asset.id)
    requireValue(name(asset.name) && asset.sampleRate === SAMPLE_RATE && integer(asset.frames, 1, LIMITS.assetFrames) && integer(asset.channels, 1, 2), "INVALID_ASSET")
    bytes += asset.frames * asset.channels * 4; assets.set(asset.id, asset)
  }
  requireValue(bytes <= LIMITS.pcmBytes, "MEDIA_BUDGET")
  for (const track of project.tracks) {
    record(track, ["id", "name", "gainDb", "pan", "muted", "solo"]); unique(track.id)
    requireValue(name(track.name) && Number.isFinite(track.gainDb) && track.gainDb >= -60 && track.gainDb <= 12 &&
      Number.isFinite(track.pan) && track.pan >= -1 && track.pan <= 1 && typeof track.muted === "boolean" && typeof track.solo === "boolean", "INVALID_TRACK")
    tracks.add(track.id)
  }
  for (const clip of project.clips) {
    record(clip, ["id", "trackId", "assetId", "startFrame", "offsetFrames", "durationFrames"]); unique(clip.id)
    const asset = assets.get(clip.assetId)
    requireValue(tracks.has(clip.trackId) && asset && integer(clip.startFrame, 0, LIMITS.timelineFrames - 1) &&
      integer(clip.offsetFrames, 0, asset.frames - 1) && integer(clip.durationFrames, 1, asset.frames) &&
      clip.offsetFrames + clip.durationFrames <= asset.frames && clip.startFrame + clip.durationFrames <= LIMITS.timelineFrames, "INVALID_CLIP")
  }
  return project
}
export function createProject(id) {
  return freeze(validateProject({ schemaVersion: 1, id, name: "Untitled session", sampleRate: SAMPLE_RATE, tracks: [], clips: [], assets: [] }))
}
export const durationFrames = project => Math.max(0, ...project.clips.map(clip => clip.startFrame + clip.durationFrames))
export const audibleTracks = project => project.tracks.filter(track => !track.muted && (!project.tracks.some(t => t.solo) || track.solo))
export function applyCommand(project, command) {
  validateProject(project)
  requireValue(command && typeof command.type === "string", "INVALID_COMMAND")
  const next = structuredClone(project)
  const clip = id => { const value = next.clips.find(c => c.id === id); requireValue(value, "CLIP_NOT_FOUND"); return value }
  const track = id => { const value = next.tracks.find(t => t.id === id); requireValue(value, "TRACK_NOT_FOUND"); return value }
  switch (command.type) {
    case "addTracks":
      record(command, ["type", "tracks", "clips", "assets"])
      requireValue(Array.isArray(command.tracks) && Array.isArray(command.clips) && Array.isArray(command.assets), "INVALID_COMMAND")
      next.tracks.push(...structuredClone(command.tracks)); next.clips.push(...structuredClone(command.clips)); next.assets.push(...structuredClone(command.assets)); break
    case "moveClip": {
      record(command, ["type", "clipId", "trackId", "startFrame"])
      const c = clip(command.clipId); track(command.trackId); c.trackId = command.trackId; c.startFrame = command.startFrame; break
    }
    case "editClip": {
      record(command, ["type", "clipId", "trackId", "startFrame", "offsetFrames", "durationFrames"])
      const c = clip(command.clipId); track(command.trackId)
      Object.assign(c, { trackId: command.trackId, startFrame: command.startFrame, offsetFrames: command.offsetFrames, durationFrames: command.durationFrames }); break
    }
    case "trimClip": {
      record(command, ["type", "clipId", "offsetFrames", "durationFrames"])
      Object.assign(clip(command.clipId), { offsetFrames: command.offsetFrames, durationFrames: command.durationFrames }); break
    }
    case "splitClip": {
      record(command, ["type", "clipId", "frame", "newId"])
      const c = clip(command.clipId), length = command.frame - c.startFrame
      requireValue(Number.isSafeInteger(length) && length > 0 && length < c.durationFrames, "SPLIT_OUTSIDE_CLIP")
      next.clips.push({ ...c, id: command.newId, startFrame: command.frame, offsetFrames: c.offsetFrames + length, durationFrames: c.durationFrames - length })
      c.durationFrames = length; break
    }
    case "duplicateClip": {
      record(command, ["type", "clipId", "newId"])
      const c = clip(command.clipId); next.clips.push({ ...c, id: command.newId, startFrame: c.startFrame + c.durationFrames }); break
    }
    case "removeClip":
      record(command, ["type", "clipId"]); clip(command.clipId); next.clips = next.clips.filter(c => c.id !== command.clipId); break
    case "removeTrack":
      record(command, ["type", "trackId"]); track(command.trackId)
      next.tracks = next.tracks.filter(t => t.id !== command.trackId); next.clips = next.clips.filter(c => c.trackId !== command.trackId); break
    case "setTrack": {
      record(command, ["type", "trackId", "patch"])
      requireValue(command.patch && Object.getPrototypeOf(command.patch) === Object.prototype, "INVALID_COMMAND")
      const keys = Reflect.ownKeys(command.patch); record(command.patch, keys)
      requireValue(keys.length > 0 && keys.every(key => ["name", "gainDb", "pan", "muted", "solo"].includes(key)), "INVALID_COMMAND")
      Object.assign(track(command.trackId), command.patch); break
    }
    case "setProjectName": record(command, ["type", "name"]); next.name = command.name; break
    default: throw fail("UNSUPPORTED_COMMAND")
  }
  return freeze(validateProject(next))
}
