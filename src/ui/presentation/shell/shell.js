// App shell (COORD-010 presentation). Composes the studio surfaces in one tree.
// Markup moved out of src/main.js unchanged except the DAW prototype (see daw.js).
// Element IDs and data attributes are the contract with the application bindings in main.js.
import { ICONS } from "./icons.js"
import { headerMarkup } from "./header.js"
import { studioMarkup } from "./studio.js"
import { dawMarkup } from "./daw.js"

export function renderShell({ ORBIT_SPIKE }) {
  return `
<div id="boot">
  <div class="boot-core">
    <div class="boot-ring"></div>
    <div class="boot-eq"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <div class="boot-logo">Music<span>OnVerse</span></div>
    <div class="boot-sub">AUDIO INTELLIGENCE STUDIO</div>
  </div>
</div>
<canvas id="stage" aria-hidden="true"></canvas>
${headerMarkup()}
${studioMarkup({ ORBIT_SPIKE })}
${dawMarkup()}
<div id="sylune-root" class="sylune-host"></div>
<input type="file" id="fileInput" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.oga,.opus,.flac,.webm,.aiff,.aif,.wma" hidden />
<div id="errorRegion" class="error-region" role="alert"></div>
<div id="toast" class="toast toast-center toast-bottom">
  <div class="alert alert-soft alert-info" id="toastInner" role="status"></div>
</div>
<button id="btnReportToggle" class="btn btn-sm btn-ghost btn-glow" type="button" title="Toggle master's report">${ICONS.doc} REPORT</button>
`
}
