// Cosmic shell tests (UI-007). Uses a minimal fake DOM for the module logic,
// and static checks for the stylesheet. Visual and stacking checks are browser checks.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { COSMIC_WORKSPACES, mountCosmicEnvironment } from "../../src/ui/presentation/cosmicEnvironment.js"

class FakeNode {
  constructor(tag, doc) {
    this.tagName = tag
    this.ownerDocument = doc
    this.children = []
    this.attributes = {}
    this.className = ""
    this.parent = null
  }
  setAttribute(k, v) { this.attributes[k] = String(v) }
  getAttribute(k) { return k in this.attributes ? this.attributes[k] : null }
  removeAttribute(k) { delete this.attributes[k] }
  appendChild(n) { n.parent = this; this.children.push(n); return n }
  insertBefore(n, ref) {
    n.parent = this
    const i = ref ? this.children.indexOf(ref) : -1
    if (i < 0) this.children.push(n); else this.children.splice(i, 0, n)
    return n
  }
  get firstChild() { return this.children[0] ?? null }
  remove() {
    if (!this.parent) return
    this.parent.children = this.parent.children.filter((c) => c !== this)
    this.parent = null
  }
}

function fakeRoot() {
  const doc = { createElement: (tag) => new FakeNode(tag, doc) }
  const body = new FakeNode("body", doc)
  body.appendChild(new FakeNode("div", doc)) // existing app root
  return body
}

test("mount inserts one decorative layer first, with aria-hidden and no interaction hooks", () => {
  const root = fakeRoot()
  const env = mountCosmicEnvironment({ root })
  const layer = root.firstChild
  assert.equal(layer.className, "cosmic-env")
  assert.equal(layer.getAttribute("aria-hidden"), "true")
  assert.equal(layer.getAttribute("data-workspace"), "analysis")
  assert.equal(layer.getAttribute("data-orbit"), "0")
  assert.equal(root.getAttribute("data-workspace"), "analysis")
  assert.equal(root.children.length, 2, "layer plus existing app root")
  env.dispose()
})

test("setWorkspace updates labels and rejects unknown workspaces", () => {
  const root = fakeRoot()
  const env = mountCosmicEnvironment({ root })
  env.setWorkspace("daw")
  assert.equal(root.firstChild.getAttribute("data-workspace"), "daw")
  assert.equal(root.getAttribute("data-workspace"), "daw")
  assert.throws(() => env.setWorkspace("mixer"), TypeError)
  assert.deepEqual([...COSMIC_WORKSPACES], ["analysis", "convert", "daw"])
  env.dispose()
})

test("orbit option marks the layer so decorative planets are suppressed", () => {
  const root = fakeRoot()
  const env = mountCosmicEnvironment({ root, orbit: true })
  assert.equal(root.firstChild.getAttribute("data-orbit"), "1")
  env.dispose()
  assert.throws(() => mountCosmicEnvironment({ root: fakeRoot(), orbit: "yes" }), TypeError)
})

test("dispose is idempotent, removes the layer, and ignores later calls", () => {
  const root = fakeRoot()
  const env = mountCosmicEnvironment({ root })
  env.dispose()
  env.dispose()
  assert.equal(root.children.length, 1, "only the app root remains")
  assert.equal(root.getAttribute("data-workspace"), null)
  assert.doesNotThrow(() => env.setWorkspace("convert"))
})

test("remount after dispose creates exactly one layer", () => {
  const root = fakeRoot()
  mountCosmicEnvironment({ root }).dispose()
  const env = mountCosmicEnvironment({ root })
  assert.equal(root.children.filter((c) => c.className === "cosmic-env").length, 1)
  env.dispose()
})

test("module has no timers, animation loop, renderer, or network", () => {
  const raw = readFileSync(new URL("../../src/ui/presentation/cosmicEnvironment.js", import.meta.url), "utf8")
  const code = raw.split("\n").filter((line) => !line.trimStart().startsWith("//")).join("\n")
  assert.equal(/requestAnimationFrame|setInterval|setTimeout|canvas|WebGL|fetch\(|localStorage/.test(code), false)
})

test("cosmic.css is static, non-interactive and free of the rejected purple palette", () => {
  const css = readFileSync(new URL("../../src/ui/styles/cosmic.css", import.meta.url), "utf8")
  assert.equal(/@keyframes|animation\s*:|transition\s*:/.test(css), false, "no motion")
  assert.match(css, /pointer-events:\s*none/)
  assert.match(css, /aria-hidden|\[data-orbit="1"\]/)
  assert.equal(/#[0-9a-f]{3,8}\b.*\b(purple|violet|magenta)/i.test(css), false)
  assert.equal(/rgba?\(\s*(1[2-9][0-9]|[89][0-9]),\s*(0|[1-4][0-9]),\s*(2[0-9][0-9]|1[5-9][0-9])/.test(css), false, "no saturated purple rgb")
})
