import { readFileSync, writeFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const dist = new URL("../dist/", import.meta.url).pathname
let html = readFileSync(join(dist, "index.html"), "utf8")

for (const file of readdirSync(join(dist, "assets"))) {
  const content = readFileSync(join(dist, "assets", file), "utf8")
  if (file.endsWith(".css")) {
    html = html.replace(
      new RegExp(`<link[^>]*${file.replace(/[-.]/g, "\\$&")}[^>]*>`),
      () => `<style>${content}</style>`,
    )
  } else if (file.endsWith(".js")) {
    // escape closing script tags so the inline module survives parsing
    const safe = content.replace(/<\/script/gi, "<\\/script")
    html = html.replace(
      new RegExp(`<script type="module"[^>]*${file.replace(/[-.]/g, "\\$&")}[^>]*></script>`),
      () => `<script type="module">${safe}</script>`,
    )
  }
}

writeFileSync(join(dist, "index.html"), html)
console.log("inlined dist -> single file,", (html.length / 1024).toFixed(0), "kB")
