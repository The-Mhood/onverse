import "./ui/presentation/rebuild/index.css"
import "./ui/workbench/workspace.css"
import * as audio from "./audio/processor.js"
import * as reference from "./audio/reference.js"
import { createWorkbenchController } from "./application/workbench/workbenchController.js"
import { mountWorkspace } from "./ui/workbench/workspace.js"

// Mount first, then bind a single controller to its real view. No hidden legacy
// selectors, stage, decorative renderer or auto-created AudioContext at startup.
const view = mountWorkspace(document.querySelector("#app"), { recorders: audio.supportedRecorders() })
const controller = createWorkbenchController({ view, audio, reference })
view.bind(controller)

// Preserve the existing optional desktop bridge and its exact channel contract.
// This browser workbench adds no session/AI IPC. User action still installs updates.
const unsubscribe = window.movUpdate?.onStatus(status => view.update(status, () => window.movUpdate.install()))
window.addEventListener("pagehide", () => {
  unsubscribe?.()
  view.dispose()
  controller.dispose().catch(error => console.error("Audio cleanup failed", error))
}, { once: true })
