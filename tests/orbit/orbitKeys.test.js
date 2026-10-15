// Orbit Mode landmark keys (agent-b, UI-005): pure mapping and text-entry guards.
import { test } from "node:test"
import assert from "node:assert/strict"
import { landmarkForKey, isTextEntryTarget, ORBIT_LANDMARKS } from "../../src/orbit/orbitKeys.js"

const el = (tag, extra = {}) => ({
  matches: (sel) => sel.split(",").map((s) => s.trim()).some((s) => s === tag || (s.startsWith("[") && extra.attr === s)),
  isContentEditable: false,
  ...extra,
})
const key = (k, over = {}) => ({ key: k, target: el("button"), repeat: false, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, defaultPrevented: false, ...over })

test("keys 1–3 map to landmarks 0–2 in order, with the chip labels the UI shows", () => {
  assert.equal(landmarkForKey(key("1")), 0)
  assert.equal(landmarkForKey(key("2")), 1)
  assert.equal(landmarkForKey(key("3")), 2)
  assert.deepEqual(ORBIT_LANDMARKS.map((l) => l.label), ["Project", "Reference", "Master"])
})

test("other keys, including 0, 4 and the existing arrow and space shortcuts, are not claimed", () => {
  for (const k of ["0", "4", "a", " ", "ArrowLeft", "ArrowRight", "Enter", "Escape"]) assert.equal(landmarkForKey(key(k)), null, k)
})

test("modifier chords and key repeat are left alone", () => {
  assert.equal(landmarkForKey(key("1", { shiftKey: true })), null, "shift turns 1 into !")
  assert.equal(landmarkForKey(key("1", { metaKey: true })), null)
  assert.equal(landmarkForKey(key("1", { ctrlKey: true })), null)
  assert.equal(landmarkForKey(key("1", { altKey: true })), null)
  assert.equal(landmarkForKey(key("1", { repeat: true })), null, "held key must not retrigger the camera")
})

test("keys already handled by another listener (defaultPrevented) are not claimed twice", () => {
  assert.equal(landmarkForKey(key("1", { defaultPrevented: true })), null)
})

test("text entry is never intercepted: input, select, textarea and contenteditable", () => {
  for (const tag of ["input", "select", "textarea"]) {
    assert.equal(landmarkForKey(key("2", { target: el(tag) })), null, tag)
  }
  assert.equal(landmarkForKey(key("2", { target: { matches: () => false, isContentEditable: true } })), null)
  assert.equal(isTextEntryTarget(el("div")), false)
  assert.equal(isTextEntryTarget(null), false)
})

test("a plain button target still receives landmark keys", () => {
  assert.equal(landmarkForKey(key("3", { target: el("button") })), 2)
})
