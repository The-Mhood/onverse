// Trusted-constructor profiles only. No mutable global limit or caller-defined
// renderer policy. Legacy defaults and canonical dependency keys stay unchanged.
export const LEGACY_PROFILE = 'linked-selection-integration-v1';
export const RANGE_PROFILE = 'linked-selection-range-v1';
const MiB = 1024 * 1024;
const profiles = Object.freeze({
  [LEGACY_PROFILE]: Object.freeze({id:LEGACY_PROFILE,engine:'native-offline-gain-sum-v1',fixedFrames:4096,
    maxFrames:4096,maxTimelineFrames:4096,maxPlacementFrames:4096,maxAssetBytes:MiB,
    maxSelectedBytes:8*32768,maxVersionBytes:64*32768,maxStagedBytes:64*32768,maxCandidates:64,maxPreviewChunkBytes:32768}),
  [RANGE_PROFILE]: Object.freeze({id:RANGE_PROFILE,engine:'native-offline-range-gain-sum-v1',fixedFrames:null,
    maxFrames:30*48000,maxTimelineFrames:300*48000,maxPlacementFrames:30*48000,maxAssetBytes:64*MiB,
    maxSelectedBytes:32*MiB,maxVersionBytes:64*MiB,maxStagedBytes:32*MiB,maxCandidates:2,maxPreviewChunkBytes:256*1024})
});
export function getRenderProfile(id = LEGACY_PROFILE) {
  if (typeof id !== 'string' || !Object.hasOwn(profiles,id)) throw Object.assign(Error('UNSUPPORTED_RENDER_PROFILE'),{code:'UNSUPPORTED_RENDER_PROFILE'});
  return profiles[id];
}
export function selectionFrames(selection, profile = LEGACY_PROFILE) {
  const p=getRenderProfile(profile),start=selection?.rangeStartFrame,end=selection?.rangeEndFrame;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start<0 || end<=start || end>p.maxTimelineFrames || end-start>p.maxFrames ||
    (p.fixedFrames!==null && (start!==0 || end!==p.fixedFrames))) throw Error('Unsupported selection range');
  return end-start;
}
