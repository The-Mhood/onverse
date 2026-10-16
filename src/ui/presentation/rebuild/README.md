# Rebuild presentation layer

This folder contains presentation-only CSS and a locally authored, grounded cosmic environment image. It deliberately contains no controller, session model, engine/provider access, event binding, synthetic waveform, or success state.

## Integration contract

Import `src/ui/presentation/rebuild/index.css` from the lead-owned UI entry after its semantic shell is mounted. The stylesheet is scoped to `.workspace-root` and expects:

```html
<section class="workspace-root">
  <div class="environment" aria-hidden="true"></div>
  <header data-surface="header">…</header>
  <div data-surface="body">
    <main data-surface="workspace">…</main>
    <aside data-surface="inspector">…</aside>
  </div>
  <footer data-surface="transport">…</footer>
</section>
```

`data-role="waveform"`, `data-role="selection"`, `data-role="timeline-ruler"`, and `data-track-color` are optional styling hooks. They do not draw or create audio data; the application renderer must provide truthful state and values. The token palette establishes a shared color mapping so a real track can keep the same identity in its header, region, inspector, and meter.

## Asset packaging

`assets/first-person-cosmic-horizon.jpg` is an original, locally generated product asset, not a modified or composited reference image. It was generated on 2026-10-16 from a prompt for a first-person rocky moon ridge, low atmospheric horizon, ringed planet at upper right, restrained navy/teal light, and uncluttered negative space; it contains no UI, text, logos, or controls. The 1376×768 source was exported as an 8-bit JPEG (quality 86, 107,345 bytes). `environment.css` references it with Vite's `?inline` query. The existing build inlines CSS into `dist/index.html`; embedding this small JPEG avoids a fragile root-relative URL when Electron loads the packaged page via `file://`. No remote asset, new package, or build-config change is required.

## Limits

The panel surfaces are visual primitives only. They do not assert the existence of an arrangement, mixer/routing, plugin host, library, SYLUNE executor, project persistence, or undo. Use only for real behavior supplied by the lead-owned controller/shell. Contrast and keyboard states still require validation against the integrated UI.
