# MusicOnVerse

A local music-production application combining a cinematic cosmic environment
with real audio analysis, editing and production workflows. The owner's
Logic Pro–like multitrack DAW is active implementation scope, not a future-only
proposal. Do not confuse the existing single-file workbench or experimental
session modules with a finished professional DAW.

## Current application and collaboration

Delivery: `arena/14df8ffa-onverse` / [PR4](https://github.com/The-Mhood/onverse/pull/4).
P owns the corresponding presentation on
[PR8](https://github.com/The-Mhood/onverse/pull/8); B is retired. Earlier P UI is
already integrated. The current cinematic result is **not owner-accepted**.
No main merge or PR closure is authorized by publication.

The preserved workbench supports local import/demo, analysis/reference comparison,
playback/A–B, region crop/export, Master Fix/manual adjustments and conversion/
download. Built-in reference profiles are heuristics, not measured chart tracks.
New multitrack capabilities and their actual evidence are recorded in the
[work queue](docs/engineering/WORK_QUEUE.md), not inferred from UI illustrations.

## Develop and verify

Use a compatible Node22+ runtime and the committed lockfile. For web work without
Electron binary downloads or dependency lifecycle execution:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
node --test tests/unit/*.test.js tests/audio/*.test.js tests/ui/*.test.js
npm run preview -- --host 0.0.0.0 --port 4173 --strictPort
```

For Arena previews, scope Vite's additional allowed host to `.e2b.app` through
`__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`; do not disable all host checking or put
sandbox localhost URLs into browser-facing service calls. The Electron shell loads
the generated `dist/index.html`; Linux browser/build proof is not native packaging
qualification. Existing signing/release commands and updater URL are not release
acceptance. No dependency upgrades or release operations are part of cleanup.

## Read first

- [Collaboration and safety](AGENTS.md)
- [Architecture: actual runtime versus experimental mechanisms](docs/ARCHITECTURE.md)
- [Canonical visual brief](docs/design/DESIGN_BRIEF.md)
- [Implementation ownership/handoff](docs/engineering/UI_IMPLEMENTATION_HANDOFF.md)
- [Experimental foundations](docs/engineering/EXPERIMENTAL_FOUNDATIONS.md)
- [Cleanup, original-document/icon recovery and per-file ledger](docs/engineering/CLEANUP_20261017.md)

The original13-image reference pack remains available at its pinned project source;
no duplicate33MB import is necessary. Full DAW, cinematic fidelity, persistent-native
recovery, AI/plugin/MIDI support and audio/security release acceptance must be
reported individually with evidence, never implied by a green build.
