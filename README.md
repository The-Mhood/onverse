# MusicOnVerse

**The AI-native music production studio: understand the sound, direct the work, own the result.**

MusicOnVerse is an early-stage desktop audio product built with Vite, browser audio APIs, custom analysis/DSP modules, and Electron. The current application can load audio, inspect technical and spectral characteristics, compare against genre/reference profiles, apply a one-click processing plan, audition A/B results, crop audio, and convert/export supported formats.

The product ambition is broader: make professional audio work more accessible without hiding control from musicians. A user should be able to ask for a change in plain language, target a precise time range or source, preview the proposed processing, and accept, modify, or undo it.

## Product direction

- **AI Sound Engineer:** conversational assistance grounded in measurable audio analysis and explicit, executable actions.
- **Timeline-aware editing:** select a range, source, track or stem; describe the change; preview before committing.
- **A real production workspace:** recording, multitrack arrangement, mixing, automation, effects, mastering, and export—delivered incrementally.
- **A trustworthy audio engine:** deterministic DSP, non-destructive edits, undo/redo, project portability, and honest measurement.
- **A sustainable business:** a useful free entry point, paid creator plans, metered expensive AI/cloud features, and eventually a professional tier.

The vision is intentionally larger than the first release. See the documents below for the staged plan.

## Start here

- [Product vision and business model](docs/PRODUCT_VISION.md)
- [Technical architecture](docs/ARCHITECTURE.md)
- [Roadmap and acceptance criteria](docs/ROADMAP.md)
- [Engineering quality and security](docs/ENGINEERING_STANDARDS.md)

## Current stack

- Vite and vanilla JavaScript ES modules
- Web Audio API and custom DSP/analysis code under `src/audio/`
- Three.js visual stage under `src/scene.js`
- Electron desktop shell under `electron/`
- electron-builder packaging and update wiring

## Run locally

Requires a compatible Node.js version for the installed Vite/Electron toolchain.

```bash
npm install
npm run dev
```

Build the web bundle:

```bash
npm run build
```

Package for macOS:

```bash
npm run dist
```

Before shipping installers or enabling auto-updates, replace the placeholder update feed in `package.json`, establish signing/notarization credentials outside the repository, and validate the release process on clean machines.

## Important product boundary

A stereo master does not contain independently editable drum, vocal, bass, and instrument tracks. Timeline selection can target a time range on the whole mix; targeting only drums inside a stereo master requires source separation and will have artifacts, or access to the original stems/multitrack project. MusicOnVerse must explain this distinction rather than imply perfect source-level editing where the audio does not support it.
