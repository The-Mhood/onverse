import "./ui/presentation/rebuild/index.css"
import "./ui/workbench/workspace.css"
import "./ui/daw/arrangement.css"
import "./ui/shell/applicationShell.css"
import { createDawController } from "./application/daw/dawController.js"
import { mountArrangement } from "./ui/daw/arrangement.js"
import { createDestinationLifecycle } from "./application/shell/destinationLifecycle.js"
import { mountApplicationShell } from "./ui/shell/applicationShell.js"
import { mountEnvironmentMotion } from "./ui/presentation/rebuild/environmentMotion.js"
import * as audio from "./audio/processor.js"
import * as reference from "./audio/reference.js"
import { createWorkbenchController } from "./application/workbench/workbenchController.js"
import { mountWorkspace } from "./ui/workbench/workspace.js"

// One entry, one persistent environment, one instance of each real controller.
// Exact P afd08b package is not published/retrievable; no substitute is called it.
const view = mountWorkspace(document.querySelector("#app"), { recorders: audio.supportedRecorders(), manageEnvironment: false })
const workspace = document.querySelector(".workspace-root")
let shell, lifecycle, daw
const effects = { ...view, render(state) { view.render(state); shell?.updateContext({ source: state.fileName || "No audio loaded" }) } }
const controller = createWorkbenchController({ view: effects, audio, reference })
view.bind(controller)
const arrangement = mountArrangement(workspace, { navigation: false })
daw = createDawController({ audio,
  onChange(snapshot) { arrangement.render(snapshot); shell?.updateContext({ project: snapshot.project.name, tracks: snapshot.project.tracks.length }) },
  beforePlay: () => controller.stopPlayback(),
  async onMix(blob, name) {
    if (controller.state.busy || controller.state.tweakBusy) throw new Error("Finish the audio-shaping operation before sending a mix.")
    const previousBuffer = controller.state.buffer
    await controller.openFile(new File([blob], name, { type: "audio/wav" }))
    if (controller.state.buffer === previousBuffer) throw new Error("Mix import failed; previous audio preserved.")
    lifecycle.navigate("workbench")
  },
})
arrangement.bind(daw)
workspace.querySelector(".daw-arrangement").id = "daw-workspace"
const environment = mountEnvironmentMotion(workspace)
shell = mountApplicationShell(workspace, { onNavigate: destination => lifecycle.navigate(destination) })
const events = new AbortController()
// Preserve the existing optional updater bridge, without adding session/AI IPC.
const unsubscribe = window.movUpdate?.onStatus(status => view.update(status, () => window.movUpdate.install()))
lifecycle = createDestinationLifecycle({
  activate(destination) {
    shell.captureScroll()
    if (destination !== "opening") arrangement.setDestination(destination)
    else workspace.querySelector(".daw-arrangement").hidden = true
    shell.renderDestination(destination)
  },
  pause: [() => controller.stopPlayback(), () => daw.pause()],
  dispose: [() => events.abort(), () => unsubscribe?.(), () => shell.dispose(), () => environment.dispose(), () => arrangement.dispose(), () => view.dispose(), () => daw.dispose(), () => controller.dispose()],
})
lifecycle.navigate("opening")
window.addEventListener("beforeunload", event => {
  // Download initiation is not a verified filesystem save receipt.
  const snapshot = daw.getSnapshot()
  if (snapshot.busy || snapshot.project.tracks.length) { event.preventDefault(); event.returnValue = "" }
}, { signal: events.signal })
window.addEventListener("pagehide", event => {
  // BFCache retains controllers/project state; normal exit drains every resource.
  if (event.persisted) lifecycle.suspend()
  else lifecycle.dispose().catch(error => console.error("Application cleanup failed", error))
}, { signal: events.signal })
