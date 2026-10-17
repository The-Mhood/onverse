import { LEGACY_PROFILE, getRenderProfile } from '../../domain/linkedSessions/renderProfiles.js';
import { decodePCM } from './pcm.js';

// Bounded built-in destination gain/peaking-EQ profile, not a plugin host.
export function validateDestinationProcessing(value, renderProfile = LEGACY_PROFILE) {
  const profile=getRenderProfile(renderProfile);
  const keys = (x, names) => x && Object.getPrototypeOf(x) === Object.prototype && Object.keys(x).length === names.length && names.every(n => Object.hasOwn(x,n));
  const finite = (x,min,max) => Number.isFinite(x) && x>=min && x<=max;
  if (!keys(value,['startFrame','gain','eq']) || !keys(value.eq,['type','frequency','Q','gainDb']) ||
      !Number.isSafeInteger(value.startFrame) || value.startFrame<0 || value.startFrame>profile.maxPlacementFrames || !finite(value.gain,-4,4) ||
      value.eq.type!=='peaking' || !finite(value.eq.frequency,20,20000) || !finite(value.eq.Q,.1,20) || !finite(value.eq.gainDb,-12,12)) throw Error('Unsupported destination processing');
  return Object.freeze({startFrame:value.startFrame,gain:value.gain,eq:Object.freeze({...value.eq})});
}
export async function renderLinkedDestination({ linkedBytes, unrelatedBytes, unrelatedFrames, processing, linkedFrames=4096, renderProfile=LEGACY_PROFILE,
  createOfflineContext = (c,n,r) => new globalThis.OfflineAudioContext(c,n,r) }) {
  // No awaiting until caller-owned bytes/parameters have been copied/validated.
  const profile=getRenderProfile(renderProfile);
  if(profile.fixedFrames!==null && linkedFrames!==profile.fixedFrames)throw Error('Unsupported linked geometry');
  const linked=decodePCM(linkedBytes,linkedFrames,renderProfile), other=decodePCM(unrelatedBytes,unrelatedFrames,renderProfile), p=validateDestinationProcessing(processing,renderProfile);
  const frames=profile.fixedFrames!==null ? 8192 : Math.max(p.startFrame+linkedFrames,unrelatedFrames)+4096;
  const context=createOfflineContext(2,frames,48000), nodes=[]; let primaryError;
  try {
    const source=(channels,frames)=>{
      const buffer=context.createBuffer(2,frames,48000); channels.forEach((c,i)=>buffer.copyToChannel(c,i));
      const node=context.createBufferSource();nodes.push(node);node.buffer=buffer;return node;
    };
    // Keep a zero-padded native input alive through the declared range tail.
    // Otherwise native graph deactivation can cut filter state at source end.
    const a=source(linked,profile.fixedFrames!==null?linkedFrames:frames-p.startFrame), gain=context.createGain();nodes.push(gain);
    const eq=context.createBiquadFilter();nodes.push(eq);
    gain.gain.value=p.gain;eq.type=p.eq.type;eq.frequency.value=p.eq.frequency;eq.Q.value=p.eq.Q;eq.gain.value=p.eq.gainDb;
    a.connect(gain);gain.connect(eq);eq.connect(context.destination);a.start(p.startFrame/48000);
    const b=source(other,unrelatedFrames);b.connect(context.destination);b.start(0);
    const output=await context.startRendering();
    if(output.length!==frames || output.sampleRate!==48000 || output.numberOfChannels!==2) throw Error('Native destination geometry mismatch');
    const channels=[new Float32Array(output.getChannelData(0)),new Float32Array(output.getChannelData(1))];
    if(!channels.every(c=>c.length===frames && c.every(Number.isFinite))) throw Error('Invalid native destination PCM');
    return {frames,sampleRate:48000,channels,params:{startFrame:p.startFrame,gain:gain.gain.value,
      eq:{type:eq.type,frequency:eq.frequency.value,Q:eq.Q.value,gainDb:eq.gain.value}}};
  } catch(error){primaryError=error;throw error;}
  finally {
    const errors=[];for(const node of nodes){try{node.disconnect();}catch(error){errors.push(error);}}
    if(errors.length)throw new AggregateError([...(primaryError?[primaryError]:[]),...errors],'Destination cleanup failed');
  }
}
