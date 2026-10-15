// MusicOnVerse — preload bridge.
// Exposes a tiny, read-only update API to the renderer (contextIsolation on).
"use strict"

const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("movUpdate", {
  /** Subscribe to updater status. cb({state, version?, error?}) */
  onStatus(cb) {
    const listener = (_event, payload) => cb(payload)
    ipcRenderer.on("mov:update-status", listener)
    return () => ipcRenderer.removeListener("mov:update-status", listener)
  },
  /** Ask the main process to quit and install the downloaded update. */
  install() {
    ipcRenderer.send("mov:update-install")
  },
})