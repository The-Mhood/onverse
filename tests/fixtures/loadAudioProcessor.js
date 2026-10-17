// Node-only adapter: compile the actual processor and its trusted ?raw inputs
// using the installed production compiler. No DSP replacement, source rewriting,
// arbitrary module target or user-provided/generated-plan code execution.
import { build } from 'vite';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
let loaded;
export function loadAudioProcessor() {
  return loaded ??= (async () => {
    const result = await build({configFile:false,logLevel:'silent',build:{write:false,minify:false,
      lib:{entry:fileURLToPath(new URL('../../src/audio/processor.js',import.meta.url)),formats:['es']}}});
    const outputs=Array.isArray(result)?result:[result];
    const chunks=outputs.flatMap(output=>output.output).filter(output=>output.type==='chunk');
    assert.equal(chunks.length,1); assert.deepEqual(chunks[0].imports,[]); assert.deepEqual(chunks[0].dynamicImports,[]);
    return import('data:text/javascript;base64,'+Buffer.from(chunks[0].code).toString('base64'));
  })();
}
