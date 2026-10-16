MusicOnVerse — build and packaging notes
=======================================

CURRENT UI RESET STATUS
  The former stylesheet, scene, canvas drawing module, favicon, packaged
  app-icon assets/generator, and vendored font assets have been retired. The old
  template is removed, but legacy render functions, inline icons, and DOM
  bindings remain in src/main.js pending lead-coordinated controller/view
  separation. The entry page is a neutral pending-reference shell; module boot
  is not yet validated. The replacement design is on hold until the owner
  supplies new references. Do not treat old interface instructions as current
  or claim a usable browser/desktop workflow at this stage.

REPOSITORY CONTENTS
  src/            Audio, application, domain, and remaining renderer source
  electron/       Desktop shell and update bridge
  scripts/        Build inliner and analysis/validation utilities
  build/          No custom app-icon resources are currently shipped
  public/         No static visual assets are currently shipped
  dist/           Generated, ignored build output; not a committed pre-built app
  index.html      Minimal entry shell
  package.json    Scripts and electron-builder configuration
  electron-builder.legacy.cjs  Configuration for the legacy Intel build

WEB DEVELOPMENT
  1. npm ci
  2. npm run dev

  This currently serves the neutral pending-reference shell, not a usable
  interactive audio interface. Browser controller boot has not been verified.

DESKTOP PACKAGING (macOS)
  1. npm ci
  2. npm run build
  3. npm run dist          -> release/ arm64 + x64 DMG/ZIP targets
  4. npm run dist:legacy  -> release-legacy/ x64 DMG/ZIP targets

  Custom app-icon assets are retired. Product identity (MusicOnVerse and
  com.mov.musiconverse) and the packaging targets remain configured; until new
  approved icon references exist, electron-builder's default icon behavior
  applies. macOS packaging has not been verified in this environment.

SIGNING AND UPDATES
  The notarized packaging command requires the owner's local signing setup.
  Signing, notarization, release feeds, and platform support require explicit
  validation before distribution. The generic updater URL in package.json is a
  placeholder; do not treat the updater feed as production-ready or publish to
  it without separate authorization.
