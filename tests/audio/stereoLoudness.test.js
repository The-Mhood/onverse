import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyze, analyzeFast, quickLufs } from '../../src/audio/analyzer.js';
import { createToneBuffer, createPcmBuffer } from '../fixtures/audioBuffers.js';

const near = (a, b) => assert.ok(Number.isFinite(a) && Math.abs(a-b) <= 1e-6, `${a} vs ${b}`);
const methods = { analyze: async b => (await analyze(b)).lufs, analyzeFast: async b => (await analyzeFast(b)).lufs, quickLufs };
// Legacy MONO calibration snapshots, not BS.1770 accuracy/reference values.
const monoBefore = { 44100: -9.611542407721808, 48000: -9.611351271611932, 96000: -9.610574139147966 };
for (const sampleRate of [44100, 48000, 96000]) {
  for (const [name, measure] of Object.entries(methods)) {
    describe(`${name} channel-energy semantics at ${sampleRate}`, () => {
      const tone = channelGains => createToneBuffer({ sampleRate, length: sampleRate/2, channelGains });
      it('preserves the existing mono filter/window calibration', async () => near(await measure(tone([1])), monoBefore[sampleRate]));
      it('duplicate mono adds 10log10(2), not an implicit dual-mono correction', async () => near(await measure(tone([1,1])) - await measure(tone([1])), 10*Math.log10(2)));
      it('one active L or R retains native mono energy', async () => {
        const mono = await measure(tone([1])); near(await measure(tone([1,0])), mono); near(await measure(tone([0,1])), mono);
      });
      it('unequal channels sum energy rather than signed samples or average power', async () => near(await measure(tone([1,-.5])) - await measure(tone([1])), 10*Math.log10(1.25)));
      it('quarter-cycle decorrelation sums the two independently measured powers', async () => {
        const left = tone([1]).getChannelData(0);
        const right = Float32Array.from(left, (_, i) => .5*Math.cos(2*Math.PI*1000*i/sampleRate));
        const l = await measure(createPcmBuffer([left], sampleRate)), r = await measure(createPcmBuffer([right], sampleRate));
        near(await measure(createPcmBuffer([left, right], sampleRate)), -0.691+10*Math.log10(10**((l+.691)/10)+10**((r+.691)/10)));
      });
      it('obeys gain law without changing or sharing original channel samples', async () => {
        const buffer = tone([1,-1]), copy = [buffer.getChannelData(0).slice(),buffer.getChannelData(1).slice()];
        const level = await measure(buffer);
        near(await measure(createPcmBuffer(copy.map(c => c.map(x => x*.5)), sampleRate)) - level, 20*Math.log10(.5));
        for (let c=0;c<2;c++) assert.deepEqual(buffer.getChannelData(c),copy[c]);
      });
    });
  }
}
for (const [name, measure] of Object.entries(methods)) {
  for (const invalid of [NaN, Infinity, -Infinity]) {
    it(`${name} rejects non-finite PCM, including a partial-window tail, without mutating it`, async () => {
      const b=createToneBuffer({length:24001,channelGains:[1,-1]}); b.getChannelData(1)[24000]=invalid;
      const before=[b.getChannelData(0).slice(),b.getChannelData(1).slice()];
      await assert.rejects(async()=>measure(b), /Non-finite PCM/);
      for(let c=0;c<2;c++) assert.deepEqual(b.getChannelData(c),before[c]);
    });
  }
}
