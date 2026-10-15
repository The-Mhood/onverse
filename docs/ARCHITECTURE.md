# MusicOnVerse — Technical Architecture

## 1. Current-state assessment

The repository is a working prototype with a useful base:

- `src/main.js` is the main application controller and constructs a large portion of the UI directly in JavaScript.
- `src/audio/analyzer.js` performs custom signal analysis.
- `src/audio/dsp.js` contains shared DSP kernels and buffer utilities.
- `src/audio/genre.js` contains genre profiles and band metadata.
- `src/audio/processor.js` handles decode/encode and a one-click master-fix render.
- `src/audio/reference.js` resolves selected streaming links and catalog metadata.
- `src/scene.js` renders the Three.js audio-reactive stage.
- `electron/main.cjs` and `electron/preload.cjs` provide a desktop wrapper and a narrow update bridge.

This is appropriate for a prototype. It is not yet a sound foundation for a full DAW because state, UI, transport, processing and product workflows are coupled in the large main module, the project/session model is not yet the center of the application, and the audio engine has no explicit processor/command contract.

### Priority risks to verify and fix

1. **No authoritative project model:** audio buffers and UI state are held in a single in-memory session. A DAW needs serializable project data, stable IDs, snapshots, autosave and recovery.
2. **AI execution boundary is absent:** natural-language requests must never directly execute arbitrary code or unconstrained DSP settings. Introduce a validated command schema and allow-listed operations.
3. **DSP performance and reliability:** long analysis/render loops can block the UI or exhaust memory. Move suitable work to Web Workers/AudioWorklets/WASM incrementally, with cancellation and progress.
4. **Audio measurement claims:** validate LUFS/true-peak calculations and all target-profile assumptions against known fixtures before making professional measurement claims.
5. **Large single-file UI controller:** split features into modules while preserving working behavior. Avoid a risky rewrite.
6. **Desktop update placeholder:** `package.json` has a placeholder generic update URL. Auto-update must remain disabled or clearly non-production until a real feed, signing and release process exist.
7. **Build pipeline coupling:** the build script inlines output assets into a single HTML file. Keep this only if browser portability requires it; test CSP, worker/WASM and large-bundle constraints before relying on it for the future engine.
8. **Secrets and generated output:** ignore local environment files, signing assets, logs, release installers and generated artifacts. Never commit signing credentials or user audio.

## 2. Target architecture

Use a modular monolith first. Keep the product shippable as one desktop application while defining boundaries that could later become separate services. Do not start with microservices.

```text
Desktop App (Electron)
├── Presentation
│   ├── Workspace shell / navigation
│   ├── Timeline + transport
│   ├── Mixer + processor panels
│   ├── AI Engineer conversation + action preview
│   └── Library, export and settings
├── Application layer
│   ├── Project/session commands
│   ├── Transport and recording controller
│   ├── AI intent → typed action plan
│   ├── Undo/redo + history
│   ├── Render/export jobs
│   └── Permissions, quotas and billing gates
├── Domain layer (pure data/rules)
│   ├── Project, Track, Clip, Region, Bus, Plugin, Automation
│   ├── Audio operation and parameter schemas
│   ├── Routing graph and validation
│   ├── Project migrations
│   └── Capability registry
├── Audio engine
│   ├── Real-time graph (AudioWorklet/native engine)
│   ├── Offline render graph
│   ├── Recording and device I/O
│   ├── Metering and analysis
│   ├── Built-in DSP processors
│   └── External plugin host/bridge (later, native)
├── Infrastructure
│   ├── Local project store + media asset store
│   ├── Worker/WASM job runner
│   ├── Optional AI provider adapter
│   ├── Optional cloud render/stem jobs
│   └── Telemetry/error reporting (opt-in)
└── Electron main process
    ├── Window and OS integration
    ├── Safe IPC allow-list
    ├── File dialogs and filesystem access
    ├── Updates
    └── Entitlements/secure credential access
```

The key rule: **UI expresses intent; application commands validate it; domain rules define meaning; the audio engine executes it.** The AI agent is not the audio engine and must not bypass these boundaries.

## 3. Project/session domain model

Design the data model before implementing a timeline.

### Project

- `id`, `name`, `schemaVersion`, `createdAt`, `updatedAt`
- `sampleRate`, `tempoMap`, `timeSignature`
- `tracks[]`, `buses[]`, `masterBusId`, `markers[]`
- `assetManifest[]`, `settings`, `snapshots[]`

### Track

- `id`, `name`, `type`: audio | bus | aux | instrument (instrument later)
- `channelLayout`, `gainDb`, `pan`, `mute`, `solo`, `arm`
- `clips[]`, `insertChain[]`, `sendRoutes[]`, `automationLanes[]`
- `color`, `locked`, `metadata`

### Clip / Region

- `id`, `assetId`, `timelineStart`, `sourceIn`, `sourceOut`
- `gainDb`, `fadeIn`, `fadeOut`, `timeStretch`, `pitchShift`
- `regionProcessors[]`, `automationOverrides[]`

Use integer sample positions or a clearly specified high-precision time representation internally. Floating-point seconds alone can accumulate boundary ambiguity for editing. The UI may display seconds and bars/beats, but conversions should go through one tested timing service.

### Processor instance

- `id`, `processorType`, `schemaVersion`, `enabled`, `parameters`
- `wetDry`, `presetId`, `automationBindings[]`, `latencySamples`
- `stateBlobRef` only for processor state that cannot be represented as ordinary parameters

### Asset manifest

Store references, checksums, media metadata and relative paths—not raw audio arrays inside project JSON. A portable project package should contain a project manifest and copied/linked media with explicit relink behavior. Use atomic writes and recovery journals.

## 4. Core command contract

Every edit, whether triggered by UI, automation or AI, should go through the same application command system.

A conceptual command:

```ts
type AudioCommand = {
  id: string;
  projectId: string;
  operation:
    | "set-track-gain"
    | "insert-processor"
    | "set-processor-parameter"
    | "create-region-effect"
    | "create-automation"
    | "render-master"
    | "export-audio";
  target: {
    trackId?: string;
    clipId?: string;
    busId?: string;
    region?: { startSample: number; endSample: number };
  };
  parameters: Record<string, number | string | boolean>;
  intent?: string;
  requiresApproval: boolean;
};
```

This is an architectural example, not an instruction to copy an unchecked generic parameter map into production. Implement operation-specific schemas, strict ranges, explicit units, target validation and versioning. Unknown operations or parameters must fail closed.

Every command should return a result with status, diagnostics, affected targets, before/after values, render reference and an undo record. Make repeated submissions idempotent where possible. Long-running jobs need cancellation, progress, timeouts and cleanup.

## 5. AI Sound Engineer design

### Pipeline

1. **Conversation parser:** identifies intent, target, time range, constraints and ambiguity.
2. **Context builder:** supplies only relevant project structure, track names, analysis results and available processor capabilities.
3. **Planner:** returns a structured plan, not executable code.
4. **Validator:** checks schema, permissions, units, processor support, parameter bounds, target existence, cost and destructive effects.
5. **Preview renderer:** creates a short audition or temporary graph; does not overwrite source audio.
6. **Approval UI:** displays affected source/range, proposed settings, audible goal, assumptions and estimated cost.
7. **Command executor:** applies the approved operation through the normal application layer.
8. **History:** records intent, command, model/provider, parameters, result and undo information.

### Safety and trust

- No arbitrary shell, filesystem, JavaScript or network tools exposed to the model.
- The model cannot choose unregistered processor IDs or bypass parameter validation.
- Never upload audio without clear consent and a visible explanation.
- Do not silently replace original assets.
- Require confirmation for destructive actions, external uploads, purchases/credits and export overwrites.
- Show uncertainty; ask a clarifying question when source or target is ambiguous.
- Offer a manual fallback when a model/provider is unavailable.
- Version prompts, schemas and evaluations. Keep secrets server-side.

## 6. Audio engine strategy

### Phase 1: preserve and harden existing Web Audio/DSP

Keep the current analysis and offline-processing capabilities while introducing stable interfaces such as:

- `AudioAssetRepository`
- `AnalysisService`
- `ProcessorRegistry`
- `OfflineRenderService`
- `TransportService`
- `ProjectRepository`

Move CPU-heavy, non-real-time analysis to Web Workers where possible. Use OfflineAudioContext for supported offline graph renders. Do not put heavy analysis inside the real-time playback path.

### Phase 2: real-time DAW core

- Use AudioWorklet for custom real-time processing and metering.
- Define deterministic sample/block behavior and processor lifecycle.
- Keep UI and audio-thread communication bounded; avoid allocations and heavy work in audio callbacks.
- Add latency reporting and compensation before complex routing is marketed as production-ready.
- Separate the live playback graph from the offline render graph, while sharing processor definitions and parameter semantics.

### Phase 3: advanced processing and native integration

- Evaluate WASM/native DSP for performance-sensitive algorithms.
- Prototype native audio device I/O and plugin hosting behind an adapter.
- Investigate JUCE or another viable licensed technology for VST3/AU hosting; do not assume Electron/Web Audio can load native plugins.
- Establish a compatibility matrix for macOS versions, Apple Silicon and Intel, sample rates, buffer sizes and plugin formats.

Do not select the final native engine solely on theoretical performance. Run a proof of concept: low-latency recording, stable playback under load, offline render parity, plugin hosting feasibility, packaging and code-signing requirements.

## 7. Storage and persistence

Start local-first:

- Project manifest: versioned JSON or a documented equivalent
- Media: files in a project asset directory
- Analysis cache: derived and disposable
- Command history: durable operations with undo metadata
- Autosave: periodic, atomic and recoverable
- Snapshots: user-visible named restore points
- Migrations: tested for every persisted schema version

Do not store multi-minute audio in localStorage. Use filesystem-backed assets in Electron and IndexedDB only for appropriate web-mode caches. Later, cloud sync can store encrypted project packages and media references, but conflict handling must be designed before multi-device collaboration launches.

## 8. AI and cloud boundaries

Create provider-neutral interfaces:

- `IntentPlanner`: structured plan generation
- `AudioAnalysisAdapter`: optional model-assisted interpretation
- `StemSeparationProvider`: async job interface
- `CloudRenderProvider`: job submission/status/download
- `EntitlementService`: plan and quota checks

Local deterministic DSP should handle predictable operations. Cloud models should be used only when they add clear value, such as source separation or heavy inference. Every paid/cloud job needs an estimate, explicit opt-in, progress, retry policy, cancellation behavior and a defined retention policy.

## 9. Security and Electron boundary

- Keep `nodeIntegration: false`, context isolation and sandbox enabled.
- Expose only narrow, typed preload methods; validate every IPC payload in the main process.
- Restrict navigation and external URL handling.
- Use OS secure storage for credentials; never put API keys in renderer code or shipped bundles.
- Validate imported media, filenames, archive paths and project manifests.
- Avoid arbitrary file paths from AI-generated commands.
- Implement a CSP and review the implications of inline bundled scripts before production.
- Do not enable auto-update against the current placeholder feed.
- Maintain dependency audits, signed releases, provenance and a security reporting path.

## 10. Testing and observability

- Unit tests for project schemas, command validation, timing conversion, DSP parameter bounds and undo/redo.
- Audio fixtures with known sample rates, channel layouts, tones, impulses, clipping, silence and reference measurements.
- Golden render tests with tolerances where floating-point variation is expected.
- Integration tests for import → analyze → process → A/B → export.
- Electron smoke tests on clean environments.
- Manual listening evaluation with level-matched blind A/B tests.
- Performance budgets for startup, analysis latency, playback glitches and memory on target Macs.
- Opt-in crash/error diagnostics with audio content excluded by default.

## 11. Recommended module migration

Do not rewrite `src/main.js` in one shot. Migrate behind tests in this order:

1. Extract state and domain types into `src/domain/`.
2. Extract project/session persistence into `src/infrastructure/projects/`.
3. Extract transport and playback into `src/application/transport/`.
4. Wrap current analyzer/processor functions behind service interfaces.
5. Extract UI panels and event bindings into `src/features/`.
6. Introduce the command bus and undo stack.
7. Add the AI plan schema and a mocked planner before connecting a paid model.
8. Add the timeline against the project model.
9. Prove recording and real-time engine requirements before choosing native plugin architecture.

Each step must preserve the existing import/analyze/fix/compare/export path. The goal is a gradual, testable evolution, not a rewrite that throws away the prototype's useful work.
