# UI-RESET-001 — executed pre-deletion results / outstanding work

2026-10-16. These are BEFORE checks. No UI code/assets deleted or replaced.

| Snapshot | Actual command | Result |
| --- | --- | --- |
| GitHub main2faa3939, isolated Git archive | `node --test tests/unit/*.test.js tests/audio/*.test.js` |154tests,151pass,0fail,3known LUFS TODOs;3.402s |
| Lead preserved local tree, HEAD2faa3939 + held core | same command |404tests,401pass,0fail,3known TODOs;39.699s |
| Closed B headb17f2aa4, isolated Git archive | above plus `tests/ui/*.test.js tests/orbit/*.test.js` |231tests,226pass,2fail,3TODOs;3.973s; actual exit1 |
| Local analyzer sanity | `node scripts/test-analyze.mjs` |PASS |
| Coordinator docs diff | `git diff --check` |PASS |

B failures are NOT hidden: orbitStage import cannot resolve uninstalled `three` in
this source-only archive; presentation scope test shells out to Git using stale
`origin/arena/ced77c2a-onverse`, now deleted, and expects a checkout rather than an
archive. No dependency installation, ref recreation or assertion weakening was used.
They do not establish a passing packaged/browser/B workflow; full source log retained.
The3LUFS TODO cases in each applicable suite remain known unresolved measurements.
No analyzer/processor/audio tolerances changed.

Inspected live GitHub repo, all branch tips, PR3/4/5 commits/files/comments and PR5
closure/head-deletion timeline. All four live branch trees + closed PR5 head + local
worktree inventoried:168unique paths.131local pre-audit files copied/hashed before
coordinator edits. Missing historic Git objects were fetched by their API-verified
SHA for read-only inspection, never by switching/resetting a working branch. The
first inventory attempt stopped on a missing commit object; fetched that named
object and reran before any inventory success claim. No code/deletion resulted.

No ignored files found here. No standalone screenshot/photo/model/texture files
found in inspected trees beyond listed icons/fonts/favicon; procedural scenery/
shaders still count as old visuals. B's external/ignored/unpublished files, hidden
worker environments and old media attachments cannot be certified absent. P must
inventory its own checkout before applying its reset. No old media retrieved/reused.

GitHub issue6 authority + full human inventory and issue7 P packet + compressed
machine inventory were actually created. API bodies exact-readback verified. Both
comment paths (GraphQL then REST) and an existing-issue PATCH were denied403; no
comment/notification success on PR4/PR5/issue2 is claimed. See GITHUB_PUBLICATION.
No commit/push/merge/ref realignment/branch creation, no runtime/CI/paid dispatch.

## Still present / not yet verified

All original active main/style/scene/draw/index UI remains. All original fonts/
favicon/icon assets remain. B-only shell/Orbit/universe/SYLUNE prototype paths absent
from main/local are inventory entries, not claimed new deletions. Old B code stays
in Git history/closed PR, not merged into the active tree. Legacy documents now carry
supersession headers; retained engineering/legal/audit history is not a runtime UI
fallback and must not guide the new design.

P receipt/fixed branch/start unknown. Mixed main/controller extraction +9case test
migration, SYLUNE DTO safety review and package/icon coupling precede safe full UI
removal. Clean neutral boot, deletion/residual inventories and replacement design
are NOT completed. New references not supplied; design held.

Build/browser/accessibility/keyboard/reduced-motion/performance/screenshots/manual
import/reference/analysis/playback/A-B/crop/conversion/mastering/export, actual
integrated DAW/Linked/undo-redo/session reopen/provider workflows and Mac packaging
were NOT executed in this audit. Backend source preservation/Node proof is not new
frontend functionality. These must be reported as unavailable until appropriate
frontend/runtime exists, never simulated as working controls.
