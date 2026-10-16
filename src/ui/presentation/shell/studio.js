// Studio: rail, deck and working panels for SCAN and CONVERT (moved from src/main.js; markup unchanged).
import { openingMarkup } from "./opening.js"
import { ICONS } from "./icons.js"
export function studioMarkup({ ORBIT_SPIKE }) {
  return `
<main class="deck">
  <nav class="rail" aria-label="Studio tools">
    <div class="tooltip tooltip-top" data-tip="Upload audio"><button class="btn btn-square btn-ghost" data-action="upload" type="button" aria-label="Upload audio">${ICONS.folder}</button></div>
    <div class="tooltip tooltip-top" data-tip="Generate demo track"><button class="btn btn-square btn-ghost" data-action="demo" type="button" aria-label="Generate demo track">${ICONS.music}</button></div>
    <div class="tooltip tooltip-top" data-tip="Run analysis"><button class="btn btn-square btn-ghost" data-action="analyze" type="button" aria-label="Run analysis">${ICONS.wave}</button></div>
    <div class="tooltip tooltip-top" data-tip="One-click master fix"><button class="btn btn-square btn-ghost" data-action="fix" type="button" aria-label="One-click master fix">${ICONS.spark}</button></div>
    <div class="tooltip tooltip-top" data-tip="Download output"><button class="btn btn-square btn-ghost" data-action="download" type="button" aria-label="Download output">${ICONS.download}</button></div>
    <div class="tooltip tooltip-top" data-tip="Reset session"><button class="btn btn-square btn-ghost" data-action="reset" type="button" aria-label="Reset session">${ICONS.reset}</button></div>
  </nav>

  <section class="stage-col">
${openingMarkup({ ORBIT_SPIKE })}
    <div id="panelFile" class="panel panel-file card card-border bg-base-200/70 p-6 hidden">
      <div class="file-head">
        <div class="file-icon" aria-hidden="true">${ICONS.music}</div>
        <div class="file-id">
          <div class="file-name" id="fileName">—</div>
          <div class="file-meta" id="fileMeta">—</div>
        </div>
        <div class="file-badges" id="fileBadges"></div>
      </div>
      <div class="file-actions">
        <button id="btnAnalyze" class="btn btn-primary btn-glow" type="button">◈ SCAN MIX</button>
        <button id="btnConvertGo" class="btn btn-ghost" type="button">⇄ CONVERT FORMAT</button>
      </div>
      <div id="progressWrap" class="progress-wrap hidden">
        <progress id="progressBar" class="progress progress-cine progress-accent" value="0" max="100"></progress>
        <div class="progress-label" id="progressLabel">Analyzing…</div>
      </div>
      <div id="refAreaFile" class="ref-zone"></div>
      <div id="player" class="player-wrap hidden">
        <div class="player-head">
          <span class="badge badge-ghost badge-xs font-mono" id="playSide">A · ORIGINAL</span>
          <span class="player-name" id="playName">—</span>
          <button id="btnCrop" class="btn btn-ghost btn-xs crop-btn" type="button" title="Crop a region of the song — playback loops inside it">✂ CROP</button>
          <button type="button" class="sylune-ask-btn" data-sylune-kind="waveform" data-sylune-label="Waveform">✦ Ask SYLUNE</button>
        </div>
        <div class="wave-shell">
          <canvas id="waveform" class="waveform"></canvas>
          <div class="seek-strip">
            <div class="seek-region" id="seekRegion"></div>
            <div class="seek-fill" id="seekFill"></div>
            <span class="seek-cursor" id="seekCursor"></span>
            <span class="seek-mark" id="seekMarkIn"></span>
            <span class="seek-mark" id="seekMarkOut"></span>
            <input type="range" id="seekBar" class="seek-bar" min="0" max="0" step="0.05" value="0" aria-label="Slide to any second of the song" />
          </div>
        </div>
        <div class="transport">
          <div class="transport-cluster">
            <button id="btnBack10" class="btn btn-square btn-ghost btn-sm" type="button" title="Back 10 seconds" aria-label="Back 10 seconds">«</button>
            <button id="btnPlay" class="btn btn-square btn-ghost btn-glow size-13" type="button" title="Play / pause (space)" aria-label="Play">${ICONS.play}</button>
            <button id="btnFwd10" class="btn btn-square btn-ghost btn-sm" type="button" title="Forward 10 seconds" aria-label="Forward 10 seconds">»</button>
            <button id="btnFwd30" class="btn btn-square btn-ghost btn-sm" type="button" title="Fast-forward 30 seconds" aria-label="Fast-forward 30 seconds">»»</button>
            <button id="btnRate" class="btn btn-ghost btn-sm rate-btn" type="button" title="Cycle playback speed">1.0×</button>
          </div>
          <div class="time" id="timeNow">0:00.0</div>
          <div class="time total" id="timeTotal">0:00.0</div>
          <div class="transport-cluster">
            <button id="btnTransportReset" class="btn btn-square btn-ghost btn-glow btn-sm" type="button" title="Back to start" aria-label="Back to start">${ICONS.reset}</button>
          </div>
        </div>
        <div id="cropPanel" class="crop-panel hidden">
          <div class="crop-grid">
            <div class="crop-row">
              <span class="crop-lab">IN</span>
              <div class="crop-ctl">
                <div class="crop-fill" id="cropFillIn"></div>
                <input type="range" id="cropIn" class="crop-range" min="0" max="0" step="0.05" value="0" aria-label="Crop start (IN)" />
              </div>
              <span class="crop-time" id="cropInTime">0:00.0</span>
            </div>
            <div class="crop-row">
              <span class="crop-lab">OUT</span>
              <div class="crop-ctl">
                <div class="crop-fill" id="cropFillOut"></div>
                <input type="range" id="cropOut" class="crop-range" min="0" max="0" step="0.05" value="0" aria-label="Crop end (OUT)" />
              </div>
              <span class="crop-time" id="cropOutTime">0:00.0</span>
            </div>
          </div>
          <div class="crop-actions">
            <span class="crop-hint">slide to any second · playback loops inside the crop</span>
            <button id="btnPlayRegion" class="btn btn-primary btn-sm" type="button">▶ PLAY REGION</button>
            <button id="btnApplyCrop" class="btn btn-accent btn-sm" type="button">✂ APPLY CROP</button>
            <button id="btnSaveCrop" class="btn btn-ghost btn-sm" type="button">⭳ EXPORT REGION</button>
            <button id="btnCancelCrop" class="btn btn-ghost btn-sm" type="button">CANCEL</button>
          </div>
        </div>
      </div>
    </div>

    <div id="panelAnalysis" class="panel panel-analysis card card-border bg-base-200/70 p-6 hidden">
      <div class="analysis-grid">
        <div class="score-cell">
          <div class="radial-progress score-ring text-primary" id="scoreRing" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" style="--value:0; --size:10rem; --thickness:0.375rem;">—</div>
          <div class="score-cap">MIX SCORE</div>
          <div class="verdict" id="verdict"></div>
        </div>
        <div class="radar-cell"><canvas id="radar"></canvas></div>
        <div class="meters-cell" id="meters"></div>
      </div>
      <div class="match-row" id="matchRow"></div>
      <div id="refAreaAnalysis" class="ref-zone"></div>
      <div class="fix-row">
        <button id="btnFix" class="btn btn-accent btn-fix" type="button">⚡ ONE-CLICK MASTER FIX</button>
      <button type="button" class="sylune-ask-btn" data-sylune-kind="processor" data-sylune-label="Master fix (manual, runs without SYLUNE)">✦ Ask SYLUNE</button>
        <div class="ab-toggle tabs tabs-box" id="abToggle" role="group" aria-label="Playback source">
          <button class="tab tab-active ab-btn" data-ab="orig" aria-pressed="true" type="button">A · ORIGINAL</button>
          <button class="tab ab-btn" data-ab="fixed" aria-pressed="false" type="button">B · FIXED</button>
        </div>
        <button id="btnDownloadFixed" class="btn btn-ghost" type="button">⭳ SAVE FIXED</button>
      </div>
      <div id="fixWrap" class="fix-wrap hidden">
        <span class="loading loading-ring loading-lg text-accent"></span>
        <div class="progress-label" id="fixLabel">Rendering master fix…</div>
      </div>
      <div id="fixTweakPanel" class="tweak-panel hidden">
        <div class="tweak-head">
          <span class="tweak-title">FINE-TUNE THE FIX</span>
          <span class="tweak-note">drag the pins to adjust the corrections baked into B · FIXED — it re-balances and re-renders automatically</span>
          <span id="tweakStatus" class="tweak-status"></span>
          <button id="btnTweakReset" class="btn btn-xs btn-ghost text-accent" type="button">⟲ RESET TO AUTO</button>
          <button type="button" class="sylune-ask-btn" data-sylune-kind="parameter" data-sylune-label="Fine-tune corrections">✦ Ask SYLUNE</button>
        </div>
        <div id="tweakSliders" class="tweak-sliders"></div>
      </div>
    </div>

    <div id="panelConvert" class="panel panel-convert card card-border bg-base-200/70 p-6 hidden">
      <div class="conv-head">
        <h2>FORMAT FORGE</h2>
        <p>Convert between the formats listed below. Conversion runs locally in your browser.</p>
      </div>
      <div class="conv-from" id="convFrom"></div>
      <div class="conv-grid" id="convGrid"></div>
      <div class="conv-options">
        <label class="opt"><span>MP3 bitrate</span><select id="convKbps" class="select select-sm select-ghost">
          <option value="320">320 kbps · best</option>
          <option value="256">256 kbps</option>
          <option value="192" selected>192 kbps · balanced</option>
          <option value="128">128 kbps · compact</option>
        </select></label>
        <label class="opt"><span>WAV depth</span><select id="convWav" class="select select-sm select-ghost">
          <option value="float" selected>32-bit float · studio</option>
          <option value="pcm16">16-bit PCM · CD</option>
        </select></label>
      </div>
      <button id="btnConvert" class="btn btn-primary btn-wide btn-glow" type="button">⇄ CONVERT</button>
      <div id="convProgress" class="progress-wrap hidden">
        <span class="loading loading-ring loading-lg text-accent"></span>
        <div class="progress-label" id="convLabel">Converting…</div>
      </div>
    </div>
  </section>

  <aside class="report-rail hidden" id="reportRail">
    <div class="report-head">
      <span>MASTER'S REPORT</span>
      <button id="btnDownloadReport" class="btn btn-xs btn-ghost text-accent" type="button">⭳ .md</button>
    </div>
    <div class="report-body" id="reportBody"></div>
  </aside>
</main>
`
}
