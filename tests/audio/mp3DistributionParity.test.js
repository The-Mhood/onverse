// Trusted, installed dependency distributions only. This is deterministic byte
// parity, not a listening test or proof for every possible input/encoder setting.
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import notices from '../../src/audio/vendor/lamejs-notices.js';
const libraries = ['all', 'min'].map(name => {
  const context = createContext({console});
  runInContext(readFileSync(new URL(`../../node_modules/lamejs/lame.${name}.js`, import.meta.url), 'utf8'), context);
  return context.lamejs;
});
for (const channels of [1, 2]) for (const kbps of [128, 192, 320]) {
  it(`lamejs min distribution is byte-identical for ${channels} channels / ${kbps} kbps`, () => {
    const pcm = Array.from({length:channels}, (_,c) => Int16Array.from({length:44100}, (_,i) =>
      Math.round(10000*Math.sin(2*Math.PI*(443+97*c)*i/44100)+5000*Math.cos(2*Math.PI*1103*i/44100))));
    const before = pcm.map(c => c.slice());
    const encoded = libraries.map(lame => {
      const encoder = new lame.Mp3Encoder(channels, 44100, kbps), chunks=[];
      for(let i=0;i<44100;i+=1152) chunks.push(Buffer.from(channels===2 ?
        encoder.encodeBuffer(pcm[0].subarray(i,i+1152), pcm[1].subarray(i,i+1152)) : encoder.encodeBuffer(pcm[0].subarray(i,i+1152))));
      chunks.push(Buffer.from(encoder.flush())); return Buffer.concat(chunks);
    });
    assert.ok(encoded[0].length>1000); assert.deepEqual(encoded[1],encoded[0]); assert.deepEqual(pcm,before);
  });
}

it('retains every upstream copyright/license comment and the package LICENSE', () => {
  const original=readFileSync(new URL('../../node_modules/lamejs/lame.all.js',import.meta.url),'utf8');
  const comments=original.match(/\/\*[\s\S]*?\*\//g).filter(c=>/copyright|license|gnu lesser/i.test(c));
  assert.equal(comments.length,9);
  for(const comment of comments) assert.ok(notices.includes(comment));
  assert.ok(notices.includes(readFileSync(new URL('../../node_modules/lamejs/LICENSE',import.meta.url),'utf8')));
});
