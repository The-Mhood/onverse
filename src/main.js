import "./ui/presentation/rebuild/index.css"
import "./ui/workbench/workspace.css"
import "./ui/daw/arrangement.css"
import { createDawController } from "./application/daw/dawController.js"
import { mountArrangement } from "./ui/daw/arrangement.js"
import * as audio from "./audio/processor.js"
import * as reference from "./audio/reference.js"
import { createWorkbenchController } from "./application/workbench/workbenchController.js"
import { mountWorkspace } from "./ui/workbench/workspace.js"

// Mount first, then bind a single controller to its real view. No hidden legacy
// selectors, stage, decorative renderer or auto-created AudioContext at startup.
const view = mountWorkspace(document.querySelector("#app"), { recorders: audio.supportedRecorders() })
const controller = createWorkbenchController({ view, audio, reference })
view.bind(controller)

let daw
const arrangement = mountArrangement(document.querySelector(".workspace-root"), {
  onDestination(destination) { controller.stopPlayback(); daw?.pause() },
})
daw = createDawController({ audio, onChange: arrangement.render,
  beforePlay: () => controller.stopPlayback(),
  async onMix(blob, name) {
    if (controller.state.busy || controller.state.tweakBusy) throw new Error("Finish the audio-shaping operation before sending a mix.")
    const previousBuffer = controller.state.buffer
    await controller.openFile(new File([blob], name, { type: "audio/wav" }))
    if (controller.state.buffer === previousBuffer) throw new Error("Mix import failed; previous audio preserved.")
    arrangement.setDestination("workbench")
  },
})
arrangement.bind(daw)
window.addEventListener("beforeunload", event => {
  // A prepared browser download is not a verified filesystem save receipt.
  const snapshot = daw.getSnapshot()
  if (snapshot.busy || snapshot.project.tracks.length) { event.preventDefault(); event.returnValue = "" }
})

// Preserve the existing optional desktop bridge and its exact channel contract.
// This browser workbench adds no session/AI IPC. User action still installs updates.
const unsubscribe = window.movUpdate?.onStatus(status => view.update(status, () => window.movUpdate.install()))
window.addEventListener("pagehide", () => {
  unsubscribe?.()
  arrangement.dispose()
  daw.dispose().catch(error => console.error("Arrangement cleanup failed", error))
  view.dispose()
  controller.dispose().catch(error => console.error("Audio cleanup failed", error))
}, { once: true })
