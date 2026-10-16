// Test helper (COORD-010): the app markup now lives in src/ui/presentation/shell/**.
// Tests that check markup or copy read main.js together with the shell modules.
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const shellDir = join(root, "src", "ui", "presentation", "shell")

export function readAppSource() {
  const parts = [readFileSync(join(root, "src", "main.js"), "utf8")]
  for (const f of readdirSync(shellDir).filter((n) => n.endsWith(".js")).sort()) {
    parts.push(readFileSync(join(shellDir, f), "utf8"))
  }
  return parts.join("\n")
}
