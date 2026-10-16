# Audio metering and validation contract — proposal

**Status:** CORE-004 review proposal, 2026-10-15. Not an implemented interface, an accepted standard-conformance claim, or permission to change automatic gain. Audited application snapshot: `7bcea1c8bb3f96a0fb15696eb44513e5d5bfcd70`. [Queue and delivery state](WORK_QUEUE.md). CORE-005 reference-tool execution and the CORE-006 isolated candidate are recorded in sections 11–12; the proposed application contract is still unaccepted and unimplemented.

## 1. Decision being proposed

Adopt independently validated, channel-aware integrated loudness and reconstructed true-peak measurement for **mono and L/R stereo at 44.1/48 kHz first**, before depending on those measurements for automatic gain. Do not ship another mono-cancellation patch under a standards-grade LUFS label while leaving the filters, gating, and gain safety ambiguous.

Recommended first step after review: a dependency-free, isolated loudness candidate and an explicitly approved independent reference-tool comparison. Do not connect a candidate to analysis, reference targets, scoring, or rendering until its tests and shared contract are accepted. Validate true peak separately; a meter does not make the existing limiter a true-peak limiter.

This proposes measurement semantics, not a JavaScript/native/TypeScript rewrite, runtime library selection, new dependency, colour change, or UI redesign. Standards editions, official conformance assets, executable provenance, and product approval remain gates in section 10.

## 2. Current implementation: audited, not endorsed

| Area | Actual code and consequence |
| --- | --- |
| Sample peak, RMS, crest, clipping | `timeDomain` in [`analyzer.js`](../../src/audio/analyzer.js) now examines channel samples. Peak is the largest absolute channel sample. RMS is mean channel/sample energy; clipping counts frames with any channel at `abs(sample) >= 0.9992`. These are PCM definitions, not loudness. |
| `lufs` | `measureLoudness` now receives channel data, applies the existing generic high-pass/shelf independently, sums per-channel energies into non-overlapping 100 ms blocks, and floors energy at `1e-12`. No absolute or relative loudness gate; partial trailing 100 ms blocks are omitted. This prevents L/R polarity cancellation but does not adopt the research candidate's filters/windows/status model. Additional channels use equal unit weights because no layout/LFE metadata is supplied; that is not a validated multichannel BS.1770 mapping. |
| Filters | Current shelf passes `1.0047` to `biquad`'s **dB** gain argument; the inspected libebur128 filter uses approximately **4 dB**, with its own coefficients/high-pass response. Changing channel energy alone cannot fix this difference. |
| Three consumers | Full analysis, fast analysis and `quickLufs` use that same loudness helper. Agreement among them proves consistency, not accuracy. |
| `truePeakDb` | `timeDomain` linearly interpolates **mono** at three points between adjacent samples; original sample positions are not explicitly included. Convex linear interpolation cannot reconstruct inter-sample overshoot. A one-frame signal produces no interpolation candidates. |
| Dynamic labels | `dynamicLufs` is a percentile span of the legacy 100 ms estimates; it is not validated EBU Loudness Range. Block dynamics are also mono-based. No LRA/short-term standards claim is authorized. |
| Gain generation | `buildFixPlan` derives gain from `g.lufs - f.lufs`; `masterFix` in [`processor.js`](../../src/audio/processor.js) measures again with `quickLufs`, applies another target trim and then `softLimit`. Both depend on the flawed loudness path. |
| Ceiling | `softLimit` is sample-domain shaping and allows up to `T * 1.06`; `ceilingProcess` in [`dsp.js`](../../src/audio/dsp.js) scales by sample peak. Neither establishes an inter-sample ceiling. Existing stage labels are not verification. |
| Reference/target consumers | `targetFromFeatures`, genre detection, `scoreAnalysis`, `buildIssues`, automatic plans, and the manual target offset depend on the measured values. `src/main.js` displays them in comparison cards/reports. These are migration boundaries, not files reserved by this task. |

**Audio-analysis stabilization note (2026-10-16):** full analysis, fast analysis and `quickLufs` now share channel-independent filtering and a unit-weight channel-energy sum. Regression fixtures verify that `[x, -x]` equals `[x, x]`, `[x, 0]` equals mono `x`, and duplicating `x` into stereo adds `10*log10(2)` (3.0103 LU) relative to mono; three-channel tests verify the current equal-weight sum without claiming a surround layout. A controlled processor test also exercises the `masterFix` post-render trim branch with anti-phase input; only the unavailable Node `OfflineAudioContext` renderer is stubbed, so this does not qualify native/browser rendering. The result field/API is unchanged, but stereo `lufs` readings and dependent scores/gain amounts can change versus the former arithmetic-mono path. This does **not** integrate the research-only CORE-006 candidate, fix the generic filter/gating/floor limitations, validate gain safety, or establish standards conformance.

**Current risk:** finite fabricated floor readings can drive very large gains. `Number.isFinite()` alone is not a sufficient validity check. This proposal does not disable that existing path; it identifies a safety prerequisite for a separately approved implementation. Avoid relying on automatic mastering for these edge cases in the meantime.

## 3. Definitions to preserve or introduce deliberately

### PCM metrics — retain the reviewed CORE-003 policy

For `C` channels and `N` frames:

- Sample peak: `max(abs(x[c][n]))` over every channel and frame, in dBFS using amplitude `20*log10(peak)`.
- PCM RMS: `sqrt(sum(x[c][n]^2) / (C*N))`, also amplitude dBFS. This is **averaged** channel energy.
- Crest: sample-peak dB minus PCM-RMS dB, when the denominator is nonzero. Silence must not become a meaningful dynamics score solely because two display floors subtract to zero.
- Clipping: existing threshold `0.9992`, inclusive, counting each affected **frame** once. Do not silently change this to a sum of clipped channel samples or a true-peak clipping count.
- CORE-003 compatibility applies to these PCM metrics. It must not force duplicated mono and stereo to have equal BS.1770-style loudness.

### Integrated loudness — proposed profile, not current `lufs`

Working profile name: **`mov-integrated-mono-stereo-v1-proposal`**. Freeze the normative edition and final identifier only after the reference review; do not advertise this temporary name as a supported product format.

1. Accept native mono or explicit left/right stereo; no implicit surround/LFE mapping. Initially validate 44,100 and 48,000 frames/second. Other layouts/rates may retain existing playback paths, but are unsupported for the proposed validated automatic normalization until tested.
2. Run an independently verified BS.1770 K-weighting filter on **each channel**, with separate filter state initialized once at stream start. Preserve that state across chunks. Do not reset filters at each loudness window or substitute the current generic shelf/high-pass.
3. Use complete **400 ms** gating windows with a **100 ms** hop (75% overlap), starting at the first PCM frame. For these two rates the frame counts are exact integers. Do not include incomplete trailing windows, invent full-window energy by zero-padding, or change source duration. Numerical boundary behavior must be checked against the pinned normative profile and oracle.
4. For each window, compute mean weighted squared samples per channel, then **sum** the L/R energies with unit weights. Mono has one unit-weight channel. There are no cross-channel product terms and no mono fold-down.
5. Window loudness: `-0.691 + 10*log10(windowEnergySum)`. First gate at **-70 LUFS**. Compute the mean energy of surviving windows, derive a relative gate **10 LU below** that preliminary loudness, and recompute integrated loudness from windows passing both gates. Gates operate on energies/windows, not a mean of LUFS numbers.
6. Proposed numerical convention includes equality at each threshold, matching the inspected reference implementations. Exact threshold comparison and floating-point handling remain a normative/conformance review item; do not hide disagreements by widening tolerances or moving fixtures away from the threshold.
7. No surviving window means **no valid integrated loudness**, not a finite floor. Inputs shorter than 400 ms have insufficient duration for this profile. The profile does not include momentary display, 3-second short-term loudness or LRA.
8. Full, fast and post-render paths must ultimately share one accepted definition. “Fast” may omit unrelated features, not silently change the loudness algorithm or skip gates.

**Mono/stereo consequence:** duplicating a mono waveform into two stereo channels adds `10*log10(2) = 3.0102999566 LU`, while `[x, -x]` and `[x, x]` have equal integrated loudness. `[x, 0]` has the same loudness as native mono `x`. Do not apply an implicit dual-mono playback correction. An explicit playback-aware dual-mono policy would be a separate product decision and profile, shared by both source and reference.

### True peak — separate proposed profile

- Unit: **dBTP**, not an interchangeable label for sample dBFS. Measure each channel without downmixing and take the maximum channel result.
- Use a validated reconstruction/oversampling filter with documented response, delay and gain. At the initial 44.1/48 kHz rates, at least 4x oversampling is a candidate, **not proof of accuracy**. Filter design and implementation selection require a separate mechanism POC.
- Explicitly include original sample magnitudes in the maximum. A finite non-silent result must never be below sample peak, aside from a declared rounding epsilon. Retain filter state across chunks; test peaks at chunk boundaries.
- Candidate boundary policy: zero extension outside the finite record, with full filter latency/tail flushing. Do not append this padding to the media or to loudness measurement. Pin identical boundary treatment for the independent comparison; endpoint spikes must not be silently discarded.
- A band-limited sine's analytic interior peak can validate a settled region, but is not necessarily the global peak of a finite, abruptly truncated record. Test start/end reconstruction separately.
- Do not assume a valid meter enforces an output ceiling. A limiter/ceiling implementation needs its own overshoot, delay, channel-linking, peak verification and rendered-output tests before using a “true-peak limited” claim.

## 4. Input, status and provenance rules

- Inspect finite PCM, positive integer frame count, equal channel lengths, supported sample rate/layout and metadata consistency. Samples outside `[-1,1]` are measurable floating-point PCM: report their level; never clamp or normalize them during analysis. Reject NaN/Infinity rather than produce a plausible number.
- All measurement is read-only. No source mutation, hidden resampling, upload or processing side effect. Unexpected failures propagate to the application boundary rather than becoming silence.
- Validity is **per metric**: a one-frame impulse has a sample peak but insufficient integrated-loudness duration. A long silent signal has no loudness above gate; it is not the same as invalid geometry, unsupported format or cancellation caused by a broken meter.
- Proposed conceptual states: `valid`, `insufficient-duration`, `below-gate`, `unsupported`, `invalid-input`, `failed`. This is not an added application enum/API. Define how application errors map to these before integration.
- Proposed evidence for a usable reading: value + unit + status/reason + accepted algorithm/profile version + rate/layout + measured frame range. Preserve source/reference provenance and whether the target is a measured excerpt or a chosen heuristic goal. No mandatory schema is being installed here.
- Represent unavailable dB values as explicit absent/null evidence with a reason when serializing. Never route `NaN`, infinity, a display floor, or a substituted zero into gain calculations. Silence's mathematical `-Infinity` is not a valid numeric target. Display formatting belongs to an approved presentation layer.
- Cache/reuse only readings with compatible algorithm, input revision, channel/playback policy and analyzed range. Reanalyze legacy measured references; do not compare a new reading to cached legacy `lufs` as though the units alone establish comparability.

## 5. Automatic-gain and output safety contract — proposed, not enforced yet

1. A measurement-driven gain operation requires valid source evidence and a deliberate finite target in LUFS. Measured reference targets require compatible accepted measurement evidence; manually chosen/profile targets must be identified as goals, not invented measurements.
2. For invalid, below-gate, too-short, unsupported, failed or legacy-unvalidated evidence: produce **no automatic gain plan**. Preserve source/playback; report why normalization is unavailable. Do not silently boost, clamp a nonsensical request, substitute unity while claiming success, or block ordinary playback merely because analysis is unavailable.
3. Target delta is `targetLUFS - sourceLUFS`, with `10^(delta/20)` as the linear amplitude ratio. Product-approved maximum positive gain and allowed target range must be explicit and validated before rendering. Exceeding a bound requires a deliberate review/error result, not hidden saturation. No arbitrary cap is selected or installed by this document.
4. Avoid uncontrolled compounded gain: the current initial gain and post-render correction must be accounted for in one explainable plan. Manual trim, EQ, compression, width and peak constraints can alter the final measurement. Do not promise exact loudness merely because a pre-limiter scalar matched it.
5. Before applying a proposed linear gain, compare predicted true peak against the chosen ceiling. If target and ceiling cannot both be met by linear gain, expose the conflict. Additional dynamics processing requires an explicit approved plan, not an implicit license for distortion.
6. Remeasure the actual rendered PCM after the last gain/limiter step with the same accepted profile. Report achieved loudness and true peak, deviations and constraints; a failed measurement cannot produce a “matched/safer” success claim. Lossy exports may alter peaks and require separate decoded-output checks for delivery guarantees.
7. Never process the active original in place. Candidate rendering/integration tests must verify read-only originals, cancellation/errors, adjustable approval, and preview A/B with controlled level matching. Those workflows are not implemented by this proposal.

## 6. Executed diagnostics on the current real analyzer

Existing deterministic PCM helper, 48 kHz, usually 24,000 frames (0.5 s), 1 kHz, amplitude 0.5. Figures below are observed **legacy outputs**, not desired calibrated results. Full analysis, fast analysis and `quickLufs` agreed exactly on loudness for all **12 cases**; source PCM was unchanged in every case. No browser render, decoder or independent meter was executed.

| Case | Legacy loudness | Sample peak | Legacy “true peak” | What this establishes |
| --- | ---: | ---: | ---: | --- |
| Native mono | -9.611351 | -6.020600 | -6.039197 | Legacy interpolation already falls below sample peak. |
| Stereo `[x,x]` | -9.611351 | -6.020600 | -6.039197 | Duplicated mono does not gain the proposed 3.0103 LU. |
| Stereo `[x,-x]` | -120.691000 | -6.020600 | -240.000000 | Loudness and true peak cancel, while corrected PCM peak/RMS remain valid. |
| Stereo `[0,x]` | -15.631951 | -6.020600 | -12.059797 | Mono averaging attenuates a valid active channel. |
| Silence | -120.691000 | -240.000000 | -240.000000 | Numeric display floors are not meaningful valid loudness evidence. |
| One frame `[1]` | -120.691000 | 0.000000 | -240.000000 | Peak exists; interpolation has no candidates; loudness is too short. |
| First-frame impulse, 24,000 frames | -43.566536 | 0.000000 | -2.498775 | Boundary sample peak is missed by interpolation. |
| 12 kHz, phase pi/4, amplitude 0.9 | -3.611908 | -3.925450 | -3.925450 | No reconstructed inter-sample rise; underlying steady-state sine's interior peak is -0.915150 dB. |
| 4,799 frames | -120.691000 | -6.020600 | -6.039197 | A one-frame change across the legacy 100 ms boundary causes a fabricated-floor discontinuity. |
| 4,800 frames | -9.612027 | -6.020600 | -6.039197 | Current code emits a number before one 400 ms window exists. |
| 19,199 frames | -9.611464 | -6.020600 | -6.039197 | Still insufficient duration under the proposed integrated profile. |
| 19,200 frames | -9.611394 | -6.020600 | -6.039197 | Exactly one proposed 400 ms window; gating/filters still need validation. |

For the opposite-polarity case and a diagnostic `-14` LUFS goal, real `buildFixPlan` returned gain **216271.852372702** (its issue directive rounds the dB amount). Applying the current post-render trim *formula* to that unrendered signal implies **106.691 dB**, or **216047.8754765718x**. These are separate observations, not a claim that a rendered output has that gain or that both factors should be multiplied. Rendering was deliberately not attempted.

Temporary source copies and diagnostic JSON were kept outside Git under `/tmp/musiconverse-metering-audit`; only this report is durable. These checks diagnose the current mechanism, not a replacement implementation's conformance.

### Reproduce the core risk without a browser or new dependency

Run in this repository using its existing Node/fixture setup. This read-only diagnostic does not change application behavior:

```bash
node --input-type=module <<'JS'
import assert from 'node:assert/strict'
import { createToneBuffer } from './tests/fixtures/audioBuffers.js'
import { analysisService } from './src/application/analysis/analysisService.js'
import { quickLufs, buildFixPlan, targetFromFeatures } from './src/audio/analyzer.js'
for (const channelGains of [[1], [1, 1], [1, -1], [0, 1]]) {
  const buffer = createToneBuffer({ channelGains })
  const copies = channelGains.map((_, c) => buffer.getChannelData(c).slice())
  const full = await analysisService.analyze(buffer)
  const fast = await analysisService.analyzeFast(buffer)
  assert.equal(full.lufs, fast.lufs)
  assert.equal(full.lufs, quickLufs(buffer))
  copies.forEach((pcm, c) => assert.deepEqual(buffer.getChannelData(c), pcm))
  const target = { ...targetFromFeatures(full), lufs: -14 }
  console.log({ channelGains, lufs: full.lufs, peakDb: full.peakDb,
    truePeakDb: full.truePeakDb, proposedGain: buildFixPlan(full, target).gain })
}
JS
```

## 7. Validation matrix and proposed numerical gates

Analytical relationships and a shared implementation's internal consistency are necessary, not sufficient. Expected **absolute** LUFS/dBTP must come from approved official vectors and a pinned independent meter, not from today's incorrect analyzer or golden snapshots of the candidate itself.

| Validation group | Required fixtures/checks |
| --- | --- |
| PCM controls | Silence, positive/negative impulses at first/last/chunk-boundary frames, unequal stereo, clipped overlap, values beyond full scale. Preserve CORE-003 PCM definitions and source immutability. |
| Channel policy | Mono, `[x,0]`, `[0,x]`, `[x,x]`, `[x,-x]`, swapped L/R and sign-flipped channels. Verify unit-weight channel-energy relations without averaging channels first. Explicitly refuse unsupported layout. |
| Weighting | Long settled tones at 20/38/100/1,000/4,000/12,000 Hz, both supported rates; compare transient and steady-state behavior. Catch shelf gain/unit errors and high-pass coefficient substitution. |
| Gating | All below absolute gate; windows just above/below/equal each gate; loud/quiet programme segments, long silence before/after programme. Compare exact window alignment/relative-gate energy calculation, not only a continuous tone. |
| Duration/framing | 1 frame; 100 ms minus/equal/plus one frame; 400 ms minus/equal/plus one frame; incomplete last hop; chunk sizes 1/127/128/4096/full length. Chunking must not change results or filter continuity. |
| True peak | Low-frequency controls, high-frequency phase sweeps including the 12 kHz/pi/4 sine, near-Nyquist cases, anti-polarity stereo, endpoint/chunk impulses, finite-record tails. Compare sample lower bound and a pinned reconstruction boundary policy. |
| Errors/limits | NaN/Infinity, mismatched channel lengths, zero length, invalid rate, unsupported layout, very quiet valid values, silence, huge requested gain, incompatible/old reference evidence and non-finite targets. Never generate unsafe automatic gain from missing/invalid evidence. |
| Output integration | Pure gain with achievable target/ceiling; deliberately conflicting target/ceiling; compression/EQ/width/manual-trim combinations; original unchanged; final rendered loudness/peak measurement; decode/export tests separately. |

Provisional engineering tolerances, **not advertised normative compliance limits**:

- PCM peak/RMS/crest analytical comparisons: `1e-6 dB` absolute for ordinary nonzero fixtures; counts and statuses exact. Existing legacy silence floors are not valid new loudness expectations.
- Channel-policy loudness differences: `1e-4 LU` absolute on matched non-boundary fixtures. Integrated loudness against independent reference: `0.1 LU` absolute or stricter if the official fixture requires it.
- True peak: target `0.1 dB` absolute on ordinary vectors, `0.2 dB` on declared stress cases, subject to official test requirements. Include cases where overshoot must be detected; do not grant a one-sided tolerance that hides under-reading. Exact lower bound `truePeak >= samplePeak` is enforced in linear amplitude before display rounding.
- One-shot/chunked candidate runs: same status, same counts, and within `1e-6` in the applicable dB/LU units. A chunk-boundary failure blocks integration.
- Zero/near-zero cases use explicit status and linear-domain checks, not subtraction of infinities. If independent tools disagree, investigate filters, precision, windows, input decoding/layout, gates and tails before adopting any tolerance change.

## 8. Independent reference plan and provenance

**At the CORE-004 audit:** git/gh/Node/Python and gcc were available; `ffmpeg`, `ffprobe` and `ebur128` were not on PATH. No tool was compiled for that documentation task. CORE-005 subsequently received explicit test-only dependency approval and built the external library harness described in section 11. No system/app package was installed and no audio was uploaded. Source inspection alone is not numerical validation.

Pinned implementation sources inspected:

1. [libebur128 source](https://github.com/jiixyj/libebur128/blob/67b33abe1558160ed76ada1322329b0e9e058b02/ebur128/ebur128.c), [API](https://github.com/jiixyj/libebur128/blob/67b33abe1558160ed76ada1322329b0e9e058b02/ebur128/ebur128.h), [README](https://github.com/jiixyj/libebur128/blob/67b33abe1558160ed76ada1322329b0e9e058b02/README.md), [MIT license](https://github.com/jiixyj/libebur128/blob/67b33abe1558160ed76ada1322329b0e9e058b02/COPYING). Commit `67b33abe1558160ed76ada1322329b0e9e058b02`, API version 1.2.6. Reviewed filter initialization, channel maps, 400 ms initial window, absolute/relative gating, no-reading behavior, and polyphase FIR true-peak documentation. Default channel maps are **not** permission to infer application surround layout.
2. [FFmpeg `ebur128` source](https://github.com/FFmpeg/FFmpeg/blob/140fd653aed8cad774f991ba083e2d01e86420c7/libavfilter/f_ebur128.c) and [filter documentation](https://github.com/FFmpeg/FFmpeg/blob/140fd653aed8cad774f991ba083e2d01e86420c7/doc/filters.texi). Tag `n8.0` resolves to commit `140fd653aed8cad774f991ba083e2d01e86420c7`. Reviewed overlapping gating, separate peak modes, default-off dual-mono option, 400 ms/3 s distinction, and libswresample requirement for true peak. This is a reproducible reference pin, not a claim about the newest release.

No implementation is selected for product distribution. The main library is MIT; the subsequently inspected bundled queue header carries a BSD-3-Clause notice. Both notices are retained in the external source tree. Copying source into the app, bundling a binary or adding a runtime library still requires an explicit dependency/security/licensing decision. A test-only external tool does not automatically become a production dependency.

For the next POC, recommend **a test-only libebur128 1.2.6 reference harness**, built from the pinned MIT-licensed source with the existing compiler after explicit approval, outside the app and without adding an npm/runtime dependency. This is smaller than building FFmpeg just for this task and can expose unrounded numerical results. Record source hashes, compiler/version/flags, library mode, channel mapping, frame feeding and tail policy. FFmpeg is an optional second cross-check, not another required install. Independently generated float32 PCM fixtures should be delivered as explicit-layout float WAV or raw interleaved PCM with declared rate/channel layout. Do not use lossy encoding or implicit resampling to establish meter correctness. Capture fixture recipe/hash, analyzed range, oracle invocation, full-precision result, candidate result, difference and status. Approval of this reference harness would not approve bundling libebur128 in the product.

An example future reference invocation is `ffmpeg -hide_banner -nostats -i fixture.wav -af ebur128=peak=sample+true:dualmono=false -f null -`. **Not executed here.** Verify pinned-version options, precision, complete-window/tail handling and build support first. Human-readable rounded output alone cannot validate `1e-4 LU` channel relationships; do not parse it as full precision. Add official vectors or a separately pinned high-precision library harness before claiming that level of oracle precision.

Normative targets to obtain and review before claiming conformance: the explicitly selected ITU-R BS.1770 edition and applicable EBU metering/test specifications (including Tech 3341 and its test material). This environment's network allowlist does not provide direct ITU/EBU access; no current edition, official normative text, tolerance classification or vector-license verification is claimed. The inspected open-source implementations support this proposal's direction but do not replace those normative sources. Retain a checksum and redistribution permission for any conformance assets; do not commit large audio packs by default.

## 9. Compatibility and staged implementation boundaries

- Existing result shapes and callers remain unchanged in this task. Future validity/provenance cannot be silently bolted onto old numeric fields while UI code calls `toFixed()` or processors consume them without checks. Design and review an adapter/result contract with affected consumers first.
- Keep pure meter code separate from render/scoring/reference policy. A single small local module plus focused fixtures/tests is sufficient for the candidate; no worker system, native host, microservice or broad controller rewrite is justified.
- Cache/reference migration must invalidate or remeasure legacy readings; versioned measurement provenance is not a request for a project-storage rewrite. Static genre numbers remain heuristic goals, not evidence of measured platform catalogues or guaranteed platform normalization behavior.
- Preserve unrelated spectral/tempo/pitch/block-dynamics algorithms during meter work. Address their cancellation/accuracy issues separately rather than broadening an accepted loudness task.
- Codex must receive the accepted shared interface via the queue/PR before implementation depends on it. This proposal reserves no UI/controller file and approves no design. Publication of a document does not dispatch a worker.

## 10. Review gates and next bounded unit

**Recommendation for owner review:** accept the direction of conventional mono/LR energy-summed, gated integrated loudness, with explicit invalid/unsupported evidence and automatic-gain refusal when measurements are unusable. Do not preserve the legacy absolute values for compatibility. Approve the validation tool separately; choose automatic-gain bounds before enabling normalization.

1. **Contract review:** confirm native-mono versus playback-dual-mono semantics, initial format scope, result/validity migration and fail-closed automatic-gain behavior. The proposed status/evidence shape is not yet an accepted shared API.
2. **Independent oracle availability:** approve how to supply a pinned test-only meter; inspect licensing/security/provenance. Resolve normative edition, official-vector availability/licensing, gate equality and boundary policy. No silent dependency installation.
3. **Isolated loudness POC:** implement only a pure candidate plus fixture/comparison harness on exact assigned paths after permission. Exercise actual per-channel filters, overlapping windows and gates. Resolve discrepancies and demonstrate silent/short/unsupported behavior before any production consumer uses it.
4. **Separate true-peak POC:** select/test reconstruction mechanism, endpoints, filter-state continuity and inter-sample overshoot. It must pass its own validation before ceiling or limiter claims are revised.
5. **Integration review:** specify affected analyzer/quick-loudness/reference/plan/processor callers, reject legacy evidence for automatic gain, preserve originals and failures, and coordinate any required UI representation with Codex. Obtain explicit task scope before edits.
6. **Release verification:** check final rendered/exported audio, real browser/macOS workflows, performance/cancellation and level-matched listening. Product-owner testing remains deferred; no document or synthetic pass substitutes for it. No automatic merge.

**Stop point for CORE-004:** proposal and current-mechanism evidence only. No replacement DSP, oracle comparison, limiter fix, application contract change, or downstream implementation is complete or authorized by this result.

## 11. CORE-005 — approved external reference-tool execution

### Scope and reproducibility

The owner explicitly approved the pinned test-only libebur128 harness. This executes a separate numerical implementation, **not a replacement candidate or app integration**. Production meter/gain/limiter code and existing test fixtures remain unchanged. The earlier CORE-004 source-only limitations are historical; normative conformance and application-contract review gates still apply.

Files added:

- [`libebur128-reference.c`](../../scripts/validation/libebur128-reference.c): small CLI adapter, explicit native-mono center / stereo L/R maps, raw little-endian interleaved float32 reader, supported-rate/layout and length checks, no input resampling. Mode `EBUR128_MODE_I | EBUR128_MODE_TRUE_PEAK`, no histogram/dual-mono correction. Test input limit: 30 seconds.
- [`run-metering-reference.mjs`](../../scripts/validation/run-metering-reference.mjs): explicit fetch or offline mode, SHA-256 verification before compilation, verified-byte staging in a fresh external temporary directory, compiler/version/flag capture, machine-readable report, analytical/negative/chunk/tail checks. Refuses source/temp directories inside the repository. Uses argument-array process calls, not shell evaluation.
- [`meteringReferenceCases.js`](../../tests/fixtures/meteringReferenceCases.js): 56 deterministic PCM recipes at 44.1/48 kHz. No downloaded audio, randomness, decoding or candidate-derived expected values. Records both PCM hash and recipe/rate/layout/frame hash to distinguish identical bytes interpreted at different rates.

Download, compilation, object files, native executable, PCM and full JSON are kept outside Git under fresh `/tmp/musiconverse-reference-*` directories. Original MIT COPYING and BSD-3-Clause queue-header notice are retained. No npm/lock/config/Electron/runtime change or executable download. The compiler is the existing gcc; no installer or third-party build script is run. The adapter is not referenced by production imports and the existing package includes only `dist`/`electron` for distribution.

Reproduce only when a compatible existing compiler and Node are available; fetch mode also requires existing working `gh` access:

```bash
node scripts/validation/run-metering-reference.mjs --fetch > /tmp/musiconverse-reference.json
```

The script prints its external build directory to stderr. To rerun without network, point at that directory's `source` child (replace the example path with the actual reported path):

```bash
node scripts/validation/run-metering-reference.mjs --source-dir /tmp/musiconverse-reference-EXAMPLE/source > /tmp/musiconverse-reference-offline.json
```

No sources are silently fetched without `--fetch`; no missing compiler is silently installed. Unknown/combined CLI modes, in-repository temp/source destinations, source hash mismatch and missing compiler fail nonzero without successful JSON. Scratch output is not preserved across machines/snapshots; the scripts, pinned hashes, recipes and snapshot below are the durable evidence. Do not redistribute the external binary without retaining its notices and reviewing the intended distribution.

### Verified source hashes

| Source at the pinned libebur128 commit | SHA-256 |
| --- | --- |
| `ebur128/ebur128.c` | `c2fc562f1088cacab4d21250b6e04996ef36c7694ea901e08cc4d64eb542b78d` |
| `ebur128/ebur128.h` | `a988fa03828bcdd6258e6c52300d709a58727272a9ce6cd3fbf351f090517111` |
| `ebur128/queue/sys/queue.h` | `8b284031772b1ba2035d9b05b24f2cb9b23e7bd324bcccb5e3fcc57d34aafa48` |
| `COPYING` | `d6b4754bb67bdd08b97d5d11b2d7434997a371585a78fe77007149df3af8d09c` |

Toolchain actually run: gcc 12.2.0 (Debian), Node v22.22.3, Linux x64. Common flags: `-std=c99 -D_GNU_SOURCE -O2 -Wall -Wextra`; local adapter additionally compiled with **`-Werror`**. Compiler invocations and local-code hashes are captured in the JSON report. macOS/other compiler execution is not claimed.

**Failure and root cause retained:** the first attempt applied `-Werror` to upstream too and failed on its existing `errcode` variable in `interp_create` being set but unused. Upstream remains byte-for-byte pinned. Compiling it separately reports that warning to stderr and the report's diagnostics; the local adapter still uses warnings-as-errors. This is not a silently swallowed compiler failure or a source patch.

### Executed verification

Per final reference run:

- **56 fixtures**, each measured at one-shot and chunk sizes 1, 127 and 4096 (duplicate sizes removed): **222 chunking measurement runs**.
- **56 additional tail checks**, **278 total positive reference invocations**. Integrated loudness is captured at the original end before any padding. Peak measurement then flushes 64 zero input frames; an independent 128-frame flush agrees in linear peak within `1e-12`, with captured loudness unchanged. Zero extension never changes the source file/duration or loudness window set.
- **25 negative checks**: missing/invalid args, unsupported layout/rate, zero/negative/oversized geometry/chunk/tail values, missing/truncated/extra/nonfinite PCM, unknown/combined runner modes, source/temp location rejection, corrupted source hash and missing compiler.
- **20 analytical controls** for mono/stereo summed energy, polarity, left/right-only, unequal channels, amplitude gain law, nonzero inter-sample rise and silent peaks.
- Chunk parity within `1e-6` dB/LU; channel relationships within `1e-4 LU`; exact sample-peak and status checks; every fixture's PCM unchanged.
- **Fetched and offline builds both passed**, with identical verified source/local-code hashes, normalized compiler provenance, complete measurement records and summaries. No output difference was hidden by rounding.
- Separately compared **12 byte-identical fixture buffers** with the current full/fast/quick analyzer paths, matching PCM hashes to the reference report. Three legacy entry points agree but have the defects shown below; these are diagnostic differences, not passing meter-accuracy tests.

### Matched-current versus reference readings

Values rounded here for readability. The four ordinary tone cases below are 2 seconds, 1 kHz, amplitude 0.5; silence is 1 second, and the phase case is 2 seconds at one quarter sample rate with amplitude 0.9, phase pi/4. These are **not** the earlier 0.5-second diagnostics.

| Fixture | Current legacy loudness | External reference LUFS | Current legacy “true peak” | External reference dBTP |
| --- | ---: | ---: | ---: | ---: |
| `44100-mono` | -9.611416 | -9.021456 | -6.037187 | -6.015612 |
| `44100-stereo` | -9.611416 | -6.011156 | -6.037187 | -6.015612 |
| `44100-inverted` | -120.691000 | -6.011156 | -240.000000 | -6.015612 |
| `44100-right-only` | -15.632016 | -9.021456 | -12.057787 | -6.015612 |
| `44100-silence` | -120.691000 | unavailable | -240.000000 | unavailable |
| `44100-phase-quarter-rate` | -3.611964 | -0.570137 | -3.925450 | -0.811624 |
| `48000-mono` | -9.611225 | -9.024213 | -6.039197 | -6.020600 |
| `48000-stereo` | -9.611225 | -6.013913 | -6.039197 | -6.020600 |
| `48000-inverted` | -120.691000 | -6.013913 | -240.000000 | -6.020600 |
| `48000-right-only` | -15.631824 | -9.024213 | -12.059797 | -6.020600 |
| `48000-silence` | -120.691000 | unavailable | -240.000000 | unavailable |
| `48000-phase-quarter-rate` | -3.611902 | -0.573787 | -3.925450 | -0.811624 |

The reconstructed peak of the abruptly truncated phased sine is about `-0.811624 dBTP`, not its infinite steady-state interior value `-0.915150 dB`. This is why endpoint policy must be included in comparisons rather than treating a finite-record analytic interior value as global truth. The mono/stereo loudness change and cancelled-channel defect are confirmed on identical bytes, not inferred from differing durations or source files.

### Complete reference snapshot

These are full-precision libebur128 outputs for these recipes/toolchain, **not official conformance targets**. `unavailable` is serialized as JSON null with an explicit status; there are no fabricated silent loudness floors. Fixture IDs ending `duration-...-0/1/2` mean minus-one/equal/plus-one frame around that duration. Exact geometry/recipes and both hashes are emitted by the runner; the PCM hash below identifies the measured bytes independently of the candidate.

| Fixture | Loudness status | LUFS | Sample dBFS | Reconstructed dBTP | PCM SHA-256 |
| --- | --- | ---: | ---: | ---: | --- |
| `44100-mono` | valid | -9.021455731040195 | -6.020654791705829 | -6.015611566715419 | `34520200b3d8e9c8b0826b5baaed7b038204cc0e8a6037c72a4bf3dbfd126ca1` |
| `44100-stereo` | valid | -6.0111557744003825 | -6.020654791705829 | -6.015611566715419 | `61c582d36c958a2609de67d7a1eab87fb815e941b185796641dcf5058a5fe050` |
| `44100-inverted` | valid | -6.0111557744003825 | -6.020654791705829 | -6.015611566715419 | `4045d010a218b5d567a3db415729be9c8bfc45bc8f8a127245336419bb43ac2b` |
| `44100-left-only` | valid | -9.021455731040195 | -6.020654791705829 | -6.015611566715419 | `e8f2e081dad73f296fbf167ffa7b655f44e1cbbc5823917f69b0f814c73dab92` |
| `44100-right-only` | valid | -9.021455731040195 | -6.020654791705829 | -6.015611566715419 | `b8721c2cbf633b0c79766bca0ef22c7cb7fc5a09d4ec44bc8b2e0e9420da03de` |
| `44100-unequal` | valid | -8.05235560095963 | -6.020654791705829 | -6.015611566715419 | `549fc95d4edd634ae0624503b81a36b96c456eca508bd22a451e6f9e821401be` |
| `44100-half-amplitude` | valid | -15.042055644319818 | -12.041254704985453 | -12.036211479995043 | `a0b44d036c60f69fac0d2b085214e61732db37deb6106d2f817b12463fda3cdc` |
| `44100-silence` | below-gate | unavailable | unavailable | unavailable | `315dac7153580b1c3862e28582b24231b6211b4debcbf41d16cd365ce1a4a80c` |
| `44100-below-gate` | below-gate | unavailable | -100.00005472801362 | -99.99501136718615 | `3327ccb2206d2eb014191d169ee2325bd3626e224e40d6705e76101db4e42b0c` |
| `44100-over-full-scale` | valid | -1.417230910216944 | 1.5835700425262909 | 1.5886129225686119 | `904625f2d7b5fe69472101dd988df789037ca9c4a73efa94ccdfa156992b6205` |
| `44100-phase-quarter-rate` | valid | -0.5701370537940147 | -3.925449672450734 | -0.8116244457013354 | `4fa17462fd28c9d6bef69ca53ee95bede1cc290eae3f17ddda597d8713fdebd9` |
| `44100-weight-20` | valid | -22.9945667372924 | -6.020601984157336 | -6.012750693569178 | `774f44183621439ffbce84380a2f0148a952e2f726e2da89f82c398b2f790ac3` |
| `44100-weight-38` | valid | -15.723087296827098 | -6.020599913279624 | -6.012751728072695 | `8aa93cd8508a77f7e7119f7670e7baac774604fc4d6d79a1c6526d90a9e7f7cd` |
| `44100-weight-100` | valid | -10.853222133261761 | -6.020654791705829 | -6.012831385213525 | `6b7cab97d1e2e127a9808750598bc0fc597a9ad54eaec6fac1a97b3b47750376` |
| `44100-weight-4000` | valid | -5.749040940529642 | -6.020654791705829 | -6.020654791705829 | `1bcdc6d437589846717c69036bd946239aeab749f5ef058efe071dd97869fa56` |
| `44100-weight-12000` | valid | -5.675332087208588 | -6.021095902593609 | -5.862069818620302 | `ff00b010bb9fda7efec005d99b0885d5091a46c4427fd470ba80a515639f8f4d` |
| `44100-duration-100ms-0` | insufficient-duration | unavailable | -6.020654791705829 | -6.015611566715419 | `e2001dcaebc34ce2669929a3ceb702ec31b3f187a2ee506e7d59e28d42afd265` |
| `44100-duration-100ms-1` | insufficient-duration | unavailable | -6.020654791705829 | -6.015611566715419 | `d6cba80263d14e3f523032da07c6c3775815a26f38ea0987246a73044fde2bdf` |
| `44100-duration-100ms-2` | insufficient-duration | unavailable | -6.020654791705829 | -6.015611566715419 | `ebb3b5262562bd51cc67e575e45db72f1fe75c0c9ea564794613b113371a619e` |
| `44100-duration-400ms-0` | insufficient-duration | unavailable | -6.020654791705829 | -6.015611566715419 | `ba9e1154c396b4da856ee48abb4d06732f2608744a300d55039cebe53686071c` |
| `44100-duration-400ms-1` | valid | -9.021737776480375 | -6.020654791705829 | -6.015611566715419 | `3ccc4cff2e73f9cb2d4b0123d7f9040bffbe61b477c23d38a247bc73d07a44a5` |
| `44100-duration-400ms-2` | valid | -9.021737776480375 | -6.020654791705829 | -6.015611566715419 | `380a4af4dd81b5150509c1420629fb849ef7af51c97ff42933a2f23ade6ee0a7` |
| `44100-single-frame` | insufficient-duration | unavailable | 0 | 0 | `e00e5eb9444182f352323374ef4e08ebcb784725fdd4fd612d7730540b3e0c8c` |
| `44100-impulse-first` | valid | -39.34230747762522 | 0 | 0 | `96e1d0920127f2bd9b1eeedd9b93e892b9973dd89553fa952e72f49c023b58bb` |
| `44100-impulse-last` | valid | -39.457382797240335 | 0 | 0 | `093a2b5a30df4a70d89f7430cdc24860260aeb011f4a1bfc85ebe7368b7d25a5` |
| `44100-impulse-chunk-boundary` | valid | -39.34230747762522 | 0 | 0 | `1d6cfcf286199b2f67ffb02dd1f718b3d14c8775172af99a126f147bb6e82133` |
| `44100-programme-with-silence` | valid | -9.62844107192683 | -6.020654791705829 | -6.015611566715419 | `b0d177a6d43d9bbb9075f6e8c1c1ed80fa9e4ce6e4bc0b3172a45660b7d88911` |
| `44100-programme-with-quiet` | valid | -9.359963427345598 | -6.020654791705829 | -6.015611566715419 | `41c2d8ad80c96830bedf637aa0362db555109e53abac8bb24b6397df15d55e0e` |
| `48000-mono` | valid | -9.024213185970961 | -6.020599913279624 | -6.020599913279624 | `548ecd5b2120e652e3b8d3f8bb493c37bab4b58ff399190b4f0bf1cd8c837ca3` |
| `48000-stereo` | valid | -6.013913229331148 | -6.020599913279624 | -6.020599913279624 | `9ceb59724b75bee1700beffcf7fbc0eb819a314c56929d61b0519c1532e90e9f` |
| `48000-inverted` | valid | -6.013913229331148 | -6.020599913279624 | -6.020599913279624 | `2d850a360fb2e37da436749135e77722ab5e83e1438b8dd410479801edcb8655` |
| `48000-left-only` | valid | -9.024213185970961 | -6.020599913279624 | -6.020599913279624 | `8f832c4cc4aff462152dd7e2c786c7f5ed0d480c4d482ad59824a1ea6a703976` |
| `48000-right-only` | valid | -9.024213185970961 | -6.020599913279624 | -6.020599913279624 | `6e66f6076aa4f2c5b791342bc40c70dcad800766332ebaa4066c41f1566cd05a` |
| `48000-unequal` | valid | -8.055113055890397 | -6.020599913279624 | -6.020599913279624 | `e0be0009a77db513e529aeb478b87d03abe16bc7255542c6ea108540228944ef` |
| `48000-half-amplitude` | valid | -15.044813099250584 | -12.041199826559248 | -12.041199826559248 | `c5359d83994feb3ac79e73794fee3d8379c28e6837aa3981bb1a0bb3a52115e3` |
| `48000-silence` | below-gate | unavailable | unavailable | unavailable | `0a3df7efc9890b1884a3c056672b2658de29c1db7445873ab02c3e9c046dee16` |
| `48000-below-gate` | below-gate | unavailable | -100.00000021942404 | -100.00000021942404 | `3c99187fd787ea12cc8fb0646325728be5d5ee8d59326e22b2eb2e076f5555a8` |
| `48000-over-full-scale` | valid | -1.419988198447963 | 1.583625266098734 | 1.583625266098734 | `251159c6366dca28a497682632cedcd9669aafd447dd7bfea0c84c52e3c543b6` |
| `48000-phase-quarter-rate` | valid | -0.5737873900426026 | -3.925449672450734 | -0.8116244457013354 | `d3684d041020b4b5c9b2a98dd6ad34a91d6a0dde9f6fb8c66901239b51e041bf` |
| `48000-weight-20` | valid | -22.998384237429935 | -6.020599913279624 | -6.012755866087995 | `40a62323806c4ce28f8702d604dd4f56b1c0cc84bfc4893ba6ceb987a623db12` |
| `48000-weight-38` | valid | -15.726908154508573 | -6.020599913279624 | -6.012750693569178 | `9268226c55d75d855795e391d1bc58fc3a994b2799e8b84b984df50f4ea50580` |
| `48000-weight-100` | valid | -10.857048431661102 | -6.020599913279624 | -6.0129586312527215 | `d234fa9ad421e3e79d52e815e0ef7c3fc61658e02eafa626905ab4ebfedbd59b` |
| `48000-weight-4000` | valid | -5.753917094918106 | -6.020599913279624 | -6.020599913279624 | `1889038039e57038a48a5ed6366dbf01bb8b1c4fda66dc0071d30ee8719903dd` |
| `48000-weight-12000` | valid | -5.679236780977813 | -6.020599913279624 | -6.020599913279624 | `7b3d1b38c761df41dbbd8a94dd451cf7998098da1e3c17e14326fb895e6de506` |
| `48000-duration-100ms-0` | insufficient-duration | unavailable | -6.020599913279624 | -6.020599913279624 | `fbe7cace58a78069a741353e7efa950247c4ea6212b4e65262db8627cab28f60` |
| `48000-duration-100ms-1` | insufficient-duration | unavailable | -6.020599913279624 | -6.020599913279624 | `6852586423642c7012383d71cc8a8eb1487c9940c95e85ea73f2a74128652a94` |
| `48000-duration-100ms-2` | insufficient-duration | unavailable | -6.020599913279624 | -6.020599913279624 | `7ea4551d4666e3c66fff84ea8353060b68f361c098d4f7c448c001b3cee0355f` |
| `48000-duration-400ms-0` | insufficient-duration | unavailable | -6.020599913279624 | -6.020599913279624 | `9b58dca82cfa4d2e69f093de8ded7a5fbdac2de0567cd8d748e63b4e94af238f` |
| `48000-duration-400ms-1` | valid | -9.02449526707876 | -6.020599913279624 | -6.020599913279624 | `b6c5129de4d8aa386e6f35ca5c702fd83fd26be58bad7f145663372a60f51a46` |
| `48000-duration-400ms-2` | valid | -9.02449526707876 | -6.020599913279624 | -6.020599913279624 | `4c65c7a65b94c3837be742c272c77cea2e054352094ef353f12db78380ee1789` |
| `48000-single-frame` | insufficient-duration | unavailable | 0 | 0 | `e00e5eb9444182f352323374ef4e08ebcb784725fdd4fd612d7730540b3e0c8c` |
| `48000-impulse-first` | valid | -39.69495697662375 | 0 | 0 | `cba634fd2aafa6a739a0687ab78d5b019592cd46fc808d28bc13fa75d3bad76e` |
| `48000-impulse-last` | valid | -39.8011381940373 | 0 | 0 | `6f1d3fc114766607eb7b45267e87a4886cb46c3826e9ab9c2b23156dadf973a2` |
| `48000-impulse-chunk-boundary` | valid | -39.69495697662375 | 0 | 0 | `1214d15b1e38fd1126537c10e7faeab48ecf7c356bdf90dfe8bc764c44b0c71d` |
| `48000-programme-with-silence` | valid | -9.631198871919738 | -6.020599913279624 | -6.020599913279624 | `6e3bc5805e42013e0063288459af7feba5e8960a49285c8c1748e3e8bf1a5fdf` |
| `48000-programme-with-quiet` | valid | -9.362721245610974 | -6.020599913279624 | -6.020599913279624 | `0721b93f7f8415f8d89b453eb3e11473b289c6ae0445ef57b699333e353dee15` |

### Repository regression and artifact checks

The existing combined Node suite still reports **92 tests / 89 passes / 3 known LUFS TODO cases / zero unexpected failures**. Sanity script, both new JS syntax checks, exact five-file scope, changed/new whitespace, local document links/fences, nine unique acyclic queue tasks, and final executed-code hash checks passed. Production build passed with the existing large-bundle warning. No additional dependency installation was used for these checks.

The build also exposed automatic Tailwind/daisyUI source scanning of documentation/validation text. An isolated build of `HEAD` (archived into a fresh external temporary directory using the same installed packages) produced CSS of **141,733 bytes**; this working tree produced **143,746 bytes**. Added selector families are `.table` and `.static`, with no removed selector family. The generated JS is **byte-identical**, 1,155,129 bytes, despite its asset filename hash changing. No production/UI/style/configuration source was edited. No `.table`/`.static` class usage was found by the source search, but browser visual equivalence was not tested. Do not claim byte-identical CSS or fix scan configuration in Codex-owned style files incidentally; coordinate any source-scanning exclusion separately.

### Remaining gates

This validates the reference harness on synthetic controls. It does **not** validate a replacement app meter, official standard editions/vectors, all gate-equality cases, multichannel layouts, arbitrary sample rates, native-module distribution, browser/macOS rendering, limiter/encoded output, cancellation/performance, listening quality or safe automatic gain. The current app's dangerous normalization edge case is still present.

Next bounded recommendation: review these results, then explicitly assign an isolated per-channel K-weighted/gated loudness candidate and compare it with this independent harness before wiring any production caller. True-peak reconstruction and limiter changes remain separate tasks. No production API acceptance, default-policy change, agent dispatch, commit, PR update or merge is implied by executing this tool.

## 12. CORE-006 — isolated JavaScript integrated-loudness POC

**Status: submitted for review, not connected to the app.** Owner directed the proposed candidate comparison after reviewing CORE-005, accepting that reference evidence for isolated POC progression. This does not accept the pending shared application contract, production-policy changes, true-peak/limiter claims or a merge.

### Exact implementation boundary

- [`integrated-loudness-candidate.mjs`](../../scripts/validation/integrated-loudness-candidate.mjs): synchronous research-only streaming mono/LR meter at 44.1/48 kHz, bounded to 30 seconds, with no native/library/runtime dependency or production imports. Separate double-precision shelf/RLB biquad recurrences per channel; continuous filter state across chunks; unit-weight sum of channel energy. Four compensated 100 ms energy totals form complete 400 ms windows, avoiding subtractive rolling-window cancellation. Incomplete trailing windows are omitted; no media padding.
- Filter coefficient parameterization follows the pinned libebur128 equations and constants. Its MIT notice is retained in the relevant code section. The JS filtering/energy-window/gating implementation has a different numerical structure from the reference's combined fourth-order recurrence. This validates implementation agreement under **shared parameter assumptions**, not independent verification that those assumptions match a selected normative edition.
- Actual processing uses the same inclusive absolute/relative energy-gate helper tested at exact mathematical thresholds. Readings are either finite LUFS or null with `below-gate` / `insufficient-duration`; unsupported configuration, malformed/nonfinite/shared-mutable chunks, over-limit input and illegal lifecycle calls throw. All input is preflighted before state changes, so rejected chunks cannot partly corrupt a prior valid stream. Results are frozen; finishing is idempotent and later input is refused.
- The result identifier is `research-integrated-native-mono-lr-v1`, deliberately **not** an accepted product metering-profile version. Research errors/statuses are not installed application UI/IPC/service states. This module has no peak/limiter implementation, gain computation, reference migration or render path.
- [`compare-loudness-candidate.mjs`](../../scripts/validation/compare-loudness-candidate.mjs): offline report reader and real-candidate comparison. Checks report kind, pinned upstream commit/source hashes, current reference-tool/fixture code hashes, library modes, boundary policy, unique/full fixture inventory, geometry, recipe/rate/layout hashes, exact PCM bytes and valid finite/unavailable readings before candidate execution. Reads only fixed local code paths. Imported JSON never selects an executable/source path, imports code or changes active application state. Provenance consistency is **not a digital signature** or proof against an intentionally forged report.
- [`integratedLoudnessCandidate.test.js`](../../tests/audio/integratedLoudnessCandidate.test.js): 53 ordinary tests, no TODOs. Mathematical gate boundaries are unit checks on the real helper; actual PCM tests exercise the full filter/window/gate mechanism. The independent numerical comparison below is real libebur128 output, not a mocked oracle.

Existing reference C/runner and both fixture helpers were preserved unchanged. No production `src` file, previous regression test, package/lock/configuration, Electron or UI/style/controller file was edited. Original PCM remains read-only. Nothing was committed, pushed, added to PR #3 or merged for this task.

### Actual numerical evidence

A fresh offline build/run of the approved libebur128 harness passed its existing 56-fixture / 278-measurement / 25-negative / 20-analytical controls. Its existing unused-variable compiler warning remains disclosed; the local C adapter still compiles with warnings-as-errors. No new tool or library was installed.

The candidate then processed those **same 56 byte- and recipe-matched fixtures** at one-shot and chunk sizes 1/127/128/4096 (duplicate sizes removed), producing **278 candidate runs**:

- Exact agreement in statuses: **42 valid, 4 below-gate, 10 insufficient-duration** fixture results.
- Every valid reading satisfies the unchanged proposed **0.1 LU absolute reference tolerance**; maximum observed absolute difference **`5.172680062059953e-9 LU`**, at `48000-weight-20`.
- Maximum observed chunking difference: **0 LU**; complete result metadata/counts agree exactly between one-shot and streamed runs. Required chunk tolerance remains `1e-6 LU`.
- Complete-window counts agree with frame geometry, including 400 ms minus/equal/plus one frame. Every source PCM hash is unchanged after all runs. Native mono/right-only equality, stereo energy sum and polarity behavior remain consistent with the reference.
- **26 negative CLI/report checks** passed: missing/unknown CLI mode, absent/malformed/oversized/non-file JSON; wrong kind/revision/source/code hashes/pass flag/modes/boundary policy; missing/duplicate IDs; changed geometry/PCM/recipe/layout/library version; invalid statuses or nonfinite/unavailable readings; and a deliberately wrong numerical LUFS result. All failed nonzero without successful/partial JSON output. A separate positive test confirms filesystem-like extra metadata is ignored, with identical measurements and no path execution/read selected by imported keys.

Selected full-precision values (the complete fixture/reference snapshot is in section 11; the comparison CLI emits all candidate rows):

| Fixture | Candidate status | Reference LUFS | Candidate LUFS | Candidate minus reference LU |
| --- | --- | ---: | ---: | ---: |
| `44100-mono` | valid | -9.021455731040195 | -9.02145573103894 | 1.255884285455977e-12 |
| `44100-duration-400ms-0` | insufficient-duration | unavailable | unavailable | unavailable |
| `48000-mono` | valid | -9.024213185970961 | -9.024213185967898 | 3.062439191126032e-12 |
| `48000-stereo` | valid | -6.013913229331148 | -6.013913229328085 | 3.063327369545732e-12 |
| `48000-inverted` | valid | -6.013913229331148 | -6.013913229328085 | 3.063327369545732e-12 |
| `48000-silence` | below-gate | unavailable | unavailable | unavailable |
| `48000-weight-20` | valid | -22.998384237429935 | -22.998384232257255 | 5.172680062059953e-09 |
| `48000-programme-with-quiet` | valid | -9.362721245610974 | -9.362721245607911 | 3.062439191126032e-12 |

The tiny low-frequency numerical difference is reported, not rounded away or used to widen acceptance tolerances. Matching this synthetic set does not establish error bounds on arbitrary music, unsupported layouts/rates, over-30-second inputs or gate-boundary PCM near finite-precision classification changes. Exact mathematical boundary checks do not replace official end-to-end PCM conformance vectors.

### Reproduce with the existing approved toolchain

First generate a fresh reference JSON using section 11's `--fetch` or external `--source-dir` command. Then:

```bash
node scripts/validation/compare-loudness-candidate.mjs --reference /tmp/musiconverse-reference.json
node --test tests/audio/integratedLoudnessCandidate.test.js
```

Changing the reference C/runner or original fixture files invalidates a stale report; regenerate rather than bypassing the hash checks. Comparison JSON captures fixed local-code SHA-256 values and the reference report SHA-256. Temporary actual outputs for this attempt are `/tmp/musiconverse-core006-fresh-reference.json`, `/tmp/musiconverse-core006-comparison.json`, and `/tmp/musiconverse-core006-cli-checks.json`; these are diagnostics, not cross-machine storage or committed media.

### Core regression and remaining integration gate

Combined Node run after adding the POC tests: **145 tests / 142 passes / 3 known legacy LUFS TODO cases / no unexpected failures**. Strict legacy audio diagnostics were also rerun: **47 tests / 44 passes / 3 failures**, deliberate exit 1, the same full/fast/quick loudness polarity cases. No existing TODO was hidden/promoted: the isolated candidate is not the analyzer used by production. Sanity and new JS syntax/protected-path checks passed. Production build explicitly returned exit 0 with the existing large-bundle warning. After rewording a new test description that accidentally activated an unused daisyUI component through text scanning, generated CSS and JavaScript are byte-identical to the preceding CORE-005 artifacts (143,746 and 1,155,129 bytes). No style/configuration source was changed. The earlier CORE-005 CSS difference versus published HEAD remains documented; this is not a browser visual-equivalence claim. The queue retains an anomalous aggregate call status and the successful isolated build verification. Final scope/document/hash checks precede completion.

The **existing automatic-gain risk is unchanged**. Do not install this bounded research module behind current numeric fields and call integration complete: valid/unavailable evidence, legacy target provenance, `.toFixed()` callers, sensible product gain bounds, final rendered remeasurement, normal full-track duration/performance and error/cancellation behavior need a reviewed integration contract. No independent normative edition/official-vector validation, true-peak candidate, limiter, real browser/macOS render, export or listening check is complete.

Recommended next checkpoint: publish this bounded research batch for review (not merge), then agree a small production validity/provenance adapter and gain-safety task before any consumer wiring. Coordinate any required presentation states with Codex rather than changing its UI here.
