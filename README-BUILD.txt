MusicOnVerse — local audio workbench
====================================

Current source status (2026-10-16)
---------------------------------
The real application is COMMITTED and PUSHED on arena/14df8ffa-onverse / PR4.
Recovery6199230 (base2faa3939), normal8051 history reconciliation3f429dd, and
cinematic app6a9369a contain the actual root entry/controller/view/services.
P7e105a0's six latest presentation files are integrated byte-identically.
Main remains2faa3939; neither PR4 nor PR8 was automatically merged.
See docs/engineering/DELIVERY_VERIFICATION_20261016.md for current evidence,
exact source/test classification, captures, motion measurements and limitations.
The earlier local-only startup report is historical, not the delivery status.

The new UI uses the existing local audio engine for single-file import/demo,
analysis/reference comparison, playback A/B, crop, Master Fix/manual adjustment,
format conversion and downloads. It is NOT a multitrack DAW, plugin host, sound
library or SYLUNE executor. No project save, persistence or undo is exposed.

Web development / production
----------------------------
Use the existing package.json/lockfile and compatible Node (verification used
Node22.22.3). In a browser-only sandbox, npm ci --ignore-scripts --no-audit --no-fund
installs without downloading/running Electron. This does not install a usable
Electron binary. For a local native development install, follow the declared
Electron/package platform requirements rather than treating the sandbox as Mac.

npm run dev -- --host 0.0.0.0
npm run build
npm run preview -- --host 0.0.0.0 --port 4173

The production build embeds CSS, JavaScript and the new P environment JPEG in
dist/index.html. Existing >500kB encoder chunk warning remains. Legacy fonts,
favicon, custom app icons and their generator are removed; no old UI is restored.

Checks
------
node --test tests/unit/*.test.js tests/audio/*.test.js tests/ui/*.test.js
node scripts/test-analyze.mjs

A clean archive of committed app6a9369a passes272tests:269PASS,0FAIL,3known
LUFS TODO defects. The preserved working tree includes unpublished core drafts;
its broader suite has462tests:459PASS,0FAIL,3TODO. To test published files only
inside this dirty checkout: node --test $(git ls-files 'tests/**/*.test.js').
TODO assertions execute. Stereo loudness and true-peak/gain risks are not repaired
or certified by the new interface. Sanity/build pass; real browser workflows,
both viewport sizes, live transitions and reduced motion pass with captured proof.

Opt-in browser proof uses only the separately approved private/pinned Chromium153
and Puppeteer25.14 toolkit. See scripts/validation/run-workbench-browser.mjs and
the engineering report. This GPU-less VM used the opt-in --cpu-renderer flag
after SwiftShader emulated-GPU dialog retirement stalls; no production/Electron
flags or motion were suppressed. Never reuse disabled-sandbox proof flags for Electron,
untrusted pages or user audio. Native Electron/Mac packaging, signing, storage,
recovery and real audio-device/listening qualification were not run here.

Packaging
---------
Existing dist/dist:legacy/dist:notarized commands and Mac dmg/zip targets remain.
ProductName/appId and signing/update hooks are unchanged. No icon is configured;
framework defaults were inspected, but no Mac package acceptance is claimed.
The held packaged-runtime diagnostic patch remains unapplied and exact-base pinned.
