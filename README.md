# MusicOnVerse

A local audio analysis, processing, and conversion prototype evolving toward a professional music-production environment. **This repository does not yet implement a multitrack DAW, persistent sessions, Linked Sessions, external plugin hosting, or an AI command executor.**

## Start here

| Read | Purpose |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Collaboration authority, ownership, isolation, review, and safety rules |
| [Project guide](docs/engineering/PROJECT_GUIDE.md) | Actual capabilities, source map, contracts, limitations, and validation |
| [Work queue](docs/engineering/WORK_QUEUE.md) | Current coordination state and historical task/result evidence |
| [Design brief](docs/design/DESIGN_BRIEF.md) | Canonical owner-supplied UI direction; not implementation approval |
| [agent-b master prompt](docs/engineering/AGENT_B_MASTER_PROMPT.md) | Reusable onboarding context; deliberately assigns no feature/task |
| [Metering contract and research](docs/engineering/AUDIO_METERING_CONTRACT.md) | Proposed interfaces, measured evidence, and unresolved audio-safety limits |

Read the rules, guide, current queue notice, and design brief before changing anything. The queue retains historical snapshots: read its latest notices/results, not just an older task entry.

## Repository state and collaboration

The lead works on `arena/b25c318e-onverse`; engineering and this onboarding material are delivered through [draft PR #3](https://github.com/The-Mhood/onverse/pull/3), targeting `main`. Do not assume `main` contains them. Recheck live refs and PR state; branch names and documentation are not proof of synchronization.

The separate [draft architecture PR #1](https://github.com/The-Mhood/onverse/pull/1) remains an **unmerged proposal**, not the current implementation or an approved roadmap. Its proposed README is also not this current onboarding guide. Reconcile overlapping documentation explicitly during future review; do not replace this guide wholesale or merge the proposal merely to onboard an agent.

The lead owns architecture, audio/application/domain contracts, coordination, and integration. The future UI collaborator is **agent-b**; Codex is no longer active. The owner will announce agent-b's appointment and specific work. Onboarding is not an editing grant, a task assignment, or evidence of dispatch. Keep unknown/unpublished previous work intact.

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
node --test tests/audio/analyzerRegression.test.js tests/audio/integratedLoudnessCandidate.test.js tests/unit/analysisService.test.js tests/unit/buildProcessingPlan.test.js
node scripts/test-analyze.mjs
```

At the 2026-10-15 audit: **145 tests, 142 passes, 3 known legacy LUFS TODO cases, 0 unexpected failures**. This is not complete audio correctness or professional mastering certification. Strict diagnostics, limitations, and UI verification requirements are in the [project guide](docs/engineering/PROJECT_GUIDE.md).

No npm test/lint/typecheck/UI-test scripts are currently configured. Report missing tooling as unconfigured, not passed. Do not add dependencies or run signing/release/update operations without separately approved scope.

`README-BUILD.txt` contains older distribution instructions, including prebuilt/legacy/signing assumptions. It is historical packaging guidance, not proof that a prebuilt app is present or that macOS/legacy packaging works. The updater feed in `package.json` is a placeholder; signing, notarization, release feeds, and platform support require explicit validation before distribution.

## Change discipline

Keep units small, reversible, and honestly validated. Do not move source files, migrate frameworks, change dependencies, or implement future capabilities merely to make the repository look tidier. Use isolated worker branches/workspaces where the environment permits, exact path ownership, reviewed commits/PRs, and explicit integration decisions. See [AGENTS.md](AGENTS.md) for the full protocol.
