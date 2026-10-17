# COORD-010 — owner resolution: shared universe visual work

## HISTORICAL VISUAL HANDOFF — 2026-10-16

[UI-RESET-001](UI_RESET_AUTHORITY.md) supersedes this universe/Orbit/board/font/
palette handoff. P owns the approved visual reset; B is retired. Do not retain any
classic/cosmic/universe fallback or use these old references as the new foundation.
Asset-license review remains historical evidence, not an instruction to ship assets.


2026-10-16. **Current owner authorization; supersedes conflicting earlier COORD-010
breadth/limits for the renderer, main-stage wiring, Orbit camera/motion, palette
and fonts addressed here.** This is implementation permission, not visual/runtime
acceptance. No core dependency, build, audio, session, IPC or Git authority added.

## Approved now / exact scope

- Shared Three.js universe renderer and presentation modules **only under
  `src/ui/presentation/universe/**`**, for visual proof then verified integration.
  Use the existing Three.js dependency; this is not a new framework, GSAP or
  postprocessing-library grant. No directory-wide permission for src/ui, src/scene
  or src/orbit follows from this amendment.
- Specific presentation-only `src/main.js` stage imports/factory selection and
  `ORBIT_SPIKE` integration necessary to use the shared stage behind unchanged
  `createStage(canvas)`. Preserve unrelated mode/navigation/state/action/audio/
  SYLUNE/persistence bindings. No simultaneous lead source editing.
- Studio restyling and already approved presentation modules continue without
  waiting for unrelated engine work. An honest unsupported control is not a
  functioning DAW/AI operation. Do not invent engine results or saving.
- Assets and Sora are conditionally authorized below. Related presentation tests
  may be updated without weakening functional checks. No additional dependency or
  unrelated renderer change without an exact justification/review.

## File-level stage plan / Orbit decision

Inspected remote PR5 **08f87407358890754d6dd4bdb76a8096b46eeb50**; no source edits,
checkout or reference rewrite. Its main imports scene/Orbit factories, sets
`ORBIT_SPIKE = !CLASSIC_SCENE`, instantiates one stage, then calls four methods.
Its Orbit camera/motion is internal to its exported factory:

- PerspectiveCamera, START/TARGET and OrbitControls setup inside `createStage`;
- `onFocus` / LANDMARKS / `focusEase`, `onReset`, controls-start cancellation;
- reduced-motion `drift` / `amp` and per-frame focus interpolation/controls update;
- `orbit:focus` / `orbit:reset` listener registration and disposal.

**Approved `src/orbit/orbitStage.js` diff in the initial replacement plan: empty.**
Those internals need not be changed to select a replacement factory. Preserve
that exact file as the legacy rollback implementation. No unrestricted ownership,
new camera API, shader/body/geometry changes or source extraction is authorized
there by older broad wording. A later genuinely necessary Orbit camera/motion
change must identify its exact symbols/hunks, reason, effects, tests and rollback;
only that specific change can be approved. Other visual work does not wait for it.

Concrete bounded implementation sequence:

1. New `src/ui/presentation/universe/stage.js` exports synchronous
   `createStage(canvas) -> {setSpectrum,setEnergy,setPlaying,dispose}`. Helpers for
   this shared visual stage may live in that authorized prefix, not unrelated
   renderer directories. Own the new camera/motion there; importing existing
   Three.js addons does not grant a dependency change.
2. Support existing canvas events `orbit:focus` with `detail.index`0–2 and
   `orbit:reset`, including reduced-motion behavior and listener cleanup. Preserve
   existing chips/keys/manual reset rather than silently leaving them inert.
   New internal mapping uses the approved scene's corresponding landmarks.
3. Main adds the factory import and a reversible stage-only selector. During the
   proof, preserve current default and opt into the candidate (for example
   `?stage=universe`). Existing `?scene=classic` remains a valid escape route.
   Keep `ORBIT_SPIKE`-dependent shell/keyboard/context behavior consistent; don't
   turn an internal renderer flag into a session/workspace model change.
4. Instantiate **one** chosen stage, not competing legacy/new WebGL contexts or
   duplicate environment loops. Shared stage owns its rendering lifecycle. Verify
   resize, UI switching, playback-driven visual signals and full disposal.
5. After documented proof gates pass, subsequent integration may select universe
   by default without another ordinary-design approval. Keep an explicit legacy
   selector (for example `?stage=orbit-legacy`) and classic path, and record exact
   diff/base so rollback is a stage-selection reversal, not a destructive reset.
   Do not remove old implementation before replacement verification.

This plan approves main-stage factory wiring and a new shared stage, **not** a
change to public stage contract or unrelated main behavior. If source inspection
shows additional necessary changes, propose only those hunks before expanding.

## Boards, palette and visual fidelity

The **latest owner-approved reference boards govern both opening universe and
DAW**, not an earlier steel-blue palette or generic monochrome interpretation.
Use the rich violet, magenta, electric blue, cyan and complementary warm highlights
where the boards show them. Preserve contrast, depth, material realism and dense
professional readability. Avoid monochromatic purple and generic neon cyberpunk.

Earlier palette restrictions mean avoid excessive neon/generic steel-blue—not
remove defining reference colors. Historical B report6202957304 says violet/
magenta literals were removed and statically tested. That is a worker report,
not a verified owner-authored blanket prohibition. Reviewed canonical records
provide no exact owner quote banning these colors. Do not invent one. If an
actual earlier conflicting owner instruction exists, identify its verbatim text,
owner and message/PR source for resolution; meanwhile use this latest explicit
direction. Reconcile obsolete palette tests without dropping meaningful contrast/
status/readability checks.

Record exact board filenames/attachment IDs/version before claiming comparison.
Latest board images and new 1480x920 studio captures are not present in lead's
checkout; no independent visual match is claimed by this authorization.
Procedural planets are not proof of matching geometry/material/lighting fidelity.
List visible mismatches and fix them before calling this direction complete.

## Art assets / exact provenance

Prefer original or properly licensed high-quality 3D/sky assets where they
materially improve fidelity. Procedural art is allowed if it meets the target,
not as an excuse for generic planets or flat placeholders. No paid acquisition,
unlicensed scraping, runtime CDN or new loader/dependency is authorized here.

Before including each asset, record: source/author/version/URL or original creation
provenance; exact local file; original and used-file SHA256; license text/version;
redistribution/self-hosting/commercial-use/modification rights; attribution and
notice location; transformations/derivatives; format/size/resolution; proof views
using it. Record transitive texture/model licenses, not just a hosting site's name.
Generated art is labelled as generated, not called an observed photograph.

Use `src/ui/presentation/universe/assets/manifest.json` for the stage's exact
manifest if needed; keep assets inside the approved module scope unless a specific
additional path is justified. Preserve required license/attribution texts and
verify their inclusion in the built/offline app. Ambiguous/restrictive assets stay
out until resolved. Final manifest must say which assets actually shipped.

## Sora — conditional integration with a verified candidate

Candidate **@fontsource-variable/sora5.3.0**, source tarball SHA512 integrity
verified against registry; only regular named members read, no scripts installed.
Exact two WOFF2 candidates and complete OFL/license/CSS hashes are in
[SORA_ASSET_REVIEW.json](SORA_ASSET_REVIEW.json). Font header checks pass.
Copyright2019 The Sora Project Authors; included SIL OFL1.1 permits embedding and
redistribution with copyright/license retained, not standalone font sale. This is
an engineering license review, not legal certification or binary security audit.
No explicit Reserved Font Name declaration was found after the copyright notice.
Do not alter/rebrand/subset these files without a separate license assessment.

B may integrate those exact unmodified files under `src/assets/fonts/`, add
`sora-OFL.txt`, and update the existing `manifest.json` and `README.md`, CSS
font faces and accessible font-license notice. Copy exact full license, use the
matching source unicode ranges and weights100–800 normal, self-host/inline through
existing build mechanism. No npm dependency addition or font CDN. Existing
Orbitron/Rajdhani/Share Tech Mono/system fonts remain available as fallbacks until
actual build, offline/file loading, layout/metrics/glyph coverage and notices pass.
Different files/versions need exact provenance verification first. Candidate files
are **not vendored or used in the app by lead**; no browser/shipping claim yet.
Report any licensing uncertainty before shipping the font.

## Required evidence before completion

1. **Baseline and revised performance** on same device/browser/GPU/backend/DPR,
   resolution and workload: startup/first frame/asset load, median/p95 frame time,
   jank/long frames, sustained CPU/GPU/memory where measurable, renderer draw calls/
   geometry/texture counts, interaction and existing playback responsiveness.
   Record duration/sample count and limitations. Software WebGL results are not
   representative hardware proof. If baseline cannot be reproduced, report the
   missing comparison; do not invent regression claims or call the gate closed.
2. **Reduced motion:** actual media emulation plus runtime preference changes;
   no decorative camera travel/orbit drift/pulsing needed for status; immediate
   user-requested focus/reset, no residual easing/damping/coasting after input;
   truthful static/audio status. Verify interactions, not merely two identical
   frames that could be stalled rendering. Document every remaining motion.
3. **Captures at1120x700 and1480x920**, explicitly inspect the **1480x920 studio**
   and opening universe; same viewport/state compared to exact approved boards.
   Record geometry/framing, planet/ring/sky/material/lighting/palette/type/depth and
   DAW readability differences. Old known gaps: missing rings, dock overlap,
   incomplete reduced-motion/performance/disposal/control evidence—not accepted.
4. Actual UI/Orbit/stage compatibility tests, relevant core regressions, build,
   offline asset/font/notices check, keyboard/focus, resize/DPR, mode changes,
   controls/keys/reset, context/asset failure behavior and repeated mount/dispose.
   No leaked listeners/RAF/textures/materials or audio workflow regressions.
5. Scope/dependency diff, exact used-asset manifest, remaining mismatches, test
   commands/results and unavailable checks. Keep implementation status distinct
   from screenshot proof, owner acceptance and release.

Proceed within this scope without another ordinary-design approval. Escalate
only a specific conflict/core crossing/extra dependency or genuinely necessary
additional renderer/Orbit diff. Preserve all existing work and fixed branches;
no destructive Git, commit/push/merge/release of held core or unreviewed history
changes. Publication is not worker receipt/start or acceptance.
