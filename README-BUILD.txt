MusicOnVerse — build and packaging notes
=======================================

CURRENT APP
  The current entry mounts the single-source MusicOnVerse audio workbench and
  its integrated controller. Import, analysis, A/B, crop, Master Fix, adjustments and export are
  available locally. This is not a multitrack editor; project persistence, undo,
  plugins, mixer routing and SYLUNE execution are not implemented. Local browser
  codec/recorder support varies, and a profile comparison is heuristic rather
  than a standards-certified measurement.

  Imported audio is processed in the client. The optional stream-reference
  lookup and packaged-app updater can require internet access. Do not use private
  user media for qualification without explicit authorization. The generic
  updater URL in package.json remains a placeholder and is not production-ready.

REPOSITORY CONTENTS
  src/            Audio, application, domain and renderer source
  electron/       Desktop shell and update bridge
  scripts/        Build inliner and analysis/validation utilities
  build/          Preserved generated legacy icon outputs, excluded from packaging lookup
  public/         No static visual assets are currently served from this directory
  dist/           Generated, ignored build output; preserve it for local packaging
  index.html      Workbench entry page
  package.json    Scripts, dependencies and electron-builder configuration
  electron-builder.legacy.cjs  Configuration for the legacy Intel build

WEB DEVELOPMENT
  1. npm ci
  2. npm run dev

PRODUCTION WEB BUILD / LOCAL-FILE OPERATION
  1. npm run build
  2. npm run preview -- --host 0.0.0.0   (optional local HTTP preview)

  Vite emits the initial entry, then scripts/inline-dist.mjs inlines initial CSS
  and JavaScript into dist/index.html. Deferred chunks remain under dist/assets;
  the bundled LAME MP3 encoder is loaded only when MP3 conversion is requested.
  Keep the complete dist/assets directory alongside index.html. Relative asset
  paths are intentional for both hosted previews and file:// loading.

  Earlier headless Chromium evidence dated 2026-10-16 exercised the built entry
  and a local synthetic WAV from file://; WAV/MP3 export and lazy MP3-chunk load
  succeeded without non-file network requests, with workflow checks at 1120×700
  and 1480×920. That browser workflow has not been rerun after the current
  stabilization edits. The prior checks do not qualify packaged Electron,
  macOS, real hardware, listening quality or user-supplied media.

DESKTOP PACKAGING (macOS)
  1. npm ci
  2. npm run build
  3. npm run dist          -> release/ arm64 + x64 DMG/ZIP targets
  4. npm run dist:legacy  -> release-legacy/ x64 DMG/ZIP targets

  The Electron window loads dist/index.html with context isolation enabled,
  Node integration disabled and sandbox enabled. Packaged output must retain
  dist/assets, including the deferred MP3 encoder. Native macOS packaging and
  runtime verification have not been performed in this Linux environment.
  Legacy icon outputs are retained, but the explicit
  buildResources path (packaging-resources) prevents electron-builder's default
  build/icon.icns discovery; no custom icon is configured. The final packaged
  macOS icon remains unverified here. Disposing during active tweak/conversion
  work suppresses stale publication but does not stop the work itself (see
  docs/engineering/WORKBENCH_CANCELLATION.md).

SIGNING AND UPDATES
  The notarized packaging command requires the owner's local signing setup.
  Signing, notarization, release feeds and platform support require explicit
  validation before distribution. Do not run dist:notarized without the owner's
  authorized local environment, and do not publish to the placeholder updater
  feed without separate authorization.
