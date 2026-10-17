// Bounded integration profile, not a product-wide session schema.
// Pure metadata only: no audio arrays, filesystem, crypto, clocks, UI or mutation.
import { LEGACY_PROFILE, getRenderProfile, selectionFrames } from './renderProfiles.js';
export const PROFILE = LEGACY_PROFILE;
export const ENGINE = 'native-offline-gain-sum-v1';

const idPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

function record(value, keys, label) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype ||
      Object.keys(value).length !== keys.length ||
      !keys.every(key => Object.hasOwn(value, key))) throw Error(`Invalid ${label} fields`);
}
function id(value) {
  if (typeof value !== 'string' || !idPattern.test(value)) throw Error('Invalid stable ID');
  return value;
}
function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw Error(`Invalid ${label}`);
  return value;
}
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const member of Object.values(value)) freeze(member);
    Object.freeze(value);
  }
  return value;
}
function track(value, profile) {
  const p=getRenderProfile(profile);
  record(value, ['trackId', 'audioRevisionId', 'label', 'assetId', 'sha256', 'frames', 'startFrame', 'gain', 'muted'], 'track');
  id(value.trackId); id(value.audioRevisionId); id(value.assetId);
  if (typeof value.label !== 'string' || value.label.length > 256) throw Error('Invalid track label');
  if (typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)) throw Error('Invalid asset checksum');
  integer(value.frames, 1, p.maxFrames, 'media frames');
  integer(value.startFrame, 0, p.maxTimelineFrames - 1, 'track start');
  if (value.startFrame + value.frames > p.maxTimelineFrames) throw Error('Track exceeds fixed render range');
  if (!Number.isFinite(value.gain) || Math.abs(value.gain) > 4) throw Error('Invalid bounded gain');
  if (typeof value.muted !== 'boolean') throw Error('Invalid mute');
  return { trackId: value.trackId, audioRevisionId: value.audioRevisionId, label: value.label,
    assetId: value.assetId, sha256: value.sha256, frames: value.frames,
    startFrame: value.startFrame, gain: value.gain, muted: value.muted };
}
export function createSnapshot(value, profile = PROFILE) {
  const p=getRenderProfile(profile);
  record(value, ['schemaVersion', 'sessionId', 'revisionId', 'sampleRate', 'layout', 'tracks'], 'snapshot');
  if (value.schemaVersion !== 1 || value.sampleRate !== 48000 || !Array.isArray(value.layout) ||
      value.layout.length !== 2 || value.layout[0] !== 'L' || value.layout[1] !== 'R') throw Error('Unsupported snapshot profile');
  id(value.sessionId); id(value.revisionId);
  if (!Array.isArray(value.tracks) || value.tracks.length < 1 || value.tracks.length > 16) throw Error('Invalid track inventory');
  const tracks = Array.from(value.tracks, value=>track(value,profile));
  if (tracks.reduce((n,t)=>n+t.frames*8,0)>p.maxAssetBytes) throw Error('Source media budget exceeded');
  if (new Set(tracks.map(t => t.trackId)).size !== tracks.length) throw Error('Duplicate track ID');
  return freeze({ schemaVersion: 1, sessionId: value.sessionId, revisionId: value.revisionId,
    sampleRate: 48000, layout: ['L', 'R'], tracks });
}
export function createSelection(value, profile = PROFILE) {
  record(value, ['groupId', 'definitionRevisionId', 'trackIds', 'rangeStartFrame', 'rangeEndFrame'], 'selection');
  id(value.groupId); id(value.definitionRevisionId);
  if (!Array.isArray(value.trackIds) || value.trackIds.length < 1 || value.trackIds.length > 8) throw Error('Invalid selected-track inventory');
  const trackIds = Array.from(value.trackIds, id);
  if (new Set(trackIds).size !== trackIds.length) throw Error('Duplicate selected track');
  selectionFrames(value,profile);
  return freeze({ groupId: value.groupId, definitionRevisionId: value.definitionRevisionId,
    trackIds, rangeStartFrame: value.rangeStartFrame, rangeEndFrame: value.rangeEndFrame });
}
export function projectDependencies(snapshotInput, selectionInput, profile = PROFILE) {
  const p=getRenderProfile(profile),snapshot = createSnapshot(snapshotInput,profile), selection = createSelection(selectionInput,profile);
  const byId = new Map(snapshot.tracks.map(t => [t.trackId, t]));
  const members = selection.trackIds.map(trackId => {
    const member = byId.get(trackId);
    if (!member) {
      const error = Error(`Missing selected track: ${trackId}`);
      error.code = 'MISSING_SELECTED_TRACK';
      throw error;
    }
    // Display labels and whole-session revisions do not affect rendered audio.
    const { label, ...audio } = member;
    return audio;
  });
  if (members.reduce((n,t)=>n+t.frames*8,0)>p.maxSelectedBytes) throw Error('Selected media budget exceeded');
  return freeze({ profile, engine: p.engine, sourceSessionId: snapshot.sessionId,
    selection, sampleRate: snapshot.sampleRate, layout: ['L', 'R'], members });
}
export function dependencyKey(snapshot, selection, profile = PROFILE) {
  // Exact bounded canonical representation; cryptographic hashing is an adapter.
  // Selection/member order is retained, never implicitly sorted or guessed.
  return JSON.stringify(projectDependencies(snapshot, selection,profile));
}
export function observeCurrentness(usedInput, usedSelectionInput, availableInput, availableSelectionInput, observedAt, profile = PROFILE) {
  integer(observedAt, 0, Number.MAX_SAFE_INTEGER, 'observation time');
  const used = createSnapshot(usedInput,profile), selected = createSelection(usedSelectionInput,profile);
  const usedKey = dependencyKey(used, selected,profile);
  const result = { usedRevisionId: used.revisionId, availableRevisionId: null, observedAt };
  if (availableInput === null) return freeze({ ...result, status: 'unknown', reason: 'source-unavailable' });
  const available = createSnapshot(availableInput,profile), availableSelection = createSelection(availableSelectionInput,profile);
  result.availableRevisionId = available.revisionId;
  if (available.sessionId !== used.sessionId) return freeze({ ...result, status: 'review-required', reason: 'source-identity-changed' });
  if (JSON.stringify(selected) !== JSON.stringify(availableSelection)) return freeze({ ...result, status: 'review-required', reason: 'selection-definition-changed' });
  let availableKey;
  try { availableKey = dependencyKey(available, availableSelection,profile); }
  catch (error) {
    if (error.code !== 'MISSING_SELECTED_TRACK') throw error;
    return freeze({ ...result, status: 'unavailable', reason: 'selected-track-missing' });
  }
  return freeze({ ...result, status: usedKey === availableKey ? 'current' : 'update-available' });
}
