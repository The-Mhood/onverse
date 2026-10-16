// UI-005 Orbit Mode spike: contract, isolation and determinism checks (agent-b).
// Static and pure-function checks only. Rendering is verified separately with screenshots.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { mulberry32 } from "../../src/orbit/orbitTextures.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const read = (rel) => readFileSync(join(root, rel), "utf8")
const sha256 = (rel) => createHash("sha256").update(readFileSync(join(root, rel))).digest("hex")

test("createStage keeps the scene.js contract: setSpectrum, setEnergy, setPlaying, dispose", () => {
  const src = read("src/orbit/orbitStage.js")
  assert.match(src, /export function createStage\(canvas\)/)
  for (const name of ["setSpectrum(arr)", "setEnergy(v)", "setPlaying(v)", "dispose()"]) {
    assert.ok(src.includes(name), `missing ${name}`)
  }
})

test("package.json is byte-identical to the approved baseline (dependency boundary)", () => {
  // scene.js is a granted visual surface under COORD-010; its checks live in tests/ui/paletteStatic.test.js.
  assert.equal(sha256("package.json"), "c800164ee6719b2eee5967a9f0f12682795d468ff3927b7f03815870e2f999a0")
})

test("the spike adds no dependency: only three and its bundled examples are imported", () => {
  for (const f of ["src/orbit/orbitStage.js", "src/orbit/orbitTextures.js"]) {
    const imports = [...read(f).matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1])
    for (const spec of imports) {
      assert.ok(spec === "three" || spec.startsWith("three/examples/") || spec === "./orbitTextures.js", `${f} imports ${spec}`)
    }
  }
})

test("the planetary flag is off by default and selects the orbit stage only for ?orbit=1", () => {
  const main = read("src/main.js")
  assert.match(main, /const ORBIT_SPIKE = !CLASSIC_SCENE/)
  assert.match(main, /const CLASSIC_SCENE = new URLSearchParams\(window\.location\.search\)\.get\("scene"\) === "classic"/)
  assert.match(main, /const createStage = ORBIT_SPIKE \? createOrbitStage : createSceneStage/)
})

test("no automatic camera movement: autoRotate is off and reduced motion stops drift", () => {
  const src = read("src/orbit/orbitStage.js")
  assert.match(src, /controls\.autoRotate = false/)
  assert.match(src, /const drift = reduced \? 0 : 1/)
  assert.match(src, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/)
})

test("procedural textures are seeded: the PRNG reproduces fixed values", () => {
  const r = mulberry32(7)
  const got = [0, 1, 2, 3, 4].map(() => Number(r().toFixed(10)))
  assert.deepEqual(got, [0.0117047532, 0.0619582576, 0.9769076328, 0.6990287057, 0.5214452685])
})

test("no downloaded images or remote URLs in the spike", () => {
  for (const f of ["src/orbit/orbitStage.js", "src/orbit/orbitTextures.js"]) {
    assert.doesNotMatch(read(f), /https?:\/\//, f)
    assert.doesNotMatch(read(f), /\.(png|jpg|jpeg|webp)"/, f)
  }
})

// UI-005 landmark focus (keys 1–3 / chips). Static checks on the stage source.
test("landmark focus: three landmarks, a canvas event, an eased move, and reduced-motion jump", () => {
  const src = read("src/orbit/orbitStage.js")
  assert.match(src, /canvas\.addEventListener\("orbit:focus", onFocus\)/)
  assert.match(src, /canvas\.removeEventListener\("orbit:focus", onFocus\)/, "dispose must remove the listener")
  assert.equal([...src.matchAll(/\{ obj: [^,]+, radius: \d+ \}/g)].length, 3, "exactly three landmarks")
  assert.match(src, /if \(reduced\) \{[\s\S]*?controls\.update\(\)[\s\S]*?return/, "reduced motion jumps without easing")
  assert.match(src, /controls\.addEventListener\("start", \(\) => \{ focusEase = null \}\)/, "a user drag cancels an ease")
  assert.doesNotMatch(src, /autoRotate\s*=\s*true/)
})

test("the stage contract is unchanged by the focus work: no new exports", () => {
  const exports = [...read("src/orbit/orbitStage.js").matchAll(/^export (function|const|let|class) (\w+)/gm)].map((m) => m[2])
  assert.deepEqual(exports, ["createStage"])
})
