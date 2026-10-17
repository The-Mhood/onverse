// Trusted generated media only; shared by Node repository tests/native driver.
import { createHash } from 'node:crypto';
import { encodePCM } from '../../src/audio/linkedSessions/pcm.js';
import { recipe, sourceChannels } from '../../scripts/validation/offline-render-fixtures.mjs';
export function storeFixture(parent, onBoundary) {
  const r = recipe(), assets = [], tracks = [];
  for (const s of r.sources) {
    const bytes = encodePCM(sourceChannels(s)), sha256 = createHash('sha256').update(bytes).digest('hex'), assetId = s.id + '-pcm';
    assets.push({ assetId, frames: s.frames, bytes });
    tracks.push({ trackId: s.id, audioRevisionId: s.id + '-r1', label: s.id, assetId, sha256,
      frames: s.frames, startFrame: s.start, gain: s.gain, muted: false });
  }
  const other = [0,1].map(c => Float32Array.from({ length:4096 }, (_,n) => (c===0?.125:.0625)*Math.sin(2*Math.PI*(c===0?1500:750)*n/48000)));
  assets.push({ assetId: 'destination-vocal', frames: 4096, bytes: encodePCM(other) });
  return { parent, onBoundary, source: {
    snapshot: { schemaVersion:1, sessionId:'source-a', revisionId:'source-r1', sampleRate:48000, layout:['L','R'], tracks },
    selection: { groupId:'drums', definitionRevisionId:'def-r1', trackIds:r.selected, rangeStartFrame:0, rangeEndFrame:4096 }
  }, destination: { targetId:'linked', unrelatedAssetId:'destination-vocal',
    processing: { startFrame:256, gain:.5, eq:{ type:'peaking', frequency:1500, Q:1, gainDb:3 } } }, assets };
}
