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

test("scene.js and package.json are byte-identical to the approved baseline M", () => {
  assert.equal(sha256("src/scene.js"), "fb2ed8f5c3e9eadcd2c1bd3ddc96154f545971a614ae15160f88881a55d75b40")
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
  assert.match(main, /const ORBIT_SPIKE = new URLSearchParams\(window\.location\.search\)\.get\("orbit"\) === "1"/)
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
