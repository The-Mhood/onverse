# MusicOnVerse — Product Vision

**Reconciled working draft for review — CORE-007, 2026-10-15.** Derived from the existing [PR #1 proposal](https://github.com/The-Mhood/onverse/blob/eedc24cb38c21d1a4be6186593c7ae7fcb8c6f85/docs/PRODUCT_VISION.md). Retains its long-term thesis/portfolio and explicitly unvalidated commercial hypotheses; adds the owner's general Linked Sessions and professional design requirements. No feature, pricing, cloud use, palette or implementation is approved merely by recording it here. PR #1 remains unmerged.

Current implementation is a single-buffer analysis/processing/conversion prototype; see [the project guide](engineering/PROJECT_GUIDE.md). [Architecture](ARCHITECTURE.md) defines the proposed technical semantics, [roadmap](ROADMAP.md) defines proof/review gates, and [design brief](design/DESIGN_BRIEF.md) is the sole canonical UI-direction brief. The content below is ambition unless explicitly identified as current in the guide.

## 1. The company we are building

MusicOnVerse should become an **AI-native audio production environment**, not just a chatbot attached to an equalizer and not merely another automatic mastering button.

The core promise:

> Tell MusicOnVerse what you hear, what you want to change, and where it should happen. It translates that intent into an explainable audio plan, lets you audition the result, and executes it in a reversible production workflow.

The product combines four capabilities that are usually separated across different tools:

1. **Listen and diagnose** — measure a mix and identify likely issues, with confidence and evidence.
2. **Understand intent** — translate a musician's request into concrete, editable processing instructions.
3. **Perform the work** — execute DSP, automation, routing, recording, mixing, and eventually plugin-hosted processing.
4. **Teach while working** — explain what changed, why, and how to make a better decision next time.

This is a product thesis, not a claim that no competitor has explored AI audio editing. The defensible opportunity is the quality of the end-to-end workflow: intent → grounded plan → preview → approval → reproducible result → learning.

## 2. Target users and the first wedge

### Primary beachhead: independent artists and producers

They need a professional-sounding result, often work without a full-time engineer, and may have limited budgets. They already understand musical intent—"the vocal feels buried", "the kick and bass are fighting", "the hook needs to feel wider"—but may not know the exact processing chain.

### Secondary segments

- Home-studio creators and singer-songwriters
- Mix engineers who want faster diagnosis and repeatable starting points
- Content creators and podcasters needing cleanup and delivery formats
- Small studios that need shared sessions, client revisions, and consistent handoff
- Music educators and students who want to learn from actionable explanations

Do not try to serve every segment with equal priority in v1. Start with the artist/producer loop and make it genuinely useful.

## 3. Product principles

1. **Musician intent comes first.** Controls remain available; AI is a fast route to control, not a replacement for it.
2. **Never fake capability.** Clearly distinguish measured facts, inferred diagnoses, genre heuristics, and model suggestions.
3. **Non-destructive by default.** Every AI action is a proposed operation, with preview, commit, undo, and history.
4. **Audio quality is measurable and audible.** Use both listening tests and validated measurements; never optimize one score at the expense of the music.
5. **Preserve creative ownership.** Projects remain exportable. Do not lock a user's work into a proprietary cloud format.
6. **Private by default.** Local analysis where practical; explicit consent before cloud upload or model processing.
7. **Latency is a feature.** Fast local feedback for common tasks; longer cloud jobs must show progress and cost.
8. **Build a reliable core before a magical demo.** No AI workflow is more important than reliable playback, export, undo, and project recovery.

## 4. The flagship experience: the AI Sound Engineer

A user loads a song, chooses a target, and chats naturally:

- "From 1:05 to 1:35, give the drums a little more room, but keep the vocal dry."
- "The low end is cloudy. Find out whether the kick and bass are masking each other."
- "Make the hook feel wider than the verse without making the vocal phasey."
- "Bring the lead vocal forward by about one dB in the second chorus."
- "Give me a warmer, smoother master, but don't crush the transients."

The agent must not treat these as unconstrained text prompts. It should convert the request into a typed operation plan containing:

- The target project, track, stem, or time selection
- The intended audible result
- Proposed processors and parameters
- Automation or region boundaries
- Confidence, assumptions, and limitations
- Expected render cost and whether external/cloud processing is needed
- A previewable result and a concise explanation

The interaction loop is:

**Request → clarify ambiguity → inspect relevant audio → propose plan → preview A/B → user approves → apply non-destructively → record history.**

A future trusted-auto-apply option is only a hypothesis for separately approved low-risk operations, not implemented permission. **Linked transfers/updates/retargets/restores always require explicit user initiation, affected-item review and approval; AI cannot bypass the manual-update rule.** Destructive edits, cloud uploads, paid jobs, and actions that overwrite files always require clear consent.

### Example: "More reverb on the drums from 1:05 to 1:35"

1. Parse the time range and identify the intended drum source.
2. Check whether the project contains a drum track/stem.
3. If it does, create an automation/region operation on that source.
4. If the user only supplied a stereo master, explain that drums cannot be cleanly isolated by ordinary EQ/reverb. Offer (a) a drum-stem separation job with artifact warnings, or (b) a whole-mix effect as an explicitly different alternative.
5. Render a short preview with a wet/dry comparison.
6. Let the user adjust amount, decay, pre-delay, and wet level conversationally.
7. Save the change as a reversible project operation.

This honest source-awareness is a product advantage.

## 5. Feature portfolio

### A. Audio intelligence — build on the current code

- Loudness, peak, dynamics, spectral balance, stereo, tempo and tuning analysis
- Issue explanations linked to measurements
- Genre-aware starting points, never presented as universal laws
- Reference matching with explicit source/provenance and confidence
- Before/after measurements and level-matched A/B audition
- Mix translation checks for mono, headphones, speakers, and common delivery targets
- Export validation and clipping/true-peak warnings

**Upgrade required:** distinguish standards-compliant measurements from approximations. For example, true-peak estimation and integrated LUFS should be validated against trusted test vectors before marketing them as standards-grade meters.

### B. AI Sound Engineer

- Conversational audio diagnosis and parameter control
- Intent-to-action compiler using a strict schema
- Explanations and evidence for every recommended fix
- Track, stem, region and bus targeting
- Plan preview, parameter adjustment, approval, undo and redo
- Session memory for the user's preferences, with visible controls and reset
- Optional "teach me" explanations and skill-level-aware detail

### C. Timeline and editing

- Multitrack timeline with clips, markers, loop regions and tempo/grid
- Precise time selection and clip-level processing
- Non-destructive region effects and automation lanes
- Snap, fades, crossfades, slip editing, comping and take management
- Project snapshots, autosave, crash recovery and version history
- Stems, MIDI/audio asset organization and portable project packages

### D. DAW / recording / mixing

- Audio recording with device selection, input monitoring, latency calibration and take management
- Track types: audio, bus, aux/return, master; MIDI/instrument tracks in a later phase
- Mixer with gain, pan, sends, inserts, meters, solo/mute, routing and automation
- Built-in EQ, compressor, gate/expander, de-esser, saturation, delay, reverb, limiter and utility tools
- Presets with full parameter transparency
- Session templates, track groups, reference track, markers and export stems
- Batch exports for streaming, video, stems and client review

A DAW is an engineering program of its own. The first usable version should be a focused audio-track DAW with a stable engine, not an attempt to clone every feature of Logic, Ableton or Pro Tools immediately.

### E. Plugins and extensibility

Plan for three tiers:

1. **Native MusicOnVerse processors** — reliable, cross-platform, automatable and AI-controllable.
2. **Supported external plugin integration** — investigate a native host/bridge for VST3 and Audio Units, with platform-specific testing and sandboxing.
3. **Developer/plugin SDK** — documented parameter schemas and capability declarations so approved processors can be controlled safely by the AI.

Do not assume browser Web Audio can load arbitrary VST/AU plugins. It cannot. External plugin hosting requires native integration and licensing/compatibility work. Plugin vendors' licenses and user consent govern installation and use.

### F. Collaboration and delivery

- Shareable review links with timestamped comments
- Client approval states and revision notes
- Portable session packages and stem handoff
- Cloud backup/sync as an opt-in paid feature
- Team roles, audit trail and shared presets in a later phase

### G. Future research bets

These are hypotheses to validate, not promises for launch:

- Source separation into vocals, drums, bass and other stems
- Audio-to-audio reference guidance with licensed, lawful inputs
- Vocal comping, timing assistance and pitch-editing workflows
- Adaptive learning that remembers preferred tone, loudness and processing style
- Multitrack mix assistant that detects masking and proposes targeted moves
- Mastering translation checks across playback systems
- Model-assisted sound design and effect-chain generation
- Cloud render queue for long, compute-heavy jobs
- Studio marketplace for presets, licensed plugin chains and expert templates

Avoid training on customer audio by default. Training use must be opt-in, specific, revocable where feasible, and contractually clear.

### H. Linked Sessions — general production workflow

A creator can move a rendered track, a selected-track combination, an actual routed bus stem, a full stereo mix, or several independent items into another session and retain a trustworthy connection to what produced it. This is not limited to mixing then mastering; sessions may branch and form arbitrary acyclic chains for production, editing, arrangement, sound design, collaboration and delivery.

Example: combine Conga and other selected drums into a named reusable Drums print in a new session. Keep working on the source. Editing an independent Vocal does not stale Drums; changing Conga flags an available Drums update. The destination continues using its previous valid audio until the user explicitly reviews and updates it. Its gain/EQ, automation/routing/placement and unrelated items stay intact.

Product guarantees required before calling this feature implemented:

- Internal render and durable destination-owned media, not manual export/reimport or a mutable external file.
- Stable session/track/bus/group/item identities and exact used revisions/render provenance; names alone never identify material.
- Per-item dependency-aware freshness, explicit used-vs-available source revisions, and honest missing/offline/unsupported/incompatible states.
- Track sums and bus stems remain semantically distinct, including shared effects/control dependencies.
- Explicit update item/selected/all with an affected-item plan; never background audio replacement. Failed/cancelled/incompatible updates retain the prior valid asset.
- Version/history/undo and restart recovery preserve the user's work, not just an in-memory preview.
- In A -> B -> C, distinguish current-to-B from stale-to-A. No silent cascade; user chooses immediate-source revisions and any ordered multi-hop plan. Reject cycles.
- Future AI proposes the same validated operations and obeys the same approval boundary. Neither a prompt nor a global trusted mode can override it.

The first proof is deliberately small: a real selected group -> committed combined destination asset -> relevant source edit leaves it unchanged -> explicit update preserves destination work -> restart/recovery/undo verification. The [roadmap](ROADMAP.md) stages other transfer kinds and graph cases after that proof. No current multitrack/session/plugin support is implied.

### I. Professional workspace and identity

Logic Pro is the primary usability/layout/workflow reference, not a clone. MusicOnVerse should feel classy, welcoming and professional, with its own restrained dark/celestial identity. Readability, waveforms, precise controls, accessibility and long-session comfort take priority over glow/animation. Avoid beginner/gaming/SaaS-dashboard presentation.

The canonical [design brief](design/DESIGN_BRIEF.md) owns layout priorities, token/component requirements, responsive/accessibility behavior and the functional-vs-cosmic boundary; do not duplicate palettes here. agent-b audits/proposes and implements only an approved presentation scope. Lead owns architecture/audio/contracts/integration. A concept is not a working mixer/plugin/session; unsupported capabilities stay honest.

## 6. Business model — unvalidated hypotheses

### Free / Starter

A useful product, not a crippled demo: local analysis, basic playback, limited built-in processing, a small number of saved projects, and common exports. Free must demonstrate trust and audio quality.

### Creator subscription

- Full AI Sound Engineer usage allowance
- More projects, snapshots and export presets
- Timeline and non-destructive region processing
- Higher-quality analysis and reference workflows
- Cloud jobs or stem separation allowance, with transparent limits

### Studio / Pro subscription

- Advanced routing and automation
- Larger AI/cloud allowance
- Collaboration, client review and revision history
- Commercial workflows, templates and batch exports
- Priority support and team features

### Add-on revenue

- Credit-based expensive jobs (stem separation, long cloud renders) with a clear price before execution
- Paid preset/template marketplace with revenue share
- Studio seats and team billing
- Potential API/SDK for partners once the core engine is stable

Do not make basic file export hostage to credits. Do not launch a marketplace before there is a real user base. Prices should follow cost research, customer interviews and conversion experiments—not guesses.

## 7. Defensibility

The moat is not the chat interface or a generic LLM. It is the combination of:

- A high-quality, low-latency audio engine
- A structured library of audio operations that can be safely executed
- Evaluation data for whether proposed changes actually improve the intended result
- User-controlled project history and workflow integration
- Personal preference profiles and repeatable production outcomes
- Reliable desktop integration, project portability, and trust

Measure product value by completed sessions, approved improvements, time-to-good-result, repeat usage and willingness to pay—not by the number of AI features.
