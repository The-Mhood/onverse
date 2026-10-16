# MusicOnVerse — recovered, integrated, built and browser-verified

2026-10-16 · Actual application delivery, **not native/release/product acceptance**.
This report supersedes the earlier unpublished/held UI startup status. Unrelated
held core work is still preserved and unpublished.

## Published source / shared path

- Fixed branch: **`arena/14df8ffa-onverse`**, existing **PR4**:
  https://github.com/The-Mhood/onverse/pull/4
- Shared base / unchanged main: `2faa3939b9e109e5a9ed2e0d53130dc51c5abc9e`.
- **`6199230`**: recover and publish the actual app, controller/view, analysis
  boundary, repaired entry, tests and approved removal. Source survived in the
  sole original worktree; no reconstruction from missing artifacts was needed.
- **`3f429dd`**: normal two-parent reconciliation with remote8051's seven
  already-published proof files. All seven were locally byte-identical beforehand.
  No force/reset/ref rewrite;8051 was NOT mistaken for the missing application.
- **`6a9369ad28239513158b87aa5467304222c093dc`**: scoped P7e105a0 integration,
  real panel transitions, feathered material-only masks, shared semantic canvas
  colors, native limits dialog/focus handling, full-reference review and proof.
  All six paths in P's a965e189→7e105a0 delta remain byte-identical to P.
- The final follow-up commit records this report/current authority/build notes and
  corrects the browser runner's old reference-availability disclaimer; it does
  not alter the6a9369a app, engine, assets, tests, dependencies or configuration.
  Final branch/HEAD is read from Git/PR4, not a self-referential hash in this file.
- No PR4/PR8/main merge, branch switch, other-branch push, reset/clean/stash,
  history rewrite, native title re-pin or release was performed.

Direct source handoff and follow-up were published to P on PR8:
[recovery](https://github.com/The-Mhood/onverse/pull/8#issuecomment-6221908155),
[source-pack request](https://github.com/The-Mhood/onverse/pull/8#issuecomment-6221919472),
[integrated source / recovered pack](https://github.com/The-Mhood/onverse/pull/8#issuecomment-6222378232).
Publication is fetchable delivery, not proof that P received, started or accepted it.
No owner relay or repeated ordinary approval is required. P can compare its dirty
files to the exact published source; `.arena/`, artifacts and unrelated dirty
core must not be overwritten. P authored the presentation; lead integrated the
real host bindings/recovery and performed combined verification.

## Files and actual runtime path

Root `index.html` → `src/main.js` → `mountWorkspace` / one
`createWorkbenchController` → existing processor/reference/analysis services.
No legacy selectors, stage/draw compatibility shim, hidden old UI, fake service
objects or synthetic successful engine responses. Zero AudioContexts at startup.

- `src/application/workbench/{workbenchController,demo}.js`: real single-source
  actions, extracted original demo, transport/A–B/regions/Master Fix/manual/export,
  cancellation/cleanup boundary and B-crop busy/finally guard.
- `src/application/analysis/analysisController.js`: extracted orchestration with
  existing service, error behavior and original nine error-flow assertions kept.
- `src/ui/workbench/{workspace.js,workspace.css}`: semantic view/actions, waveform,
  canonical token projections, four-layer environment integration, actual content
  entry, native dialog entry/exit/focus and material-only feathering. Playback
  updates do not continually retrigger result-panel animations. No blur filter.
- `src/ui/presentation/rebuild/**`: P's authored asset and presentation, latest
  six changed/new files copied exactly from7e105a0. The standalone preview is NOT
  the application entry. App proof executes root production HTML.
- `src/audio/waveformPeaks.js`: extracted pure peak helper. Analyzer changes are
  only the three authorized phrases; genre/reference edits are comments. DSP,
  processors, analysis service, models and plan algorithms are not changed.
- UI/controller/error-flow tests; `scripts/validation/run-workbench-browser.mjs`
  uses existing published private-toolkit audit helpers, real WebAudio constructors
  and trusted synthetic fixtures, not fake audio implementations.
- `docs/design/REFERENCE_{PACK_SOURCE,PALETTE_SAMPLES}.json` and
  `REFERENCE_REVIEW_20261016.md`: original01–13 provenance, independent quantization,
  individual inspection, distinct families, approximate HEX/source/semantic mapping.

The original full pack was recovered at project ref900f0733 on an existing branch
via read-only GitHub API, without switching/merging it. All16original blobs,
33,442,231bytes, verified; each numbered image01–13 actually inspected individually.
13shared system,02grounded cosmic,05/09precision,04framing-only take precedence
 over the pack guide's older broad04recommendation. No fake DAW/SYLUNE capability.

## Icon failure investigated, not hidden

Twelve legacy build icons returned in the refreshed environment, byte-equal to
base2faa originals, although approved P9f7eeff explicitly retires those paths and
removes the icon generator/mac.icon/buildResources fields. The sole-worktree
pre-mutation139file backup includes every returned icon:
`/home/user/recovery/music-on-verse-20261016/{before,manifest.json,status.txt}`.

Reapplied precisely that reviewed12path deletion; shell assertion unchanged.
There is no remaining runtime/custom icon reference in app/package/legacy config;
legacy config spreads package.build and does not add its own icon requirement.
Inspected installed app-builder-lib26.15.3: macPackager's `getOrConvertIcon('icns')`,
platformPackager's resolve/default path, and ElectronFramework.getDefaultIcon
(default Mac icon embedded in app skeleton). This is source-level fallback review,
NOT a built/accepted Mac package. Do not reintroduce the retired icon for green or
remove an unrelated required asset. New product-icon/package acceptance is separate.

## Fresh validation and exact classification

Node22.22.3; root npm lock unchanged; installs use existing lock with
`npm ci --ignore-scripts --no-audit --no-fund` (Electron not downloaded/executed).

| Check actually run | Result / qualification |
|---|---|
| Clean **Git archive6a9369a** in external review directory, fresh dependency install | PASS; no unpublished core drafts needed to install, build or run app tests. No alternate Git branch/worktree was created. |
| Clean archive `node --test tests/{audio,unit,ui}/*.test.js` | **272 tests /269PASS /0FAIL /3TODO**,26suites, no skips/cancellations. All published tests including14UI shell/cinematic checks. |
| Preserved working-tree full same suites | **462 tests /459PASS /0FAIL /3TODO**,26suites, no skips/cancellations. Includes190additional unpublished held-core cases; this is NOT the independently reproducible PR-only count. |
| Analyzer sanity `node scripts/test-analyze.mjs` | PASS in original and clean committed-source archive. |
| `npm run build` | PASS in both.19modules; existing >500kB encoder chunk warning retained, not suppressed. CSS/JS/JPEG embedded in production HTML. |
| Clean-build HTML versus actual browser-served HTML | **Byte-identical SHA-256 `df12b9c1358892beab9321b95d1ae14648e2ca6f9ef8a8429b922b16ed373f55`**. Runtime proof therefore uses the standalone committed app, not held drafts. |
| Actual production browser workflows | **PASS**,20check groups,16actual PNGs (8viewport/full-page pairs),12real downloads, zero unexpected JS/console/HTTP/blocked-request errors. One intentional invalid-decoder console error is recorded. |
| Actual1120×700 and1480×920 | PASS empty/loaded/open-panel/reduced-motion; scrollWidth exactlyviewportwidth, no horizontally clipped controls or broken images. Human inspection of both loaded captures/full page and reduced-motion panel completed. |
| Reduced motion | PASS BOTH sizes: all four environmental animation names/transforms become none; actual dialog has zero animations, opacity1/transformnone, not merely a media-query flag. |
| Preview host acceptance | HTTP200 for `.e2b.app` Host; server bound0.0.0.0:4173 with environment-only additional preview-host allowance. No product config/origin/security relaxation. |
| `node --check` affected modules/runner; `git diff --check`; semantic token audit | PASS;93used/110declared tokens, no undefinedmvo token. |

Known TODO assertions execute and still expose: analyze and analyzeFast stereo
channel-energy invariance under right polarity inversion (mono fold-down cancels),
and the post-render quick-LUFS trim's same cancellation defect. No tolerance was
weakened and no DSP repair/standards qualification is implied. True-peak/gain risks
remain visible in the actual UI/limits panel.

### Real functional/audio observations

- Import/picker decodes a genuine stereo48kHz2second fixture at native context
  rate44100Hz/88199frames;16second demo generates and analyzes real audio.
- Reference file decode/measurement and built-in category/subgenre re-analysis;
  unsupported stream URL rejected locally, without a real-provider request.
- Playback advances, pauses/seeks/rate cycles, A/B works; Space works outside
  controls and is guarded inside the native modal. No physical listening claim.
- IN/OUT export produces a real1second stereoWAV. Cropping A re-analyzes the
  working buffer. B crop preserves exact floor/ceil behavior (49611frames at B's
  rendered sample rate), and A remains byte-identical.
- Real OfflineAudioContext Master Fix, fast measurement, manual output trim and
  reset produced three actual offline renders; B bytes change on adjustment.
- Original A WAV705636bytes SHA
  `d77052610a42b6111e37e0f6700dc382a8ff59238f85393042fed93a32e6e850`
  remains equal through B processing/cropping. WAV/MP3/M4A/WebM/report download;
  encoded outputs decode back to expected stereo geometry. OGG unsupported here.
  Chromium's M4A option is browser-codec MP4/Opus, NOT an AAC/Apple compatibility claim.
- Invalid decode preserves current source; clear disables unavailable operations.
  Nine real AudioContexts opened, all nine closed after pagehide; browser closed
  and its private runtime removed. Not a native Electron quit/IPC qualification.

### Measured cinematic motion / native panel transitions

Four actual layers advance naturally with distinct timelines/phase/transform:
212second image drift,212second far haze,158second mid light,116second near veil.
No accelerated screenshots, stopped/faked timelines, repainting background-position,
blur, duplicate scene renderer or playback-coupled decorative RAF was introduced.

Predeclared headless budget:5second idle samples, average≥30fps,95thframe≤50ms.
Measurements were taken without concurrent heavy unit suites:

| Actual viewport | Frames / elapsed | Avg fps | p95 frame | Worst frame | >50ms |
|---|---|---|---|---|---|
| 1120×700 | 297 /5016.37ms | 59.206 | 16.7ms | 83.27ms | 1 |
| 1480×920 | 301 /5016.41ms | 60.003 | 16.8ms | 16.8ms | 0 |

Both pass the declared budget; the single1120outlier is retained, not hidden.
Panel entry/exit were observed inside the activation's browser task, not a racy
CDP poll after a420ms effect:40–42frame traces contain real intermediate opacity,
transform, top-layer/display retirement and native focus restoration at BOTH
sizes. Escape dismisses; modal Space cannot toggle audio. Actual analysis/B/manual
and reference/region content changes activated surface animation events.

**Tooling limitation/failure investigation retained:** no installed system browser
was found. Rebuilt the already-approved external43package pinned toolkit
(Chromium153.0.0/Puppeteer25.14.0, integrity-audited, scripts disabled, no apt).
Default Sparticuz SwiftShader GPU emulation on this GPU-less VM produced long
raster/layer-retirement stalls: an early remote intermediate-opacity poll missed
its window; a same-task close trace later had a50.35second inter-frame gap.
These attempts are FAIL, not recategorized as passing. The declared compatible
`--cpu-renderer` alternative keeps the SAME browser/pins/network isolation/audio
and all natural animations, removes SwiftShader-only GPU args and uses Chromium
CPU raster. It passed both-size motion/live-panel/full-audio proof. This does not
certify a hardware GPU; no production or Electron browser flag was changed.
An initial2second playback fixture CDP pause race was also retained; observation
and real-button pause now execute together at the first native advanced frame.
A programmatic modal-origin focus issue was fixed in6a9369a, not waived in tests.

## Evidence / reproducibility

Main artifact directory:
`/home/user/reviews/music-on-verse-delivery-20261016/`.

- `browser/`: final20group PASS `report.json`, sixteen PNGs and twelve synthetic
  output files. `loaded-1120x700.png`, `loaded-1480x920.png`, their `-full.png`
  versions, open-panel and reduced-motion pairs are actual production captures.
- Clean install/test/sanity/build logs; broader working-tree test log; toolkit
  lock/manifest; source/protected-boundary and payload hash manifests; diff/patch.
- Compact delivery ZIP beside this directory, containing only review evidence and
  approved published source patch, NOT uncommitted held-core source, credentials,
  user audio, node_modules, browser binary or old missing historical captures.
- Earlier failed browser attempts remain separately under `/home/user/reviews/`
  and `/home/user/recovery/music-on-verse-20261016/`; final packet includes their
  reports for diagnosis, not fake passing labels.

Reproduce published Node checks on the fixed branch (after protecting local work):

```sh
npm ci --ignore-scripts --no-audit --no-fund
node --test $(git ls-files 'tests/**/*.test.js')
node scripts/test-analyze.mjs
npm run build
```

Opt-in trusted-synthetic browser proof, with separately provisioned approved
private toolkit and production preview on4173:

```sh
node scripts/validation/run-workbench-browser.mjs /tmp/onverse-browser-tools-... --cpu-renderer
```

The toolkit directory must be genuine/private0700 with exact approved pins; the
runner audits it. It restricts native environment/profile/extraction, allows only
local production/data/blob requests, and restores/removes private runtime in
finally. Its disabled-sandbox proof configuration is NEVER for real user media,
untrusted pages, production Electron or security acceptance.

## Remaining explicit limits

Vertical document scrolling is intentional: loaded content heights1015px/1076px
at1120×700/1480×920; full-page PNGs disclose all below-fold controls. Analysis
findings also have their own bounded scrolling region. No horizontal overflow.
Smaller secondary labels still warrant target-device readability/accessibility
review; no WCAG certification or product-owner reference-fidelity signoff.

No physical audio device listening, Mac/Electron/legacy build/signing/notarization,
native updater/IPC/security/release acceptance, provider lookup/preview access,
production session persistence/ownership/migration/recovery/undo, plugin hosting,
multitrack/mixer/library, power-loss qualification or SYLUNE execution was claimed.
Native main/preload, lock and processor remain exact-base; the protected native
window-title aesthetic change stays deferred rather than weakening proof pins.
Those limits do not block this recovered, published and genuinely booting browser
application or its independently verified existing workflows.
