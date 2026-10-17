# Shared application shell — verified partial checkpoint, 2026-10-17

**Status: requested presentation checkpoint is NOT complete.** The independent shared-host implementation is running and verified, but P's exact `afd08b938349eca124db6fb4c5ab8cb26e53f7b9` presentation package is not retrievable. The running opening uses the existing 2.5D presentation plus a disclosed baseline phase cue, **not** the requested cinematic renderer or final visual acceptance.

- Branch: `arena/14df8ffa-onverse`.
- Runtime/source commit: `eca5aa9d555bd39940b55508875f07d1b3f3a658`, based on published `a172fcf99be909824dc51f759fe962be611b48ce`. Evidence is published in the following commit on the same branch; use `git rev-parse HEAD` for that final publication identity.
- [Live production application](https://4173-iy0ptvfql17xhsa5cqu3k.e2b.app).
- [Evidence and screenshot index](evidence/shell-integration-20261017/README.md).
- Production HTML: **509424 bytes**, SHA256 `a286014ca38702961b6e2a5ad052629e1de098b9a180758e7bc6d279a0ce4576`. Rebuild and live response using the preview Host header match exactly. No built bundle is committed.

## Implemented in the actual entry

`src/main.js` now composes one workbench controller, one real multitrack controller, one continuous environment and one shared shell. Navigation starts at Home and opens Audio shaping or Arrangement; names remain provisional. The real mix-to-workbench bridge uses the same route authority. No duplicate app/demo entry, replacement audio/project store or hidden legacy fallback was added.

The host pauses outgoing audio before route activation. Controllers and destination DOM are retained, preserving loaded source, project/history and view state. Each destination has explicit external-navigation/environment ownership options so the real entry does not duplicate listeners or environment mounts. Hidden destinations and Sylune help do not receive playback shortcuts. Destination scroll positions are retained. Brand navigation and the skip link target the current real destination; focus is moved out of hidden content after navigation without stealing initial-load focus.

Sylune is a single persistent, dismissible, responsive panel, clearly **Not connected**. Its context and static workflow guide reflect the active destination. It does not accept commands, call a provider, fabricate responses or modify audio. Escape restores focus; a real modal retains Escape priority. Desktop open-panel layouts reserve space; mobile uses a closable, scrollable bottom panel. The initial fixed-position specificity bug was caught in screenshots and corrected; browser assertions now check computed positioning and viewport bounds.

`destinationLifecycle.js` provides validated destinations, suspend and idempotent async cleanup. Cleanup attempts every registered resource even if another fails. Persisted `pagehide` pauses without destroying retained project/controller state; nonpersisted exit drains resources. The optional updater bridge is unchanged. Browser download initiation remains distinct from verified filesystem persistence; the conservative unsaved-project warning remains.

P-owned `src/ui/presentation/rebuild/**`, audio/DSP, domain, DAW/workbench/analysis controllers, Electron and dependency manifests/lock are unchanged from a172. Existing Master Fix, import/analysis/reference/playback/A–B/crop/export/manual adjustments/conversion/download workflows remain on their original implementations.

## Exact integration blocker and direct coordination

Initial and final exact fetches return `upload-pack: not our ref` (exit128). The GitHub commit API returns HTTP422, `No commit found for SHA`. Published P branch `arena/31c3346b-onverse` remains `295e0d31716ceb9d8e7cd978381b46450ceb73ea`; no exact source object or asset package was delivered during this checkpoint. This establishes an unavailable dependency, not that P never made a local commit.

Direct P requests, without owner relay:

- [Exact source publication/archive and contract request](https://github.com/The-Mhood/onverse/pull/8#issuecomment-6235504344).
- [Implemented host boundary and lifecycle evidence](https://github.com/The-Mhood/onverse/pull/8#issuecomment-6235615379).

The concrete shell boundary is `mount(root,{onNavigate})` → `renderDestination(opening|workbench|daw)`, `captureScroll()`, `updateContext({project,tracks,source})`, `dispose()`. The current environment mount has `dispose()`. P must supply the exact retrievable source/asset hashes, CSS entry, mount/dispose ownership, launch/arrival/drift/nav callbacks and reduced-motion/visibility/context-loss cleanup contract. Lead did not edit P's reserved files, manufacture that package, push P's branch, merge/close a PR or rewrite history.

## Fresh verification on this runtime

| Check | Result |
|---|---|
| Production build / preview Host response | PASS; exact hash above |
| Complete Node suite | **608/608 PASS**, 35 suites; 0 fail/cancel/skip/TODO, including 8 added lifecycle/shell checks |
| Existing workbench browser regression | **26 groups PASS**, 13 actual generated-audio/report downloads; 18 capture pairs = 36 PNGs |
| Actual multitrack browser/native graph proof | **10 groups PASS**, 4 downloads; file-origin project roundtrip, real edits/mix bridge, native six-case comparison at unchanged `1e-6` tolerance; max error `1.862645149230957e-8` |
| New integrated shell browser | **5 grouped checks PASS**, 10 responsive capture pairs = 20 PNGs; includes all four requested views at desktop1480×920 and mobile390×844 |
| Route lifetime/state proof | 18 transitions; identical environment/destination DOM; loaded source, three-track named project and zoom retained; listeners **143→143** |
| Exit / reduced-motion proof | Repeated exit: **0 listeners / 0 pending rAF / 1 created context, 1 closed**; shell nodes removed. Reduced motion: **0 running CSS animations** |
| BFCache event policy | Synthetic persisted `pagehide/pageshow` retains state and contexts; **not native browser BFCache qualification** |
| Completed original cleanup | PASS:80 classified /60 authored unchanged /8 reconciled docs /20 exact originals archived /12 retired icons absent |

The previous workbench harness initially clicked the first `h1`, now the hidden opening heading. The unsuccessful run is retained separately. The selector was scoped to `.intro h1`; the original keyboard playback assertion and every audio, comparison, contrast, precision and performance threshold remain unchanged. The DAW harness explicitly selects Arrangement from Home, including file-origin startup, instead of assuming Arrangement is the default route.

All browser work uses the audited 43-package, pinned, scripts-disabled Chromium/Puppeteer toolkit, local app pages and generated PCM only. No user audio, provider, uploads, external pages, listening or native/security qualification is implied.

## Performance: investigation retained, NOT cleared

Normal nontraced five-second browser samples retain the existing **p95≤50ms / mean≥30fps** thresholds:

| View | 1120×700 mean / p95 / max | 1480×920 mean / p95 / max |
|---|---|---|
| Opening | 44.25fps /50ms /100ms |45.90fps /33.4ms /50ms |
| DAW |49.84fps /50ms /150ms |59.80fps /16.7ms /33.3ms |
| Workbench full regression |45.25fps /33.4ms /133.346ms |45.25fps /33.4ms /433.3ms |

The 433.3ms outlier was not hidden by a passing p95. An isolated plain archive of exact a172 was built without altering the working branch. Both production builds were then measured sequentially with the same generated demo + real Master Fix workflow and Chrome tracing. **The supplemental traced comparison is FAIL: four cold samples exceed the unchanged budget** (two baseline, two shell). All four warm samples pass. Full traces and failure JSON are retained, not replaced by only the successful measurements.

| Build / width | First mean / p95 / max | Warm mean / p95 / max |
|---|---|---|
| a172 /1120 |34.46fps /66.7ms /83.4ms |44.50fps /33.4ms /50ms |
| shell /1120 |34.97fps /66.7ms /100ms |42.92fps /33.4ms /50.1ms |
| a172 /1480 |26.51fps /133.2ms /316.6ms |42.86fps /33.4ms /50ms |
| shell /1480 |26.91fps /116.7ms /300ms |41.13fps /49.9ms /83.3ms |

The first large baseline/shell windows record 198ms/176ms main-thread long tasks; warm windows record none. GC events are ≤~11ms individually in those first windows, so GC alone is not an established explanation. Both builds show similar cold stalls and warm main-thread task totals (~0.77s baseline /~0.76s shell at1480). These results do not isolate a severe shell-specific regression, but also do **not** prove a root cause, a smooth60fps renderer, or resolution of cold raster/trace overhead. Supplemental traced samples impose additional instrumentation cost; they are not silently substituted for normal tests. No budget was loosened. Native GPU/mobile hardware profiling and the actual missing P renderer remain required before performance/visual acceptance.

## Remaining active product work

The requested exact presentation integration and final cinematic opening/transitions/shared-world/Sylune visual acceptance remain blocked. The existing 2.5D composition and new baseline launch/arrival cue are **not** claimed as true3D, volumetric or the owner's accepted experience. The real DAW remains the bounded working increment documented in the prior implementation report, not the complete Logic-inspired product.

Real Sylune provider/execution, recording, plugins, buses, automation, MIDI and real DAW Linked Sessions registry/render/service/UI with provenance, reviewed approval, stale/cycle/conflict/cancellation/last-valid recovery remain outstanding. No fake success controls were added. Original audio assertions/tolerances are unchanged. Historical dependency advisories, native Mac packaging/signing/notarization/release/security, hardware performance, listening and audio-standards gates remain unresolved; this checkpoint does not invent results for them.
