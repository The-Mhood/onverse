// Generates build/icon_1024.png — MusicOnVerse app icon:
// dark purple rounded square, violet→magenta waveform bars (pure Node, no deps).
import { deflateSync } from "node:zlib"
import { writeFileSync, mkdirSync } from "node:fs"

const S = 1024
const PX = new Float64Array(S * S * 4) // premultiplied? no: straight RGBA floats

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const mix = (a, b, t) => a + (b - a) * t

function addPx(x, y, r, g, b, a) {
  const i = (y * S + x) * 4
  PX[i] += r * a
  PX[i + 1] += g * a
  PX[i + 2] += b * a
  PX[i + 3] += a
}
function setPx(x, y, r, g, b, a) {
  const i = (y * S + x) * 4
  PX[i] = r
  PX[i + 1] = g
  PX[i + 2] = b
  PX[i + 3] = a
}

// ---- geometry ----
const CORNER = 232 // outer rounded-corner radius
const X0 = 208, X1 = 816 // bar field
const NB = 7
const BW = 60 // bar width
const GAP = (X1 - X0 - NB * BW) / (NB - 1)
const YB = 756 // baseline
const HB = [170, 296, 452, 622, 540, 384, 246] // bar heights
const CAPR = 26 // top cap radius

// rounded outer mask (SDF, exact aa via supersampling inside)
function outerCoverage(x, y) {
  // distance to rounded rect [0,0,S,S] radius CORNER
  const qx = Math.abs(x - 0.5 - S / 2) - (S / 2 - CORNER)
  const qy = Math.abs(y - 0.5 - S / 2) - (S / 2 - CORNER)
  const ax = Math.max(qx, 0), ay = Math.max(qy, 0)
  const d = Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - CORNER
  return clamp(0.5 - d, 0, 1)
}

// vertical gradient helpers (top..bottom inside one bar)
function barColor(x, yTop, yBot, idx, y) {
  const t = clamp((y - yTop) / Math.max(1, yBot - yTop), 0, 1)
  let top, bot
  if (idx === 3) {
    // center accent — magenta
    top = [255, 214, 250]; bot = [168, 22, 150]
  } else {
    // violet family
    top = [232, 206, 255]; bot = [110, 58, 232]
  }
  const c = [0, 0, 0]
  for (let k = 0; k < 3; k++) c[k] = mix(bot[k], top[k], Math.pow(1 - t, 0.85))
  return c
}

function barCoverageAndColor(x, y, idx) {
  const cx = X0 + BW / 2 + idx * (BW + GAP)
  const h = HB[idx]
  const yTop = YB - h
  if (y < yTop - 2 || y > YB + 1) return 0
  // vertical supersample ×4
  let cov = 0
  const ys = [y - 0.375, y - 0.125, y + 0.125, y + 0.375]
  for (const sy of ys) {
    if (sy < yTop || sy > YB) continue
    const yRel = sy - yTop
    let hw = BW / 2
    if (yRel < CAPR) hw = Math.sqrt(Math.max(0, 2 * CAPR * yRel - yRel * yRel))
    const xl = cx - hw, xr = cx + hw
    const ov = Math.min(xr, x + 0.5) - Math.max(xl, x - 0.5)
    if (ov > 0) cov += Math.min(ov, 1)
  }
  cov /= 4
  return cov
}

function bgColor(x, y) {
  const t = y / S
  // deep purple-black vertical field
  const base = [15, 6, 34]
  const bot = [31, 12, 64]
  let r = mix(base[0], bot[0], t), g = mix(base[1], bot[1], t), b = mix(base[2], bot[2], t)
  // radial violet glow behind the bars
  const dcx = (x - 512) / 700, dcy = (y - 620) / 700
  const glow = Math.exp(-(dcx * dcx + dcy * dcy)) * 0.85
  r += 56 * glow; g += 18 * glow; b += 110 * glow
  // soft magenta bloom top-center
  const dtx = (x - 512) / 520, dty = (y - 430) / 520
  const bloom = Math.exp(-(dtx * dtx + dty * dty)) * 0.5
  r += 70 * bloom * (1 - t); b += 40 * bloom * (1 - t); g += 4 * bloom * (1 - t)
  return [Math.min(255, r), Math.min(255, g), Math.min(255, b)]
}

// ---- composite (2×2 supersample for edges) ----
const samples = [[0.25, 0.25], [0.25, 0.75], [0.75, 0.25], [0.75, 0.75]]
for (let py = 0; py < S; py++) {
  for (let px = 0; px < S; px++) {
    let cr = 0, cg = 0, cb = 0, ca = 0
    for (const [sx, sy] of samples) {
      const x = px + sx - 0.5, y = py + sy - 0.5
      const o = outerCoverage(x, y)
      if (o <= 0) continue
      const [br, bg, bb] = bgColor(x, y)
      let r = br, g = bg, b = bb
      for (let i = 0; i < NB; i++) {
        const cov = barCoverageAndColor(x, y, i)
        if (cov > 0) {
          const cx = X0 + BW / 2 + i * (BW + GAP)
          const yTop = YB - HB[i]
          const [rr, gg, bbb] = barColor(x, yTop, YB, i, y)
          r = mix(r, rr, cov); g = mix(g, gg, cov); b = mix(b, bbb, cov)
        }
      }
      cr += r * o; cg += g * o; cb += b * o; ca += o
    }
    setPx(px, py, cr / 4, cg / 4, cb / 4, (ca / 4) * 255)
  }
}

// ---- PNG encode (8-bit RGBA) ----
const crcTable = new Int32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[n] = c
}
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, "ascii"), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4)
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
const raw = Buffer.alloc(S * (S * 4 + 1))
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0 // filter: none
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4
    raw[y * (S * 4 + 1) + 1 + x * 4] = Math.round(PX[i])
    raw[y * (S * 4 + 1) + 2 + x * 4] = Math.round(PX[i + 1])
    raw[y * (S * 4 + 1) + 3 + x * 4] = Math.round(PX[i + 2])
    raw[y * (S * 4 + 1) + 4 + x * 4] = Math.round(PX[i + 3])
  }
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
])
mkdirSync(new URL("../build/", import.meta.url).pathname, { recursive: true })
const out = new URL("../build/icon_1024.png", import.meta.url).pathname
writeFileSync(out, png)
console.log("wrote", out, png.length, "bytes")
// sanity: sample a few pixels
const at = (x, y) => [PX[(y * S + x) * 4], PX[(y * S + x) * 4 + 1], PX[(y * S + x) * 4 + 2], PX[(y * S + x) * 4 + 3]]
console.log("corner (should be alpha≈0):", at(8, 8).map(v => Math.round(v)))
console.log("bg center-left:", at(300, 500).map(v => Math.round(v)))
console.log("bar3 center:", at(512, 400).map(v => Math.round(v)))
