import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { describe, it } from "node:test"

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
const main = readFileSync(new URL("../../src/main.js", import.meta.url), "utf8")
const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"))

describe("rebuilt entry shell contract", () => {
  it("provides a semantic mount and accessible loading status", () => {
    assert.match(html, /<main id="app">[\s\S]*?<p role="status">Loading audio workspace…<\/p>[\s\S]*?<\/main>/)
    assert.match(html, /src="\/src\/main\.js"/)
  })

  it("does not restore old theme, favicon, font requests, or hidden UI markup", () => {
    assert.doesNotMatch(html, /fonts\.googleapis|gstatic|favicon\.svg/)
    assert.doesNotMatch(html, /data-theme|theme-color/)
    assert.doesNotMatch(html, /id="(?:boot|topbar|panelIdle|panelFile|btnIdleUpload|btnIdleDemo)"/)
    assert.doesNotMatch(html, /class="[^"]*hidden[^"]*"/)
  })

  it("keeps deleted presentation modules and the old app template detached", () => {
    assert.doesNotMatch(main, /app\.innerHTML\s*=/)
    assert.doesNotMatch(main, /from "\.\/scene\.js"/)
    assert.doesNotMatch(main, /from "\.\/ui\/draw\.js"/)
    assert.doesNotMatch(main, /import "\.\/style\.css"/)
  })

  it("retires custom app-icon references without changing packaging identity or targets", () => {
    assert.equal(pkg.productName, "MusicOnVerse")
    assert.equal(pkg.build.productName, "MusicOnVerse")
    assert.equal(pkg.build.appId, "com.mov.musiconverse")
    assert.equal(pkg.scripts.icon, undefined)
    assert.equal(pkg.build.mac.icon, undefined)
    assert.equal(pkg.build.directories.buildResources, "packaging-resources",
      "do not let electron-builder auto-discover the preserved legacy build/icon.icns")
    assert.deepEqual(pkg.build.files, ["dist/**/*", "electron/**/*"])
    assert.deepEqual(pkg.build.mac.target.map(({ target }) => target), ["dmg", "zip"])
    assert.equal(pkg.scripts.dist, "npm run build && electron-builder --mac dmg")
    // build/icon.* are preserved generated legacy outputs. Assert builder
    // isolation, not physical absence of those files.
    const retiredAssets = [
      "../../scripts/make-icon.mjs",
      "../../public/favicon.svg",
      "../../src/assets/fonts/orbitron-latin-wght-normal.woff2",
      ...[400, 500, 600, 700].flatMap((weight) => [
        `../../src/assets/fonts/rajdhani-latin-${weight}-normal.woff2`,
        `../../src/assets/fonts/rajdhani-latin-ext-${weight}-normal.woff2`,
      ]),
      "../../src/assets/fonts/share-tech-mono-latin-400-normal.woff2",
      "../../src/assets/fonts/manifest.json",
    ]
    for (const path of retiredAssets) {
      assert.equal(existsSync(new URL(path, import.meta.url)), false, `${path} should be absent`)
    }
  })
  it("mounts the real workspace before binding one controller, with no stale visual dependencies", () => {
    assert.match(main, /const view = mountWorkspace/)
    assert.match(main, /const controller = createWorkbenchController/)
    assert.match(main, /view\.bind\(controller\)/)
    assert.ok(main.indexOf("mountWorkspace(document") < main.indexOf("view.bind(controller)"))
    assert.doesNotMatch(main, /btnIdleUpload|stage\?\.|stage\.set|drawRadar|drawWaveform|ICONS|boot\.onclick/)
    assert.match(main, /movUpdate\?\.onStatus/)
    assert.match(main, /unsubscribe\?\.\(\)/)
    assert.match(main, /controller\.dispose\(\)/)
  })

  it("uses new semantic controls, real peak data and text-only report/metadata insertion", () => {
    const view = readFileSync(new URL("../../src/ui/workbench/workspace.js", import.meta.url), "utf8")
    assert.match(view, /peaksFor\(selected,/)
    assert.match(view, /Reference source/)
    assert.match(view, /textContent = s\.fileName/)
    assert.match(view, /detail\.textContent = issue\.detail/)
    assert.doesNotMatch(view, /id="(?:btnIdleUpload|boot|stage|panelFile|panelIdle)"/)
    assert.match(view, /SYLUNE execution are not implemented/)
  })

  it("keeps reduced-motion support and new asset-independent responsive styling", () => {
    const css = readFileSync(new URL("../../src/ui/workbench/workspace.css", import.meta.url), "utf8")
    assert.match(css, /prefers-reduced-motion:reduce/)
    assert.match(css, /max-width:1199px/)
    assert.doesNotMatch(css, /fonts\.googleapis|gstatic|favicon|@font-face|url\(/)
  })

})

// Static checks complement, never replace, run-workbench-browser.mjs.
