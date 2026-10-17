// Trusted generated fixtures and independent CPU oracles, NOT native-render proof.
import {encodePCM,decodePCM} from '../../src/audio/linkedSessions/pcm.js';
import {RANGE_PROFILE} from '../../src/domain/linkedSessions/renderProfiles.js';
import {createHash} from 'node:crypto';
import {peaking} from '../../scripts/validation/offline-render-fixtures.mjs';
export const rangeHash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function rangeFixture(parent,onBoundary,frames=48000) {
  const tracks=[],assets=[];
  for(const [i,name,start,size,gain,muted]of [[0,'tone-a',0,frames+9600,.5,false],[1,'tone-b',24000,frames,-.25,false],[2,'outside',60*48000,480,1,false],[3,'muted',0,9600,1,true]]){
    const channels=[0,1].map(c=>Float32Array.from({length:size},(_,n)=>(c===0?.5:-.25)*Math.sin(2*Math.PI*(i+1)*375*n/48000)));
    const bytes=encodePCM(channels,RANGE_PROFILE),assetId=name+'-pcm';assets.push({assetId,frames:size,bytes});
    tracks.push({trackId:name,audioRevisionId:name+'-r1',label:name,assetId,sha256:rangeHash(bytes),frames:size,startFrame:start,gain,muted});
  }
  const bytes=encodePCM([0,1].map(c=>Float32Array.from({length:48000},(_,n)=>(c===0?.125:.0625)*Math.sin(2*Math.PI*(c===0?1500:750)*n/48000))),RANGE_PROFILE);
  assets.push({assetId:'destination-other',frames:48000,bytes});
  return {parent,onBoundary,renderProfile:RANGE_PROFILE,source:{snapshot:{schemaVersion:1,sessionId:'source-a',revisionId:'range-r1',sampleRate:48000,layout:['L','R'],tracks},
    selection:{groupId:'drums',definitionRevisionId:'range-def-1',trackIds:tracks.map(t=>t.trackId),rangeStartFrame:4800,rangeEndFrame:4800+frames}},
    assets,destination:{targetId:'linked',unrelatedAssetId:'destination-other',processing:{startFrame:256,gain:.5,eq:{type:'peaking',frequency:1500,Q:1,gainDb:3}}}};
}
export function expectedRange(snapshot,selection,assets) {
  const frames=selection.rangeEndFrame-selection.rangeStartFrame,out=[new Float32Array(frames),new Float32Array(frames)];
  for(const id of selection.trackIds){const t=snapshot.tracks.find(t=>t.trackId===id);const channels=decodePCM(assets.find(a=>a.assetId===t.assetId).bytes,t.frames,RANGE_PROFILE);
    if(t.muted)continue;
    for(let n=0;n<frames;n++){const src=n+selection.rangeStartFrame-t.startFrame;if(src<0||src>=t.frames)continue;
      for(let c=0;c<2;c++)out[c][n]=Math.fround(out[c][n]+Math.fround(channels[c][src]*t.gain));}
  }
  return out;
}
export function expectedRangeDestination(bytes,otherBytes,processing) {
  const frames=bytes.length/8,otherFrames=otherBytes.length/8,input=decodePCM(bytes,frames,RANGE_PROFILE),other=decodePCM(otherBytes,otherFrames,RANGE_PROFILE);
  if(processing.eq.frequency!==1500||processing.eq.Q!==1||processing.eq.gainDb!==3)throw Error('Oracle only supports declared fixture EQ');
  const k=peaking(),length=Math.max(processing.startFrame+frames,otherFrames)+4096;
  return [0,1].map(c=>{let x1=0,x2=0,y1=0,y2=0;return Float32Array.from({length},(_,n)=>{
    const src=n-processing.startFrame,x=src>=0&&src<frames?Math.fround(input[c][src]*processing.gain):0;
    const y=k.b0*x+k.b1*x1+k.b2*x2-k.a1*y1-k.a2*y2;x2=x1;x1=x;y2=y1;y1=y;
    return Math.fround(Math.fround(y)+(n<otherFrames?other[c][n]:0));});});
}
