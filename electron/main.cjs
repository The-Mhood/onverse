// MusicOnVerse — Electron shell.
// Loads the fully self-contained build (dist/index.html) produced by `npm run build`.
"use strict"

const { app, BrowserWindow, ipcMain, shell } = require("electron")
const path = require("path")
const { autoUpdater } = require("electron-updater")

autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

const SMOKE = process.env.MOV_SMOKE === "1"
const isMac = process.platform === "darwin"

app.setName("MusicOnVerse")

function pagePath() {
  // Packaged: <app>/Contents/Resources/app.asar/dist/index.html
  // Dev:      <project>/dist/index.html
  return path.join(__dirname, "..", "dist", "index.html")
}

let win = null
let pageErrors = 0

function createWindow() {
  win = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1120,
    minHeight: 700,
    show: !SMOKE && !process.env.MOV_HIDE,
    backgroundColor: "#0b0517",
    title: "MusicOnVerse — Audio Intelligence Studio",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  })

  win.on("page-title-updated", (e) => e.preventDefault())

  // Keep the app on the local page — open external links in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: "deny" }
  })
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file://")) {
      e.preventDefault()
      if (/^https?:/i.test(url)) shell.openExternal(url)
    }
  })

  win.webContents.on("console-message", (eventOrLevel, maybeMessage) => {
    let level = eventOrLevel
    let message = maybeMessage
    // Electron >= 30 passes a single structured event object.
    if (typeof maybeMessage !== "string" && eventOrLevel && typeof eventOrLevel === "object") {
      level = eventOrLevel.level
      message = eventOrLevel.message
    }
    if (level === "error" || level === 3) {
      pageErrors++
      if (SMOKE) console.log("[page:error]", message)
    }
  })

  win.webContents.on("render-process-gone", (_e, details) => {
    if (SMOKE) {
      console.log("[smoke] renderer gone:", details.reason)
      app.exit(1)
    }
  })

  if (SMOKE) {
    win.webContents.on("did-fail-load", (_e, code, desc) => {
      console.log("[smoke] did-fail-load", code, desc)
      app.exit(1)
    })
    win.webContents.on("did-finish-load", () => {
      console.log("[smoke] page loaded")
      setTimeout(() => {
        console.log(pageErrors === 0 ? "[smoke] OK — zero page errors" : `[smoke] FAIL — ${pageErrors} page errors`)
        app.exit(pageErrors === 0 ? 0 : 1)
      }, 4000)
    })
  }

  win.loadFile(pagePath())
}

// ---- auto-updater (electron-updater, generic hosted feed) ------------------
function sendStatus(state, extra = {}) {
  const payload = { state, ...extra }
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send("mov:update-status", payload)
  }
}

function setupAutoUpdater() {
  // Updates only make sense in a packaged, signed build — never in dev/smoke.
  if (!app.isPackaged || SMOKE) return

  // Runtime override for the feed URL (e.g. MOV_UPDATE_URL=https://cdn.example.com/mac).
  // Otherwise electron-updater uses the `publish` config baked into app-update.yml.
  if (process.env.MOV_UPDATE_URL) {
    autoUpdater.setFeedURL({ provider: "generic", url: process.env.MOV_UPDATE_URL })
  }

  autoUpdater.on("checking-for-update", () => sendStatus("checking"))
  autoUpdater.on("update-available", (info) => sendStatus("available", { version: info.version }))
  autoUpdater.on("update-not-available", () => sendStatus("not-available"))
  autoUpdater.on("error", (err) => {
    console.error("[updater] error:", err && err.message)
    sendStatus("error", { error: (err && err.message) || String(err) })
  })
  autoUpdater.on("download-progress", (p) => sendStatus("downloading", { percent: Math.round(p.percent) }))
  autoUpdater.on("update-downloaded", (info) => {
    console.log(`[updater] v${info.version} downloaded — ready to install`)
    sendStatus("downloaded", { version: info.version })
  })

  ipcMain.on("mov:update-install", () => {
    console.log("[updater] installing update")
    autoUpdater.quitAndInstall(false, true)
  })

  setTimeout(() => autoUpdater.checkForUpdates().catch((e) => console.error("[updater] check failed:", e.message)), 4000)
}

app.whenReady().then(() => {
  createWindow()
  setupAutoUpdater()
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (!isMac || SMOKE) app.quit()
})
