// Routing/lifetime authority only. Destination controllers retain project/audio
// state; navigating never remounts them or manufactures a second project store.
export function createDestinationLifecycle({ activate, pause = [], dispose = [] }) {
  if (typeof activate !== 'function' || ![...pause, ...dispose].every(fn => typeof fn === 'function')) throw new TypeError('Invalid shell lifecycle ports')
  let current = 'opening', disposed = false, disposal
  function pauseAll() {
    const failures = []
    for (const effect of pause) { try { effect() } catch (error) { failures.push(error) } }
    if (failures.length) throw new AggregateError(failures, 'Destination pause failed')
  }
  return Object.freeze({
    get destination() { return current },
    navigate(destination) {
      if (disposed) return false
      if (!['opening', 'workbench', 'daw'].includes(destination)) throw new TypeError('Unknown destination')
      pauseAll() // Do not activate a new destination if outgoing audio cannot pause.
      activate(destination); current = destination; return true
    },
    suspend() { if (disposed) return false; pauseAll(); return true },
    dispose() {
      if (!disposal) {
        disposed = true
        // Attempt EVERY resource cleanup even when an earlier one fails.
        disposal = (async () => {
          const results = await Promise.allSettled([...pause, ...dispose].map(effect => Promise.resolve().then(effect)))
          const errors = results.filter(r => r.status === 'rejected').map(r => r.reason)
          if (errors.length) throw new AggregateError(errors, 'Application cleanup failed')
        })()
      }
      return disposal
    },
  })
}
