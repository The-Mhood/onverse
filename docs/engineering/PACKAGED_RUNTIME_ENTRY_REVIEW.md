# CORE-013 — packaged-main capability entry, exact review candidate

2026-10-16. **PATCH PREPARED; NOT APPLIED TO ELECTRON. NO MAC RUN.**

## Task / why / impact

The owner directed continuation after the standalone SQLite qualification. No Mac
execution route was established (the route question was skipped, followed by
`proceed`). Conservative action: prepare the exact next main-entry diff for review,
not silently adopt it or bypass the [storage gate](PRODUCTION_SESSION_STORAGE.md).

Current `electron/main.cjs`, preload, package/lock, build and application source are
unchanged. Existing package `electron/**/*` already covers the proposed destination;
**no package-inclusion/config/dependency change is necessary for this self-contained
capability entry**. Core source/PCM imports are deliberately absent. This does not
imply those other core modules/workers are packaged.

New repository files:

- `scripts/validation/packaged-runtime-candidate/sessionRuntimeProbe.cjs`: dormant
  candidate source, OUTSIDE packaged electron/dist paths.
- `scripts/validation/prepare-packaged-runtime-probe.mjs`: deterministic stdout-only
  two-file review patch; no Git calls/writes, temp staging or automatic application.
- `tests/unit/packagedRuntimeCandidate.test.js`:20source-contract regressions.
- This review. Status pointers only in WORK_QUEUE and SESSION_RUNTIME_QUALIFICATION.

## Exact proposed Electron change — still requires review/adoption

Generate without changing startup:

```sh
node scripts/validation/prepare-packaged-runtime-probe.mjs > /tmp/packaged-main.REVIEW-ONLY.patch
```

Generator accepts **no arguments** and pins original main SHA256
`46d6d66b879cd8d884fb5a917d1bd2e0ac060da3c06be1a1773d7cfb9d574c63`
(Git blob `87afad78fa96917a98b050754650d0523f57d806`). Changed base stops with
`MAIN_BASE_CHANGED_REVIEW_REQUIRED`; do not silently regenerate/rebase over another
worker's Electron edit. These are pre-adoption/current-base tests: a later approved
adoption must deliberately update/retire the generator pin and current-main-specific
preparation tests as part of its reviewed diff, not weaken audio or runtime checks.

The generated patch changes ONLY:

1. `electron/main.cjs`: two insertion-only hunks. Before any normal Electron/updater
   imports, reserve `--mov-session-runtime-*` for a fixed module. Wrap the entire
   original normal branch verbatim in `else`. No window/preload/security/updater
   setting is altered. Typo/extra diagnostic arguments cannot fall through into a
   normal startup or updater run.
2. Add `electron/diagnostics/sessionRuntimeProbe.cjs`, exactly the candidate bytes.
   Fixed one-shot mode, no renderer/preload/IPC, generic path/SQL/module/shell/evaluate
   or child-process endpoint. Does not launch a window or import electron-updater.

This patch is independently applicable to the exact original Electron shell; it does
not require adopting the held domain/audio/storage core patch. Real normal startup,
updater, packaging, macOS routing and activation/quit behavior remain UNVERIFIED and
must be tested before adoption. Source/VM equality is not a packaged smoke test.

## Probe protocol and intentionally narrow evidence

A reviewed packaged artifact's actual executable would be invoked with exactly
`--mov-session-runtime-probe`, no additional arguments. Direct development scripts,
renderer context, run-as-node, unpackaged/non-Mac/unsupported arch, late invocation,
missing builtin or unreviewed artifact layout block. Even malformed Electron-looking
diagnostic invocations terminate explicitly; do not leave an app waiting for ready.

Before `app.whenReady`, it observes actual process versions/type/OS/architecture,
`app.isPackaged` and `app.isReady`. These aren't caller-supplied context options.
Only its fixed entry may load `node:sqlite`. No npm/native/system-executable fallback.
It opens only `:memory:` and checks STRICT tables, foreign-key rejection, transaction
rollback, actual sqlite_version matching process.versions.sqlite and bounded compile
options. **No filesystem DB, ownership transaction, media or full ledger here.**

For a successful capability observation, raw `original-fs` hashes the actual main
executable (<=256MiB) and canonical `Resources/app.asar` (<=512MiB), using retained
no-follow descriptors and BigInt identity/size/time/link checks across reads. A
30second monotonic deadline is checked between reads; synchronous kernel I/O cannot
be forcibly interrupted, so this is NOT a strict wall-clock/liveness guarantee.
Electron's patched fs separately reads/hashes two bounded logical ASAR source members
(main/probe, <=64KiB each). No attempt to open logical members through raw fs.

These are **observed bytes, NOT loaded-code attestation, full Electron Framework/
bundle hashing, code-signing, tamper resistance or release certification**. Same-UID
races, ASAR caching and underlying Electron bootstrap/profile effects are not
qualified. The probe itself does not access project/userData paths, uploads, updater,
credentials or network. It writes only one bounded stdout JSON result, closes SQLite
and artifact FDs, retains sanitized primary+cleanup error codes, then exits. Failed
stdout cannot exit successfully. No arbitrary report-file path is accepted.

Exit0 means `status:capability-only-pass`, **not storage acceptance**. Blocked probes
exit2; output or unavailable app-exit API faults exit1. Every result keeps:

- `productionReady:false`, `storageQualificationPassed:false`;
- `productionAdapterImplemented:false`, `apfsVerified:false`;
- `hardwareFlushProven:false`, `powerLossProven:false`.

A source-level positive can be simulated; an editable JSON result is not a trusted
qualification token. There is no automatic readiness promotion or application
consumer of this report.

## Actual evidence from this Linux workspace

-20/20focused pass, zero skips. Strict base pin; deterministic patch; actual Git
 apply/check/reverse in new private fixture trees; original main restored exactly.
- VM compares original vs proposed normal initialization call sequence and ensures
 diagnostic dispatch never loads updater/window code. All Electron/Mac-looking
 contexts and artifact layout tests are **explicit simulations**; plain bytes are
 NOT a real executable/ASAR. Happy-path hashes, identity/limit refusal, stdout failure
 and primary+close failure retention are contract tests only.
- Real standalone Node SQLite :memory: is used within one simulated context to
 exercise actual builtin SQL. Real Node execution of proposed main rejects without
 needing Electron installed. Neither is actual Electron evidence.
- Actual fresh Node invocation with the exact probe flag returned
 `ELECTRON_MAIN_REQUIRED`, exit2, electron:null and all qualification flags false.
- Full default suite404tests/401pass/0fail/3existing LUFS TODOs. Strict audio remains
47tests/44pass/3known failures (expected actual exit1); analyzer sanity PASS.
- The first focused attempt had6failures: the generator incorrectly assumed the
 strict-mode directive was the fourth line rather than the third. Corrected the
 exact insertion/hunk positions while retaining the full original SHA pin; final
 patch application/reversal and tests passed. Original failed log is preserved.
- No Electron binary, Mac architecture, real ASAR, normal app GUI/updater, browser
 native render, build, signing/notarization, CI dispatch or paid service executed.
 No dependency/install or Git/GitHub publication. No application/B edits.

## Required review / Mac execution next

1. Review the exact two-file generated diff, especially pre-import routing, exit
   semantics and original normal branch preservation. Candidate is not adopted.
2. Establish an authorized Mac/local or existing CI route. Build commands, resource
   use and any workflow changes need that concrete route; no workflow dispatched.
   Avoid `dist:notarized`, credentials, publishing or disabling sandbox/Gatekeeper.
   This slice deliberately does not invent a signing/build recipe. Existing package
   afterSign can contact Apple when credentials are present; do not run it casually.
3. After review, in an isolated copy verify the exact original main hash, apply the
   review patch, inspect package inclusion and build a nonpublishing artifact under
   the separately agreed environment. An already-built reviewed artifact can be
   invoked directly, NOT with `ELECTRON_RUN_AS_NODE` or a supplied development script:

```sh
# Mac-only, AFTER artifact/entry review; APP points to that reviewed local artifact.
# Record stdout, stderr AND actual exit code. This command was NOT run here.
if "$APP/Contents/MacOS/MusicOnVerse" --mov-session-runtime-probe > capability.json 2> capability.stderr; then
  status=0
else
  status=$?
fi
printf 'actual exit=%s\n' "$status"
```

4. Collect actual macOS arm64 and x64 capability records and independent APFS/volume
   facts, native hardware and Rosetta/translation status (not inferred from process.arch).
   A single available Mac does not qualify the missing architecture. Never
   treat simulated test contexts or standalone Mac Node as packaged-main evidence.
5. Only after this capability check, implement/review the fixed PACKAGED child
   protocol and run ownership/killed-owner/useful-PCM/receipt/history crash matrix
   there. The existing standalone qualification runner STILL refuses Electron; this
   capability candidate does not weaken that refusal or claim to port its children.
6. Storage adapter/full ledger/migration/backup/I/O-fault and actual UI/audio/provider
   acceptance remain further gates. CORE-013 running/gated; CORE-015 planned; save
   session-only/null timestamp. B's amended COORD-010 scope is unchanged.
