// MusicOnVerse — legacy Intel (x64) build config.
// Pins Electron 32.3.3 (Chromium 128) so the app runs on macOS 10.15 Catalina
// through 12 Monterey — covering every Intel Core i5 MacBook Pro ever made.
// Usage: npx electron-builder --mac -c electron-builder.legacy.cjs
"use strict"

const pkg = require("./package.json")
const base = pkg.build

module.exports = {
  ...base,
  // Electron 32 is the last line that supports macOS Catalina (10.15);
  // Electron 33+ raises the floor to macOS 11+. Pin it here (devDep stays 44).
  electronVersion: "32.3.3",
  directories: {
    ...base.directories,
    output: "release-legacy",
  },
  mac: {
    ...base.mac,
    // x64 only — this build is specifically for Intel Macs.
    target: [
      { target: "dmg", arch: ["x64"] },
      { target: "zip", arch: ["x64"] },
    ],
  },
}