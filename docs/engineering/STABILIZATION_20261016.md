# Final stabilization — 2026-10-16

**Implemented and verified; not a native/release or standards certification.**
This supersedes the three-TODO and bundle-warning status in the historical
[delivery report](DELIVERY_VERIFICATION_20261016.md). Approved presentation,
reference provenance, dependencies, native main/preload and packaging configuration
are unchanged. No UI rebuild, restored legacy UI, fake service, provider access or
unrelated held-core publication.

## Loudness: all three TODOs resolved

| Former TODO | Classification / cause | Fix / genuine verification |
|---|---|---|
| `analyze` right-channel inversion | Implementation defect: signed mono fold-down before squaring introduces cross-channel cancellation. The invariance assertion is valid. | Filter private copies of each channel independently, then sum window energies. Original assertion passes unchanged at `1e-6` dB. |
| `analyzeFast` right-channel inversion | Same implementation defect and shared helper; not an incorrect test assumption. | Same channel-energy helper; original assertion passes unchanged at `1e-6` dB. |
| `quickLufs` post-render cancellation | Same defect independently repeated by its mono fold-down; a false silence floor could request enormous trim. | Remove its fold-down; use the same helper. Original assertion passes unchanged. Twelve actual-module **native OfflineAudioContext** renders independently exercise real `masterFix` post-render trim. |

Before strict run: **47 tests, 44 pass, 3 fail**. The original suite now has
**47 pass, zero TODOs**; the TODO wrapper is removed, not bypassed or retoleranced.
New channel-energy tests cover 44.1/48/96 kHz mono snapshots, duplicated mono,
one active L/R, unequal and decorrelated channels, gain law and PCM immutability.

**Deliberate measurement semantics:** sum L/R energy with unit weights, never
signed samples or averaged channel power. `[x,-x]` equals `[x,x]`; duplicated
mono adds `10 log10(2) = 3.0102999566` relative to native mono; `[x,0]` equals mono.
Mono's existing numerical calibration is preserved. Stereo readings and derived
plans/scores consequently change; the screenshots' roughly -15.1 → -12.1 reading
is expected, not a presentation regression.

This remains the **existing ungated, approximate K-weighted estimate** with
complete nonoverlapping 100 ms windows and the existing numeric display floor.
It is **not BS.1770 integrated loudness**. Source comments now say so explicitly.
The isolated integrated-meter candidate was not blindly promoted: it has different
filters/gating, nullable evidence, restricted sample rates/layouts and a 30-second
research limit incompatible with the current production contract. Its proposal
and independent-reference work remain separate and unchanged.

Additional safety: reject non-finite PCM (including incomplete tails) and weighted
energy. Master Fix rejects non-finite targets, too-short, silent and floor-only
normalization evidence **before offline rendering**, and checks rendered evidence
again before trim. These are errors preserving source/prior B, not hidden unity
gain or fabricated normalization success. No arbitrary maximum-gain cap was chosen.

## Concrete failure-path defects also fixed

- **Recorder ownership:** construction/start/runtime/stop errors previously leaked
  resources or could leave the operation pending. Await stop/error together; cancel
  the timer, detach handlers, stop/disconnect source and tracks, close context on
  every exit. Empty output rejects. Cleanup attempts all releases and preserves
  the primary error as cause if cleanup also fails. Three startup regressions
  failed before the fix. Eight controlled tests now pass; a real unsupported-codec
  constructor failure also closes its native context and ends native tracks.
- **Disposal / cancellation boundary:** deferred render, remeasurement, full
  analysis, decode and conversion could publish after disposal; a late Master Fix
  could recreate playback. Five new regressions failed before the fix. Disposal
  now invalidates publication before awaiting close, invalidates tweak epochs,
  suppresses late effects and shares one close promise. Reference success/failure
  is also guarded. This **does not abort** in-flight computation or add a general
  cancellation/AbortSignal API or cancel control.
- **B-crop error preservation:** crop previously replaced B before remeasurement.
  Its new regression failed before the fix. Publish cropped B and its analysis
  together only after success; failure retains last valid B and A.

## Fresh verification

Node **22.22.3**; unchanged lock; clean Git archive of implementation
`f92fe04609cce2a007ee2f9535e14ea8eb221c87` with fresh scripts-disabled `npm ci`.
Follow-up `5a1e10d591bc46e0d8503cb8203f75709de35cd4` changes only the browser proof
runner to verify the actual production file origin; application/test cases and
build bytes remain identical. Final evidence/authority changes are documentation only.

| Executed check | Result |
|---|---|
| Full clean published-source suite, strict audio env | **365/365 pass; 0 fail / skip / cancelled / TODO** |
| Full preserved working-tree suite, strict audio env | **555/555 pass; 0 fail / skip / cancelled / TODO**; 190 additional cases are unpublished held core, not PR-only verification |
| Analyzer sanity and production build, clean and working | **PASS**; 20 modules; no chunk-size warning |
| Clean/served production HTML | Byte-identical SHA-256 `b316b5ab6328c9b7f65716ff4166cab18ef768e937d0416ec3d448ed7185cb83` |
| Final actual root production replay, `nLd2c5` | **PASS: 22 check groups, 13 downloads, 32 genuine PNGs**, no unexpected page/console/HTTP/blocked-request errors; intentional decoder failure retained |
| Both 1120×700 and 1480×920 | Empty, loaded A, fixed B, manual adjustment, native panel, reduced motion, cropped B and decode-error preservation; all layout checks pass |
| Native post-render invariants | **12 cases pass**: mono / aligned / inverted stereo, 44.1/48 kHz, -18/-24 achievable targets; original immutable, distinct finite output, exact geometry/polarity; maximum sample gain error `7.44e-9`, loudness target error `2.84e-7` (assertions remain `1e-6`) |
| Native unavailable-evidence rejection | Short/silent/below-floor/invalid-target cases reject before offline rendering; PCM unchanged |
| Resource audit | HTTP workflow + native error probe **10 contexts / 10 closes**, 15 offline renders (3 UI + 12 supplemental); actual file-origin decoder **1 / 1**; browser closed and private runtime removed |
| Actual `file://dist/index.html` | Boots, imports/measures synthetic WAV, exports byte-identical original A without external entry assets; **browser file origin, not Electron acceptance** |
| Native shell syntax and ASAR payload checks | `node --check` main/preload/notarize pass; installed production-dependency payload roundtrips ASAR with exact HTML/main/preload/notarize/package bytes. **Not an electron-builder-produced executable or Mac package** |

Real workflows include demo, import, measured file reference, built-in profile,
play/pause/seek/rate/Space, A–B, region export, Master Fix, manual trim/reset, A/B
crop, WAV/MP3 and available recorder conversions, report, invalid decode retaining
source, clear and pagehide cleanup. Original A WAV remains SHA-256
`d77052610a42b6111e37e0f6700dc382a8ff59238f85393042fed93a32e6e850`.
Actual MP3 output remains byte-identical before/after: 81,502 bytes, SHA-256
`9ed582c9d48a11bff0adc5cf4c4605ad08e1db2cec00921883a9c2e9d6886100`.
These are automated observations on synthetic PCM, **not actual listening**.

## Capture review — no presentation edits warranted

Reviewed the historical engineering report and actual prior captures, a fresh
`deb5b2c` baseline replay, and all eight final states at **both** target sizes.
No reproducible layout/interaction defect required presentation changes. Cosmic
composition, palette, layers, controls, assets, transitions, reduced motion and
reference pack are byte-unchanged. Intentional vertical document/issue scrolling
remains; horizontal overflow, horizontally clipped controls and broken images: zero.
Expanded manual controls remain reachable in genuine full-page captures.

[Before/after captures, complete state index, raw reports, logs and provenance](evidence/stabilization-20261016/README.md).
These are unchanged browser PNGs, not recreated UI or retouched reference matches.

CPU raster, same predeclared 5-second budget (average ≥30 FPS, p95 ≤50 ms):

| Viewport | Average FPS | p95 | Maximum | >50 ms frames |
|---|---:|---:|---:|---:|
| 1120×700 | 59.206 | 16.7 ms | 83.304 ms | 1 |
| 1480×920 | 59.803 | 16.7 ms | 33.3 ms | 0 |

Both pass; the long frame is disclosed, not waived or called sub-50 ms. This does
not resolve the previously recorded SwiftShader stall or qualify a physical GPU.

## Controlled bundle investigation

The raw self-contained `lame.all.js` string dominated the chunk. Use the **same
installed lamejs 1.2.1 package's `lame.min.js` distribution**, not a new encoder,
dependency, dynamic chunk or raised warning limit. Six deterministic byte-parity
cases cover mono/stereo at every exposed bitrate (128/192/320); notice-preservation
and actual browser encode/decode tests also pass. All nine upstream copyright /
license comment blocks and package LICENSE are retained as exact string data.

| Bytes | Before `deb5b2c` | Final |
|---|---:|---:|
| JavaScript chunk | 607,630 | **243,228** (60.0% smaller) |
| Self-contained HTML | 788,239 | **423,837** (46.2% smaller) |
| CSS | 179,986 | **179,986**, unchanged |

Vite JS gzip estimate: 147.82 → 85.31 kB. The >500 kB warning is genuinely gone;
self-contained local-file behavior is preserved and actually tested.

## Remaining defects / release gates — NOT passes

1. **Meter/normalizer qualification:** approximate weighting, no integrated gates,
   legacy display-floor/zero-target semantics, unvalidated multichannel weights;
   no accepted general maximum-positive-gain policy or target/peak conflict policy.
   Other spectral/pitch/noise paths still use mono fold-down. Existing interpolated
   “true peak” and sample-peak shaping are not reconstructed true-peak metrology /
   limiting. Three polarity TODOs are fixed, not the entire metering proposal.
2. **Electron/macOS execution and packaging:** Linux x64, no system Electron,
   Xvfb, codesign or hdiutil. Installed Electron CLI auto-attempted binary download
   and failed (`fetch failed`); no native smoke pass is claimed and it was not
   retried. ASAR roundtrip/file-origin proof do not qualify .app/DMG/ZIP, arm64/x64,
   legacy Electron 32, permissions, updater, signing, notarization, stapling or
   Gatekeeper. The owned 33 MB probe ASAR was removed after verification, not
   published as an installable release.
3. **Security/dependencies:** live npm audit: production **0** advisories; full
   dependency graph **13** (4 high / 9 moderate), including build tooling. No blind
   audit fix/downgrade, overrides or lock change. Native source review still flags
   broad `file://` navigation, updater IPC sender/frame validation, placeholder /
   override feed policy, absent CSP/static encoder `new Function`, and notarization
   skip/signature-output handling for native qualification. Isolation/sandbox flags
   being enabled are not a security pass. Resolve and validate before signed release.
4. **Human/target-device acceptance:** no physical listening, physical-GPU timing,
   Mac/Apple AAC interoperability, accessibility/contrast certification, provider
   previews, production session persistence/ownership/recovery/migration or SYLUNE
   execution. Browser M4A is browser-selected MP4/Opus here; OGG is unavailable.

## Scope, preservation and reproduction

Implementation changes: `src/audio/{analyzer,processor}.js`, exact upstream notice
data; workbench/analysis lifecycle/error guards; original regression TODO removal;
stereo, encoder-parity, recorder/error, normalization and disposal tests; test-only
native bridge and browser proof. **No** presentation/main/index/native/dependency/
model/storage/history/undo/IPC/provider contract changes or held-core integration.
The per-file evidence manifest records hashes and the before/after source boundary.
A path-scoped Git whitespace exception preserves verbatim captured TAP padding,
not application/source whitespace or weakened assertions.

Environment-refresh history was reconciled reversibly with exact published-tree
recovery `2c1ab8f` and normal merge `fffa979`; published ancestry is preserved.
No branch switch/reset/stash/clean/force-push/history rewrite; PR8 head/state are
preserved, with no merge or close.
Held files were backed up before edits and audited; AGENTS/queue publish only new
current-status prefixes, preserving their unrelated dirty bodies.

On the fixed branch `arena/14df8ffa-onverse`, PR4; read its exact final evidence
commit from Git (this document does not invent a self-referential commit hash):

```sh
npm ci --ignore-scripts --no-audit --no-fund
MUSICONVERSE_STRICT_AUDIO_REGRESSIONS=1 node --test $(git ls-files 'tests/**/*.test.js')
node scripts/test-analyze.mjs
npm run build
# Opt-in approved private 0700 Chromium153/Puppeteer25.14 toolkit; local build on4173:
node scripts/validation/run-workbench-browser.mjs /tmp/onverse-browser-tools-... --cpu-renderer
```

The toolkit is separately integrity-audited, scripts disabled, isolated environment,
synthetic-only and network-allowlisted. Disabled browser sandbox is **never** a
production Electron flag or permission to open user audio/untrusted pages in it.
