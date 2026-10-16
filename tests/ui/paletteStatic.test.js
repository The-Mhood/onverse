// Static palette guard (COORD-010 visual pass, revised 2026-10-16 by owner approval for the Cosmic Studio boards).
// Violet and magenta are allowed only as the explicit APPROVED_BOARD list below, and only in the shell stylesheet.
// Any other violet or magenta literal in the canvas or stylesheet surfaces fails. Pure source checks, no browser.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const read = (f) => readFileSync(join(root, f), "utf8")

// Hue (degrees) and saturation of an sRGB colour given as 0-255 channels.
function hsl(r, g, b) {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  const d = max - min
  let h = 0
  if (d !== 0) {
    const R = r / 255, G = g / 255, B = b / 255
    if (max === R) h = ((G - B) / (d)) % 6
    else if (max === G) h = (B - R) / d + 2
    else h = (R - G) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return { h, s }
}

// Violet, purple, magenta, indigo band. Blue-steel (about 200-230) and warm accents stay allowed.
const VIOLET_BAND = (h, s) => s > 0.2 && h >= 240 && h < 340
// Owner-approved board palette (2026-10-16): violet and magenta tokens, defined only in
// src/ui/presentation/shell/shell.css. Nothing else may use these literals.
const APPROVED_BOARD = new Set(["7c5cff", "b9a8ff", "d64fc4", "f09ae0"])
const FORBIDDEN = (h, s, hex) => VIOLET_BAND(h, s) && !APPROVED_BOARD.has(hex)

function colourLiterals(src) {
  const out = []
  for (const m of src.matchAll(/#([0-9a-fA-F]{6})\b/g)) out.push(m[1])
  for (const m of src.matchAll(/0x([0-9a-fA-F]{6})\b/g)) out.push(m[1])
  for (const m of src.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g)) {
    out.push([m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join(""))
  }
  return out
}

function violetLiterals(file) {
  const bad = []
  for (const hex of colourLiterals(read(file))) {
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16)
    const { h, s } = hsl(r, g, b)
    if (FORBIDDEN(h, s, hex.toLowerCase())) bad.push(`#${hex} (hue ${h.toFixed(0)}, sat ${s.toFixed(2)})`)
  }
  return bad
}

test("the classifier flags violet and passes steel, blue and warm colours", () => {
  assert.ok(FORBIDDEN(...Object.values(hsl(168, 85, 247)), "a855f7"), "#a855f7 must be forbidden")
  assert.ok(FORBIDDEN(...Object.values(hsl(232, 121, 249)), "e879f9"), "#e879f9 must be forbidden")
  for (const [r, g, b] of [[127, 169, 204], [74, 111, 143], [184, 157, 132], [111, 184, 168], [223, 230, 238]]) {
    const { h, s } = hsl(r, g, b)
    assert.ok(!FORBIDDEN(h, s, ""), `${r},${g},${b} must be allowed (hue ${h.toFixed(0)})`)
  }
})

for (const file of ["src/scene.js", "src/ui/draw.js", "src/style.css", "src/ui/styles/cosmic.css", "src/ui/styles/sylune.css", "src/ui/presentation/shell/shell.css"]) {
  test(`${file} has no violet or magenta colour literal`, () => {
    assert.deepEqual(violetLiterals(file), [])
  })
}

test("scene.js has no purple palette identifiers left", () => {
  const src = read("src/scene.js")
  assert.doesNotMatch(src, /PURPLES/)
  assert.match(src, /const PALETTE = \[/)
})

test("reduced motion zeroes automatic scene drift while pointer look stays", () => {
  const src = read("src/scene.js")
  assert.match(src, /const drift = reduced \? 0 : 1/)
  assert.match(src, /camera\.position\.x = Math\.sin\(t \* 0\.1\) \* 0\.6 \* drift \+ pointer\.x \* 1\.1/)
})

test("the approved board violet and magenta are exactly the shell tokens, and only there", () => {
  const shell = [...new Set(colourLiterals(read("src/ui/presentation/shell/shell.css")))]
  const violetInShell = shell.filter((hex) => {
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16)
    return VIOLET_BAND(...Object.values(hsl(r, g, b)))
  })
  assert.deepEqual(violetInShell.sort(), [...APPROVED_BOARD].sort())
})
