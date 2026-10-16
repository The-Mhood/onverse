// UI-004 Slice A: presentation and semantics checks (agent-b).
// These are static and pure-function checks. They do not render the app; browser rendering is
// verified separately and reported honestly.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createErrorRegion } from "../../src/ui/presentation/errorRegion.js"
import { readAppSource } from "../ui/shellSource.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const read = (rel) => readFileSync(join(root, rel), "utf8")
const fontsDir = "src/assets/fonts"

// ---- Typography: vendored, self-hosted, no remote requests ----

test("index.html loads no remote font or CDN resources", () => {
  const html = read("index.html")
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/)
  assert.doesNotMatch(html, /<link[^>]+href="https?:/)
})

test("fonts.css has one @font-face per vendored WOFF2 with explicit ?inline URLs and no remote URLs", () => {
  const css = read(`${fontsDir}/fonts.css`)
  const faces = css.match(/@font-face\s*\{[^}]*\}/g) || []
  assert.equal(faces.length, 12, "expected 12 @font-face rules (Sora x2 added 2026-10-16)")
  for (const family of ["Sora", "Orbitron", "Rajdhani", "Share Tech Mono"]) {
    assert.ok(faces.some((f) => f.includes(`font-family: '${family}'`)), `missing family ${family}`)
  }
  assert.doesNotMatch(css, /https?:\/\//)
  const urls = [...css.matchAll(/url\('\.\/([^'?]+)\?inline'\)/g)].map((m) => m[1])
  assert.equal(urls.length, faces.length, "every @font-face must use an ?inline URL")
  for (const file of urls) {
    assert.ok(existsSync(join(root, fontsDir, file)), `fonts.css references missing file ${file}`)
  }
})

test("every vendored font and licence file matches the pinned manifest (bytes and sha256)", () => {
  const manifest = JSON.parse(read(`${fontsDir}/manifest.json`))
  let checked = 0
  for (const pkg of manifest.packages) {
    for (const f of pkg.files) {
      const data = readFileSync(join(root, fontsDir, f.path))
      assert.equal(data.length, f.bytes, `${f.path} byte length`)
      assert.equal(createHash("sha256").update(data).digest("hex"), f.sha256, `${f.path} sha256`)
      checked++
    }
  }
  assert.equal(checked, 16)
})

test("each typeface ships its complete SIL OFL 1.1 text", () => {
  for (const name of ["sora-OFL.txt", "orbitron-OFL.txt", "rajdhani-OFL.txt", "share-tech-mono-OFL.txt"]) {
    const txt = read(`${fontsDir}/${name}`)
    assert.match(txt, /SIL OPEN FONT LICENSE Version 1\.1/, name)
    assert.match(txt, /Copyright/, name)
  }
})

test("notices module embeds the licence texts with ?raw and renders them without innerHTML", () => {
  const notices = read(`${fontsDir}/notices.js`)
  assert.match(notices, /\?raw/)
  for (const name of ["sora-OFL.txt", "orbitron-OFL.txt", "rajdhani-OFL.txt", "share-tech-mono-OFL.txt"]) {
    assert.ok(notices.includes(name), `notices.js must import ${name}`)
  }
  const dialog = read("src/ui/presentation/licenceDialog.js")
  assert.doesNotMatch(dialog, /innerHTML/)
  assert.match(dialog, /\.textContent = notice\.text/)
})

// ---- Focus and reduced motion ----

test("a visible focus indicator is defined for keyboard users", () => {
  const css = read("src/style.css")
  assert.match(css, /:focus-visible\s*\{[^}]*outline:\s*2px solid/)
})

test("boot splash is skipped when the OS requests reduced motion", () => {
  const main = readAppSource()
  assert.match(main, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches\)\s*dismissBoot\(\)/)
  assert.match(main, /else setTimeout\(dismissBoot, 2400\)/)
})

// ---- Copy: no unverified or removed claims ----

test("removed claims do not reappear in visible copy", () => {
  const sources = [read("index.html"), readAppSource()]
  const banned = [
    /top tracks/i,
    /Spotify's top/i,
    /fix everything/i,
    /every major/i,
    /any major audio/i,
    /sample-by-sample/i,
    /matches your mix to it exactly/i,
    /mastered profile/i,
    /sample-level matching/i,
    /exact sample/i,
  ]
  for (const src of sources) {
    for (const re of banned) assert.doesNotMatch(src, re, `banned copy matched ${re}`)
  }
})

test("reference descriptions use the approved disclosure wording", () => {
  const main = readAppSource()
  assert.match(main, /Built-in genre profile: an illustrative target/)
  assert.match(main, /Measured uploaded reference:/)
  assert.match(main, /Metadata-selected built-in profile, or a measured Apple Music preview \(30 s only\)/)
})

// ---- Semantics: names, pressed state, live error region ----

test("every icon-only button in the template has an accessible name", () => {
  const main = readAppSource()
  const buttons = main.match(/<button\b[^>]*\bbtn-square\b[^>]*>/g) || []
  assert.ok(buttons.length >= 10, `expected icon buttons, found ${buttons.length}`)
  for (const b of buttons) assert.match(b, /aria-label="[^"]+"/, `missing aria-label: ${b.slice(0, 80)}`)
})

test("mode and A/B toggles expose pressed state, not an unpaired tab pattern", () => {
  const main = readAppSource()
  assert.doesNotMatch(main, /role="tab"/)
  assert.doesNotMatch(main, /role="tablist"/)
  const modeBtns = main.match(/class="tab[^"]*mode-btn"[^>]*>/g) || []
  const abBtns = main.match(/class="tab[^"]*ab-btn"[^>]*>/g) || []
  // Three studio modes: SCAN, CONVERT, and the labelled DAW prototype (UI-006). Count updated deliberately.
  assert.equal(modeBtns.length, 3)
  assert.equal(abBtns.length, 2)
  for (const b of [...modeBtns, ...abBtns]) assert.match(b, /aria-pressed="(true|false)"/, b)
  assert.match(main, /b\.setAttribute\("aria-pressed", String\(b\.dataset\.ab === state\.ab\)\)/)
  assert.match(main, /b\.setAttribute\("aria-pressed", String\(b\.dataset\.mode === mode\)\)/)
})

test("the error region is a persistent alert, and the licence entry point exists", () => {
  const main = readAppSource()
  assert.match(main, /<div id="errorRegion" class="error-region" role="alert"><\/div>/)
  assert.match(main, /id="btnLicences"[^>]*aria-haspopup="dialog"/)
  assert.match(main, /const errorRegion = createErrorRegion\(\$\("#errorRegion"\)\)/)
})

test("play button label tracks playback state", () => {
  const main = readAppSource()
  assert.match(main, /play\.setAttribute\("aria-label", state\.playing \? "Pause" : "Play"\)/)
})

test("createErrorRegion shows and clears messages on the element", () => {
  const el = { textContent: "" }
  const region = createErrorRegion(el)
  region.show("Couldn't decode that file.")
  assert.equal(el.textContent, "Couldn't decode that file.")
  assert.equal(region.text, "Couldn't decode that file.")
  region.clear()
  assert.equal(el.textContent, "")
})

test("createErrorRegion never shows an empty error", () => {
  const el = { textContent: "" }
  const region = createErrorRegion(el)
  region.show(null)
  assert.equal(el.textContent, "Something went wrong.")
  region.show(new Error("boom").message)
  assert.equal(el.textContent, "boom")
})

test("createErrorRegion rejects a missing element instead of failing silently", () => {
  assert.throws(() => createErrorRegion(null), /element is required/)
})

// ---- Scope guard: Slice A must not touch lead- or scene-owned files ----

// Scope is measured against the approved base (main) and the published branch head, not the local
// snapshot ref. The local ref has no shared history with origin (see PR #5 preflight), so a diff
// against it reports the whole snapshot. Working-tree files that differ from origin are added as well.
// The only docs/ exception is the non-canonical agent-b proposal, which the lead explicitly allowed.
test("Slice A does not modify denied paths", () => {
  const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean)
  const origin = "origin/arena/ced77c2a-onverse"
  const published = git(["diff", "--name-only", "2faa393", origin])
  const working = git(["ls-tree", "-r", "--name-only", origin]).filter((f) => {
    try {
      const onDisk = readFileSync(join(root, f))
      const inOrigin = execFileSync("git", ["show", `${origin}:${f}`], { cwd: root })
      return !onDisk.equals(inOrigin)
    } catch {
      return true
    }
  })
  const extra = git(["ls-files", "-o", "--exclude-standard"]).filter((f) => {
    try {
      git(["cat-file", "-e", `${origin}:${f}`])
      return false
    } catch {
      return true
    }
  })
  const changed = [...new Set([...published, ...working, ...extra])]
  // COORD-010 (2026-10-15) grants src/scene.js, src/scene/** and src/ui/draw.js as visual surfaces.
  const denied = /^(src\/(audio|application|domain)\/|electron\/|package(-lock)?\.json$|vite\.config|scripts\/|docs\/|tests\/(unit|audio)\/|tests\/fixtures\/)/
  const allowedDocs = new Set(["docs/design/proposals/agent-b-daw-sylune-proposal.md"])
  const offending = changed.filter((f) => denied.test(f) && !allowedDocs.has(f))
  assert.deepEqual(offending, [], "denied paths changed")
})

// ---- Error routing: one path through toast, no test-harness changes ----

test("analysis failures are routed through toast with the error flag, not a new global", () => {
  const main = readAppSource()
  assert.match(main, /toast\(`Analysis failed: \$\{err\?\.message \|\| String\(err\)\}`, 3200, \{ error: true \}\)/)
  assert.match(main, /function toast\(msg, ms = 3200, options = \{\}\) \{/)
  assert.match(main, /if \(options\.error\) errorRegion\.show\(msg\)\s*\n\s*else errorRegion\.clear\(\)/)
})

test("the mode label no longer claims a conversational feature", () => {
  const main = readAppSource()
  assert.doesNotMatch(main, /CONVERSE/)
  assert.match(main, /◈ SCAN<\/button>/)
})

// UI-005 Orbit HUD wiring (agent-b): keys and chips reach the stage only in Orbit Mode.
test("main.js routes landmark keys and chips to the stage only when ORBIT_SPIKE is on", () => {
  const main = readAppSource()
  assert.match(main, /import \{ landmarkForKey, ORBIT_LANDMARKS \} from "\.\/orbit\/orbitKeys\.js"/)
  assert.match(main, /if \(ORBIT_SPIKE\) \{\s*const landmark = landmarkForKey\(e\)/)
  assert.match(main, /new CustomEvent\("orbit:focus", \{ detail: \{ index \} \}\)/)
  assert.match(main, /if \(ORBIT_SPIKE\) \{\s*const hud = document\.createElement\("aside"\)/)
  assert.match(main, /data-orbit-focus="\$\{l\.index\}"/)
})

test("the Orbit HUD makes no false save claim and adds no fake mode toggle", () => {
  // Owner decision (2026-10-15): Reference 2 copy and controls. The save status must match real state:
  // no project persistence exists yet, so it reads "Not saved · session only", never "Project saved locally".
  const main = readAppSource()
  assert.doesNotMatch(main, /Project saved locally/)
  assert.match(main, /Not saved · session only/)
  assert.doesNotMatch(main, /data-orbit-mode/)
})
