// Shared universe stage (COORD-010 resolution 6213314954, presentation only).
// Contract: createStage(canvas) -> { setSpectrum, setEnergy, setPlaying, dispose }, same as src/scene.js and src/orbit/orbitStage.js.
// Canvas events (same as the Orbit stage): "orbit:focus" with detail.index 0-2, and "orbit:reset".
// Motion: no automatic camera travel under prefers-reduced-motion. User drag and focus/reset act immediately under reduced motion.
// Audio: setSpectrum/setEnergy are accepted and deliberately not visualised. Audio-reactive scaling needs a lead-approved data interface.
// Lifecycle: one renderer, one RAF loop (paused while the document is hidden), listeners and GPU objects released in dispose().
import * as THREE from "three"
import { BACKDROP_FS, PLANET_VS, PLANET_FS, RING_VS, RING_FS } from "./shaders.js"

// Focus index -> landmark. Roles map to current workspace roles (Project, Reference, Master), not a track model.
export const LANDMARK_NAMES = Object.freeze(["horizon", "giant", "distant"])
const DEFAULT_VIEW = Object.freeze({ yaw: 0, pitch: -0.04, z: 0, fov: 50 })
const FOCUS_VIEW = Object.freeze({ fov: 42 })
const FOCUS_MS = 1100
const RESET_MS = 900

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function createStage(canvas) {
  const mq = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null
  let reduced = !!(mq && mq.matches)
  const drift = () => (reduced ? 0 : 1)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" })
  renderer.setPixelRatio(Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, 1.25))
  renderer.setClearColor(0x03040a, 1)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(DEFAULT_VIEW.fov, 1, 0.1, 600)

  const geometries = []
  const materials = []
  const track = (obj) => { if (obj.geometry) geometries.push(obj.geometry); if (obj.material) materials.push(obj.material); return obj }

  const backdropU = {
    uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uDrift: { value: drift() },
    uTanHalf: { value: Math.tan(THREE.MathUtils.degToRad(DEFAULT_VIEW.fov / 2)) }, uDim: { value: 1 },
    uRot: { value: new THREE.Matrix3() },
    uDeep: { value: new THREE.Color("#03040c") }, uA: { value: new THREE.Color("#3a2a86") },
    uB: { value: new THREE.Color("#1a6fb0") }, uC: { value: new THREE.Color("#d45fb8") },
    uH: { value: new THREE.Color("#ff9a4a") }, uGC: { value: new THREE.Vector3(0.42, 0.34, -0.84) },
  }
  const backdrop = track(new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: backdropU, depthTest: false, depthWrite: false,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: BACKDROP_FS,
    }),
  ))
  backdrop.frustumCulled = false
  backdrop.renderOrder = -1
  scene.add(backdrop)

  function planet({ pos, r, c1, c2, c3 = "#222", atmos = "#000", atmos2 = "#000", seed, bands = 6, craters = 0, rim = 1, rimPow = 3, sun = "#ffe2b8", light = [-0.55, 0.35, 0.75] }) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: PLANET_VS, fragmentShader: PLANET_FS,
      uniforms: {
        uSun: { value: new THREE.Vector3(...light) }, uSunCol: { value: new THREE.Color(sun) },
        uC1: { value: new THREE.Color(c1) }, uC2: { value: new THREE.Color(c2) }, uC3: { value: new THREE.Color(c3) },
        uAtmos: { value: new THREE.Color(atmos) }, uAtmos2: { value: new THREE.Color(atmos2) },
        uSeed: { value: seed }, uBands: { value: bands }, uCraters: { value: craters }, uRim: { value: rim }, uRimPow: { value: rimPow },
      },
    })
    const mesh = track(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 72), mat))
    mesh.position.set(...pos)
    mesh.scale.setScalar(r)
    scene.add(mesh)
    return mesh
  }

  const bodies = {}
  bodies.horizon = planet({
    pos: [-15, -31, -46], r: 30, c1: "#1b3b66", c2: "#10284a", c3: "#4f7fb0",
    atmos: "#ffb27a", atmos2: "#5fb8ff", seed: 11.2, bands: 5, rim: 2.2, rimPow: 2.4,
    sun: "#ffd2a0", light: [0.62, 0.22, -0.18],
  })
  const GIANT_POS = [-21, 9.5, -36]
  bodies.giant = planet({ pos: GIANT_POS, r: 5.2, c1: "#c29e7c", c2: "#7b5f4a", c3: "#3a3030", atmos: "#9fd0ff", atmos2: "#7090c0", seed: 3.1, bands: 9, rim: 1.2, rimPow: 3.2 })
  bodies.giantRing = track(new THREE.Mesh(
    new THREE.RingGeometry(1.5, 2.6, 192, 1),
    new THREE.ShaderMaterial({
      vertexShader: RING_VS, fragmentShader: RING_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uRA: { value: new THREE.Color("#8c7a66") }, uRB: { value: new THREE.Color("#e0c9a6") }, uSeed: { value: 7.7 } },
    }),
  ))
  bodies.giantRing.rotation.set(1.25, 0.0, 0.35)
  bodies.giant.add(bodies.giantRing)
  bodies.moonA = planet({ pos: [7, 5.5, -22], r: 1.8, c1: "#9a9692", c2: "#66635f", c3: "#3a3a3c", atmos: "#101010", seed: 5.5, bands: 2, craters: 1, rim: 0.2, rimPow: 6 })
  bodies.moonB = planet({ pos: [-3.5, -2.5, -17], r: 0.7, c1: "#a88466", c2: "#6e5443", c3: "#2e2420", atmos: "#101010", seed: 9.9, bands: 2, craters: 1, rim: 0.2, rimPow: 6 })
  bodies.distant = planet({ pos: [-18, 14, -58], r: 0.9, c1: "#6a4c9c", c2: "#3f2b6b", c3: "#c07ad9", atmos: "#d68cff", seed: 2.2, bands: 3, rim: 0.8, rimPow: 4 })
  const LANDMARKS = [bodies.horizon, bodies.giant, bodies.distant]
  const MOON_ORBITS = [
    { mesh: bodies.moonA, radius: 14, speed: 0.021, phase: 0.4 },
    { mesh: bodies.moonB, radius: 19, speed: 0.013, phase: 2.1 },
  ]

  // Camera state. "focus" is an eased transition; any user drag or manual change cancels it immediately.
  const view = { yaw: DEFAULT_VIEW.yaw, pitch: DEFAULT_VIEW.pitch, z: DEFAULT_VIEW.z, fov: DEFAULT_VIEW.fov }
  let transition = null
  let time = 0
  let last = typeof performance !== "undefined" ? performance.now() : 0
  let raf = 0
  let disposed = false
  let playing = false

  function directionTo(p) {
    const dx = p.x, dy = p.y - 0, dz = p.z - view.z
    const len = Math.hypot(dx, dy, dz) || 1
    const d = { x: dx / len, y: dy / len, z: dz / len }
    const pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1))
    const yaw = Math.atan2(-d.x, -d.z)
    return { yaw, pitch: THREE.MathUtils.clamp(pitch, -0.6, 0.5) }
  }

  function startTransition(to, ms) {
    if (reduced) {
      Object.assign(view, to)
      transition = null
      return
    }
    transition = { from: { ...view }, to, t0: performance.now(), ms }
  }

  function onFocus(e) {
    const index = e && e.detail ? e.detail.index : undefined
    if (!Number.isInteger(index) || index < 0 || index >= LANDMARKS.length) return
    const aim = directionTo(LANDMARKS[index].position)
    startTransition({ yaw: aim.yaw, pitch: aim.pitch, z: view.z, fov: FOCUS_VIEW.fov }, FOCUS_MS)
  }
  function onReset() {
    startTransition({ ...DEFAULT_VIEW }, RESET_MS)
  }
  function cancelTransition() {
    transition = null
  }

  // Pointer look: direct and undamped. Input cancels any focus ease in progress.
  // The canvas itself is pointer-events:none in the shell, so listen on window and start a drag only on sky targets
  // (body, document, the main deck or the canvas), never on controls, panels or text.
  let dragging = false
  let pointerId = null
  const SKY_SELECTOR = "main.deck, canvas#stage"
  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return
    const t = e.target
    const isSky = t === document.body || t === document.documentElement || (t instanceof Element && t.matches(SKY_SELECTOR))
    if (!isSky) return
    dragging = true
    pointerId = e.pointerId
    cancelTransition()
  }
  function onPointerUp() {
    dragging = false
    pointerId = null
  }
  function onPointerMove(e) {
    if (!dragging || e.pointerId !== pointerId) return
    cancelTransition()
    view.yaw -= e.movementX * 0.0022
    view.pitch = THREE.MathUtils.clamp(view.pitch - e.movementY * 0.0022, -0.6, 0.5)
  }

  function onMotionPreference(e) {
    reduced = !!e.matches
    backdropU.uDrift.value = drift()
    if (reduced) cancelTransition()
  }

  const size = { w: 1, h: 1 }
  function resize() {
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null
    const w = Math.max(1, Math.round((rect && rect.width) || canvas.clientWidth || (typeof innerWidth === "number" ? innerWidth : 1)))
    const h = Math.max(1, Math.round((rect && rect.height) || canvas.clientHeight || (typeof innerHeight === "number" ? innerHeight : 1)))
    size.w = w; size.h = h
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    const pr = renderer.getPixelRatio()
    backdropU.uRes.value.set(w * pr, h * pr)
  }
  let observer = null
  if (typeof ResizeObserver === "function") {
    observer = new ResizeObserver(() => resize())
    observer.observe(canvas)
  } else if (typeof window !== "undefined") {
    window.addEventListener("resize", resize)
  }

  function frame(now) {
    if (disposed) return
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    time += dt
    const d = drift()
    backdropU.uTime.value = time

    if (transition) {
      const k = Math.min((performance.now() - transition.t0) / transition.ms, 1)
      const e = easeInOut(k)
      const { from, to } = transition
      view.yaw = from.yaw + (to.yaw - from.yaw) * e
      view.pitch = from.pitch + (to.pitch - from.pitch) * e
      view.z = from.z + (to.z - from.z) * e
      view.fov = from.fov + (to.fov - from.fov) * e
      if (k >= 1) transition = null
    }

    camera.position.set(Math.sin(time * 0.05) * 0.6 * d, Math.sin(time * 0.037) * 0.25 * d, view.z)
    camera.fov = view.fov
    camera.updateProjectionMatrix()
    camera.quaternion.setFromEuler(new THREE.Euler(view.pitch, view.yaw, 0, "YXZ"))
    camera.updateMatrixWorld()
    backdropU.uRot.value.setFromMatrix4(camera.matrixWorld)

    for (const m of MOON_ORBITS) {
      const a = m.phase + time * m.speed * d
      m.mesh.position.set(GIANT_POS[0] + Math.cos(a) * m.radius, GIANT_POS[1] + Math.sin(a * 0.6) * 2.2, GIANT_POS[2] + Math.sin(a) * m.radius)
    }
    bodies.giantRing.rotation.z = 0.35 + time * 0.0015 * d

    renderer.render(scene, camera)
    raf = requestAnimationFrame(frame)
  }

  function startLoop() {
    if (raf || disposed || document.hidden) return
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }
  function stopLoop() {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }
  function onVisibility() {
    if (document.hidden) stopLoop()
    else startLoop()
  }

  canvas.addEventListener("orbit:focus", onFocus)
  canvas.addEventListener("orbit:reset", onReset)
  window.addEventListener("pointerdown", onPointerDown)
  window.addEventListener("pointerup", onPointerUp)
  window.addEventListener("pointercancel", onPointerUp)
  window.addEventListener("pointermove", onPointerMove)
  if (mq && mq.addEventListener) mq.addEventListener("change", onMotionPreference)
  document.addEventListener("visibilitychange", onVisibility)

  resize()
  startLoop()

  return {
    // Accepted for contract compatibility. Deliberately not visualised (no audio-reactive behaviour in this stage).
    setSpectrum() {},
    setEnergy() {},
    setPlaying(p) { playing = !!p },
    get playing() { return playing },
    dispose() {
      if (disposed) return
      disposed = true
      stopLoop()
      canvas.removeEventListener("orbit:focus", onFocus)
      canvas.removeEventListener("orbit:reset", onReset)
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointercancel", onPointerUp)
      window.removeEventListener("pointermove", onPointerMove)
      if (mq && mq.removeEventListener) mq.removeEventListener("change", onMotionPreference)
      document.removeEventListener("visibilitychange", onVisibility)
      if (observer) observer.disconnect()
      else window.removeEventListener("resize", resize)
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
      renderer.dispose()
    },
  }
}
