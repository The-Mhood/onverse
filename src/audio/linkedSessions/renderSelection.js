import { LEGACY_PROFILE, getRenderProfile, selectionFrames } from '../../domain/linkedSessions/renderProfiles.js';
import { createSnapshot, createSelection, projectDependencies } from '../../domain/linkedSessions/linkedSessionContract.js';
import { decodePCM, encodePCM, hashPCM } from './pcm.js';

// loadAsset(assetId) is a trusted core port returning canonical PCM bytes, not a
// filename/URL supplied by a plan. Native context injection supports host bridges;
// a missing native engine fails closed, with no summing/polyfill fallback.
export async function renderSelection({ snapshot, selection, loadAsset, digest, renderProfile = LEGACY_PROFILE,
  createOfflineContext = (channels, frames, rate) => new globalThis.OfflineAudioContext(channels, frames, rate) }) {
  const p=getRenderProfile(renderProfile),source = createSnapshot(snapshot,renderProfile), chosen = createSelection(selection,renderProfile),frames=selectionFrames(chosen,renderProfile);
  const dependencies = projectDependencies(source, chosen,renderProfile);
  if (typeof loadAsset !== 'function' || typeof createOfflineContext !== 'function') throw Error('Missing render ports');
  const media = [];
  // Validate ALL selected assets, including muted members, before any graph is built.
  for (const track of dependencies.members) {
    const loaded = await loadAsset(track.assetId);
    if (!(loaded instanceof Uint8Array) || loaded.byteLength!==track.frames*8) throw Error('Invalid asset bytes');
    const bytes = new Uint8Array(loaded);
    const channels = decodePCM(bytes, track.frames,renderProfile);
    if (await hashPCM(bytes, digest) !== track.sha256) throw Error('Asset checksum mismatch');
    media.push({ track, channels });
  }
  const context = createOfflineContext(2, frames, 48000);
  const nodes = [];
  let primaryError;
  try {
    for (const { track, channels } of media) {
      const buffer = context.createBuffer(2, track.frames, 48000);
      for (let c = 0; c < 2; c++) buffer.copyToChannel(channels[c], c);
      const node = context.createBufferSource();
      nodes.push(node);
      const gain = context.createGain();
      nodes.push(gain);
      node.buffer = buffer;
      gain.gain.value = track.muted ? 0 : track.gain;
      node.connect(gain); gain.connect(context.destination);
      if(p.fixedFrames!==null)node.start(track.startFrame / 48000);
      else {
        const offset=Math.max(0,chosen.rangeStartFrame-track.startFrame),when=Math.max(0,track.startFrame-chosen.rangeStartFrame);
        const duration=Math.min(track.frames-offset,frames-when);
        if(duration>0)node.start(when/48000,offset/48000,duration/48000);
      }
    }
    const output = await context.startRendering();
    if (output.length !== frames || output.sampleRate !== 48000 || output.numberOfChannels !== 2) throw Error('Native render geometry mismatch');
    const bytes = encodePCM([output.getChannelData(0), output.getChannelData(1)],renderProfile);
    return { sampleRate: 48000, layout: ['L', 'R'], frames, bytes, sha256: await hashPCM(bytes, digest) };
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanupErrors = [];
    for (const node of nodes) {
      try { node.disconnect(); } catch (error) { cleanupErrors.push(error); }
    }
    if (cleanupErrors.length) throw new AggregateError(
      [...(primaryError ? [primaryError] : []), ...cleanupErrors],
      'Render node cleanup failed');
  }
}
