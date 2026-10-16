// Static contract checks for the shared universe stage (COORD-010 resolution 6213314954).
// These do not render WebGL. Behaviour is checked by the browser measurements recorded with the proof.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"

const stage = readFileSync(new URL("../../src/ui/presentation/universe/stage.js", import.meta.url), "utf8")
const shaders = readFileSync(new URL("../../src/ui/presentation/universe/shaders.js", import.meta.url), "utf8")
const manifest = JSON.parse(readFileSync(new URL("../../src/ui/presentation/universe/assets/manifest.json", import.meta.url), "utf8"))
const main = readFileSync(new URL("../../src/main.js", import.meta.url), "utf8")

test("createStage keeps the four-method stage contract", () => {
  assert.match(stage, /export function createStage\(canvas\)/)
  assert.match(stage, /setSpectrum\(\) \{\}/)
  assert.match(stage, /setEnergy\(\) \{\}/)
  assert.match(stage, /setPlaying\(p\) \{/)
  assert.match(stage, /dispose\(\) \{/)
})

test("audio input is not visualised: setSpectrum and setEnergy are deliberate no-ops", () => {
  assert.match(stage, /Accepted for contract compatibility\. Deliberately not visualised/)
  assert.doesNotMatch(stage, /getByteFrequencyData|AnalyserNode|AudioContext/)
})

test("focus and reset are wired from the canvas and removed on dispose", () => {
  assert.match(stage, /canvas\.addEventListener\("orbit:focus", onFocus\)/)
  assert.match(stage, /canvas\.addEventListener\("orbit:reset", onReset\)/)
  assert.match(stage, /canvas\.removeEventListener\("orbit:focus", onFocus\)/)
  assert.match(stage, /canvas\.removeEventListener\("orbit:reset", onReset\)/)
  assert.match(stage, /Number\.isInteger\(index\) \|\| index < 0 \|\| index >= LANDMARKS\.length/)
})

test("pointer look listens on window and is removed on dispose; it never starts on controls", () => {
  for (const ev of ["pointerdown", "pointerup", "pointercancel", "pointermove"]) {
    assert.match(stage, new RegExp(`window\\.addEventListener\\("${ev}"`))
    assert.match(stage, new RegExp(`window\\.removeEventListener\\("${ev}"`))
  }
  assert.match(stage, /const SKY_SELECTOR = "main\.deck, canvas#stage"/)
})

test("reduced motion: preference is read, follows runtime changes, and removes automatic travel", () => {
  assert.match(stage, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/)
  assert.match(stage, /mq\.addEventListener\("change", onMotionPreference\)/)
  assert.match(stage, /mq\.removeEventListener\("change", onMotionPreference\)/)
  assert.match(stage, /const drift = \(\) => \(reduced \? 0 : 1\)/)
  assert.match(stage, /if \(reduced\) \{\s*Object\.assign\(view, to\)/)
})

test("lifecycle: one RAF loop, paused while hidden, and GPU objects are released", () => {
  assert.match(stage, /document\.addEventListener\("visibilitychange", onVisibility\)/)
  assert.match(stage, /document\.removeEventListener\("visibilitychange", onVisibility\)/)
  assert.match(stage, /if \(raf \|\| disposed \|\| document\.hidden\) return/)
  assert.match(stage, /for \(const g of geometries\) g\.dispose\(\)/)
  assert.match(stage, /for \(const m of materials\) m\.dispose\(\)/)
  assert.match(stage, /renderer\.dispose\(\)/)
  assert.match(stage, /if \(disposed\) return/)
})

test("no textures, samplers, loaders or remote URLs: all art is procedural", () => {
  for (const src of [stage, shaders]) {
    assert.doesNotMatch(src, /TextureLoader|ImageLoader|CubeTextureLoader|sampler2D|texture2D|fetch\(|XMLHttpRequest/)
    assert.doesNotMatch(src, /https?:\/\//)
  }
})

test("manifest records no shipped external assets and labels the generated art", () => {
  assert.deepEqual(manifest.assets, [])
  assert.deepEqual(manifest.shippedFiles, [])
  assert.match(manifest.generated[0].labelling, /Procedural/)
})

test("main.js opts into the universe stage only with ?stage=universe; default and classic are unchanged", () => {
  assert.match(main, /import \{ createStage as createUniverseStage \} from "\.\/ui\/presentation\/universe\/stage\.js"/)
  assert.match(main, /const STAGE_PARAM = new URLSearchParams\(window\.location\.search\)\.get\("stage"\)/)
  assert.match(main, /const createStage = !ORBIT_SPIKE \? createSceneStage : STAGE_PARAM === "universe" \? createUniverseStage : createOrbitStage/)
  assert.ok(existsSync(new URL("../../src/orbit/orbitStage.js", import.meta.url)), "Orbit rollback stage must remain")
})
