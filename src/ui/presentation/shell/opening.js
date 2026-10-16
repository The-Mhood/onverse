// Opening: the first-person universe invitation. Copy and bindings unchanged (approval pending for new wording).
import { ICONS } from "./icons.js"
export function openingMarkup({ ORBIT_SPIKE }) {
  return `
    <div id="panelIdle" class="panel panel-center card card-border bg-base-200/70 p-8">
      ${ORBIT_SPIKE ? `
      <p class="orbit-eyebrow">CURRENT PLACE · AURORA ORBIT</p>
      <h1 class="orbit-title">You are not<br>viewing space.<br>You are inside it.</h1>
      <p class="orbit-sub">The camera breathes with the scene: a nearby giant cuts the stars, a moon drifts at distance, and the horizon holds the studio beneath your feet.</p>
      <div class="orbit-actions">
        <button class="orbit-btn orbit-btn-primary" id="btnOrbitStudio" type="button">Enter studio</button>
        <button class="orbit-btn" id="btnOrbitReset" type="button">Reset view</button>
      </div>
      <div class="orbit-secondary">
        <button class="orbit-link" id="btnIdleUpload" type="button">Open audio file</button>
        <button class="orbit-link" id="btnIdleDemo" type="button">Generate demo track</button>
      </div>
      <div class="idle-hint">or drop a file anywhere · wav · mp3 · m4a · ogg · flac · aiff</div>` : `
      <div class="idle-glyph" aria-hidden="true">${ICONS.wave}</div>
      <h1 class="glow-text">FORGE YOUR SOUND</h1>
      <p class="idle-sub">Local audio analysis, reference comparison, processing and conversion.</p>
      <div class="idle-actions">
        <button class="btn btn-primary btn-glow" id="btnIdleUpload" type="button">OPEN AUDIO FILE</button>
        <button class="btn btn-ghost" id="btnIdleDemo" type="button">GENERATE DEMO TRACK</button>
      </div>
      <div class="idle-hint">or drop a file anywhere · wav · mp3 · m4a · ogg · flac · aiff</div>`}
    </div>

`
}
