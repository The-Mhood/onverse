import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exerciseCrashBoundaries, COMMIT_BOUNDARIES } from '../../scripts/validation/run-linked-session-integration.mjs';
import { encodePCM } from '../../src/audio/linkedSessions/pcm.js';
import { recipe, expectedGroup } from '../../scripts/validation/offline-render-fixtures.mjs';
test('actual adapter SIGKILL at ten boundaries, byte-exact separate-process reopen and writable recovery/quarantine/fresh approved update/undo-redo', {skip:process.platform!=='linux'}, async()=>{
  // CPU oracle bytes are fixtures here; opt-in native driver repeats with actual native output.
  const rows=await exerciseCrashBoundaries(encodePCM(expectedGroup(recipe())),encodePCM(expectedGroup(recipe('updated'))));
  assert.equal(rows.length,COMMIT_BOUNDARIES.length+1);assert.ok(rows.every(r=>r.byteExact&&r.writableRecovered&&r.freshApprovedUpdate&&r.separateProcessReopen&&r.undoRedo));
  assert.deepEqual(rows.filter(r=>r.promoted).map(r=>r.boundary),['pointer-renamed','directory-synced','complete']);
});
