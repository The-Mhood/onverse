# Rebuild presentation layer

This folder contains presentation-only CSS and a locally authored cosmic environment image. It deliberately contains no controller, session model, engine/provider access, event binding, synthetic waveform, or success state.

## Integration contract

Import `src/ui/presentation/rebuild/index.css` from the lead-owned UI entry after its semantic shell is mounted. The stylesheet is scoped to `.workspace-root`. The functional adapter can use this shape:

```html
<section class="workspace-root">
  <div class="environment" aria-hidden="true"></div>
  <header data-surface="header">…</header>
  <div class="studio-grid" data-surface="body">
    <main data-surface="workspace">
      …real editor content…
      <div role="group" data-surface="transport">…real playback controls…</div>
    </main>
    <aside data-surface="inspector">…real details…</aside>
  </div>
</section>
```

The transport surface may be a playback group within the single-file editor; the CSS does not require a global session footer. The standalone `index.html` is a presentation-only preview and uses a preview footer solely to demonstrate the surface treatment. `data-role="waveform"`, `data-role="selection"`, `data-role="timeline-ruler"`, and `data-track-color` are optional styling hooks. They do not draw or create audio data; the application renderer must provide truthful state and values.

## Environment motion and surface treatment

`environment.css` layers the static, locally authored horizon with three very slow, staggered, low-amplitude atmospheric fields. Composited transforms and restrained opacity changes shift spatial layers and illumination; they reverse gently at their endpoints and sit behind the workspace. There is no second renderer, canvas, camera movement, star flicker, animated background repaint, or direct `backdrop-filter`. `prefers-reduced-motion: reduce` stops the scene motion and presentation transitions.

Editor, inspector, waveform and transport materials are near-opaque dark mineral gradients. Small, feathered edge highlights and restrained cool/warm shadows let the scene tint the perimeter without reducing editing contrast. `data-view-phase="enter"` / `"exit"` are optional presentation-only hooks for a host that deliberately animates an existing view; they do not create or switch views by themselves. No such transition is claimed until the functional shell opts into and tests the hook.

`REFERENCE-PALETTE.md` records the full-reference review, approximate image samples, compatible combinations and semantic mapping. The palette is centralized in `tokens.css`; no new dependencies are required.

## Asset packaging

`assets/first-person-cosmic-horizon.jpg` is an original, locally generated product asset, not a modified or composited reference image. It was generated on 2026-10-16 from a prompt for a first-person rocky moon ridge, low atmospheric horizon, ringed planet at upper right, restrained navy/teal light, and uncluttered negative space; it contains no UI, text, logos, or controls. The 1376×768 source was exported as an 8-bit JPEG (quality 86, 107,345 bytes). `environment.css` references it with Vite's `?inline` query. The existing build inlines CSS into `dist/index.html`; embedding this small JPEG avoids a fragile root-relative URL when Electron loads the packaged page via `file://`. No remote asset, new package, or build-config change is required.

## Limits

The panel surfaces and optional transition hooks are visual primitives only. They do not assert the existence of an arrangement, mixer/routing, plugin host, library, SYLUNE executor, project persistence, or undo. Use only for real behavior supplied by the lead-owned controller/shell. Contrast, responsive density and keyboard states still require verification in the integrated UI at target viewports.
