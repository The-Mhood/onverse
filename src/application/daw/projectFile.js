// Explicit self-contained project download/open. No DB, autosave, native paths,
// imports, executable code or network. Never confuse a download with a save receipt.
import { SAMPLE_RATE, LIMITS, validateProject, record, freeze, fail } from "../../domain/daw/project.js"
import { validateBuffer } from "../../audio/daw/engine.js"
export const MAX_PROJECT_FILE_BYTES = 100 * 1024 * 1024
const hash = async (bytes, platform) => [...new Uint8Array(await platform.crypto.subtle.digest("SHA-256", bytes))].map(n => n.toString(16).padStart(2, "0")).join("")
function base64(bytes, platform) {
  let text = ""
  for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768))
  return platform.btoa(text)
}
function pcmBytes(buffer) {
  const bytes = new Uint8Array(buffer.length * buffer.numberOfChannels * 4), view = new DataView(bytes.buffer)
  for (let c = 0; c < buffer.numberOfChannels; c++) for (let n = 0; n < buffer.length; n++)
    view.setFloat32((n * buffer.numberOfChannels + c) * 4, buffer.getChannelData(c)[n], true)
  return bytes
}
export async function serializeProject(project, assets, platform = globalThis) {
  validateProject(project)
  const media = []
  for (const meta of project.assets) {
    const buffer = validateBuffer(assets.get(meta.id))
    if (buffer.length !== meta.frames || buffer.numberOfChannels !== meta.channels) throw fail("ASSET_UNAVAILABLE")
    const bytes = pcmBytes(buffer)
    media.push({ assetId: meta.id, encoding: "f32le-interleaved", sha256: await hash(bytes, platform), data: base64(bytes, platform) })
  }
  return JSON.stringify({ format: "musiconverse-project", version: 1, project, media })
}
export async function deserializeProject(text, platform = globalThis) {
  if (typeof text !== "string" || text.length > MAX_PROJECT_FILE_BYTES || new TextEncoder().encode(text).byteLength > MAX_PROJECT_FILE_BYTES) throw fail("PROJECT_FILE_LIMIT")
  const doc = JSON.parse(text)
  record(doc, ["format", "version", "project", "media"])
  if (doc.format !== "musiconverse-project" || doc.version !== 1) throw fail("UNSUPPORTED_PROJECT_FORMAT")
  const project = validateProject(doc.project)
  if (!Array.isArray(doc.media) || doc.media.length !== project.assets.length || doc.media.length > LIMITS.assets) throw fail("INVALID_MEDIA_TABLE")
  const assets = new Map()
  for (const entry of doc.media) {
    record(entry, ["assetId", "encoding", "sha256", "data"])
    const meta = project.assets.find(a => a.id === entry.assetId), bytesExpected = meta && meta.frames * meta.channels * 4
    if (!meta || assets.has(meta.id) || entry.encoding !== "f32le-interleaved" || !/^[a-f0-9]{64}$/.test(entry.sha256) || typeof entry.data !== "string" ||
      entry.data.length !== Math.ceil(bytesExpected / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(entry.data)) throw fail("INVALID_MEDIA_TABLE")
    const binary = platform.atob(entry.data)
    if (binary.length !== bytesExpected) throw fail("INVALID_PCM_LENGTH")
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
    if (await hash(bytes, platform) !== entry.sha256) throw fail("MEDIA_CHECKSUM")
    const view = new DataView(bytes.buffer), buffer = new platform.AudioBuffer({ length: meta.frames, numberOfChannels: meta.channels, sampleRate: SAMPLE_RATE })
    for (let c = 0; c < meta.channels; c++) for (let n = 0; n < meta.frames; n++) buffer.getChannelData(c)[n] = view.getFloat32((n * meta.channels + c) * 4, true)
    assets.set(meta.id, validateBuffer(buffer))
  }
  return { project: freeze(project), assets }
}
