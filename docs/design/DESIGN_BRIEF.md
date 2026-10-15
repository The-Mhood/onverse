# MusicOnVerse canonical design brief

**Updated: 2026-10-15. Status: owner-settled visual/sequence decisions; Slice A implementation follows the bounded [COORD-006/UI-004 handoff](../engineering/UI_IMPLEMENTATION_HANDOFF.md) after actual merge M and worker preflight/ownership acknowledgment.** [AGENTS.md](../../AGENTS.md) governs ownership; [PROJECT_GUIDE.md](../engineering/PROJECT_GUIDE.md) distinguishes implemented capabilities from future DAW concepts. This is the single design-direction brief; task-specific audits/proposals should reference it, not create competing briefs.

## Identity and usability

**Reference 1 is the visual target; Reference 2 is layout structure only. Ground-up redesign of presentation, not an extension/skin of the old interface.** Logic Pro remains a professional-usability reference, not an additional competing visual/layout target. MusicOnVerse must retain its own classy, welcoming, professional dark/celestial identity. It must not feel like a beginner toy, game interface, or SaaS dashboard.

The working surface is functional first. Waveforms, meters, names, time values, editing precision, and long-session comfort outrank decoration. Cosmic styling belongs chiefly in branding, onboarding/empty states, and restrained peripheral accents. No moving/glowing layer may reduce readability, obscure audio, steal focus, or consume resources needed for playback/rendering.

Preserve working interactions and contracts. A visual rearrangement does not authorize new DSP, session serialization, routing/state architecture, or framework/dependency changes.

## Workspace direction and priority

**Slice A comes first:** current-capability shell, navigation, transport and central workspace, readable responsive states and preserved existing actions. The owner has approved the target/sequence; agent-b supplies its bounded file/check plan and reports concrete tokens/results, not another request to settle the same choices.

**Orbit Mode follows as a separate spike**, after Slice A acceptance, in a separate module behind a default-off feature flag. Keep the existing `createStage` API unchanged. Reduced-motion **camera** behavior belongs to that spike, not Slice A. Compare ringed planet, moon terminator, atmospheric limb and ring to Reference 1 at **1120×700 and 1480×920**, reporting actual matches/gaps. No such comparison has been performed by the lead.

Longer-term component priorities below are not a mandate to invent missing features in Slice A:

1. Shell and clear navigation.
2. Transport, timeline, and central workspace.
3. Track headers, lanes, and arrangement.
4. Mixer.
5. Inspector.
6. Plugin presentation.
7. Complete applicable UI states.
8. Cosmic refinements.

This ordering is design direction, not a task assignment or a claim those capabilities exist. Current single-buffer workflows must remain usable. Real multitrack editing, mixer/routing, project history, hosted plugins, and Linked Sessions await core contracts/mechanism proofs. Keep unsupported actions honestly unavailable; static concepts must be unmistakably labelled concepts, never functioning-looking controls that do nothing.

Proposals should establish clear transport/context, a dominant editing surface, consistent selection/focus, and optional inspector/mixer regions. Avoid dashboard-card fragmentation and permanently competing visual panels. Present the same underlying authoritative state; do not create UI-only routing, processors, linked-item freshness, or duplicate session models.

## Token system to specify in the proposal

Define a coherent ground-up token/component system from Reference 1, using Reference 2 only for layout. Reusing proven behavior does not require extending the old visual theme. Record actual token values/results in the worker delivery for coordinator review; no final measured colour/gradient values are invented here. Ordinary implementation choices within the approved reference do not require another owner round-trip; material departures do.

| Semantic family | Required design decisions |
| --- | --- |
| Surfaces | Canvas, panel, raised/popover, recessed/input; subdued neutral-dark hierarchy |
| Text | Primary, secondary, muted, inverse; readable even in dense views |
| Borders/focus | Subtle/default/strong separators, selection, clearly visible keyboard focus |
| Accents | Restrained celestial brand accent vs functional action/selection accent |
| Feedback | Success/warning/error/info and current/stale/missing states; never colour alone |
| Typography | Readable UI stack; display/brand type sparingly; tabular/monospace numeric treatment |
| Spacing/sizing | One consistent scale; compact desktop controls with usable hit targets and touch adaptations |
| Shape/depth | Consistent corners, borders, shadows; depth communicates hierarchy, not gratuitous glow |
| Motion | Minimal transitions; reduced-motion/static-workspace behavior and performance budgets |

Avoid tiny, widely tracked uppercase labels for essential controls/data. Font option A is concretely mapped to approved **self-hosting**: sparse Orbitron brand/display, readable Rajdhani UI, Share Tech Mono readouts, and system fallbacks. Pinned WOFF2/OFL assets and provenance are [reviewed and prepared](../../src/assets/fonts/README.md); Slice A removes runtime Google-font requests, uses explicit inline packaging and exposes complete licences. No npm dependency is added. Typography, fallback glyph coverage and actual contrast still need UI checks. Do not infer unmeasured accessibility or licence compliance in a shipped bundle merely from source files existing.

## Reusable component vocabulary

Define consistent presentation and states for:

- Application shell, navigation, toolbar, transport, time/readout, context menus.
- Buttons/icon buttons, inputs, selectors, tabs, tooltips, dialogs, notices, progress/cancellation.
- Waveform/timeline surfaces and, only with real backing capabilities, track headers/lanes, mixer strips, inspector sections, processor panels.
- Source/linked-item identity, used-vs-available revision labels, affected-item review, compatibility/missing-dependency explanations when those core contracts exist.

Names and imported metadata are untrusted: render text safely, do not interpolate raw values as executable HTML. Maintain stable selection, focus, scroll, and control state through view updates. Do not hide errors behind a success toast or animate progress unsupported by the real operation.

## Accessibility, endurance, and responsiveness

- Target WCAG AA contrast: 4.5:1 for normal text, 3:1 for large text and essential non-text control boundaries/states. Measure actual colours; do not declare compliance from appearance.
- Keyboard-operable actions, visible focus, semantic labels, meaningful disabled states, non-colour status cues; no hover-only essential controls.
- Keep values/units readable, permit zoom/scaling, and make dense desktop controls usable without sacrificing touch hit areas in narrow layouts.
- Collapse/reveal secondary panes at smaller widths; do not squeeze the entire desktop DAW into unreadable miniatures. Preserve access to core actions and clear navigation.
- Evaluate representative desktop and narrow web viewports. Electron currently enforces a 1120 x 700 minimum; web mobile support is a separate test claim.
- Preserve existing CSS reduced-motion behavior in Slice A. Fully calm **camera** behavior is part of the later Orbit Mode spike, not a Slice A dependency. Background energy is never required to understand playback or status.
- Long-session comfort, meter/waveform clarity, and stable layout take priority over showcasing effects.

## State and capability honesty

Specify applicable empty, loading, ready, active, selected, disabled/unsupported, error, cancellation-requested/cancelled, and recovery states. Persistence, undo, cancellable computation, plugin hosting, or linked updates cannot be advertised before implementation and validation.

Future linked-item UI must distinguish a usable committed asset, a newer source revision, unknown/missing dependencies, incompatible update, and failed/cancelled render. Source edits must never silently replace audio. UI cannot bypass the approved operations or the manual-update invariant.

## Ownership and review

agent-b owns the bounded Slice A presentation reservation under the dated handoff once actual M and its independent preflight/ownership acknowledgment activate the grant. Onboarding alone is not an assignment. Publish the audit/file/check plan before edits; lead reviews contract preservation and results. The owner has settled Reference 1/2, ground-up presentation, self-hosting and Slice A/spike order; do not ask again. New consequential product/dependency/contract departures still require review.

The handoff—not this general brief—defines the exact file allowlist/denylist. Slice A includes scoped presentation in `src/main.js`, styles/entry and specified new presentation/font/texture/test paths; it excludes `src/ui/draw.js` and scene/camera implementation. `src/main.js` has a dated exclusive handoff; no concurrent lead editing. DSP/application/domain/storage/IPC/configuration/dependencies remain protected. Use locally generated/procedural textures, no texture CDN; static local assets use explicit inline imports. Required reference-provenance wording is in the handoff; no unsupported chart-track fingerprint or standards-grade claim.

Review the actual diff and functioning workflows, not screenshots alone. Run applicable regression/build checks, supply a runnable preview and screenshots where supported, and report manual/keyboard/viewport checks and omissions. No new test dependency without approval, no invented browser/macOS/listening results, and no automatic merge.
