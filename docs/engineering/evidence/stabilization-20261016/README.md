# Stabilization evidence — actual production, 2026-10-16

[Engineering result, root causes, scope and release gates](../../STABILIZATION_20261016.md).
[Source / image hashes and original-path mapping](SOURCE.json).

**Unmodified actual browser captures, not generated or reconstructed UI.**
Before: fresh replay of `deb5b2c` (20 groups, 12 downloads, 16 PNGs).
After: production app `f92fe04`, proof runner `5a1e10d`, final run **nLd2c5**
(22 groups, 13 downloads, 32 PNGs). Both PASS, using approved CPU raster on
headless Chromium153, synthetic audio only. Not physical-GPU, listening, Electron,
Mac, standards, native storage or security acceptance.

## Matched before/after at both viewport sizes

| Viewport | Before / real original A | After / same original A |
|---|---|---|
| 1120×700 | [Full page](before-loaded-1120x700-full.png) | [Full page](after-loaded-1120x700-full.png) |
| 1480×920 | [Full page](before-loaded-1480x920-full.png) | [Full page](after-loaded-1480x920-full.png) |

Structure, palette/assets and presentation source are unchanged. The loudness
readout/derived score changes because of the deliberate energy-sum correction.
Slow cosmic drift advances naturally between captures; no reference-fidelity
signoff, paused decorative timeline or pixel-identical environmental pose is claimed.

## Every final key state, both sizes

| Actual state | 1120×700 | 1480×920 |
|---|---|---|
| Empty / unavailable controls | [Full page](after-empty-1120x700-full.png) | [Full page](after-empty-1480x920-full.png) |
| Loaded original A | [Full page](after-loaded-1120x700-full.png) | [Full page](after-loaded-1480x920-full.png) |
| Rendered fixed B | [Full page](after-fixed-1120x700-full.png) | [Full page](after-fixed-1480x920-full.png) |
| Manual adjustment expanded / real changed B | [Full page](after-manual-adjusted-1120x700-full.png) | [Full page](after-manual-adjusted-1480x920-full.png) |
| Native limits panel | [Viewport](after-panel-open-1120x700.png) | [Viewport](after-panel-open-1480x920.png) |
| Reduced motion / native panel | [Viewport](after-reduced-motion-1120x700.png) | [Viewport](after-reduced-motion-1480x920.png) |
| Cropped fixed B / A intact | [Full page](after-fixed-cropped-1120x700-full.png) | [Full page](after-fixed-cropped-1480x920-full.png) |
| Invalid decode / last valid cropped A retained | [Full page](after-decode-error-preserved-1120x700-full.png) | [Full page](after-decode-error-preserved-1480x920-full.png) |

18 PNGs committed: two matched baseline full pages and one capture of each final
state/viewport. All were individually reviewed; intentional vertical scrolling
and bounded findings scrolling are not hidden by viewport-only claims. Raw runs
produced 16/32 PNGs respectively; remaining files and synthetic downloads remain
at the original local review paths recorded in SOURCE. Raw reports retain their
original filenames/output paths; use this table/SOURCE for the committed copies.

## Raw executed evidence

- [Before production report](before-report.json); [final production report](after-report.json).
- [Before strict: three original failures](before-strict-audio.txt);
  [original assertions now all pass](after-original-regressions.txt).
- [Clean 365-test suite](clean-tests.txt), [preserved-tree 555-test suite](final-working-tests.txt),
  [clean sanity](clean-sanity.txt), [clean build](clean-build.txt).
- [Encoder parity](mp3-parity.txt), [final processor / notices / error tests](final-processor-tests.txt).
- Reproduced before-fix failures: [recorder cleanup](before-recorder-cleanup.txt),
  [late disposal / B-crop publication](before-disposal-regressions.txt),
  [unavailable normalization evidence](before-normalization-evidence.txt).
- [ASAR payload byte/structure check](asar-check.json): not a native executable;
  the owned 33 MB probe archive was removed after verification, not released.
- [Production npm audit: zero](npm-audit-production.json),
  [full audit: 13 advisories / release gate](npm-audit.json),
  [Electron executable check blocked by failed binary download](electron-version.txt).

Final report includes 12 native actual-module render invariants, four native
pre-render rejections, real recorder constructor-failure cleanup, motion budgets,
focus/keyboard/reduced-motion observations, code hashes, real download hashes,
closed contexts and actual self-contained `file://` boot/import/analyze/WAV export.
The supplemental native-module bridge does not replace real root-UI verification
or certify LUFS/true-peak accuracy. No ordinary mock is labelled a native pass.

Captured `.txt` TAP logs preserve exact stdout bytes, including diagnostic padding.
A path-scoped `.gitattributes` whitespace exception covers only these raw outputs;
application/source whitespace checks and all assertions/tolerances are unchanged.
