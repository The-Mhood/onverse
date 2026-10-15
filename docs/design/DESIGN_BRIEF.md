# MusicOnVerse canonical design brief

**Recorded: 2026-10-15. Status: owner-supplied direction and review constraints, not an approved UI implementation, final palette, or assigned task.** [AGENTS.md](../../AGENTS.md) governs ownership; [PROJECT_GUIDE.md](../engineering/PROJECT_GUIDE.md) distinguishes implemented capabilities from future DAW concepts. This is the single design-direction brief; task-specific audits/proposals should reference it, not create competing briefs.

## Identity and usability

Logic Pro is the primary reference for layout clarity, production workflow, density, and professional usability, **not a skin to clone**. MusicOnVerse must retain its own classy, welcoming, professional dark/celestial identity. It must not feel like a beginner toy, game interface, or SaaS dashboard.

The working surface is functional first. Waveforms, meters, names, time values, editing precision, and long-session comfort outrank decoration. Cosmic styling belongs chiefly in branding, onboarding/empty states, and restrained peripheral accents. No moving/glowing layer may reduce readability, obscure audio, steal focus, or consume resources needed for playback/rendering.

Preserve working interactions and contracts. A visual rearrangement does not authorize new DSP, session serialization, routing/state architecture, or framework/dependency changes.

## Workspace direction and priority

Implement only after a scoped proposal and review, in this order:

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

Reuse/evolve the existing CSS theme intentionally. Record approved values here after review; no final colour hex values, gradient, font acquisition, or measurements have been selected in this documentation unit.

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

Avoid tiny, widely tracked uppercase labels for essential controls/data. Use a readable system/fallback stack while reviewing existing remote-font privacy/offline behavior; no new font/dependency without appropriate approval and licensing review. Colour/gradient implementation still needs owner review. Do not infer palette approval from approval of this brief.

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
- Fully calm reduced-motion behavior should be proposed for the Three.js scene as well as CSS. Background visual energy must not be required to understand playback or status.
- Long-session comfort, meter/waveform clarity, and stable layout take priority over showcasing effects.

## State and capability honesty

Specify applicable empty, loading, ready, active, selected, disabled/unsupported, error, cancellation-requested/cancelled, and recovery states. Persistence, undo, cancellable computation, plugin hosting, or linked updates cannot be advertised before implementation and validation.

Future linked-item UI must distinguish a usable committed asset, a newer source revision, unknown/missing dependencies, incompatible update, and failed/cancelled render. Source edits must never silently replace audio. UI cannot bypass the approved operations or the manual-update invariant.

## Ownership and review

agent-b is the intended UI owner after appointment; onboarding itself assigns no task. A requested UI implementation first needs an audit/proposal showing layout/components, affected files, applicable states, accessibility/responsiveness, core dependencies, and regression checks. Lead reviews architecture/contracts; owner reviews product/visual choices before broad changes.

Likely presentation areas are `src/style.css`, scoped DOM presentation in `src/main.js`, `src/ui/draw.js`, and later `src/scene.js`/font declarations in `index.html`. These are **not editing grants**. `src/main.js` always needs an exclusive handoff. DSP/application/domain/storage/IPC/configuration/dependencies remain lead-owned unless explicitly coordinated.

Review the actual diff and functioning workflows, not screenshots alone. Run applicable regression/build checks, supply a runnable preview and screenshots where supported, and report manual/keyboard/viewport checks and omissions. No new test dependency without approval, no invented browser/macOS/listening results, and no automatic merge.
