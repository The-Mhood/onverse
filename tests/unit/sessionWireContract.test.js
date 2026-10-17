import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readSessionRequest, readSessionPreviewRequest, publicSessionError} from '../../src/application/sessions/sessionWireContract.js';
const request = () => ({schemaVersion:1, hostEpoch:'host-1', requestId:'req-1', projectId:'project-1', method:'getSession', params:{sessionId:'source-a'}});
test('wire input is exact, copied, frozen and canonical across key ordering',()=>{
  const input=request(), copy=readSessionRequest(input);input.params.sessionId='other';assert.equal(copy.params.sessionId,'source-a');assert.ok(Object.isFrozen(copy.params));
  const reordered={params:{sessionId:'source-a'},method:'getSession',projectId:'project-1',requestId:'req-1',hostEpoch:'host-1',schemaVersion:1};
  assert.equal(JSON.stringify(readSessionRequest(reordered)),JSON.stringify(copy));
});
test('wire rejects authority fields, unknown methods, malformed IDs/versions and paths',()=>{
  for(const input of [{...request(),role:'human-ui'}, {...request(),method:'eval'}, {...request(),schemaVersion:2},
    {...request(),projectId:'../private'}, {...request(),params:{sessionId:'source-a',approval:{}}}, {...request(),params:{sessionId:2}}])assert.throws(()=>readSessionRequest(input));
});
test('wire rejects getters without invoking them, symbols, sparse arrays, cycles and exotic objects',()=>{
  let called=false;const input=request();Object.defineProperty(input.params,'sessionId',{get(){called=true;return 'source-a';},enumerable:true});
  assert.throws(()=>readSessionRequest(input));assert.equal(called,false);
  for(const value of [new Date(),new Map(),new Uint8Array(10),Object.create(null),{...request(),extra:Symbol('x')},
    {...request(),extra:[,]}, {...request(),extra:undefined}, {...request(),extra:NaN}])assert.throws(()=>readSessionRequest(value));
  const cycle=request();cycle.params.self=cycle;assert.throws(()=>readSessionRequest(cycle));
});
test('wire bounds nodes/depth/bytes before dispatch',()=>{
  assert.throws(()=>readSessionRequest({...request(),params:{sessionId:'x'.repeat(20000)}}));
  let nested={};for(let n=0;n<10;n++)nested={nested};assert.throws(()=>readSessionRequest({...request(),params:nested}));
});
test('wire public errors never expose paths, stacks, arbitrary codes or throwing accessors',()=>{
  assert.deepEqual(publicSessionError(Object.assign(Error('/private/audio.wav'),{code:'STALE_SOURCE'})),{code:'STALE_SOURCE'});
  assert.deepEqual(publicSessionError({code:'/private/secret',stack:'private'}),{code:'INTERNAL_ERROR'});
  assert.deepEqual(publicSessionError(Object.defineProperty({},'code',{get(){throw Error('private');}})),{code:'INTERNAL_ERROR'});
});

test('review status/cancel commands are exact and cannot import approval or preview authority',()=>{
  for(const method of ['getLinkedReview','cancelLinkedReview']){
    assert.equal(readSessionRequest({...request(),method,params:{reviewId:'review-a'}}).params.reviewId,'review-a');
    for(const params of [{reviewId:'review-a',role:'human-ui'},{planId:'review-a'},{reviewId:'../file'},{reviewId:'review-a',bytes:[0]}])
      assert.throws(()=>readSessionRequest({...request(),method,params}));
  }
});
test('separate preview request is exact/canonical/bounded JSON metadata, never bytes, getters or authority',()=>{
  const input={previewId:'preview-a',schemaVersion:1,projectId:'project-a',hostEpoch:'host-a',planId:'plan-a'};
  const copy=readSessionPreviewRequest(input);assert.ok(Object.isFrozen(copy));input.planId='other';assert.equal(copy.planId,'plan-a');
  for(const extra of [{role:'human-ui'},{bytes:new Uint8Array(32768)},{path:'/private'},{schemaVersion:2},{previewId:'../file'},{planId:undefined}])
    assert.throws(()=>readSessionPreviewRequest({...input,...extra}));
  let touched=false;Object.defineProperty(input,'previewId',{enumerable:true,get(){touched=true;return 'preview-a';}});
  assert.throws(()=>readSessionPreviewRequest(input));assert.equal(touched,false);
});
