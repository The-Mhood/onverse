// Static checks for the Orbit composition pass (UI-005, presentation only). No browser.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { readAppSource } from "../ui/shellSource.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const read = (f) => readFileSync(join(root, f), "utf8")

test("Orbit chrome is on only for ?orbit=1 in the Scan/Orbit view, and off in the DAW", () => {
  const main = readAppSource()
  assert.match(main, /document\.body\.classList\.toggle\("orbit-mode", ORBIT_SPIKE && mode === "converse"\)/)
  assert.match(main, /document\.body\.classList\.toggle\("orbit-mode", ORBIT_SPIKE && state\.mode === "converse"\)/)
})

test("Orbit controls keep their bindings: Enter studio (DAW), Reset view (orbit:reset)", () => {
  const main = readAppSource()
  assert.match(main, /\$\("#btnOrbitStudio"\)\.onclick = \(\) => setMode\("daw"\)/)
  assert.match(main, /new CustomEvent\("orbit:reset"\)/)
  assert.match(read("src/orbit/orbitStage.js"), /canvas\.addEventListener\("orbit:reset", onReset\)/)
})

test("the idle landing card is restyled as a left overlay only inside body.orbit-mode", () => {
  const css = read("src/style.css")
  assert.match(css, /body\.orbit-mode \.panel-center#panelIdle \{/)
  assert.match(css, /\.orbit-title \{/)
  // The DAW and other workspaces must not inherit the overlay rules.
  assert.doesNotMatch(css, /^\.panel-center\s*\{[^}]*position:\s*absolute/m)
})

test("the AI Fix report rail is shrunk, not removed, and keeps its toggle and fix bindings", () => {
  const main = readAppSource()
  const css = read("src/style.css")
  assert.match(main, /id="reportRail"/)
  assert.match(main, /\$\("#btnFix"\)\.onclick = runFix/)
  assert.match(main, /\$\("#btnReportToggle"\)\.onclick = \(\) => reportRail\.classList\.toggle\("hidden"\)/)
  assert.match(css, /\.report-rail \{ width: min\(280px, 24vw\)/)
  assert.match(css, /\.report-rail\.hidden \{ display: none; \}/)
})

test("the fix button's ambient pulse is removed in the shrunk fix row", () => {
  assert.match(read("src/style.css"), /\.fix-row \.btn-fix \{ animation: none;/)
})

test("Orbit landmark positions keep the ringed bodies out of the planet sphere (occlusion guard)", () => {
  const stage = read("src/orbit/orbitStage.js")
  const pos = (name) => {
    const m = stage.match(new RegExp(`${name}\\.position\\.set\\(([-\\d.]+), ([-\\d.]+), ([-\\d.]+)\\)`))
    assert.ok(m, `${name} position not found`)
    return m.slice(1, 4).map(Number)
  }
  const terra = { c: [0, -3140, 0], r: 2500 } // terra centre: -(TERRA_R + 640), limb at ~84% of frame
  for (const name of ["ringBody", "ringBody2"]) {
    const p = pos(name)
    const d = Math.hypot(p[0] - terra.c[0], p[1] - terra.c[1], p[2] - terra.c[2])
    assert.ok(d > terra.r, `${name} is inside the planet sphere (distance ${d.toFixed(0)})`)
  }
})
