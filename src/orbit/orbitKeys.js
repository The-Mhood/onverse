/* MusicOnVerse — Orbit Mode keyboard landmarks (1–3). Pure helpers, no DOM side effects (agent-b, UI-005).
 * Keys focus a celestial landmark in the orbit stage. They are inert in DAW Mode and while text is being
 * typed, and they ignore modifier keys and key-repeat so existing shortcuts and typing are unaffected. */

export const ORBIT_LANDMARKS = [
  { index: 0, key: "1", label: "Project" },
  { index: 1, key: "2", label: "Reference" },
  { index: 2, key: "3", label: "Master" },
]

const TEXT_ENTRY = "input, select, textarea, [contenteditable='true'], [contenteditable='']"

/* True when keystrokes belong to a text field, so landmark keys must not run. */
export function isTextEntryTarget(el) {
  if (!el) return false
  if (el.isContentEditable === true) return true
  return typeof el.matches === "function" && el.matches(TEXT_ENTRY)
}

/* Maps a keydown event to a landmark index (0–2), or null when the key should be left alone. */
export function landmarkForKey(event) {
  if (!event || event.defaultPrevented || event.repeat) return null
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return null
  if (isTextEntryTarget(event.target)) return null
  const hit = ORBIT_LANDMARKS.find((l) => l.key === event.key)
  return hit ? hit.index : null
}
