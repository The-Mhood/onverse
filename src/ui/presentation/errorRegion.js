/* Persistent error region (presentation only).
 * Errors stay on screen, announced politely by assistive tech, until the next
 * action clears them. The existing toast is kept alongside; nothing is swallowed. */

export function createErrorRegion(element) {
  if (!element) throw new Error("createErrorRegion: element is required")
  return {
    show(message) {
      element.textContent = message == null || message === "" ? "Something went wrong." : String(message)
    },
    clear() {
      element.textContent = ""
    },
    get text() {
      return element.textContent
    },
  }
}
