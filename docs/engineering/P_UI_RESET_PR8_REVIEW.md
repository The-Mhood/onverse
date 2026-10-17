# UI-RESET-001 — PR8 lead review, 2026-10-16

**CHANGES REQUIRED; NOT ACCEPTED/MERGED.** New reset submission discovered while
checking for concurrent work: [PR8](https://github.com/The-Mhood/onverse/pull/8),
`arena/31c3346b-onverse`, reviewed head
`995306c927c6d0e71fb6483013f141ffd31ecb4b`, base/main
`2faa3939b9e109e5a9ed2e0d53130dc51c5abc9e`. Six changed paths.
This is evidence of a published reset submission, not an invented agent launch or
independent identity/receipt attestation. No PR checks are reported by GitHub.

Lead initially planned functional extraction from local main and migration of nine
controller tests. **Paused before touching main/tests** on discovering PR8 already
changes that shared file. Do not stack competing main edits or silently integrate
P's commit. Working branch/main/core/assets stay unchanged. The earlier pre-delete
manifest remains a historical before snapshot; this report is the submitted delta.

## Blocking findings at the exact reviewed head

### R1 — removed markup still has live module-level bindings (blocker)

`index.html` has only `id="app"`; PR main1477 assigns
`$("#btnIdleUpload").onclick` without that element existing. Similar live bindings
remain at1478/1480+,1504+,1513+,1530+ and1591. A fixed-source Node VM execution with
querySelector returning null for missing IDs reaches exactly1477 and throws:

`TypeError: Cannot set properties of null (setting 'onclick')`.

This is a tiny DOM contract model, **not a browser/actual app boot**. Import lines
are blanked and imports/audio calls are not executed; line numbers are preserved.
The supplied empty document and JS null assignment nevertheless demonstrate a real
entry-code error. No engine call or window event registration occurs before it.
A successful Vite build and extracted-function tests cannot prove module startup.

Do NOT fix by restoring hidden old markup, fake controls or blanket no-op engine
stubs. Detach obsolete view bindings through the reviewed mixed-file split and
provide only an accessible, non-designed pending-reference notice.

### R2 — dangling unbound visual symbols break preserved operations (blocker)

PR main96+ and125+ reference `stage?.setSpectrum/...` after removing its declaration.
`stopPlayback()` in the same VM context throws `ReferenceError: stage is not defined`.
Optional chaining does not protect an undeclared identifier. `drawRadar?.` and
`drawWaveform?.` similarly reference removed imports; null canvas guards merely
hide them until a corresponding element exists. Stop/play/crop/load/analysis/tweak
paths depend on these functions. Retaining their text is not preserving usable
functional orchestration.

Remove genuine visual dependencies via explicit, reviewed view separation; don't
replace playback/analysis callbacks with successful-looking stubs or change public
engine/SYLUNE/storage/IPC contracts. Lead remains owner of functional extraction.
The9analysisErrorFlow cases must retain assertions and migrate their seam as part
of that extraction, not be deleted or kept as the only startup acceptance test.

### R3 — reset is incomplete; retained presentation/assets remain (blocker to completion)

The removed top-level template/CSS/scene/draw files are real progress, but main
still holds9inline SVGs in ICONS, renderAnalysis/renderReport/buildRefHtml/
renderTweakPanel/renderConvertPanel and updater-banner DOM construction. Old HTML/
classes and UI behavior remain in active source/bundle, not an acceptable hidden
legacy foundation. Original font binaries/notices/manifests remain; the old favicon
is still explicitly linked. Packaged icons and icon generator also remain.

P's pure font/favicon cleanup is ALREADY approved by issue6/7; favicon is not
blocked on package icon metadata (only its index reference needs owned removal).
Remove each font's shipped bytes before removing its required license/manifest.
B-only paths absent from this main-based branch are absent, not newly removed.
Package icon references still require the exact lead-reviewed coupled change.
Report that residual gate; do not describe the entire reset as complete meanwhile.
New design remains held for new media; SYLUNE keeps its name.

## Protected-path review / limited positive finding

Existing audio/application/domain/Electron/test/script/config files in the PR
remain byte-identical to main. The one protected-prefix addition is
`src/audio/waveformPeaks.js` (SHA256
`98112ea172760d3929472809ded37e86b79ae6a594cd3341c320a78b9c5f29cf`).
Its function body is byte-identical to the old private peaksFor helper. A Node VM
checks widths1/2/4/9, expected two-channel peaks, unchanged synthetic channel data
and original same-width cache identity. No actual audio decoding/rendering/listening
is implied. There is no production consumer added for the new module.

This review verifies the exact mathematical copy only; it is not a blanket audio
folder grant/new public contract adoption, nor evidence the mixed controller has
been extracted. Coordinate any retained helper/new consumer with lead; no extra DSP
or backend changes. Do not use old raster/UI layout as the new design foundation.

## Actual executed evidence

- Read GitHub PR8 metadata/body/files/comments/checks and exact fetched commit;
  no branch switch/reset/merge/cherry-pick/push. PR head/main still require recheck
  before action; these line numbers/hashes apply only to the reviewed SHA.
- Isolated PR8 Git archive: `node --test tests/unit/*.test.js tests/audio/*.test.js`
  ->154tests/151pass/0fail/3existing LUFS TODOs,1.774s. This is independently rerun,
  not just the worker's claim. Tests don't exercise module boot; no false pass.
- `node scripts/validation/review-ui-reset-candidate.mjs` -> expected actual exit1,
  `status:changes-requested`, reproduces R1/R2 and records residual asset paths,
  source hashes and exact peak-copy checks. Exit2 means harness/precondition error;
  never count exit1 as a passing frontend. Fixed commit/no generic path/script args.
- Current working core regression:404tests/401pass/0fail/3known TODOs. No tolerance
  changes. Existing controller tests unchanged; no test migration claimed yet.
- No dependency/runtime install, browser/native audio/GUI/Electron/Mac/build/provider
  check in this lead review. Worker's build claim is not independently rerun or
  called a boot test. No actual new frontend workflow can be verified yet.

## P correction handoff (may proceed within UI-only scope)

1. Read this exact review and issue6/7. Keep PR8 unmerged; return a corrected head
   with exact file/removal/retained/residual lists. Do not rewrite/force old history.
2. P may continue pure font/favicon/visual cleanup and prepare its neutral entry.
   **Coordinate/release main with lead before further functional hunks.** No
   competing lead extraction is being applied while this submitted main is reviewed.
3. Submit a main/view separation plan with old real operations preserved and no
   old markup/renderer/stage symbols/bindings hidden in active source. Lead reviews
   protected seams; exact owner approval precedes protected behavior/public-contract
   changes. Don't solve errors with hidden elements, blanket optional chaining or
   fake operation success.
4. Preserve/migrate nine controller assertions, add entry-boot and no-dangling-view
   coverage, run existing engine tests and authorized actual neutral-shell checks.
   Distinguish backend preservation, unavailable frontend access and unimplemented
   full DAW/provider/platform capabilities.
5. Package icon integration is a separate scoped lead task; fonts/favicon are not
   an excuse to wait. Once genuinely clean and validated, WAIT for new references.

No visual redesign, P-branch write, source integration, acceptance or merge is
performed by this review. GitHub publication is not worker receipt/correction.
