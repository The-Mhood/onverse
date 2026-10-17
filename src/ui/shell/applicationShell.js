// Shared real-app shell over the existing presentation baseline. Does not claim
// to contain P's unavailable afd08b package or a volumetric cinematic renderer.
export function mountApplicationShell(root, { onNavigate, window: win = window } = {}) {
  if (!root || typeof onNavigate !== 'function') throw new TypeError('Shell requires real navigation')
  const events = new AbortController(), on = (el, type, callback) => el.addEventListener(type, callback, { signal: events.signal })
  const nav = document.createElement('nav'); nav.className = 'production-modes application-navigation'; nav.setAttribute('aria-label', 'MusicOnVerse destinations')
  nav.innerHTML = `<button type="button" data-destination="opening">MusicOnVerse <small>Home</small></button><button type="button" data-destination="workbench">Audio shaping <small>Single-file tools</small></button><button type="button" data-destination="daw">Arrangement <small>Multitrack</small></button><button type="button" class="sylune-toggle" aria-controls="sylune-panel" aria-expanded="false">Sylune <small>Not connected</small></button>`
  root.querySelector('.studio-header').after(nav)
  const opening = document.createElement('section'); opening.className = 'cosmic-opening'; opening.setAttribute('aria-labelledby', 'cosmic-title')
  opening.innerHTML = `<p class="eyebrow">MUSICONVERSE / YOUR MUSIC, IN SPACE</p><h1 id="cosmic-title" tabindex="-1">A space for what<br>you hear next.</h1><p class="opening-description">Shape a sound. Build a session.<br>Two ways to create, in one continuous environment.</p><div class="cosmic-destinations"><button type="button" data-enter="workbench"><span>01 / REFINE</span><strong>Audio shaping</strong><small>Analyze, compare and master your audio.</small><span aria-hidden="true">↗</span></button><button type="button" data-enter="daw"><span>02 / CREATE</span><strong>Arrangement</strong><small>Arrange, edit and mix real audio tracks.</small><span aria-hidden="true">↗</span></button></div><p class="opening-phase" role="status" aria-live="polite"></p><p class="opening-note">Destination names are provisional. The new presentation package is awaiting source delivery; this is the existing environment with the integrated application shell.</p>`
  root.querySelector('.environment-banner').before(opening)
  const companion = document.createElement('aside'); companion.id = 'sylune-panel'; companion.className = 'sylune-panel'; companion.hidden = true; companion.setAttribute('aria-labelledby', 'sylune-title')
  companion.innerHTML = `<header><div><span class="eyebrow">MUSICONVERSE COMPANION</span><h2 id="sylune-title" tabindex="-1">Sylune</h2></div><button type="button" class="sylune-close" aria-label="Close Sylune">Close</button></header><p class="sylune-connection" role="status">Not connected</p><p>No AI provider or execution service is connected. Sylune cannot generate suggestions, process commands or change your music.</p><h3>Current workspace</h3><p class="sylune-context"></p><h3>Local workflow guide</h3><p class="sylune-help"></p><p class="sylune-disclosure">This guide is static application help, not an AI response. Linked Sessions, recording, plugins, buses, automation and AI execution remain outstanding.</p>`
  root.append(companion)
  const toggle = nav.querySelector('.sylune-toggle'), preference = win.matchMedia('(prefers-reduced-motion: reduce)')
  let scrollFrame = 0
  const scrolls = new Map()
  let disposed = false, destination = 'opening', hasNavigated = false, hasRendered = false, phase = 'launch', timers = [], context = { project: 'Untitled session', tracks: 0, source: 'No audio loaded' }
  function setPhase(value) {
    if (disposed) return
    phase = value; root.dataset.journeyPhase = value
    opening.querySelector('.opening-phase').textContent = value === 'launch' ? 'Entering your space… Navigation is available now.' : value === 'arrival' ? 'Arriving. Choose where to begin.' : 'Local audio. Your files stay with you.'
  }
  const cancelTimers = () => { for (const timer of timers) win.clearTimeout(timer); timers = [] }
  function settle() { cancelTimers(); setPhase('drift') }
  function updateContext(value = {}) {
    context = { ...context, ...value }
    companion.querySelector('.sylune-context').textContent = destination === 'daw' ? `${context.project} · ${context.tracks} audio tracks` : destination === 'workbench' ? `Audio shaping · ${context.source}` : 'Choose Audio shaping or Arrangement to begin.'
    companion.querySelector('.sylune-help').textContent = destination === 'daw' ? 'Import tracks or create the three-track session. Select a region to edit timing; use track gain, pan, mute and solo. Download a project to retain its audio and edits.' : destination === 'workbench' ? 'Import audio or generate the demo. Analyze against a reference, render Master Fix, compare A/B, and export. Your original audio remains preserved.' : 'Audio shaping offers the existing analysis and mastering tools. Arrangement opens the real multitrack editor. Navigation retains your current audio and session.'
  }
  function setCompanion(open, { restoreFocus = true } = {}) {
    if (disposed) return
    companion.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); root.dataset.syluneOpen = String(open)
    if (open) companion.querySelector('h2').focus({ preventScroll: true }); else if (restoreFocus) toggle.focus({ preventScroll: true })
  }
  function renderDestination(value) {
    if (disposed) return
    destination = value
    if (value !== 'opening') { hasNavigated = true; settle() } else if (hasNavigated) settle()
    root.dataset.editor = value; opening.hidden = value !== 'opening'
    for (const button of nav.querySelectorAll('[data-destination]')) {
      button.setAttribute('aria-pressed', String(button.dataset.destination === value))
      if (button.dataset.destination === value) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current')
    }
    updateContext()
    // Prevent focus remaining in hidden content after navigation. No remount.
    const heading = value === 'opening' ? opening.querySelector('h1') : root.querySelector('.intro h1')
    heading.setAttribute('tabindex', '-1'); if (hasRendered) heading.focus({ preventScroll: true }); hasRendered = true
    if (value === 'opening') root.querySelector('.studio-footer > span').textContent = 'MusicOnVerse / LOCAL AUDIO'
    root.querySelector('.skip-link').href = value === 'opening' ? '#cosmic-title' : value === 'daw' ? '#daw-workspace' : '#workbench'
    if (scrollFrame) win.cancelAnimationFrame(scrollFrame)
    scrollFrame = win.requestAnimationFrame(() => { scrollFrame = 0; if (!disposed) { const point = scrolls.get(value) || { x: 0, y: 0 }; win.scrollTo({ left: point.x, top: point.y, behavior: 'instant' }) } })
  }
  for (const button of nav.querySelectorAll('[data-destination]')) on(button, 'click', () => onNavigate(button.dataset.destination))
  for (const button of opening.querySelectorAll('[data-enter]')) on(button, 'click', () => onNavigate(button.dataset.enter))
  on(root.querySelector('.brand'), 'click', event => { event.preventDefault(); onNavigate('opening') })
  on(toggle, 'click', () => setCompanion(companion.hidden))
  on(companion.querySelector('.sylune-close'), 'click', () => setCompanion(false))
  on(win, 'keydown', event => { if (event.key === 'Escape' && !companion.hidden && !root.querySelector('dialog[open]')) { event.preventDefault(); setCompanion(false) } })
  on(preference, 'change', () => { if (preference.matches) settle() })
  setPhase(preference.matches ? 'drift' : 'launch')
  if (!preference.matches) { timers.push(win.setTimeout(() => setPhase('arrival'), 1300)); timers.push(win.setTimeout(() => setPhase('drift'), 1750)) }
  updateContext()
  return Object.freeze({ captureScroll() { scrolls.set(destination, { x: win.scrollX, y: win.scrollY }) }, renderDestination, updateContext, setCompanion, get phase() { return phase },
    dispose() { if (disposed) return; disposed = true; cancelTimers(); if (scrollFrame) win.cancelAnimationFrame(scrollFrame); scrollFrame = 0; events.abort(); nav.remove(); opening.remove(); companion.remove(); delete root.dataset.journeyPhase; delete root.dataset.syluneOpen } })
}
