import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    host: "0.0.0.0",
    allowedHosts: [".e2b.app", "localhost", "127.0.0.1"],
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: [".e2b.app", "localhost", "127.0.0.1"],
  },
})
