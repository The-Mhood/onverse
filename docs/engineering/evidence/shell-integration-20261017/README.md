# Shared-shell evidence — 2026-10-17

**Verified independent host; exact P presentation integration blocked. Not final visual/performance acceptance.**

[Checkpoint report](../../SHARED_SHELL_CHECKPOINT_20261017.md) · [runtime/source identity](identity.json) · [live app](https://4173-iy0ptvfql17xhsa5cqu3k.e2b.app)

Runtime source: `eca5aa9d555bd39940b55508875f07d1b3f3a658`, branch `arena/14df8ffa-onverse`. All successful browser reports identify the same production bundle SHA256 `a286014ca38702961b6e2a5ad052629e1de098b9a180758e7bc6d279a0ce4576`.

## Required fresh actual-entry captures

These are independent desktop and mobile screenshots, not a montage or archived P entry. `*-viewport.png` shows the actual viewport, important for the fixed Sylune panel; companion-free full-page captures and panel full-page captures also exist without the `-viewport` suffix. Mobile DAW uses deliberate internal timeline scrolling, not document horizontal overflow.

| View | Desktop 1480×920 | Mobile 390×844 |
|---|---|---|
| Opening (existing environment + baseline phase cue, NOT afd renderer) | [PNG](shell/opening-1480x920-viewport.png) | [PNG](shell/opening-390x844-viewport.png) |
| Loaded audio shaping / preserved workbench | [PNG](shell/workbench-1480x920-viewport.png) | [PNG](shell/workbench-390x844-viewport.png) |
| Functioning three-track DAW | [PNG](shell/daw-1480x920-viewport.png) | [PNG](shell/daw-390x844-viewport.png) |
| Single unconnected Sylune | [PNG](shell/sylune-1480x920-viewport.png) | [PNG](shell/sylune-390x844-viewport.png) |

Additional1120×700 open-panel captures: [DAW](shell/sylune-daw-1120x700-viewport.png), [workbench](shell/sylune-workbench-1120x700-viewport.png).

## Raw proof

- [608-test exact raw TAP, deterministic gzip](tests.tap.gz):35suites,608pass,0fail/cancel/skip/TODO. Decompress with `gzip -dc`.
- [Final build log](build.txt), [original cleanup verifier](cleanup.txt), [live preview receipt](live-preview.txt).
- [Shared-shell production browser JSON](shell/browser.json):5grouped checks,18route transitions,143→143listeners, actual state/DOM retention, all10responsive capture pairs, unconnected Sylune/keyboard/focus checks, persisted-event policy, reduced motion and idempotent cleanup. Opening/DAW ordinary performance samples are included.
- [DAW production/native graph JSON](daw/browser.json):10groups,4downloads, six native graph cases and exact file-origin reopen/mix proof. Generated audio downloads are identified by byte counts and hashes, not retained as a large PCM dataset.
- [Preserved workbench JSON](workbench/report.json):26groups,13downloads,18capture pairs/36PNGs. Original absolute scratch output paths are retained in the raw report; corresponding PNGs are copied into `workbench/` here. Generated audio download hashes remain in the report.
- [Supplemental traced baseline comparison — **FAIL**, four cold budget violations](performance/comparison.json). All8trace captures are retained as deterministic `.trace.json.gz`; all4warm samples pass. See the checkpoint report for comparisons and unresolved cold/CPU raster limitations. This result is NOT counted as a passing performance gate.
- [Superseded initial workbench harness failure](superseded-attempt/workbench-hidden-heading-failure.json): first `h1` became hidden after Home was introduced. The final harness scopes the same keyboard action/assertion to `.intro h1`. No assertion was removed. The original large frame outliers are retained here and in the final normal run.
- [Exact fetch failure](dependency/fetch.txt), [GitHub commit response](dependency/github-commit.json), [GitHub error](dependency/github-error.txt), [prepublication remote identities](dependency/remote-before-publication.txt). Requested `afd08b938349eca124db6fb4c5ab8cb26e53f7b9` remains inaccessible.
- [SHA256 manifest](sha256.json): exact bytes of all files in this evidence directory other than the manifest itself.

## Reproduction

Use locked dependencies with lifecycle scripts disabled (`npm ci --ignore-scripts --no-audit --no-fund`), then `npm run build`. Production preview: `npm run preview -- --host 0.0.0.0 --port 4173 --strictPort`; source graph proof: `npm run dev -- --host 0.0.0.0 --port 4174 --strictPort`. Vite accepts `.e2b.app` preview hosts.

The existing validation toolkit audit requires a private `/tmp/onverse-browser-tools-*` directory, a scripts-free private manifest, exact pinned `@sparticuz/chromium@153.0.0` and `puppeteer-core@25.14.0`, registry integrity hashes and exactly43packages. Do not run this disabled-sandbox harness on user files or untrusted pages.

```sh
node --test tests/unit/*.test.js tests/audio/*.test.js tests/ui/*.test.js
python3 scripts/validation/verify-cleanup.py
node scripts/validation/run-shell-browser.mjs "$PRIVATE_AUDITED_TOOLKIT"
node scripts/validation/run-daw-browser.mjs "$PRIVATE_AUDITED_TOOLKIT"
node scripts/validation/run-workbench-browser.mjs "$PRIVATE_AUDITED_TOOLKIT" --cpu-renderer
```

Run browser performance work sequentially, not alongside other browser/test processes. To reproduce the diagnostic comparison, build an isolated **plain archive** of exact a172 (without switching branches or overwriting source), serve its self-contained `dist/index.html` on loopback4175 and run `node scripts/validation/run-shell-performance-comparison.mjs "$PRIVATE_AUDITED_TOOLKIT"`. The comparison collects all eight samples before asserting the unchanged50ms/30fps gates; the preserved run exits1. Chrome tracing adds instrumentation overhead, and this is Linux CPU-raster data, not native GPU qualification.

The authoritative full owner experience/Linked Sessions brief and prior multitrack implementation report remain in `docs/design/COSMIC_EXPERIENCE_DELIVERABLES_20261017.md` and `docs/engineering/DAW_IMPLEMENTATION_20261017.md`. This evidence does not supersede outstanding requirements or claim listening/audio-standards/native/security results.
