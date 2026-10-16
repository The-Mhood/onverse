// DAW prototype surface (COORD-010). Purpose-designed layout: transport and roles on top,
// a track column beside a timeline, and a horizontal mixer strip below. Nothing here is a working
// DAW. Every control is disabled or labelled "not implemented"; no audio, track or session data.
// Selectors used by the app and tests: #panelDaw, [data-daw-prototype], .sylune-ask-btn targets.
export function dawMarkup() {
  return `
<section id="panelDaw" class="panel panel-daw hidden" aria-labelledby="dawTitle" data-daw-prototype>
  <header class="daw-bar">
    <h2 id="dawTitle" class="daw-title">DAW <span class="proto-tag">PROTOTYPE</span></h2>
    <div class="daw-transport" role="group" aria-label="Transport (prototype, not implemented)">
      <button type="button" class="daw-btn" disabled>▶ Play <span class="proto-tag">not implemented</span></button>
      <button type="button" class="daw-btn" disabled>■ Stop <span class="proto-tag">not implemented</span></button>
      <button type="button" class="daw-btn" disabled>● Record <span class="proto-tag">not implemented</span></button>
      <button type="button" class="daw-btn" disabled>⟲ Cycle <span class="proto-tag">not implemented</span></button>
      <span class="daw-clock">BAR 001.1.1 · 120 BPM · 4/4 — PROTOTYPE, not implemented</span>
    </div>
  </header>
  <div class="proto-banner" role="note"><strong>PROTOTYPE — not implemented; no audio changes.</strong> This shows the intended DAW structure. There is no multitrack engine, recording, routing, plugin host or automation yet. Use SCAN and CONVERT for the working tools.</div>
  <div class="daw-roles" aria-label="Current roles in this app (not DAW tracks)">
    <span class="role-chip">Project: loaded buffer (current)</span>
    <span class="role-chip">Reference: comparison source (current)</span>
    <span class="role-chip">Master: processed view (current)</span>
    <span class="proto-tag">These are current roles, not tracks in a session.</span>
  </div>
  <div class="daw-body">
    <div class="daw-arrange" aria-label="Arrangement (prototype)">
      <div class="daw-ruler" aria-hidden="true"><span class="daw-ruler-gutter">BARS</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span></div>
      <div class="daw-track" role="group" aria-label="Audio 1 · Lead vocal (prototype)">
        <div class="daw-head"><strong>Audio 1 · Lead vocal</strong><span class="proto-tag">PROTOTYPE</span>
          <button type="button" class="sylune-ask-btn" data-sylune-kind="track" data-sylune-label="Audio 1 · Lead vocal (prototype)">✦ Ask SYLUNE</button></div>
        <div class="daw-lane"><span class="proto-region">illustrative region, no audio</span></div>
      </div>
      <div class="daw-track" role="group" aria-label="Audio 2 · Drums (prototype)">
        <div class="daw-head"><strong>Audio 2 · Drums</strong><span class="proto-tag">PROTOTYPE</span>
          <button type="button" class="sylune-ask-btn" data-sylune-kind="track" data-sylune-label="Audio 2 · Drums (prototype)">✦ Ask SYLUNE</button></div>
        <div class="daw-lane"><span class="proto-region">illustrative region, no audio</span></div>
      </div>
      <div class="daw-track" role="group" aria-label="Audio 3 · Bass (prototype)">
        <div class="daw-head"><strong>Audio 3 · Bass</strong><span class="proto-tag">PROTOTYPE</span>
          <button type="button" class="sylune-ask-btn" data-sylune-kind="track" data-sylune-label="Audio 3 · Bass (prototype)">✦ Ask SYLUNE</button></div>
        <div class="daw-lane"><span class="proto-region">illustrative region, no audio</span></div>
      </div>
      <div class="daw-track" role="group" aria-label="Bus 1 · Reverb (prototype)">
        <div class="daw-head"><strong>Bus 1 · Reverb</strong><span class="proto-tag">PROTOTYPE</span>
          <button type="button" class="sylune-ask-btn" data-sylune-kind="bus" data-sylune-label="Bus 1 · Reverb (prototype)">✦ Ask SYLUNE</button></div>
        <div class="daw-lane"><span class="proto-tag">routing not implemented</span></div>
      </div>
      <div class="daw-track" role="group" aria-label="Automation (prototype)">
        <div class="daw-head"><strong>Automation</strong><span class="proto-tag">not implemented</span></div>
        <div class="daw-lane"><span class="proto-tag">no automation engine; nothing moves</span></div>
      </div>
    </div>
  </div>
  <div class="daw-mixer" aria-label="Mixer (prototype, not implemented)">
    <div class="daw-strip"><strong>Audio 1</strong><span class="proto-tag">insert: not implemented</span><span class="proto-tag">pan / level: not implemented</span>
      <button type="button" class="sylune-ask-btn" data-sylune-kind="track" data-sylune-label="Audio 1 channel strip (prototype)">✦ Ask</button></div>
    <div class="daw-strip"><strong>Audio 2</strong><span class="proto-tag">insert: not implemented</span><span class="proto-tag">pan / level: not implemented</span>
      <button type="button" class="sylune-ask-btn" data-sylune-kind="track" data-sylune-label="Audio 2 channel strip (prototype)">✦ Ask</button></div>
    <div class="daw-strip"><strong>Audio 3</strong><span class="proto-tag">insert: not implemented</span><span class="proto-tag">pan / level: not implemented</span>
      <button type="button" class="sylune-ask-btn" data-sylune-kind="track" data-sylune-label="Audio 3 channel strip (prototype)">✦ Ask</button></div>
    <div class="daw-strip"><strong>Master out</strong><span class="proto-tag">master bus: not implemented</span>
      <button type="button" class="sylune-ask-btn" data-sylune-kind="bus" data-sylune-label="Master out (prototype)">✦ Ask</button></div>
  </div>
  <p class="proto-note">Plugins: no plugin host. Buses and routing: not implemented. Recording: not implemented. SYLUNE cannot act on this view yet.</p>
</section>
`
}
