// Emit an exact REVIEW patch; never write electron/, package configuration or Git.
import * as fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export const EXPECTED_MAIN_SHA256='46d6d66b879cd8d884fb5a917d1bd2e0ac060da3c06be1a1773d7cfb9d574c63';
export const PROBE_FLAG='--mov-session-runtime-probe';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const insertion=['', '// Review-only diagnostic route: no studio/updater initialization in this mode.',
  'const sessionRuntimeProbe = process.argv.some(arg => arg.startsWith("--mov-session-runtime-"))',
  'if (sessionRuntimeProbe) {', '  require("./diagnostics/sessionRuntimeProbe.cjs").run()', '} else {'];
export function candidateMain(original){
  if(typeof original!=='string'||sha(original)!==EXPECTED_MAIN_SHA256)throw Error('MAIN_BASE_CHANGED_REVIEW_REQUIRED');
  const lines=original.trimEnd().split('\n');
  if(lines[2]!=='"use strict"')throw Error('MAIN_LAYOUT_CHANGED');
  return [...lines.slice(0,3),...insertion,...lines.slice(3),'}',''].join('\n');
}
export function reviewPatch(original,probe){
  const proposed=candidateMain(original),lines=original.trimEnd().split('\n');
  if(typeof probe!=='string'||!probe.endsWith('\n')||probe.includes('\r')||Buffer.byteLength(probe)>65536)throw Error('INVALID_PROBE_SOURCE');
  // Two insertion-only hunks: preserve the complete original normal branch.
  const first=lines.slice(0,7),last=lines.slice(-3),offset=lines.length-2;
  const mainPatch=['diff --git a/electron/main.cjs b/electron/main.cjs','--- a/electron/main.cjs','+++ b/electron/main.cjs',
    `@@ -1,7 +1,${7+insertion.length} @@`,...first.slice(0,3).map(x=>' '+x),...insertion.map(x=>'+'+x),...first.slice(3).map(x=>' '+x),
    `@@ -${offset},3 +${offset+insertion.length},4 @@`,...last.map(x=>' '+x),'+}'];
  const body=probe.slice(0,-1).split('\n');
  const added=['diff --git a/electron/diagnostics/sessionRuntimeProbe.cjs b/electron/diagnostics/sessionRuntimeProbe.cjs','new file mode 100644','--- /dev/null','+++ b/electron/diagnostics/sessionRuntimeProbe.cjs',`@@ -0,0 +1,${body.length} @@`,...body.map(x=>'+'+x)];
  return Object.freeze({patch:[...mainPatch,...added,''].join('\n'),proposedMain:proposed,originalMainSha256:sha(original),proposedMainSha256:sha(proposed),probeSha256:sha(probe)});
}
export async function prepareReview(){
  const [original,probe]=await Promise.all([fs.readFile(new URL('../../electron/main.cjs',import.meta.url),'utf8'),fs.readFile(new URL('./packaged-runtime-candidate/sessionRuntimeProbe.cjs',import.meta.url),'utf8')]);
  return reviewPatch(original,probe);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==2){console.error('No arguments accepted. Emits a review-only patch to stdout; never applies it.');process.exitCode=2;}
  else prepareReview().then(result=>process.stdout.write(result.patch)).catch(error=>{console.error(error.message);process.exitCode=1;});
}
