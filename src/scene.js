/* MusicOnVerse — cinematic 3D stage.
 * A slow-drifting nebula of steel-blue particles, an audio-reactive spectrum ring,
 * rotating wireframe torus and a pulsing core. The whole camera eases toward
 * the pointer like a high-end product film.
 */
import * as THREE from "three"

const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = (v) => Math.min(1, Math.max(0, v))

function radialTexture(inner, outer) {
  const size = 128
  const c = document.createElement("canvas")
  c.width = c.height = size
  const ctx = c.getContext("2d")
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, inner)
  g.addColorStop(1, outer)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// Palette from Reference 1: steel, blue, pale ink, warm accent.
const PALETTE = [
  new THREE.Color("#4a6f8f"),
  new THREE.Color("#7fa9cc"),
  new THREE.Color("#a9c4dc"),
  new THREE.Color("#b89d84"),
  new THREE.Color("#6f8aa6"),
]

export function createStage(canvas) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const drift = reduced ? 0 : 1 // reduced motion: no automatic camera, spin or drift (pointer look still works)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100)
  camera.position.set(0, 0, 13)

  const world = new THREE.Group()
  scene.add(world)

  /* ---- nebula particles ---- */
  const COUNT = 1300
  const pos = new Float32Array(COUNT * 3)
  const col = new Float32Array(COUNT * 3)
  const seed = new Float32Array(COUNT)
  for (let i = 0; i < COUNT; i++) {
    const r = 4 + Math.random() * 14
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7
    pos[i * 3 + 2] = -2 - r * Math.cos(phi) * 0.6
    const c = PALETTE[Math.floor(Math.random() * PALETTE.length)]
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
    seed[i] = Math.random() * 100
  }
  const pGeo = new THREE.BufferGeometry()
  pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  pGeo.setAttribute("color", new THREE.BufferAttribute(col, 3))
  const pMat = new THREE.PointsMaterial({
    size: 0.09,
    vertexColors: true,
    map: radialTexture("rgba(255,255,255,1)", "rgba(255,255,255,0)"),
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const particles = new THREE.Points(pGeo, pMat)
  world.add(particles)

  /* ---- spectrum ring ---- */
  const BARS = 56
  const bars = []
  const barMat = []
  const barGeo = new THREE.BoxGeometry(0.14, 1, 0.14)
  const baseY = 0.35
  for (let i = 0; i < BARS; i++) {
    const a = (i / BARS) * Math.PI * 2
    const c = PALETTE[i % PALETTE.length].clone().lerp(new THREE.Color("#dfe6ee"), i / BARS * 0.4)
    const mat = new THREE.MeshBasicMaterial({
      color: c,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    barMat.push(mat)
    const mesh = new THREE.Mesh(barGeo, mat)
    mesh.position.set(Math.cos(a) * 3.6, 0, Math.sin(a) * 3.6)
    mesh.rotation.y = -a
    mesh.scale.y = baseY
    mesh.userData.phase = i * 0.35
    world.add(mesh)
    bars.push(mesh)
  }

  /* ---- rotating torus rings ---- */
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x4a6f8f,
    wireframe: true,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.035, 8, 90), ringMat)
  ring1.rotation.x = Math.PI / 2.4
  world.add(ring1)
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.025, 8, 90), ringMat.clone())
  ring2.material.color.set(0xb89d84)
  ring2.material.opacity = 0.1
  ring2.rotation.x = Math.PI / 2.4 + 0.35
  world.add(ring2)

  /* ---- core glow ---- */
  const glowMat = new THREE.SpriteMaterial({
    map: radialTexture("rgba(127,169,204,0.6)", "rgba(127,169,204,0)"),
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const core = new THREE.Sprite(glowMat)
  core.scale.setScalar(4.2)
  world.add(core)

  /* ---- state ---- */
  let spectrum = new Float32Array(BARS)
  let targetSpectrum = new Float32Array(BARS)
  let energy = 0
  let targetEnergy = 0
  let playing = false
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }

  const onPointer = (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1
  }
  const onResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false)
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
  }
  window.addEventListener("pointermove", onPointer, { passive: true })
  window.addEventListener("resize", onResize)
  onResize()

  const timer = new THREE.Timer()
  let raf = 0

  function tick() {
    raf = requestAnimationFrame(tick)
    timer.update()
    const t = timer.getElapsed()

    pointer.x = lerp(pointer.x, pointer.tx, 0.035)
    pointer.y = lerp(pointer.y, pointer.ty, 0.035)
    energy = lerp(energy, targetEnergy, 0.12)
    for (let i = 0; i < BARS; i++) spectrum[i] = lerp(spectrum[i], targetSpectrum[i], 0.14)

    camera.position.x = Math.sin(t * 0.1) * 0.6 * drift + pointer.x * 1.1
    camera.position.y = Math.cos(t * 0.13) * 0.4 * drift + pointer.y * 0.7
    camera.lookAt(0, 0, -1.5)

    world.rotation.y = t * 0.03 * drift + pointer.x * 0.12

    // particles drift slowly
    const pp = pGeo.attributes.position.array
    for (let i = 0; i < COUNT; i++) {
      pp[i * 3 + 1] += Math.sin(t * 0.22 + seed[i]) * 0.0009 * drift
      pp[i * 3] += Math.cos(t * 0.18 + seed[i] * 1.7) * 0.0007 * drift
    }
    pGeo.attributes.position.needsUpdate = true
    pMat.size = 0.09 + energy * 0.05

    // bars react
    for (let i = 0; i < BARS; i++) {
      const m = bars[i]
      const idle = 0.3 + 0.16 * Math.sin(t * 1.6 + m.userData.phase) * drift
      const v = playing ? spectrum[i] : idle * 0.6
      const s = baseY + Math.max(0, v) * 2.6 * (0.75 + energy * 0.6)
      m.scale.y = lerp(m.scale.y, s, 0.18)
      m.position.y = (m.scale.y * 0.5) + 0.2
      barMat[i].opacity = 0.55 + Math.min(0.4, v * 0.8)
    }

    ring1.rotation.z = t * 0.05 * drift
    ring1.rotation.y = t * 0.07 * drift
    ring2.rotation.z = -t * 0.04 * drift
    ring2.rotation.y = -t * 0.06 * drift

    core.scale.setScalar(4.2 + Math.sin(t * 0.8) * 0.25 + energy * 1.4)
    glowMat.opacity = 0.4 + energy * 0.4

    renderer.render(scene, camera)
  }
  tick()

  return {
    setSpectrum(arr) {
      const n = Math.min(BARS, arr.length)
      for (let i = 0; i < BARS; i++) {
        const idx = Math.floor((i / BARS) * n)
        targetSpectrum[i] = clamp01(arr[idx] || 0)
      }
    },
    setEnergy(v) { targetEnergy = clamp01(v) },
    setPlaying(v) { playing = v },
    dispose() {
      cancelAnimationFrame(raf)
      window.removeEventListener("pointermove", onPointer)
      window.removeEventListener("resize", onResize)
      renderer.dispose()
    },
  }
}