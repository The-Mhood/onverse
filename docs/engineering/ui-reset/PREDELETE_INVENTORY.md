# UI-RESET-001 — complete pre-deletion path inventory

Observed 2026-10-16T14:42:12Z; 168 unique paths across all four live GitHub branch tips, closed PR5 head and the preserved local worktree. Local pre-audit file count: 131.

Git blobs/sizes/modes per snapshot and local SHA256/size are in PREDELETE_INVENTORY.json. This is path-level ownership, NOT a deletion log. No UI has been deleted. B-only paths below are absent from main/local unless explicitly present in the snapshot columns.

Sources: **M**=GitHub main, **C**=core PR4, **B**=closed PR5, **A**=architecture branch, **K**=merged core branch, **L**=local pre-audit.

## PROTECTED_REPOSITORY

| Path | Sources | Disposition |
| --- | --- | --- |
| `.gitignore` | M C B A K L | Lead |

Preserve unrelated repository/configuration; investigate before any deletion.

## RECORD_SUPERSEDE_NOT_DESIGN

| Path | Sources | Disposition |
| --- | --- | --- |
| `AGENTS.md` | M C B K L | Lead records; P proposes factual cleanup |
| `README-BUILD.txt` | M C B A K L | Lead records; P proposes factual cleanup |
| `README.md` | M C B A K L | Lead records; P proposes factual cleanup |
| `docs/ARCHITECTURE.md` | M C B A K L | Lead records; P proposes factual cleanup |
| `docs/ENGINEERING_STANDARDS.md` | A | Lead records; P proposes factual cleanup |
| `docs/PRODUCT_VISION.md` | M C B A K L | Lead records; P proposes factual cleanup |
| `docs/ROADMAP.md` | M C B A K L | Lead records; P proposes factual cleanup |
| `docs/design/DESIGN_BRIEF.md` | M C B K L | Lead records; P proposes factual cleanup |
| `docs/design/proposals/agent-b-daw-sylune-proposal.md` | B | Lead records; P proposes factual cleanup |
| `docs/engineering/AGENT_B_MASTER_PROMPT.md` | M C B K L | Lead records; P proposes factual cleanup |
| `docs/engineering/AUDIO_METERING_CONTRACT.md` | M C B K L | Lead records; P proposes factual cleanup |
| `docs/engineering/CORE_INTEGRATION_REVIEW.md` | L | Lead records; P proposes factual cleanup |
| `docs/engineering/LINKED_MEDIA_RECOVERY_PROBE.md` | C L | Lead records; P proposes factual cleanup |
| `docs/engineering/LINKED_UPDATE_SERVICE.md` | L | Lead records; P proposes factual cleanup |
| `docs/engineering/LINKED_WRITER_RECOVERY.md` | L | Lead records; P proposes factual cleanup |
| `docs/engineering/OFFLINE_RENDER_PROBE.md` | C L | Lead records; P proposes factual cleanup |
| `docs/engineering/PACKAGED_RUNTIME_ENTRY_REVIEW.md` | L | Lead records; P proposes factual cleanup |
| `docs/engineering/PRODUCTION_SESSION_STORAGE.md` | L | Lead records; P proposes factual cleanup |
| `docs/engineering/PROJECT_GUIDE.md` | M C B K L | Lead records; P proposes factual cleanup |
| `docs/engineering/SESSION_APPLICATION_IPC.md` | L | Lead records; P proposes factual cleanup |
| `docs/engineering/SESSION_HOST_FOUNDATION.md` | L | Lead records; P proposes factual cleanup |
| `docs/engineering/SESSION_RENDERED_REVIEW.md` | L | Lead records; P proposes factual cleanup |
| `docs/engineering/SESSION_RUNTIME_QUALIFICATION.md` | L | Lead records; P proposes factual cleanup |
| `docs/engineering/SORA_ASSET_REVIEW.json` | L | Lead records; P proposes factual cleanup |
| `docs/engineering/SYLUNE_PRESENTATION_CONTRACT.md` | L | Lead records; P proposes factual cleanup |
| `docs/engineering/UI_BASELINE_DECISION.md` | M C B K L | Lead records; P proposes factual cleanup |
| `docs/engineering/UI_IMPLEMENTATION_HANDOFF.md` | M C B K L | Lead records; P proposes factual cleanup |
| `docs/engineering/UNIVERSE_VISUAL_HANDOFF.md` | L | Lead records; P proposes factual cleanup |
| `docs/engineering/USEFUL_RANGE_PROFILE.md` | L | Lead records; P proposes factual cleanup |
| `docs/engineering/WORK_QUEUE.md` | M C B K L | Lead records; P proposes factual cleanup |

Historical docs are not active UI fallback. Reset supersedes B grants/layout/boards; retain engineering/legal/history, clearly mark stale visual guidance. No old refs as new design foundation.

## ASSET_CONFIG_GATE

| Path | Sources | Disposition |
| --- | --- | --- |
| `build/icon.icns` | M C B A K L | P asset list + Lead integration |
| `build/icon.iconset/icon_128x128.png` | M C B A K L | P asset list + Lead integration |
| `build/icon.iconset/icon_128x128@2x.png` | M C B A K L | P asset list + Lead integration |
| `build/icon.iconset/icon_16x16.png` | M C B A K L | P asset list + Lead integration |
| `build/icon.iconset/icon_16x16@2x.png` | M C B A K L | P asset list + Lead integration |
| `build/icon.iconset/icon_256x256.png` | M C B A K L | P asset list + Lead integration |
| `build/icon.iconset/icon_256x256@2x.png` | M C B A K L | P asset list + Lead integration |
| `build/icon.iconset/icon_32x32.png` | M C B A K L | P asset list + Lead integration |
| `build/icon.iconset/icon_32x32@2x.png` | M C B A K L | P asset list + Lead integration |
| `build/icon.iconset/icon_512x512.png` | M C B A K L | P asset list + Lead integration |
| `build/icon.iconset/icon_512x512@2x.png` | M C B A K L | P asset list + Lead integration |
| `build/icon_1024.png` | M C B A K L | P asset list + Lead integration |
| `scripts/make-icon.mjs` | M C B A K L | P asset list + Lead integration |

Old visual icon/generator must leave active tree; blocked on safe removal/replacement of package icon references. Do not delete before build-reference review.

## PROTECTED_INTEGRATION

| Path | Sources | Disposition |
| --- | --- | --- |
| `electron-builder.legacy.cjs` | M C B A K L | Lead |
| `electron/main.cjs` | M C B A K L | Lead |
| `electron/notarize.cjs` | M C B A K L | Lead |
| `electron/preload.cjs` | M C B A K L | Lead |
| `package-lock.json` | M C B A K L | Lead |
| `package.json` | M C B A K L | Lead |
| `scripts/inline-dist.mjs` | M C B A K L | Lead |
| `vite.config.ts` | M C B A K L | Lead |

Preserve lifecycle/security/IPC/deps/build. Icon-only package field change needs exact reviewed lead diff; no P directory-wide grant.

## P_REPLACE_ENTRY

| Path | Sources | Disposition |
| --- | --- | --- |
| `index.html` | M C B A K L | P |

Remove old theme/font/visual metadata; preserve valid minimal app boot and product name. No new design until references.

## P_REMOVE_ASSET

| Path | Sources | Disposition |
| --- | --- | --- |
| `public/favicon.svg` | M C B A K L | P |
| `src/assets/fonts/README.md` | M C B K L | P |
| `src/assets/fonts/fonts.css` | B | P |
| `src/assets/fonts/manifest.json` | M C B K L | P |
| `src/assets/fonts/notices.js` | B | P |
| `src/assets/fonts/orbitron-OFL.txt` | M C B K L | P |
| `src/assets/fonts/orbitron-latin-wght-normal.woff2` | M C B K L | P |
| `src/assets/fonts/rajdhani-OFL.txt` | M C B K L | P |
| `src/assets/fonts/rajdhani-latin-400-normal.woff2` | M C B K L | P |
| `src/assets/fonts/rajdhani-latin-500-normal.woff2` | M C B K L | P |
| `src/assets/fonts/rajdhani-latin-600-normal.woff2` | M C B K L | P |
| `src/assets/fonts/rajdhani-latin-700-normal.woff2` | M C B K L | P |
| `src/assets/fonts/rajdhani-latin-ext-400-normal.woff2` | M C B K L | P |
| `src/assets/fonts/rajdhani-latin-ext-500-normal.woff2` | M C B K L | P |
| `src/assets/fonts/rajdhani-latin-ext-600-normal.woff2` | M C B K L | P |
| `src/assets/fonts/rajdhani-latin-ext-700-normal.woff2` | M C B K L | P |
| `src/assets/fonts/share-tech-mono-OFL.txt` | M C B K L | P |
| `src/assets/fonts/share-tech-mono-latin-400-normal.woff2` | M C B K L | P |
| `src/assets/fonts/sora-OFL.txt` | B | P |
| `src/assets/fonts/sora-latin-ext-wght-normal.woff2` | B | P |
| `src/assets/fonts/sora-latin-wght-normal.woff2` | B | P |

Remove old binaries/style/manifest/notices and favicon with all active references; remove a license only with all corresponding shipped font bytes; never reuse as new-design foundation.

## PROTECTED_CORE

| Path | Sources | Disposition |
| --- | --- | --- |
| `scripts/test-analyze.mjs` | M C B A K L | Lead |
| `scripts/validation/compare-loudness-candidate.mjs` | M C B K L | Lead |
| `scripts/validation/integrated-loudness-candidate.mjs` | M C B K L | Lead |
| `scripts/validation/libebur128-reference.c` | M C B K L | Lead |
| `scripts/validation/linked-media-recovery-probe.mjs` | C L | Lead |
| `scripts/validation/offline-render-fixtures.mjs` | C L | Lead |
| `scripts/validation/packaged-runtime-candidate/sessionRuntimeProbe.cjs` | L | Lead |
| `scripts/validation/prepare-packaged-runtime-probe.mjs` | L | Lead |
| `scripts/validation/probe-sqlite-ownership.mjs` | L | Lead |
| `scripts/validation/run-linked-render-probe.mjs` | L | Lead |
| `scripts/validation/run-linked-session-integration.mjs` | L | Lead |
| `scripts/validation/run-metering-reference.mjs` | M C B K L | Lead |
| `scripts/validation/run-offline-render-probe.mjs` | C L | Lead |
| `scripts/validation/run-session-application-integration.mjs` | L | Lead |
| `scripts/validation/run-session-range-integration.mjs` | L | Lead |
| `scripts/validation/run-session-runtime-qualification.mjs` | L | Lead |
| `scripts/validation/session-runtime-contract.mjs` | L | Lead |
| `src/application/analysis/analysisService.js` | M C B K L | Lead |
| `src/application/linkedSessions/linkedUpdateService.js` | L | Lead |
| `src/application/sessions/sessionApplication.js` | L | Lead |
| `src/application/sessions/sessionWireContract.js` | L | Lead |
| `src/audio/analyzer.js` | M C B A K L | Lead |
| `src/audio/dsp.js` | M C B A K L | Lead |
| `src/audio/genre.js` | M C B A K L | Lead |
| `src/audio/linkedSessions/pcm.js` | L | Lead |
| `src/audio/linkedSessions/renderLinkedDestination.js` | L | Lead |
| `src/audio/linkedSessions/renderSelection.js` | L | Lead |
| `src/audio/processor.js` | M C B A K L | Lead |
| `src/audio/reference.js` | M C B A K L | Lead |
| `src/domain/linkedSessions/linkedSessionContract.js` | L | Lead |
| `src/domain/linkedSessions/renderProfiles.js` | L | Lead |
| `src/domain/processors/buildProcessingPlan.js` | M C B K L | Lead |
| `src/infrastructure/linkedSessions/generationStore.js` | L | Lead |
| `src/infrastructure/linkedSessions/linuxWriterLock.js` | L | Lead |
| `tests/audio/analyzerRegression.test.js` | M C B K L | Lead |
| `tests/audio/integratedLoudnessCandidate.test.js` | M C B K L | Lead |
| `tests/audio/linkedDestinationRender.test.js` | L | Lead |
| `tests/audio/linkedSelectionRender.test.js` | L | Lead |
| `tests/audio/offlineRenderFixtures.test.js` | C L | Lead |
| `tests/fixtures/audioBuffers.js` | M C B K L | Lead |
| `tests/fixtures/linkedRangeFixture.js` | L | Lead |
| `tests/fixtures/linkedSessionStoreFixture.js` | L | Lead |
| `tests/fixtures/linkedWriterProcess.mjs` | L | Lead |
| `tests/fixtures/meteringReferenceCases.js` | M C B K L | Lead |
| `tests/unit/analysisService.test.js` | M C B K L | Lead |
| `tests/unit/buildProcessingPlan.test.js` | M C B K L | Lead |
| `tests/unit/linkedGenerationRecovery.test.js` | L | Lead |
| `tests/unit/linkedGenerationStore.test.js` | L | Lead |
| `tests/unit/linkedMediaRecoveryProbe.test.js` | C L | Lead |
| `tests/unit/linkedRangeProfile.test.js` | L | Lead |
| `tests/unit/linkedRenderedReview.test.js` | L | Lead |
| `tests/unit/linkedSessionContract.test.js` | L | Lead |
| `tests/unit/linkedUpdateService.test.js` | L | Lead |
| `tests/unit/linkedWriterRecovery.test.js` | L | Lead |
| `tests/unit/packagedRuntimeCandidate.test.js` | L | Lead |
| `tests/unit/sessionApplication.test.js` | L | Lead |
| `tests/unit/sessionRenderedReview.test.js` | L | Lead |
| `tests/unit/sessionRuntimeQualification.test.js` | L | Lead |
| `tests/unit/sessionWireContract.test.js` | L | Lead |

Keep actual DSP/analysis/mastering/conversion/reference/session/Linked/recovery/history/host/validators/proofs/tests, including held local files. No deletion/silent contract changes.

## SHARED_SPLIT

| Path | Sources | Disposition |
| --- | --- | --- |
| `src/main.js` | M C B A K L | Lead + P |

Do not delete wholesale: preserve/extract real controller state/audio/import/reference/crop/analysis/processing/export/reset/update subscription; P replaces presentation only after reviewed split.

## P_REMOVE_PRESENTATION

| Path | Sources | Disposition |
| --- | --- | --- |
| `src/orbit/orbitKeys.js` | B | P |
| `src/orbit/orbitStage.js` | B | P |
| `src/orbit/orbitTextures.js` | B | P |
| `src/scene.js` | M C B A K L | P |
| `src/style.css` | M C B A K L | P |
| `src/ui/draw.js` | M C B A K L | P |
| `src/ui/presentation/cosmicEnvironment.js` | B | P |
| `src/ui/presentation/errorRegion.js` | B | P |
| `src/ui/presentation/licenceDialog.js` | B | P |
| `src/ui/presentation/shell/daw.js` | B | P |
| `src/ui/presentation/shell/header.js` | B | P |
| `src/ui/presentation/shell/icons.js` | B | P |
| `src/ui/presentation/shell/opening.js` | B | P |
| `src/ui/presentation/shell/shell.css` | B | P |
| `src/ui/presentation/shell/shell.js` | B | P |
| `src/ui/presentation/shell/studio.js` | B | P |
| `src/ui/presentation/sylune/panel.js` | B | P |
| `src/ui/presentation/universe/assets/manifest.json` | B | P |
| `src/ui/presentation/universe/shaders.js` | B | P |
| `src/ui/presentation/universe/stage.js` | B | P |
| `src/ui/styles/cosmic.css` | B | P |
| `src/ui/styles/sylune.css` | B | P |

Replace/delete entire old visual implementation after owned caller detachment; no classic/cosmic/Orbit hidden fallback. No engine ownership by path.

## CONTRACT_REVIEW

| Path | Sources | Disposition |
| --- | --- | --- |
| `src/ui/presentation/sylune/contextActions.js` | B | Lead + P |
| `tests/ui/sylunePresentation.test.js` | B | Lead + P |

Separate presentation reducers/prototypes from published SYLUNE DTO/validation coverage; no public-contract removal or weakened safety tests without exact approval.

## P_RETIRE_VISUAL_TEST

| Path | Sources | Disposition |
| --- | --- | --- |
| `tests/orbit/orbitKeys.test.js` | B | P |
| `tests/orbit/orbitStage.test.js` | B | P |
| `tests/ui/cosmicEnvironment.test.js` | B | P |
| `tests/ui/orbitComposition.test.js` | B | P |
| `tests/ui/paletteStatic.test.js` | B | P |
| `tests/ui/presentation.test.js` | B | P |
| `tests/ui/shell.test.js` | B | P |
| `tests/ui/shellSource.js` | B | P |
| `tests/ui/universeStage.test.js` | B | P |

May retire obsolete layout/palette/scene assertions with removed UI; preserve/port behavioral accessibility/error/legal/contract coverage, do not weaken core tests.

## PROTECTED_SEAM_TEST

| Path | Sources | Disposition |
| --- | --- | --- |
| `tests/unit/analysisErrorFlow.test.js` | M C B K L | Lead |

Nine real controller-boundary cases parse main.js today; explicitly migrate seam with unchanged success/failure/cleanup assertions before dropping controller markup.

