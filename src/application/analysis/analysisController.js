import { analysisService as defaultAnalysisService } from "./analysisService.js"
import { scoreAnalysis as defaultScoreAnalysis, buildIssues as defaultBuildIssues, buildFixPlan as defaultBuildFixPlan, targetFromFeatures } from "../../audio/analyzer.js"
import { matchGenre, GENRES, categoryById, categoryProfile } from "../../audio/genre.js"
import { fetchPreviewBuffer as defaultFetchPreviewBuffer, profileForResolved } from "../../audio/reference.js"

/**
 * DOM-free orchestration for the existing single-buffer analysis workflow.
 * Used by the workbench controller. No visual assets, listeners or second store.
 * Caller supplies the SAME mutable workbench state and explicit view/playback
 * effects. Constructing this boundary performs no analysis, I/O or state mutation.
 * Only explicit method calls may invoke the unchanged engine/reference services.
 *
 * Callbacks are trusted in-process collaborators, not renderer/provider commands.
 * This does not add cancellation, asynchronous freshness, IPC authentication,
 * durable session persistence or a UI. Existing cleanup/error behavior is retained.
 * Original progress/report wording is retained for parity, not a new visual brief
 * or a certification of the underlying genre/profile/loudness measurements.
 */
export function createAnalysisController(ports) {
  if (!ports || typeof ports !== "object" || !ports.state || typeof ports.state !== "object") {
    throw new TypeError("Analysis controller requires an existing workbench state")
  }
  const {
    state, stopPlayback, updateAbUI, renderRefAreas, showProgress, setProgress,
    setProgressLabel, renderAnalysis, renderReport, renderTweakPanel, showPanel, toast,
    analysisService = defaultAnalysisService,
    scoreAnalysis = defaultScoreAnalysis, buildIssues = defaultBuildIssues,
    buildFixPlan = defaultBuildFixPlan, fetchPreviewBuffer = defaultFetchPreviewBuffer,
    console = globalThis.console,
  } = ports
  for (const effect of [stopPlayback, updateAbUI, renderRefAreas, showProgress, setProgress,
    setProgressLabel, renderAnalysis, renderReport, renderTweakPanel, showPanel, toast]) {
    if (typeof effect !== "function") throw new TypeError("Analysis controller requires explicit effects")
  }
  if (typeof analysisService?.analyze !== "function" || typeof console?.error !== "function" ||
      [scoreAnalysis, buildIssues, buildFixPlan, fetchPreviewBuffer].some(fn => typeof fn !== "function") ||
      [ports.ensureReferenceReady, ports.makeTarget].some(fn => fn !== undefined && typeof fn !== "function")) {
    throw new TypeError("Invalid analysis controller collaborator")
  }
  const ensureReferenceReady = ports.ensureReferenceReady ?? prepareReference
  const makeTarget = ports.makeTarget ?? resolveTarget

  async function prepareReference() {
    const r = state.ref
    if (r.src === "auto") return { ok: true, kind: "auto" }
    if (r.src === "file") {
      if (!r.file) { toast("Upload a reference track first."); return { ok: false } }
      if (!r.file.feat) {
        showProgress(true, "Analyzing your reference track…")
        try {
          const feat = await analysisService.analyze(r.file.buf, (v) => {
            setProgress(v)
            if (v < 0.68) setProgressLabel("Analyzing your reference track…")
            else if (v < 0.96) setProgressLabel("Scanning reference spectrum…")
          })
          r.file.feat = feat
        } catch (err) {
          console.error(err)
          toast(`Couldn't analyze the reference track: ${err.message || err}`)
          showProgress(false)
          return { ok: false }
        }
        showProgress(false)
      }
      return { ok: true, kind: "file" }
    }
    // stream url
    if (!r.url) { toast("Paste a stream link first."); return { ok: false } }
    const u = r.url
    if (u.error) { toast("That stream link couldn't be resolved — check it and try again."); return { ok: false } }
    if (!u.prepared) {
      if (u.meta.previewUrl) {
        // Apple Music exposes an official 30 s preview as real audio — that becomes the reference
        showProgress(true, "Fetching Apple Music preview…")
        try {
          const ab = await fetchPreviewBuffer(u.meta.previewUrl)
          setProgress(0.35)
          setProgressLabel("Analyzing reference preview…")
          u.buf = ab
          u.feat = await analysisService.analyze(ab, (v) => setProgress(0.35 + v * 0.65))
        } catch (err) {
          console.error(err)
          toast("Couldn't fetch the Apple preview audio — using the mastered profile for its genre instead.")
          u.prepared = true
          showProgress(false)
          return { ok: true, kind: "profile" }
        }
        showProgress(false)
      } else if (!u.meta.identityKnown) {
        toast("We couldn't identify that link. Try a direct track link, or upload the reference file instead.")
        return { ok: false }
      }
      u.prepared = true
    }
    return { ok: true, kind: u.feat ? "url" : "profile" }
  }

  /* build the object the main file gets scored & fixed against */
  function resolveTarget(kind, analysis) {
    const r = state.ref
    const t = { kind }
    if (kind === "auto") {
      const catOverride = r.cat ? categoryById(r.cat) : null
      let gm
      if (catOverride) {
        const subName = r.sub && catOverride.subs.includes(r.sub) ? r.sub : catOverride.subs[0]
        const g = GENRES.find((x) => x.name === subName) || categoryProfile(catOverride.id)
        gm = { top: g, category: catOverride, confidence: null, manual: true }
      } else {
        gm = matchGenre(analysis)
      }
      t.g = gm.top
      t.gm = gm
      t.meta = { title: gm.top.name, catName: (gm.category && gm.category.name) || gm.top.name, subName: gm.category && gm.category.subs.length > 1 ? gm.top.name : null, manual: !!gm.manual }
      return t
    }
    if (kind === "file") {
      const name = state.ref.file.name
      t.g = targetFromFeatures(state.ref.file.feat, { name: `"${name}"`, realm: "your reference track" })
      t.meta = { title: `Your reference — "${name}"`, kindLabel: "YOUR REFERENCE TRACK", note: "analyzed sample-by-sample from your uploaded audio" }
      return t
    }
    const u = state.ref.url
    if (kind === "url" && u && u.feat) {
      const label = `${u.meta.title || "reference"}${u.meta.artist ? ` — ${u.meta.artist}` : ""}`
      t.g = targetFromFeatures(u.feat, { name: `"${label}"`, realm: "the Apple Music preview reference" })
      t.meta = { title: label, kindLabel: "STREAM REFERENCE · APPLE PREVIEW", note: "official 30 s preview decoded and measured — sample-level matching", platform: u.meta.platform }
      return t
    }
    // resolved stream link without audio → closest mastered profile for its platform genre
    if (u && u.meta && u.meta.cat) {
      const base = profileForResolved(u.meta)
      if (base) {
        const label = `${u.meta.title || "track"}${u.meta.artist ? ` — ${u.meta.artist}` : ""}`.slice(0, 46)
        t.g = { ...base, name: `"${label}"`, realm: "the mastered profile for its platform genre", urlTarget: true }
        t.meta = { title: label, kindLabel: "STREAM REFERENCE · RESOLVED TRACK", note: "full streamed audio can't be decoded in the browser — matched the mastered profile for its genre on the platforms", platform: u.meta.platform, genre: u.meta.genre, cat: categoryById(u.meta.cat) }
        return t
      }
    }
    // fall back to auto detection when the link gave no usable genre
    const auto = makeTarget("auto", analysis)
    auto.meta.fallback = true
    return auto
  }

  async function runAnalysis() {
    if (!state.buffer || state.busy) return
    state.busy = true
    try {
      stopPlayback()
      state.ab = "orig"
      updateAbUI()
      renderRefAreas()
      const prep = await ensureReferenceReady()
      if (!prep.ok) return
      showProgress(true, "Analyzing…")
      const analysis = await analysisService.analyze(state.buffer, (v) => {
        setProgress(v)
        const labels = ["Reading waveform…", "Measuring loudness…", "Scanning spectrum…", "Checking pitch…", "Analyzing stereo…", "Finding tempo…", "Finalizing…"]
        const i = Math.min(labels.length - 1, Math.floor(v * labels.length))
        setProgressLabel(labels[i])
      })
      const target = makeTarget(prep.kind, analysis)
      const g = target.g
      const scores = scoreAnalysis(analysis, g)
      const { issues, positives } = buildIssues(analysis, g, scores)
      const fixPlan = buildFixPlan(analysis, g)
      state.analysis = analysis
      state.scores = scores
      state.issues = { issues, positives }
      state.autoPlan = fixPlan
      state.fixPlan = fixPlan
      state.targetUsed = target
      state.fixed = null
      state.fixedFast = null
      state.tweaks = { trimDb: 0, gluePct: 100, width: 0, band: { sub: 0, bass: 0, low: 0, mid: 0, high: 0, presence: 0, air: 0 } }
      state.hasCustomTweaks = false
      renderAnalysis()
      renderReport()
      renderRefAreas()
      renderTweakPanel()
      showPanel("Analysis")
      const shown = (target.meta.title || g.name).length > 42 ? (target.meta.title || g.name).slice(0, 42) + "…" : target.meta.title || g.name
      toast(`Analysis complete — ${shown} · ${scores.overall}/100`)
    } catch (err) {
      console.error(err)
      toast(`Analysis failed: ${err?.message || String(err)}`)
    } finally {
      state.busy = false
      showProgress(false)
      renderRefAreas()
    }
  }

  return Object.freeze({ runAnalysis, ensureReferenceReady, makeTarget })
}
