MusicOnVerse — Audio Intelligence Studio
=========================================

WHAT'S IN THIS ZIP
  src/            Application source (UI + audio DSP: analyzer, genre engine,
                  reference resolver, processor, players)
  electron/       Desktop shell (main.cjs, preload.cjs, notarize hook)
  scripts/        Build utilities (single-file inliner, icon generator, sanity test)
  build/          App icon (.icns source)
  public/         Static assets
  dist/           PRE-BUILT APP — dist/index.html is a fully self-contained
                  single-file build. Double-click it to run MusicOnVerse in any
                  modern browser. No install needed.
  index.html      Vite entry page
  package.json    Scripts + electron-builder config
  electron-builder.legacy.cjs  Config for the macOS Catalina (10.15–12) build

RUN IT RIGHT NOW (no build)
  1. Unzip.
  2. Open dist/index.html in Chrome / Edge / Safari.
  3. Click GENERATE DEMO TRACK (or OPEN AUDIO FILE) and hit CONVERSE.

RUN AS A WEB APP IN DEV
  1. npm install
  2. npm run dev        (Vite dev server)

BUILD THE DESKTOP APPS (macOS)
  1. npm install
  2. npm run build          (regenerates dist/)
  3. npm run dist           -> release/  arm64 + x64 DMG + ZIP  (macOS 13+)
  4. npm run dist:legacy    -> release-legacy/  x64 ZIP/DMG for macOS 10.15–12

  First launch of an unsigned build: right-click the app -> Open -> Open.
  For Gatekeeper-clean builds, fill ~/.freebuff/mov-sign.env with your Developer
  ID .p12 + App Store Connect API key, then run npm run dist:notarized.

AUTO-UPDATES
  electron-updater is wired. Point the "publish" block in package.json at your
  hosted feed and upload release/*.zip + release/latest-mac.yml there.
