/* Deterministic procedural textures for the Orbit Mode spike (UI-005).
 * Generated on canvas at runtime from a seeded PRNG: no downloaded images, no network.
 * Same seed always yields the same pixels. */
import * as THREE from "three"

/** mulberry32: small, fast, seeded PRNG. Returns a function producing floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeCanvas(w, h) {
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  return c
}

/** Grey, cratered surface for the small moons. */
export function craterTexture(seed = 7, size = 512) {
  const rand = mulberry32(seed)
  const c = makeCanvas(size, size)
  const ctx = c.getContext("2d")
  ctx.fillStyle = "#7d7d82"
  ctx.fillRect(0, 0, size, size)
  // Low-frequency mottling.
  for (let i = 0; i < 900; i++) {
    const x = rand() * size, y = rand() * size, r = 6 + rand() * 40
    const v = 90 + Math.floor(rand() * 60)
    ctx.fillStyle = `rgba(${v},${v},${v + 4},${0.05 + rand() * 0.07})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  // Craters: dark floor, lit rim on the lower-right (matches the key light direction).
  for (let i = 0; i < 260; i++) {
    const x = rand() * size, y = rand() * size
    const r = 2 + Math.pow(rand(), 3) * 34
    const floor = ctx.createRadialGradient(x, y, 0, x, y, r)
    floor.addColorStop(0, "rgba(40,40,44,0.85)")
    floor.addColorStop(0.8, "rgba(70,70,76,0.6)")
    floor.addColorStop(1, "rgba(150,150,156,0.0)")
    ctx.fillStyle = floor
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = "rgba(205,205,210,0.35)"
    ctx.lineWidth = Math.max(1, r * 0.12)
    ctx.beginPath()
    ctx.arc(x + r * 0.08, y + r * 0.08, r, 0.2, 2.6)
    ctx.stroke()
  }
  // Fine speckle.
  for (let i = 0; i < 6000; i++) {
    const v = Math.floor(rand() * 255)
    ctx.fillStyle = `rgba(${v},${v},${v},0.12)`
    ctx.fillRect(rand() * size, rand() * size, 1, 1)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** Radial striations for planetary rings. u runs from inner to outer edge, v around the ring. */
export function ringTextures(seed = 11, width = 1024) {
  const rand = mulberry32(seed)
  // Per-column values combine several frequencies so the bands look like real ring structure.
  const values = new Float32Array(width)
  for (let x = 0; x < width; x++) {
    const broad = 0.5 + 0.5 * Math.sin(x * 0.011 + 1.3) * Math.sin(x * 0.0037 + 0.2)
    values[x] = 0.35 * broad + 0.65 * rand()
  }
  // Smooth slightly so adjacent pixels form fine lines rather than noise.
  const smooth = new Float32Array(width)
  for (let x = 0; x < width; x++) {
    let s = 0, n = 0
    for (let k = -2; k <= 2; k++) {
      const xi = x + k
      if (xi >= 0 && xi < width) { s += values[xi]; n++ }
    }
    smooth[x] = s / n
  }

  const colorCanvas = makeCanvas(width, 4)
  const cctx = colorCanvas.getContext("2d")
  const alphaCanvas = makeCanvas(width, 4)
  const actx = alphaCanvas.getContext("2d")
  for (let x = 0; x < width; x++) {
    const v = smooth[x]
    const l = Math.round(128 + 92 * v)
    cctx.fillStyle = `rgb(${l},${Math.round(l * 0.86)},${Math.round(l * 0.66)})`
    cctx.fillRect(x, 0, 1, 4)
    const a = Math.round(255 * Math.min(1, Math.max(0, 0.18 + 0.9 * (v - 0.25))))
    actx.fillStyle = `rgb(${a},${a},${a})`
    actx.fillRect(x, 0, 1, 4)
  }
  const color = new THREE.CanvasTexture(colorCanvas)
  color.colorSpace = THREE.SRGBColorSpace
  const alpha = new THREE.CanvasTexture(alphaCanvas)
  return { color, alpha }
}
