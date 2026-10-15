// Shared cosmic shell (UI-007): one persistent, decorative, non-interactive layer behind every workspace.
// Presentation only. No RAF loop, no canvas, no renderer, no session store, no dependency.
// API: mountCosmicEnvironment({ root, orbit }) -> { setWorkspace(key), dispose() }
//
// - The layer is inserted before the app root with aria-hidden and pointer-events none.
// - orbit: true suppresses the decorative planets, because the real Orbit canvas is the environment.
// - setWorkspace is a presentation label (data-workspace) only. It is not a workspace engine.
// - Motion: none. The layer is static, so reduced motion needs no extra handling.

export const COSMIC_WORKSPACES = Object.freeze(["analysis", "convert", "daw"])

const PLANET_PARTS = Object.freeze([
  "cosmic-horizon",
  "cosmic-nebula",
  "cosmic-ringed",
  "cosmic-moon cosmic-moon-a",
  "cosmic-moon cosmic-moon-b",
  "cosmic-arc",
])

export function mountCosmicEnvironment({ root, orbit = false } = {}) {
  if (!root || typeof root.appendChild !== "function") throw new TypeError("mountCosmicEnvironment needs a root element")
  if (typeof orbit !== "boolean") throw new TypeError("orbit must be a boolean")
  const doc = root.ownerDocument
  let disposed = false
  let workspace = "analysis"

  const layer = doc.createElement("div")
  layer.className = "cosmic-env"
  layer.setAttribute("aria-hidden", "true")
  layer.setAttribute("data-cosmic", "")
  layer.setAttribute("data-orbit", orbit ? "1" : "0")
  layer.setAttribute("data-workspace", workspace)
  for (const cls of PLANET_PARTS) {
    const part = doc.createElement("span")
    part.className = cls
    layer.appendChild(part)
  }
  root.insertBefore(layer, root.firstChild)
  root.setAttribute("data-workspace", workspace)

  return {
    setWorkspace(key) {
      if (disposed) return
      if (!COSMIC_WORKSPACES.includes(key)) throw new TypeError(`unknown cosmic workspace: ${String(key)}`)
      workspace = key
      layer.setAttribute("data-workspace", key)
      root.setAttribute("data-workspace", key)
    },
    dispose() {
      if (disposed) return
      disposed = true
      layer.remove()
      root.removeAttribute("data-workspace")
    },
  }
}
