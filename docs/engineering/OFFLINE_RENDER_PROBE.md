# CORE-010 — reconstructed native OfflineAudioContext/media proof

Fresh reconstruction, 2026-10-15; base
`2faa3939b9e109e5a9ed2e0d53130dc51c5abc9e`. **Not a byte-identical recovery of the
unavailable historical patch.** Owner-authorized reconstruction; lead/core on fixed branch
`arena/14df8ffa-onverse`. Research-only, with synthetic generated samples.
No production imports/wiring, UI, Electron change, user audio, uploads or cost.

Read [CORE-009](LINKED_MEDIA_RECOVERY_PROBE.md) separately. This probe's simple
exclusive media/metadata writer is **not an atomic project transaction**. If its
second write fails, an orphan may remain. Coexistence with CORE-009 does not join
the mechanisms or implement Linked Sessions, persistence/history, undo or a DAW.

## Reproduce

Node-only tests require no installed browser tools:

```sh
node --test tests/audio/offlineRenderFixtures.test.js
node --test tests/unit/*.test.js tests/audio/*.test.js
node scripts/test-analyze.mjs
```

For the separately approved native run, use Linux x64/Node >=22.12, a fresh
private test-only toolkit directory **outside this repository**, and no lifecycle
scripts. Do not add these tools to application package.json/package-lock.json.

```sh
tools=$(mktemp -d /tmp/onverse-browser-tools-XXXXXX)
chmod 700 "$tools"
printf '{"name":"onverse-private-proof-tools","version":"1.0.0","private":true}\n' > "$tools/package.json"
npm install --prefix "$tools" --ignore-scripts --no-audit --no-fund --save-exact \
  @sparticuz/chromium@153.0.0 puppeteer-core@25.14.0
node scripts/validation/run-offline-render-probe.mjs --tools-dir "$tools"
```

Only this approved pair is accepted. Before import, the runner verifies the
private temporary root, exact dependency versions, installed package versions,
fixed regular-file entry points, top-level integrity pins, and every lock entry's
registry URL/SHA-512 integrity. Arbitrary toolkit directories fail closed. npm
verifies fetched tarball integrity; this check is not an attestation against a
hostile same-UID actor modifying installed source afterwards. Future transitive
locks can differ: inspect their packages/URLs/integrities and report their counts
and hashes rather than assume this run's lock. Do not obtain additional tooling
or run package scripts silently.

Verified top-level registry integrity pins:

- `@sparticuz/chromium@153.0.0`:
  `sha512-jiGWqSvPMdu4+P9TilYqAR7yEGPEHINx+lCvE/NqNO/EHYzF/x1hUiI5T6ioVIt7dEy7n88byyT0vk+dnsgQwA==`
- `puppeteer-core@25.14.0`:
  `sha512-LQitnes3tBeVbdZ7V/4iwJPLZGgkl9uBVK0W7YYMh68j/3Y9eNuvj4yl+Fdo7zN0SuajOMrhd7aPj3DifK8k6A==`

This installation had **43 packages**. All lock URLs were on
`https://registry.npmjs.org/`, with SHA-512 integrity. Lock SHA-256:
`52064d287a9e3871efa875f030b7ec24885c711bdaa792bab5e978dccea02cbb`.
Wrapper registry licence: MIT; Puppeteer-core: Apache-2.0. **Embedded Chromium,
NSS and other third-party code are not all MIT**. These are temporary test tools,
not application redistribution assets.

## Native runtime containment and launch issue

Node 22.22.3 reported `typeof OfflineAudioContext === 'undefined'`. No mock or
polyfill substitutes for native execution. Actual run: Linux x64,
**HeadlessChrome/153.0.8010.0**.

The runner creates a new private runtime before importing/extracting Chromium.
It uses the package's exported `inflate` on bundled `al2023.tar.br`, then
`setupLambdaEnvironment(<runtime>/al2023/lib)` for bundled NSS/NSPR libraries
(including libnspr4/libnss3/libnssutil3). No apt/system-library install is needed.
It extracts the executable only under that fresh runtime, not shared
`/tmp/chromium`. Home/profile/cache/fonts are private. Environment passed to the
browser is allowlisted, not provider/GitHub secrets. Process environment changes
are restored in finally; the exported runner is single-driver/sequential only.

**Actual first reconstruction failure:** assigning a new `process.env` object
left native `os.tmpdir()` at `/tmp`, so package extraction went to shared temp.
The containment guard failed with `Unexpected shared browser extraction` before
launch. A minimal Node experiment reproduced that behavior. Fix: mutate actual
environment entries, verify native tmpdir equals the private runtime, and restore
the original entries in finally. Subsequent runs used fresh private runtimes;
they never reused that shared extraction. Artifacts are retained, not deleted.

The packaged test browser's arguments include disabled sandboxing. **Never copy
these flags into production Electron.** Evaluate only this trusted fixture
function on a blank page. Page is offline; all requests are intercepted/rejected;
background-networking/component-update/sync and DNS resolution are disabled where
supported. Zero observed page requests is **not packet capture or a security
certification**. Browser closes in finally, including failures; if rendering and cleanup both
fail, an AggregateError retains both errors instead of masking the first.

## Actual data flow and numerical oracle

Constants fixed before execution: 48 kHz, L/R, source output 4096 frames,
destination output 8192 frames, **maximum absolute error `2e-6`**.

Source recipes:

| Source | Length | Start | Gain | Float32 input |
| --- | ---: | ---: | ---: | --- |
| Conga | 2048 | 0 | 0.5 original / 1 updated | 375 Hz, L amplitude 1.25, R -1.25 |
| Other | 3072 | 128 | 1 | 375 Hz, L 0.75, R 0.25 |
| Vocal (unselected) | 2048 | 64 | 1 / 5 unrelated edit | 1500 Hz, both 0.9 |

Selection is Conga+Other only. Silence sets both selected gains to zero. Independent
channel control instead uses a 256-frame source, L +1.75 at frame 64 and R -2 at
frame 128. Native AudioBufferSourceNodes feed native GainNodes and sum at output.

Actual native result samples are packed as little-endian interleaved Float32 and
written to external `.f32` files with separate bounded metadata JSON. A **separate
Node reader process** validates root/owner, fixed media ID, dimensions, layout,
rate, finite samples, byte length and checksum. Reopened bytes must equal the
actual native result bytes exactly. **That reader's returned bytes**, not expected
arrays or the original in-memory render, feed the destination browser graph.
Base64 is transient driver transport only; metadata/report JSON has no PCM arrays.

Destination linked source starts at frame 256, through native gain 0.5 and native
peaking EQ (1500 Hz, Q 1, +3 dB). Actual node parameter values are checked. Separate
unrelated audio starts at zero, length 4096: L 1500 Hz/amplitude 0.125; R
750 Hz/amplitude 0.0625. Full 8192-frame output, including filter tail, is checked.

The independent **Node** oracle uses RBJ peaking-biquad coefficients:
`A=10^(gainDb/40)`, `w=2*pi*f/rate`, `alpha=sin(w)/(2*Q)`, `a0=1+alpha/A`;
`b0=(1+alpha*A)/a0`, `b1=-2*cos(w)/a0`, `b2=(1-alpha*A)/a0`,
`a1=-2*cos(w)/a0`, `a2=(1-alpha/A)/a0`.
Recurrence: `y=b0*x+b1*x1+b2*x2-a1*y1-a2*y2`, double state, Float32 source,
gain/sum and filter-output boundaries. Placement and unrelated audio are explicit.
DC unity, zero-gain identity and +3 dB centre response are separately unit-tested.
No Web Audio render serves as its own expected result.

## Executed results

- Node fixture/media tests: **26 / 26 pass**, zero skips/failures; these are **not
  native browser execution**.
- CORE-009 tests: **31 / 31 pass**.
- Combined current default suite: **211 total / 208 passes / 3 known legacy LUFS
  TODOs / 0 unexpected failures / 0 skips**. The same historical total is incidental:
  this reconstruction splits the 57 new tests as 31+26, not historical 32+25.
- Sanity command: all checks passed.
- Strict legacy diagnostic:
  `MUSICONVERSE_STRICT_AUDIO_REGRESSIONS=1 node --test tests/audio/analyzerRegression.test.js`
  still **exits 1: 47 tests / 44 passes / 3 LUFS failures**. Nothing was weakened.

Native positives (observed twice in fresh private runtimes):

| Source case | Peak | Max oracle error | Separate-process bytes |
| --- | ---: | ---: | --- |
| original | 1.375 | 0 | exact |
| updated | 2 | 0 | exact |
| unrelated-edit | 1.375 | 0 | exact; identical to original |
| silence | 0 | 0 | exact |
| channels | 2 | 0 | exact |

| Destination case | Peak | Max absolute error | Bound |
| --- | ---: | ---: | ---: |
| original | 0.803838312625885 | 3.5762786865234375e-7 | 2e-6 |
| updated | 1.1167265176773071 | 3.5762786865234375e-7 | 2e-6 |

All intended source and destination hashes agreed across both runs. Destination
hashes: original `621d155a0dd00b8e876b2506720d6611b6881d2885a1edc5401c854b34470981`;
updated `925ac53186875191a734d694733e37a843441c7295855b69dce8e82ed6655f30`.
This is observed reproducibility here, not a cross-engine bitwise guarantee.

Native negative controls, all rejected by the unchanged numerical gate:

| Wrong graph | Explicit source case | Max error |
| --- | --- | ---: |
| WaveShaper curve [-1,1], oversample none | original | 0.375 |
| Incorrectly include Vocal | original | 0.9000000059604645 |
| Bypass destination gain/EQ | updated | 0.9859869480133057 |

The initial bypass reconstruction used original media and gave
`0.6784102320671082`; the final control explicitly uses updated media, explaining
the difference without changing tolerance. Early Vocal negative peak was
`2.1773297786712646`; later it was `2.1773300170898438`. Fault-case peak equality
is **not** required: the negative must be detected. Exact native accumulation order
was not instrumented; no cause beyond that evidence is asserted.

Repeated runs verified full environment restoration and zero observed page
requests/errors. Local complete reports `/tmp/onverse-native-report-1.json` and
`/tmp/onverse-native-report-2.json` include code hashes, media hashes, actual
parameters, results, tool audit and artifact paths. Runtimes:
`/tmp/onverse-browser-runtime-osLpuT`, `/tmp/onverse-browser-runtime-gai7Pi`.
Reports/media/packages/binaries remain outside Git. These paths are diagnostic,
not portable deliverables; reproduction creates new ones.

## Validation/security controls and remaining gates

Tests exercise independent recipes, exact gains/alignment, unrelated exclusion,
silence, L/R separation, negative-zero/over-range byte retention, nonfinite samples
and finite Float64-to-Float32 overflow, truncated/mismatched input, oracle response,
numerical failure, explicit native absence, process reopen, metadata without PCM,
validation-before-write, overwrite refusal, canonical complete transport,
same-length corruption, altered channel/rate/frame metadata, oversized/malformed
manifest, matching-byte symlinks, traversal/owner/non-temp roots and arbitrary
unapproved toolkit refusal. File access reuses CORE-009's private-root/bounded-read
helpers; this is not a new production storage abstraction.

**Not executed/claimed:** listening, product UI/browser workflows, macOS/Windows,
Electron IPC/packaging, physical power loss, full-track budgets, plugins,
standards/conformance, true peak, safe automatic gain, cancellation/promotion races,
or complete Linked Sessions integration. Existing LUFS, true-peak, automatic-gain,
release/updater and security limitations remain unresolved.

Next: review/accept minimal stable IDs, immutable snapshots, exact selection and
relevant dependencies, explicit approval-bound prepare/commit, compatibility,
destination preservation and cancellation barrier. Then join actual rendered media
to a validated journal/generation transaction, test failure/restart and retained
undo/redo. No operational UI or broad framework precedes that acceptance.

## Continuation review and acceptance — 2026-10-15

Reviewer: Arena lead/core, owner-requested technical review. **Accepted after the
narrow R1/R2 corrections below**, only as isolated native-render/media evidence.
This is not an independent external reviewer, GitHub approval, merge permission,
product feature acceptance or normative/security certification.

- **R1:** environment-controlled temp-root escape, shared with CORE-009. Corrected
  using its canonical Linux `/tmp` guard; browser tool/runtime setup cannot
  authorize an arbitrary non-temp parent through TMPDIR. Regression red before
  correction, green afterward.
- **R2:** auditTools' lock-path regex allowed `..` path segments. A metadata-only
  fake installation demonstrated a lock-selected package.json read outside the
  toolkit root; no fake code was imported/executed. Dot segments now reject
  before file access. Regression red before correction, green afterward. Fixed
  entry-point imports were never selected by these lock entries; this finding
  concerned metadata-read containment, not demonstrated arbitrary execution.
- Reviewed finally handling and reproduced post-launch primary failure, plus
  simultaneous primary/cleanup errors, using **scratch copies only**. Actual
  browser processes exited (PID no longer existed), both errors survived in the
  AggregateError case, and complete environment/native tmpdir restoration passed.
  The injected cleanup exception occurred **after real browser.close succeeded**:
  this tests error retention/restoration, not forced termination if close itself
  hangs. Only the main browser PID's exit was asserted, not a process-tree audit.
  A machine/driver SIGKILL or permanently wedged OS/browser is still not a proven
  cleanup guarantee. No assertion of packet-level network isolation follows.

Independent review execution used a **fresh scripts-disabled** installation of
the approved exact pair, outside the repository. 43 packages; all lock URLs and
SHA-512 records checked; live registry top-level integrity/licence metadata
matched both documented pins. New lock SHA-256:
`229c104fec2c37c36953816579c3d30975dae2b0259480af9973153ea02920c5`.
Comparison confirmed the entire non-root package graph equals the original lock;
root package naming accounts for the different lock hash. No claim of verifying
an installed tree against hostile post-install tampering is added.

Verified original report code hashes against Git blobs at submitted head
`9cab37bc482a49d96bd785aa2cc4d11c72606217`. Repeated native execution twice after
fixes using fresh private runtimes: **all five source hashes and both destination
hashes equal the submitted evidence**, sources exact against oracle, both
max destination errors `3.5762786865234375e-7` under unchanged `2e-6`, all three
negative controls detected, zero observed page requests/errors. This independently
reproduces numerical/media claims; it does not certify the original author's
historical installation procedure or excluded target-platform tests.

Current fixture/media suite: **28/28 pass**, not native executions. Combined suite:
**214/211 pass/3 known TODOs/0 unexpected failures/0 skips**. Full review reports:
`/tmp/onverse-review-native-1.json`, `/tmp/onverse-review-native-2.json`,
`/tmp/onverse-review-evidence.json`. Scratch failure paths are recorded there.
These are retained local diagnostics, not required portable dependencies.

No broader implementation is accepted here. The next work must use these real
native bytes in a validated generation/journal transaction, not a second separate
media writer. Immutable source/dependency/provenance and cancellation/undo rules
must be recorded before that implementation; the fixed g0/g1 storage fixture
must be narrowly parameterized and regression-tested rather than blindly adopted
as a production schema or replaced by a speculative storage framework.
