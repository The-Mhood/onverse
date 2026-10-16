// Shell contract (COORD-010, 2026-10-16). The markup moved from src/main.js into src/ui/presentation/shell/**.
// These checks keep the application bindings and the honest DAW prototype intact. Source checks only.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { readAppSource } from "./shellSource.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const read = (f) => readFileSync(join(root, f), "utf8")
const main = read("src/main.js")
const shellAll = readAppSource()

test("shell modules are split by surface and composed by renderShell", () => {
  for (const f of ["icons.js", "header.js", "opening.js", "studio.js", "daw.js", "shell.js", "shell.css"]) {
    assert.ok(read(`src/ui/presentation/shell/${f}`).length > 0, `${f} missing`)
  }
  const shell = read("src/ui/presentation/shell/shell.js")
  assert.match(shell, /export function renderShell\(\{ ORBIT_SPIKE \}\)/)
  assert.match(shell, /\$\{headerMarkup\(\)\}/)
  assert.match(shell, /\$\{studioMarkup\(\{ ORBIT_SPIKE \}\)\}/)
  assert.match(shell, /\$\{dawMarkup\(\)\}/)
  assert.match(main, /app\.innerHTML = renderShell\(\{ ORBIT_SPIKE \}\)/)
})

test("every element ID the application binds to exists in the shell markup", () => {
  const bound = new Set()
  for (const m of main.matchAll(/\$\("#([A-Za-z][A-Za-z0-9_-]*)"\)/g)) bound.add(m[1])
  for (const m of main.matchAll(/getElementById\("([A-Za-z][A-Za-z0-9_-]*)"\)/g)) bound.add(m[1])
  // Two IDs are not in the shell by design: #app is the mount point in index.html, and #fixSummaryCard
  // is created at runtime by main.js (card.id = "fixSummaryCard"). Both must be provided by a known source.
  const runtime = { app: read("index.html"), fixSummaryCard: main }
  const missing = [...bound].filter((id) => !(id in runtime) && !new RegExp(`\\bid="${id}"`).test(shellAll))
  assert.deepEqual(missing, [], "bound ids missing from markup")
  for (const [id, src] of Object.entries(runtime)) {
    assert.ok(new RegExp(`(id="${id}"|\\.id = "${id}")`).test(src), `${id} not provided`)
  }
  assert.ok(bound.size > 40, `expected many bound ids, found ${bound.size}`)
})

test("the DAW prototype is honest: every button is disabled or a SYLUNE ask target, and nothing is a working control", () => {
  const daw = read("src/ui/presentation/shell/daw.js")
  const buttons = daw.match(/<button\b[^>]*>/g) || []
  assert.ok(buttons.length >= 10, `expected DAW buttons, found ${buttons.length}`)
  for (const b of buttons) {
    assert.ok(/\bdisabled\b/.test(b) || /class="sylune-ask-btn"/.test(b), `working-looking control: ${b}`)
  }
  assert.doesNotMatch(daw, /<input\b|<select\b|<textarea\b/)
  assert.match(daw, /data-daw-prototype/)
  assert.match(daw, /PROTOTYPE — not implemented; no audio changes\./)
  assert.match(daw, /Plugins: no plugin host\. Buses and routing: not implemented\./)
})

test("SYLUNE ask targets in the DAW use only the approved target kinds", () => {
  const daw = read("src/ui/presentation/shell/daw.js")
  const kinds = [...daw.matchAll(/data-sylune-kind="([a-z]+)"/g)].map((m) => m[1])
  assert.ok(kinds.length >= 8)
  for (const k of kinds) assert.ok(["track", "bus"].includes(k), `unexpected sylune kind ${k}`)
})

test("focus uses the approved cyan token, not a white outline", () => {
  const css = read("src/ui/presentation/shell/shell.css")
  assert.match(css, /--sh-cyan: #22d3ee;/)
  assert.match(css, /:focus-visible \{\s*outline: 2px solid var\(--sh-cyan\)/)
  assert.doesNotMatch(css, /outline:[^;]*#fff(fff)?\b/i)
})

test("reduced motion removes shell transitions and animations", () => {
  const css = read("src/ui/presentation/shell/shell.css")
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css, /transition-duration: 0\.01ms !important/)
})

test("the shell adds no network request, font URL or image asset", () => {
  for (const f of ["icons.js", "header.js", "opening.js", "studio.js", "daw.js", "shell.js", "shell.css"]) {
    const src = read(`src/ui/presentation/shell/${f}`)
    assert.doesNotMatch(src, /https?:\/\//, f)
    assert.doesNotMatch(src, /url\(/, f)
  }
})
