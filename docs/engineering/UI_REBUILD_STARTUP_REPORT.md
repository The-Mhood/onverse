# UI-RESET-003 — startup repair and functional rebuild evidence

2026-10-16 · lead · **working browser rebuild, not full product/release acceptance**

## 1. Ownership, authoritative state and preservation

- Merged GitHub `main`: `2faa3939b9e109e5a9ed2e0d53130dc51c5abc9e`.
- P's OPEN PR8: `arena/31c3346b-onverse`, last inspected
  `a965e1890b08911811e48cd1f059363bec64f8c6`. Its earlier reset/asset cleanup was
  `9f7eefffc64c29bbd644fc426e1146db8a75b954`. It is not merged or startup-accepted.
- Lead's fixed branch: `arena/14df8ffa-onverse`, HEAD still `2faa3939…`.
  **This repair is uncommitted/unpushed working-tree code.** No commit contains it
  yet; neither the owner nor P should mistake PR8 or main for this combined result.
  No reset, clean, stash, history rewrite, force-push, switch, merge or release.
- Before edits, all **143 existing files** (including held untracked core and the
  unused analysis-controller candidate) were copied and SHA-256 inventoried at
  `/home/user/reviews/ui-rebuild-before-20261016`. The evidence packet retains a
  reversible slice patch, full before/current manifests and exact removed paths.
- All earlier Linked Sessions/application/domain/storage/recovery/history/IPC and
  packaged-runtime proof source is preserved. `electron/main.cjs`, preload,
  `package-lock.json`, DSP/processor/service/plan logic and unrelated tests are
  byte-identical to the pre-slice snapshot. The only existing engine-file changes
  are P's reviewed three analyzer wording replacements and genre/reference comments.

### Explicit parallel boundary

Published and exact API-body readback checked:
https://github.com/The-Mhood/onverse/pull/8#issuecomment-6219121571

Lead owns `src/main.js`, `index.html`, `src/application/workbench/**`,
`src/ui/workbench/**`, the analysis-controller integration, controller/UI tests
and runtime validation. P owns `src/ui/presentation/rebuild/**` and
`public/rebuild/**` for new presentation/assets, not state, audio/provider access
or functional event bindings. Routine reversible visual decisions need no new
approval. Exact protected crossings get file/hunk/reason/risk review; unrelated
work continues. P actually submitted its seven presentation files at `a965e189`;
all seven were copied **byte-identically**, then integrated through lead-owned
markup/CSS, with no write to P's branch or edits to its files.

The former design WAIT is superseded by the owner's current direction: 13 shared
system; 02 first-person grounded cosmic setting; 05/09 hierarchy and editing
precision; 04 framing only, not a fake DAW window. The numbered reference images
are not present in this checkout. The real P-authored/generated environment asset
is integrated, but exact reference fidelity/visual signoff is NOT claimed.

## 2. Root causes and architectural repair

| Blocker | Root cause | Actual repair |
| --- | --- | --- |
| Null `#btnIdleUpload` and other startup bindings | PR8 removed the markup but retained module-level legacy-selector assignments. | Replace the mixed entry with explicit `mountWorkspace` → one real controller → `view.bind`. The new semantic markup is mounted BEFORE bindings; missing new DOM contracts throw descriptive errors. No old IDs or hidden legacy template recreated. |
| Undeclared `stage`, `drawRadar`, `drawWaveform` | Imports/declarations were removed while audio/control functions still called presentation globals; optional chaining cannot guard undeclared identifiers. | Remove decorative stage coupling from playback, analysis and seek paths. Real Web Audio source/analyser plumbing remains in the controller; a new canvas view draws the actual extracted `peaksFor` output. No dummy stage/renderer/service or success stub. |
| Legacy renderer/template still bundled | Main mixed engine orchestration, old report/ref/control HTML, SVG icon table, updater markup, boot overlay and stage setup. | Delete that active presentation implementation. Main is now a small composition root. New view owns semantic controls, text-only metadata/report insertion and lifecycle-bound event listeners. Analysis/reference bodies run through the existing DOM-free controller; other single-buffer operations live in a separate workbench controller. |
| Asset/config remnants | Fonts/favicon/icons and icon generator outlived the first reset. | Adopt P's reviewed 32 removals and three exact package icon-removal fields. Retain product identity, dependency versions, lockfile, signing/update settings and Mac targets. New P JPEG is embedded through Vite `?inline`, proven in the production page; no legacy visual fallback. |
| Tests did not execute app boot | Old nine-case suite extracted only one main function through a VM; static shell/build checks passed despite broken module evaluation. | Migrate ONLY that harness to the actual analysis factory, retaining every original test case/assertion. Add operation/static-shell tests and actual production-browser ESM/workflow tests with screenshots and real downloads. |

### Actual startup/dependency trace

`index.html` has the semantic `main#app`, a loading status and module entry.
Main imports P's presentation CSS and the lead's semantic/density adapter, the
unchanged real processor/reference modules, workbench controller and workspace
view. The view creates all its own required controls; construction alone starts
no audio context, request, listener-driven audio operation or analysis.

The processor still uses the existing bundled `lamejs` raw source and local
Web Audio decode/OfflineAudioContext path. Its algorithms and result contracts
are unchanged. Analysis uses `analysisService.analyze/analyzeFast`; scoring,
issues, plans, genre/category selection and measured reference targets use the
same helpers. The extracted demo synthesis is a verbatim function copy.
Playback AudioContext is created only on actual playback; the original
analyser/source connection, A/B source selection, rate/seek/crop math remain.
Only obsolete spectrum-to-decorative-stage delivery is removed.

The new view has one file picker and one reference picker, semantic source/
comparison/editor/transport/region/conversion/inspector controls, a required-node
lookup map, and an explicit finite action map. No selectors reach deleted markup.
DOM updates use textContent for filenames, external reference metadata and reports;
no generated/imported code is executed. The canvas uses real cached PCM peaks,
redrawing only when its buffer/size/side/region changes; playhead state comes from
the real source clock. ResizeObserver and event listeners are disposed explicitly.

Desktop integration remains ONLY the optional existing `window.movUpdate` bridge:
preload subscribes to `mov:update-status`, unsubscribes on cleanup, and the user's
install button calls the existing `mov:update-install` path. The renderer creates
no new IPC/session/AI API. Pagehide unsubscribes, disconnects the view and closes
the playback context. Electron/native/security behavior itself was not qualified.

### Bounded orchestration changes, not audio algorithm changes

- Replace old DOM-painting effects with real view effects on the same state.
- Import now awaits its automatic analysis, rather than a fire-and-forget call;
  there is still no per-request revision/freshness/cancellation guarantee.
- Existing busy/tweak flags disable unrelated mutation controls. Fixed-copy crop
  uses that busy port during remeasurement instead of an old DOM-button disabled
  assignment; it is released on failure. Original floor/ceil crop samples remain.
- Reference URL rejection now clears its resolving indicator and reports a real
  thrown resolver error. Backend URL resolution/preview/profile contracts are unchanged.
- Manual UI inputs retain original ranges and debounce, use fresh nested defaults,
  and call the same `buildProcessingPlan`/`masterFix`/fast-analysis operations.
- Conversion remains from original A, even if B is selected. Supported recorder
  formats are enabled per the actual `supportedRecorders` capability result.
  M4A UI text says **browser codec**, not guaranteed AAC: this Chromium produced
  Opus in MP4 using the unchanged backend. No processor contract was altered.
- Exported report is newly formatted plain text from actual existing results,
  with heuristic/measurement limitations disclosed, not legacy UI/attribution.

## 3. Files changed, removed and preserved

**Lead implementation/integration:** `src/main.js`, `index.html`, new
`src/application/workbench/workbenchController.js` and `demo.js`, existing
`src/application/analysis/analysisController.js` (header updated; its three copied
function bodies remain unchanged), new `src/ui/workbench/workspace.js` and CSS.

**P additions adopted exactly:** `src/audio/waveformPeaks.js` from the reset;
all seven `src/ui/presentation/rebuild/**` files from `a965e189` (four CSS entries,
README/provenance, labeled nonfunctional preview HTML, 107345-byte JPEG).
The main app does NOT load P's nonfunctional preview page or substitute it for
runtime startup evidence.

**P protected-prefix wording review:** analyzer changes are exactly its three
approved string replacements; genre/reference changes are comments only. Numeric
catalogs and every algorithm statement remain identical. The waveform helper
math is copied unchanged from old draw.js, not the old canvas interface.

**32 removals:** old `src/style.css`, `src/scene.js`, `src/ui/draw.js`; old favicon,
icon generator, 12 app-icon files; all 10 old WOFF2 binaries, their 3 OFL notices,
and their font README/manifest. Font notices removed only with corresponding bytes.
Machine inventory lists every exact path; no unrelated repository deletion.

**Tests:** old `analysisErrorFlow.test.js` harness migration; new
`workbenchController.test.js` (13 controlled operation tests); new/adapted
`tests/ui/entryShell.test.js` (7 static contracts). Existing 31-case analysis
factory suite and all other earlier held tests stay unchanged.
New `scripts/validation/run-workbench-browser.mjs` is opt-in synthetic-only proof,
not production code, a service stub, a browser sandbox or a release acceptance gate.

**Coordination/docs:** this report, current authority/handoff/design/queue banners,
build instructions and historical-candidate supersession notice. Earlier held
engineering records are preserved below those current status notes.

### Native title reconciliation — explicitly not silently re-pinned

P's Electron title-only change is NOT adopted in this working tree.
`electron/main.cjs` stays at exact pre-slice SHA-256
`46d6d66b879cd8d884fb5a917d1bd2e0ac060da3c06be1a1773d7cfb9d574c63`.
An intermediate reconciliation included that hunk and triggered 11 exact-base
failures in the held packaged-runtime proof. It was returned byte-for-byte to the
preserved native baseline; no test was weakened and no proof hash was silently
re-pinned. The complete final suite then passes its original guards, including
20/20 packaged-candidate cases. Native title/background and unused reference
platform-color metadata are residual presentation/compatibility follow-ups, not
browser boot dependencies, authorization ambiguity or reasons to pause P.
The old native title does not restore any deleted interface/asset. No native
window/security/updater contract was changed or Mac qualification claimed.

## 4. Executed verification and screenshots

Node `v22.22.3`, Linux. Existing app dependencies installed with
`npm ci --ignore-scripts --no-audit --no-fund` (323 packages); no version/lock change,
no package scripts or Electron binary installer. Separate approved toolkit:
Chromium153.0.0/Puppeteer25.14.0, scripts disabled, 43 packages, pinned integrity
and full toolkit audit. Private runtime/TMPDIR, allowlisted environment,
al2023 libraries, no external network requests, finally cleanup. Browser sandbox
is disabled for trusted local synthetic PCM only; NEVER a security/Mac proof.

| Command/check | Actual final result |
| --- | --- |
| `node --test tests/unit/*.test.js tests/audio/*.test.js tests/ui/*.test.js` | **455 tests; 452 pass; 0 ordinary failures; 3 SAME known LUFS TODO failures; no skips.** |
| `node --test tests/unit/workbenchController.test.js` | 13/13 pass. |
| `node --test tests/unit/packagedRuntimeCandidate.test.js` | 20/20 pass with original exact native pin preserved. |
| `node scripts/test-analyze.mjs` | All taxonomy/URL/detection/scoring/reference sanity checks pass. |
| `npm run build` | Pass; Vite8.2.2 + inline-dist; existing >500kB JS-chunk warning remains (bundled encoder). |
| `node scripts/validation/run-workbench-browser.mjs <audited-private-toolkit>` | PASS on actual served production `dist/index.html`, not VM/import stripping or a preview mockup. |
| Preview proxy Host request | HTTP200 for an `.e2b.app` Host; server bound `0.0.0.0:4173`. |
| Source/body/case preservation and whitespace/index checks | Exact proof in packet; all nine original assertion bodies retained; no staged changes. |

Final browser evidence: `/home/user/reviews/workbench-browser-20261016-ZQx7D3`.
That folder contains code-pinned `report.json`, real downloaded synthetic audio,
viewport PNGs **1120×700** and **1480×920** (both empty and loaded states), plus
full-page PNGs to expose scrollable content. These are actual browser captures,
not AI UI mockups. Only their decorative background is P's generated art.

- Zero page exceptions, missing assets, failed HTTP responses, blocked external
  requests or unexpected console errors. The intentionally invalid WAV generates
  one **expected** decoder console error, recorded rather than hidden.
- Zero audio contexts at startup. All 9 real AudioContexts opened by the workflow/
  decoder tests close after the registered cleanup hook is exercised; three real
  offline master renders observed. That is not a native Electron quit proof.
- No horizontal overflow or horizontally clipped controls at either size.
  **Vertical scrolling is real and required**, not hidden: loaded scroll heights
  990 at1120×700 and1051 at1480×920. Findings also scroll within the inspector.
- Reviewed actual screenshots: source, single real waveform, transport/A–B and
  inspector remain legible; dense secondary text/vertical density remain visual
  refinement work, not a declared WCAG or exact-reference pass.
- Keyboard Space and seek controls work; labels/focus styling and reduced-motion
  CSS/media are checked. No full accessibility/performance certification.
- Captured runtime metrics are diagnostics under this sandbox, not a baseline
  benchmark, device guarantee or performance budget acceptance.

Intermediate browser failures were retained in adjacent attempt folders: a
harness resolver rule initially blocked loopback; upload-readiness polling raced
real decoding; fixture expectations initially assumed 48k/88200 frames instead
of the decoder's native44.1k/88199; transient progress polling could miss a short
render after P CSS integration. Final proof uses native decoded geometry,
exact A-byte identity, actual offline-render count + released UI guard and real
file bytes, not relaxed sample tolerances or suppressed app errors.

## 5. Workflow outcomes and remaining limits

| Workflow | Evidence / limits |
| --- | --- |
| Demo/import | Real original 16s demo synthesizer, file picker, browser decoder and automatic analyzer run. Invalid audio reports failure without replacing the valid buffer. Drag/drop is wired through the same operation but not separately browser-tested. |
| Analysis/reference | Real analysis, uploaded-reference measurement/comparison, auto/manual category + subgenre scoring pass. Unsupported URL is rejected by real resolver without network. Real Apple/Spotify/YouTube resolution and remote previews remain untested due outbound restrictions; no success fabricated. |
| Playback/A–B | Actual AudioContext source advances; play/pause, seek/rate, A/B copy selection and keyboard Space pass. No device listening/audible-quality claim. |
| Crop/region | Export A region is exactly44100frames/1s stereo. Applying A crop re-analyzes its buffer; B crop retains exact floor/ceil sample-boundary math (49611frames at49610Hz in this retuned case), leaving A bytes unchanged. |
| Master Fix/manual | Real OfflineAudioContext render + fast remeasure; trim changes actual B WAV bytes, reset renders again. A WAV SHA stays `d77052610a42b6111e37e0f6700dc382a8ff59238f85393042fed93a32e6e850` before/after. Other manual controls use the same tested plan path; not every slider separately browser-tested. |
| Conversion/download | Genuine A WAV, MP3, M4A/MP4 browser-codec and WebM files downloaded. Compressed files decode back to stereo of expected duration. OGG unsupported/disabled here, not promised. Fixed WAV and analysis report downloads pass. Recorder encodes are real-time/browser-specific. |
| Lifecycle/IPC | Registered pagehide cleanup exercised; view listeners/observer disposed and real playback context closed. Existing optional updater bridge preserved by inspection/static coverage; real Electron/update flow not run. |

The original three stereo LUFS TODO assertions execute and expose defects.
True-peak/gain and reference-profile accuracy risks persist. No audio algorithm,
tolerance or TODO was modified to produce a pass. Existing analysis errors after
publication may retain the newly published result; preview errors may retain a
partial buffer cache and use a profile fallback. No new atomic rollback,
cancellation/freshness, worker, project persistence, undo/redo, durable Mac
ownership/recovery or release/security guarantee is introduced.

**Explicitly unimplemented in this UI:** multitrack arrangement, mixer/routing,
plugin host, sound library and SYLUNE execution. Held core proof modules are not
silently adopted into the product. No fake lanes, meters, AI action animation or
placeholder-success service is exposed. The view/controller/presentation split
allows later validated application operations without another wholesale UI rewrite.

## 6. Current delivery status and next work

Startup and the exercised local single-file workflows are repaired and verified
in this working tree; the live production preview is running. New P presentation
is integrated. **The complete visual rebuild/product is not declared finished**:
numbered-reference fidelity and remaining density/a11y polish still need review,
remote reference/device/native/Mac workflows remain unverified, and the repaired
source has not been committed or pushed under the standing held-work restriction.
PR8/main are therefore NOT the deployed repair. No auto-merge or forced publication.

P may continue approved presentation refinement in its exact owned files without
waiting for native-title metadata or other protected follow-ups. Lead retains the
functional entry/ports/tests. Any future shared-file or protected behavior change
gets exact review; unrelated UI implementation remains unblocked.
