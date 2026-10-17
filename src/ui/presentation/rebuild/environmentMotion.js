// Presentation-only depth response. CSS owns the continuous celestial motion;
// this adapter never reads audio, changes product state, or moves any control.
export function mountEnvironmentMotion(root, { window: win = globalThis.window, document: doc = globalThis.document } = {}) {
  if (!root || !win || !doc) throw new TypeError('Environment requires a root, window and document')
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)')
  let disposed = false, frame = 0, x = 0, y = 0, tx = 0, ty = 0, previous
  const subscriptions = []
  const on = (target, name, listener) => {
    target.addEventListener(name, listener, { passive: true })
    subscriptions.push(() => target.removeEventListener(name, listener))
  }
  const paint = () => {
    root.style.setProperty('--mvo-scene-x', `${x.toFixed(3)}px`)
    root.style.setProperty('--mvo-scene-y', `${y.toFixed(3)}px`)
  }
  const cancel = () => { if (frame) win.cancelAnimationFrame(frame); frame = 0; previous = undefined }
  const reset = () => { cancel(); x = y = tx = ty = 0; paint() }
  const enabled = () => !disposed && !reduced.matches && !doc.hidden
  function tick(now) {
    frame = 0
    if (!enabled()) return
    const dt = previous === undefined ? 16 : Math.min(64, Math.max(0, now - previous))
    previous = now
    const blend = 1 - Math.exp(-dt / 145)
    x += (tx - x) * blend; y += (ty - y) * blend
    if (Math.abs(tx - x) + Math.abs(ty - y) < .025) {
      x = tx; y = ty; paint(); previous = undefined; return
    }
    paint(); frame = win.requestAnimationFrame(tick)
  }
  function target(nx, ny) {
    tx = nx; ty = ny
    if (!frame && enabled()) frame = win.requestAnimationFrame(tick)
  }
  // PointerEvent identifies the actual device, including a mouse/pen on a
  // touch-primary hybrid. Do not infer it from the primary-device media query.
  function pointer(event) {
    if (!enabled() || !['mouse', 'pen'].includes(event.pointerType) || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return
    // Hold the depth response neutral around precise controls and modal content.
    // Autonomous drift continues behind them; no preventDefault or audio coupling.
    if (event.target?.closest?.('button, input, select, textarea, summary, dialog') || root.querySelector('dialog[open]')) { target(0, 0); return }
    const clamp = n => Math.max(-1, Math.min(1, n))
    target(clamp(event.clientX / Math.max(1, win.innerWidth) * 2 - 1) * 10,
      clamp(event.clientY / Math.max(1, win.innerHeight) * 2 - 1) * 7)
  }
  function preference() {
    root.dataset.environmentPaused = String(doc.hidden || reduced.matches || disposed)
    if (!enabled()) reset()
  }
  on(win, 'pointermove', pointer)
  on(doc, 'pointerleave', () => target(0, 0))
  on(win, 'blur', reset)
  on(root, 'focusin', () => target(0, 0))
  on(doc, 'visibilitychange', preference)
  on(reduced, 'change', preference)
  preference()
  return Object.freeze({ dispose() {
    if (disposed) return
    disposed = true; reset()
    root.dataset.environmentPaused = 'true'
    for (const unsubscribe of subscriptions) unsubscribe()
  } })
}
