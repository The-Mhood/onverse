import { LEGACY_PROFILE, getRenderProfile } from '../../domain/linkedSessions/renderProfiles.js';
// Bounded 48 kHz L/R integration profile. Canonical interleaved Float32 LE;
// over-range samples and signed zero are preserved, never normalized/clipped.
export function decodePCM(bytes, frames, profile = LEGACY_PROFILE) {
  const p=getRenderProfile(profile);
  if (!(bytes instanceof Uint8Array) || !Number.isSafeInteger(frames) || frames < 1 || frames > p.maxFrames || bytes.length !== frames * 8) throw Error('Invalid PCM dimensions');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const channels = [new Float32Array(frames), new Float32Array(frames)];
  for (let n = 0; n < frames; n++) for (let c = 0; c < 2; c++) {
    const x = view.getFloat32((n * 2 + c) * 4, true);
    if (!Number.isFinite(x)) throw Error('Nonfinite PCM');
    channels[c][n] = x;
  }
  return channels;
}
export function encodePCM(channels, profile = LEGACY_PROFILE) {
  const p=getRenderProfile(profile);
  if (!Array.isArray(channels) || channels.length !== 2 || !channels.every(c => c instanceof Float32Array) || channels[0].length !== channels[1].length) throw Error('Invalid PCM channels');
  const frames = channels[0].length;
  if (frames < 1 || frames > p.maxFrames) throw Error('Invalid PCM dimensions');
  const bytes = new Uint8Array(frames * 8), view = new DataView(bytes.buffer);
  for (let n = 0; n < frames; n++) for (let c = 0; c < 2; c++) {
    const x = channels[c][n];
    if (!Number.isFinite(x)) throw Error('Nonfinite PCM');
    view.setFloat32((n * 2 + c) * 4, x, true);
  }
  return bytes;
}
export async function hashPCM(bytes, digest = data => globalThis.crypto.subtle.digest('SHA-256', data)) {
  if (!(bytes instanceof Uint8Array)) throw Error('Invalid PCM bytes');
  // Copy before the first await so caller mutation cannot change hashed content.
  const hash = await digest(new Uint8Array(bytes));
  if (!(hash instanceof ArrayBuffer) || hash.byteLength !== 32) throw Error('Invalid SHA-256 digest');
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}
