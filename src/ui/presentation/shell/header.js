// Top bar: brand, station switch (SCAN, CONVERT, DAW) and top actions.
import { ICONS } from "./icons.js"
export function headerMarkup() {
  return `
<header class="topbar">
  <div class="brand">
    <div class="brand-mark" aria-hidden="true"><span></span></div>
    <div class="brand-text">
      <div class="brand-name">Music<span>OnVerse</span></div>
      <div class="brand-tag">AUDIO INTELLIGENCE</div>
    </div>
  </div>
  <div class="mode-switch tabs tabs-box" id="modeSwitch" role="group" aria-label="Studio mode">
    <button class="tab tab-active mode-btn" data-mode="converse" aria-pressed="true" type="button">◈ SCAN</button>
    <button class="tab mode-btn" data-mode="convert" aria-pressed="false" type="button">⇄ CONVERT</button>
    <button class="tab mode-btn" data-mode="daw" aria-pressed="false" type="button">▦ DAW · PROTOTYPE</button>
  </div>
  <div class="top-actions">
    <span class="orbit-status"><span class="orbit-status-dot" aria-hidden="true"></span>Not saved · session only</span>
    <div class="tooltip tooltip-bottom" data-tip="Open audio from your local storage">
      <button id="btnUpload" class="btn btn-square btn-ghost btn-glow" type="button" aria-label="Open audio file">${ICONS.folder}</button>
    </div>
    <div class="tooltip tooltip-bottom" data-tip="Download output">
      <button id="btnDownload" class="btn btn-square btn-ghost btn-glow" type="button" aria-label="Download output">${ICONS.download}</button>
    </div>
    <button id="btnSylune" class="btn btn-ghost btn-sm sylune-toggle" type="button" aria-controls="sylune-root" aria-expanded="false">✦ SYLUNE</button>
    <button id="btnLicences" class="btn btn-ghost btn-sm" type="button" aria-haspopup="dialog">Font licences</button>
  </div>
</header>
`
}
