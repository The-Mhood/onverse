# MusicOnVerse

A local audio analysis, processing, and conversion prototype evolving toward a professional music-production environment. **This repository does not yet implement a multitrack DAW, persistent sessions, Linked Sessions, external plugin hosting, or an AI command executor.**

## Start here

| Read | Purpose |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Collaboration authority, ownership, isolation, review, and safety rules |
| [Project guide](docs/engineering/PROJECT_GUIDE.md) | Actual capabilities, source map, contracts, limitations, and validation |
| [Work queue](docs/engineering/WORK_QUEUE.md) | Current coordination state and historical task/result evidence |
| [Design brief](docs/design/DESIGN_BRIEF.md) | Canonical settled visual direction; scoped implementation is governed by the dated handoff |
| [agent-b master prompt](docs/engineering/AGENT_B_MASTER_PROMPT.md) | Reusable onboarding context; deliberately assigns no feature/task |
| [Metering contract and research](docs/engineering/AUDIO_METERING_CONTRACT.md) | Proposed interfaces, measured evidence, and unresolved audio-safety limits |
| [Architecture working draft](docs/ARCHITECTURE.md) | Proposed session/Linked Sessions semantics, transaction/recovery rules and proof gate; not an installed API |
| [Product vision](docs/PRODUCT_VISION.md) / [roadmap](docs/ROADMAP.md) | Reconciled intent and incremental proof/test plan; review drafts, not shipped features or task assignments |

Read the rules, guide, current queue notice, and design brief before changing anything. The queue retains historical snapshots: read its latest notices/results, not just an older task entry.

## Repository state and collaboration

The lead works on fixed `arena/b25c318e-onverse`; engineering/onboarding is delivered through [PR #3](https://github.com/The-Mhood/onverse/pull/3) into `main`. The owner authorized its merge only after whole-PR review/fixes. The [2026-10-15 handoff](docs/engineering/UI_IMPLEMENTATION_HANDOFF.md) and COORD-006 result on that PR supply the actual merge M and conditional Slice A grant. Recheck live refs/PR result: pre-merge documents and branch names do not prove integration.

The separate [draft architecture PR #1](https://github.com/The-Mhood/onverse/pull/1) remains **unmerged**. CORE-007 explicitly reconciles its architecture, product vision and roadmap at the existing paths as working drafts for review, with attribution and later Linked Sessions constraints. These are not installed APIs, accepted POC defaults, executed tests or a PR merge. Its original README/engineering standards are not adopted; overlapping files require deliberate reconciliation, not a wholesale merge merely to onboard an agent.

The lead owns architecture/audio/application/domain contracts and integration. **agent-b**, on its separate fixed UI branch, receives the exclusive dated Slice A presentation reservation in the handoff, activated after actual M and its own preservation/ancestry/ownership acknowledgment; no new owner approval is needed for the settled choices. Orbit Mode is a later separate feature-flagged spike with unchanged createStage API. Worker checkout/receipt/start remain unverified here; preserve all unknown/unpublished work. Codex is inactive. Architecture drafts do not grant implementation of future capabilities.

## Local development

First inspect the checkout and preserve all existing work. Use the committed lockfile and a compatible Node/npm version; Node 22.22.3 and npm 10.9.8 were used for the documented Linux checks. A clean dependency installation can run lifecycle scripts and download binaries: follow the applicable environment/owner authorization rather than installing during a read-only audit.

```bash
# When a locked dependency install is authorized:
npm ci

# Web development:
npm run dev

# Production web build; writes ignored dist/:
npm run build
```

For a proxied development preview, bind to `0.0.0.0` and allow the actual preview hostname using narrowly scoped Vite configuration/environment. Do not broadly disable host checks, and do not put sandbox localhost URLs into browser-facing service calls. The Electron shell loads `dist/index.html`, not the Vite dev URL.

### Existing checks

```bash
node --test tests/unit/*.test.js tests/audio/*.test.js
node scripts/test-analyze.mjs
```

At the 2026-10-15 COORD-006 review: **154 tests, 151 passes, 3 known legacy LUFS TODO cases, 0 unexpected failures** (includes nine actual-controller failure-boundary cases). This is not complete audio correctness or professional mastering certification. Strict diagnostics, limitations, and UI verification requirements are in the [project guide](docs/engineering/PROJECT_GUIDE.md).

No npm test/lint/typecheck/UI-test scripts are currently configured. Report missing tooling as unconfigured, not passed. Do not add dependencies or run signing/release/update operations without separately approved scope.

`README-BUILD.txt` contains older distribution instructions, including prebuilt/legacy/signing assumptions. It is historical packaging guidance, not proof that a prebuilt app is present or that macOS/legacy packaging works. The updater feed in `package.json` is a placeholder; signing, notarization, release feeds, and platform support require explicit validation before distribution.

## Change discipline

Keep units small, reversible, and honestly validated. Do not move source files, migrate frameworks, change dependencies, or implement future capabilities merely to make the repository look tidier. Use isolated worker branches/workspaces where the environment permits, exact path ownership, reviewed commits/PRs, and explicit integration decisions. See [AGENTS.md](AGENTS.md) for the full protocol.
