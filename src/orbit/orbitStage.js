/* MusicOnVerse — Orbit Mode planetary stage (UI-005 spike, behind ?orbit=1).
 * Same contract as src/scene.js: createStage(canvas) -> { setSpectrum, setEnergy, setPlaying, dispose }.
 * Procedural Three.js only: shader planets, a striated ring, cratered moons, a nebula backdrop.
 * Camera: deliberate OrbitControls drag/zoom, plus user-triggered landmark focus (keys 1–3 or the chips).
 * The focus move is eased, and instant when prefers-reduced-motion is set. There is no automatic camera movement. */
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { ringTextures } from "./orbitTextures.js"

const clamp01 = (v) => Math.min(1, Math.max(0, v))

const NOISE = /* glsl */ `
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash3(i), b = hash3(i + vec3(1.0, 0.0, 0.0));
  float c = hash3(i + vec3(0.0, 1.0, 0.0)), d = hash3(i + vec3(1.0, 1.0, 0.0));
  float e = hash3(i + vec3(0.0, 0.0, 1.0)), g = hash3(i + vec3(1.0, 0.0, 1.0));
  float k = hash3(i + vec3(0.0, 1.0, 1.0)), m = hash3(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(k, m, f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float s = 0.0, amp = 0.5;
  for (int i = 0; i < 5; i++) { s += amp * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); amp *= 0.5; }
  return s;
}`

const PLANET_VS = /* glsl */ `
varying vec3 vObj;
varying vec3 vWN;
varying vec3 vWPos;
void main() {
  vObj = normalize(position);
  vWN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`

/* Blue cloud-streaked world seen from orbit (Reference 1, lower half). */
const TERRA_FS = /* glsl */ `
uniform vec3 uLight;
uniform vec3 uCam;
uniform float uTime;
uniform float uEnergy;
varying vec3 vObj;
varying vec3 vWN;
varying vec3 vWPos;
${NOISE}
void main() {
  vec3 n = normalize(vObj);
  float streak = fbm(vec3(n.x * 2.2, n.y * 16.0, n.z * 2.2) + vec3(uTime * 0.012, 0.0, 0.0));
  float cloud = smoothstep(0.50, 0.80, streak);
  vec3 deep = vec3(0.020, 0.075, 0.150);
  vec3 shallow = vec3(0.060, 0.190, 0.320);
  vec3 ocean = mix(deep, shallow, fbm(n * 3.0));
  vec3 cloudCol = vec3(0.62, 0.58, 0.52);
  vec3 col = mix(ocean, cloudCol, cloud * 0.55);
  vec3 N = normalize(vWN);
  float ndl = dot(N, uLight);
  float lit = smoothstep(-0.18, 0.30, ndl);
  vec3 V = normalize(uCam - vWPos);
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.2);
  vec3 atmo = vec3(0.30, 0.60, 1.0) * rim * (0.35 + 0.65 * clamp(ndl + 0.2, 0.0, 1.0));
  vec3 outc = col * (0.04 + 0.96 * lit) + atmo * (0.75 + 0.5 * uEnergy);
  gl_FragColor = vec4(outc, 1.0);
}`

/* Atmospheric limb halo: additive shell just outside the planet edge. */
const HALO_FS = /* glsl */ `
uniform vec3 uLight;
uniform float uEnergy;
varying vec3 vObj;
varying vec3 vWN;
varying vec3 vWPos;
uniform vec3 uCam;
void main() {
  vec3 N = normalize(vWN);
  vec3 V = normalize(uCam - vWPos);
  float edge = pow(1.0 - abs(dot(N, V)), 4.0);
  float day = smoothstep(-0.25, 0.45, dot(N, uLight));
  vec3 c = vec3(0.35, 0.68, 1.0) * edge * (0.25 + 0.75 * day) * (0.7 + 0.5 * uEnergy);
  gl_FragColor = vec4(c, 1.0);
}`

/* Banded gas giant (Reference 1, top): cream/brown bands with storm swirls. */
const GIANT_FS = /* glsl */ `
uniform vec3 uLight;
uniform vec3 uCam;
uniform vec3 uTint;
varying vec3 vObj;
varying vec3 vWN;
varying vec3 vWPos;
${NOISE}
void main() {
  vec3 n = normalize(vObj);
  float warp = fbm(n * 2.6) * 2.4;
  float band = sin(n.y * 34.0 + warp) * 0.5 + 0.5;
  float swirl = fbm(vec3(n.x * 6.0, n.y * 3.0, n.z * 6.0) + vec3(0.0, 0.0, warp));
  vec3 cream = vec3(0.80, 0.70, 0.56) * uTint;
  vec3 brown = vec3(0.36, 0.22, 0.14) * uTint;
  vec3 col = mix(brown, cream, smoothstep(0.25, 0.75, band));
  col = mix(col, col * 0.62, smoothstep(0.55, 0.8, swirl) * 0.6);
  vec3 N = normalize(vWN);
  float ndl = dot(N, uLight);
  float lit = smoothstep(-0.15, 0.28, ndl);
  gl_FragColor = vec4(col * (0.05 + 0.95 * lit), 1.0);
}`

/* Deep-space backdrop: teal-blue nebula haze over near-black, sampled by direction. */
const NEBULA_VS = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const NEBULA_FS = /* glsl */ `
uniform float uTime;
varying vec3 vDir;
${NOISE}
void main() {
  vec3 d = normalize(vDir);
  float haze = fbm(d * 2.4 + vec3(0.0, uTime * 0.004, 0.0));
  float wisps = fbm(d * 6.5 + vec3(3.1, 0.0, 1.7));
  float band = smoothstep(0.35, 0.8, haze) * (0.45 + 0.55 * wisps);
  vec3 base = vec3(0.012, 0.018, 0.032);
  vec3 teal = vec3(0.080, 0.215, 0.270);
  vec3 warm = vec3(0.150, 0.095, 0.075);
  vec3 col = base + teal * band * 0.9 + warm * smoothstep(0.6, 0.9, wisps) * 0.35 * (1.0 - d.y);
  gl_FragColor = vec4(col, 1.0);
}`

function starField(rand, count, radius) {
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1, th = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u)
    pos[i * 3] = radius * s * Math.cos(th)
    pos[i * 3 + 1] = radius * u
    pos[i * 3 + 2] = radius * s * Math.sin(th)
    const k = 0.55 + rand() * 0.45
    col[i * 3] = k; col[i * 3 + 1] = k * (0.93 + rand() * 0.07); col[i * 3 + 2] = k * (0.9 + rand() * 0.1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  g.setAttribute("color", new THREE.BufferAttribute(col, 3))
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }))
}

/* Ring as a polar strip with radial u (0 inner → 1 outer) so striations run radially. */
function ringGeometry(inner, outer, segments = 256) {
  const pos = [], uv = [], idx = []
  for (let i = 0; i <= segments; i++) {
    const th = (i / segments) * Math.PI * 2
    for (let j = 0; j <= 1; j++) {
      const r = j === 0 ? inner : outer
      pos.push(r * Math.cos(th), 0, r * Math.sin(th))
      uv.push(j, i / segments)
    }
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3
    idx.push(a, c, b, b, c, d)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

export function createStage(canvas) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const drift = reduced ? 0 : 1

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.setClearColor(0x03050a, 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 20000)
  // Start pitched down toward the planet so the limb sits near 43% from the top of the frame.
  const START = new THREE.Vector3(0, 0, 0)
  const TARGET = new THREE.Vector3(0, -360, -1000)
  camera.position.copy(START)
  camera.lookAt(TARGET)

  const LIGHT = new THREE.Vector3(-0.7, 0.36, 0.5).normalize()
  const uniforms = {
    uLight: { value: LIGHT },
    uCam: { value: camera.position },
    uTime: { value: 0 },
    uEnergy: { value: 0 },
  }

  /* ---- backdrop ---- */
  const nebula = new THREE.Mesh(
    new THREE.SphereGeometry(9000, 48, 32),
    new THREE.ShaderMaterial({ vertexShader: NEBULA_VS, fragmentShader: NEBULA_FS, uniforms, side: THREE.BackSide, depthWrite: false }),
  )
  scene.add(nebula)
  const stars = starField(mulberryFromSeed(3), 2600, 7000)
  scene.add(stars)

  /* ---- Terra: the blue planet below the horizon ---- */
  const TERRA_R = 2500
  const terraMat = new THREE.ShaderMaterial({ vertexShader: PLANET_VS, fragmentShader: TERRA_FS, uniforms })
  const terra = new THREE.Mesh(new THREE.SphereGeometry(TERRA_R, 160, 120), terraMat)
  terra.position.set(0, -TERRA_R - 640, 0) // limb near 84% of frame height, as in Reference 2
  scene.add(terra)
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(TERRA_R * 1.035, 160, 120),
    new THREE.ShaderMaterial({ vertexShader: PLANET_VS, fragmentShader: HALO_FS, uniforms, side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  )
  halo.position.copy(terra.position)
  scene.add(halo)

  /* ---- banded gas giant, cropped by the top edge ---- */
  const giantUniforms = { ...uniforms, uTint: { value: new THREE.Vector3(1, 1, 1) } }
  const giant = new THREE.Mesh(
    new THREE.SphereGeometry(1100, 160, 120),
    new THREE.ShaderMaterial({ vertexShader: PLANET_VS, fragmentShader: GIANT_FS, uniforms: giantUniforms }),
  )
  giant.position.set(0, 1501, -1873) // above the frame; Reference landmark brings it in
  giant.rotation.z = 0.12
  scene.add(giant)


  /* ---- ringed foreground body: striated rings crossing the lower frame ---- */
  const ringBody = new THREE.Group()
  ringBody.position.set(-757, 188, -2065) // upper-left, cropped by the top edge (projects to ~23%W, 0%H)
  ringBody.rotation.set(-0.75, 0, 0.1)
  scene.add(ringBody)
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xc2a886, roughness: 0.8, metalness: 0, emissive: 0x20170e, emissiveIntensity: 1 }) // warm lit planet, Reference 2
  const body = new THREE.Mesh(new THREE.SphereGeometry(300, 128, 96), bodyMat)
  ringBody.add(body)
  const ringTex = ringTextures(11)
  const ringMat = new THREE.MeshStandardMaterial({ map: ringTex.color, alphaMap: ringTex.alpha, transparent: true, side: THREE.DoubleSide, roughness: 0.85, metalness: 0, depthWrite: false })
  const ring = new THREE.Mesh(ringGeometry(300, 780), ringMat)
  ringBody.add(ring)

  /* ---- second ringed body, lower right: its ring arcs across the horizon (composition per the approved mock) ---- */
  const ringBody2 = new THREE.Group()
  ringBody2.position.set(455, -693, -677) // lower-right arc crossing the limb (projects to ~85%W, 102%H)
  ringBody2.rotation.set(-1.05, 0, -0.35)
  scene.add(ringBody2)
  const body2 = new THREE.Mesh(new THREE.SphereGeometry(190, 96, 72), new THREE.MeshStandardMaterial({ color: 0x9a8670, roughness: 0.9, metalness: 0 }))
  ringBody2.add(body2)
  const ring2Tex = ringTextures(23)
  const ring2Mat = new THREE.MeshStandardMaterial({ map: ring2Tex.color, alphaMap: ring2Tex.alpha, transparent: true, side: THREE.DoubleSide, roughness: 0.85, metalness: 0, depthWrite: false })
  const ring2 = new THREE.Mesh(ringGeometry(240, 480), ring2Mat)
  ringBody2.add(ring2)

  /* ---- cratered moons on the right ---- */
  const moonSpecs = [
    { p: [653, -205, -1335], r: 150 }, // grey moon, right (projects to ~83%W, 29%H)
  ]
  // Smooth grey moon on the right, as in Reference 2 (no crater texture).
  const moons = moonSpecs.map(({ p, r }) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 96, 64), new THREE.MeshStandardMaterial({ color: 0x9d9a96, roughness: 0.82, metalness: 0 }))
    m.position.set(...p)
    scene.add(m)
    return m
  })

  /* ---- distant specks in the haze ---- */
  const specks = []
  const rand = mulberryFromSeed(19)
  for (let i = 0; i < 6; i++) {
    const r = 3 + rand() * 9
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshStandardMaterial({ color: 0x6b6b72, roughness: 1 }))
    const a = (-0.35 + rand() * 0.7), e = 0.05 + rand() * 0.4, dist = 1400 + rand() * 900
    m.position.set(Math.sin(a) * dist, Math.sin(e) * dist * 0.6, -Math.cos(a) * dist)
    scene.add(m)
    specks.push(m)
  }

  /* ---- lighting for standard materials ---- */
  const key = new THREE.DirectionalLight(0xfff1dc, 3.0)
  key.position.copy(LIGHT).multiplyScalar(10000)
  scene.add(key)
  scene.add(new THREE.AmbientLight(0x23324a, 0.35))

  /* ---- deliberate camera: drag/zoom only, no auto-rotate ---- */
  const controls = new OrbitControls(camera, canvas)
  controls.target.copy(TARGET)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.autoRotate = false
  controls.rotateSpeed = 0.5
  controls.zoomSpeed = 0.7
  controls.minDistance = 250
  controls.maxDistance = 3200
  controls.minPolarAngle = 0.25
  controls.maxPolarAngle = Math.PI - 0.25
  controls.update()

  /* ---- landmark focus: keys 1–3 and the chips dispatch "orbit:focus" on the canvas (index 0–2).
   * The camera keeps its current viewing direction and eases to a standoff from the landmark.
   * Under reduced motion it jumps. Any user drag cancels an ease in progress. ---- */
  const LANDMARKS = [
    { obj: ringBody, radius: 780 },    // 1 Project: ringed body, upper left
    { obj: giant, radius: 1100 },      // 2 Reference: banded gas giant, top
    { obj: moons[0], radius: 150 },    // 3 Master: the grey moon, right
  ]
  let focusEase = null
  const focusCenter = new THREE.Vector3()
  function onFocus(event) {
    const lm = LANDMARKS[event && event.detail ? event.detail.index : -1]
    if (!lm) return
    lm.obj.getWorldPosition(focusCenter)
    const dir = camera.position.clone().sub(controls.target).normalize()
    const standoff = Math.min(controls.maxDistance * 0.9, Math.max(controls.minDistance * 1.2, lm.radius * 3))
    const toPos = focusCenter.clone().addScaledVector(dir, standoff)
    if (reduced) {
      controls.target.copy(focusCenter)
      camera.position.copy(toPos)
      controls.update()
      return
    }
    focusEase = { fromT: controls.target.clone(), toT: focusCenter.clone(), fromP: camera.position.clone(), toP: toPos, t0: -1, dur: 900 }
  }
  canvas.addEventListener("orbit:focus", onFocus)
  // "Reset view" (Orbit overlay): back to the start pose. Instant under reduced motion; no timers or tweens.
  function onReset() {
    focusEase = null
    controls.target.copy(TARGET)
    camera.position.copy(START)
    controls.update()
  }
  canvas.addEventListener("orbit:reset", onReset)
  controls.addEventListener("start", () => { focusEase = null })

  /* ---- sizing ---- */
  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null
  if (ro) ro.observe(canvas)
  else window.addEventListener("resize", resize)
  resize()

  /* ---- loop ---- */
  let raf = 0
  let t = 0
  let last = performance.now()
  let playing = false
  let targetEnergy = 0
  let energy = 0
  let disposed = false
  const amp = reduced ? 0.4 : 1

  function frame(now) {
    if (disposed) return
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    const speed = drift * (playing ? 1 : 0.4)
    t += dt * speed
    energy += (targetEnergy - energy) * 0.1
    uniforms.uTime.value = t
    uniforms.uEnergy.value = energy * amp
    if (focusEase) {
      if (focusEase.t0 < 0) focusEase.t0 = now
      const u = Math.min(1, (now - focusEase.t0) / focusEase.dur)
      const e = 1 - Math.pow(1 - u, 3)
      controls.target.lerpVectors(focusEase.fromT, focusEase.toT, e)
      camera.position.lerpVectors(focusEase.fromP, focusEase.toP, e)
      if (u >= 1) focusEase = null
    }
    controls.update()
    renderer.render(scene, camera)
  }
  raf = requestAnimationFrame(frame)

  return {
    setSpectrum(arr) {
      let s = 0
      const n = Math.min(arr.length, 56)
      for (let i = 0; i < n; i++) s += arr[i] || 0
      targetEnergy = clamp01(n ? s / (n * 255) : 0)
    },
    setEnergy(v) { targetEnergy = clamp01(v) },
    setPlaying(v) { playing = !!v },
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      canvas.removeEventListener("orbit:focus", onFocus)
      canvas.removeEventListener("orbit:reset", onReset)
      if (ro) ro.disconnect()
      else window.removeEventListener("resize", resize)
      controls.dispose()
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
        for (const m of mats) {
          for (const k of Object.keys(m)) if (m[k] && m[k].isTexture) m[k].dispose()
          m.dispose()
        }
      })
      moons.forEach((m) => { m.geometry.dispose(); m.material.dispose() })
      ringTex.color.dispose()
      ringTex.alpha.dispose()
      renderer.dispose()
    },
  }
}

function mulberryFromSeed(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
