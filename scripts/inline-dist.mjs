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
      () => {
        // The entry's import.meta.url becomes index.html after inlining. Vite's
        // relative dynamic imports were authored relative to assets/index-*.js,
        // so relocate only its sibling chunks under ./assets/ for HTTP and file://.
        const relocated = safe.replace(/import\((['"`])\.\/(?!assets\/)([^'"`]+\.js)\1\)/g,
          (_match, quote, chunk) => `import(${quote}./assets/${chunk}${quote})`)
        return `<script type="module">${relocated}</script>`
      },
    )
  }
}

writeFileSync(join(dist, "index.html"), html)
console.log("inlined initial CSS/JS; deferred chunks remain in dist/assets; entry HTML", (html.length / 1024).toFixed(0), "kB")
