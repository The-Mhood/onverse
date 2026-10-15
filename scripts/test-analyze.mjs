import { analyze, scoreAnalysis, buildIssues, buildFixPlan, targetFromFeatures } from "../src/audio/analyzer.js"
import { matchGenre, CATEGORIES, GENRES, categoryById, categoryForGenre, mapPlatformGenre, BAND_KEYS } from "../src/audio/genre.js"
import { parseStreamUrl } from "../src/audio/reference.js"

/* ---- taxonomy integrity ---- */
const seen = new Set()
let missing = []
for (const c of CATEGORIES) {
  if (!c.subs.length) throw new Error(`Category ${c.name} has no sub-genres`)
  for (const s of c.subs) {
    if (seen.has(s)) throw new Error(`Sub-genre ${s} duplicated`)
    seen.add(s)
    if (!GENRES.find((g) => g.name === s)) missing.push(`${c.name} → ${s}`)
  }
}
for (const g of GENRES) if (!seen.has(g.name)) missing.push(`unassigned genre ${g.name}`)
if (missing.length) throw new Error(`Taxonomy gaps: ${missing.join(", ")}`)
const cats = CATEGORIES.map((c) => c.id)
if (new Set(cats).size !== cats.length) throw new Error("Duplicate category ids")
console.log(`OK taxonomy: ${CATEGORIES.length} platform categories, ${GENRES.length} sub-genres, all assigned`)

/* ---- platform genre alias mapping ---- */
const aliases = { "Hip-Hop/Rap": "hiphop", "R&B/Soul": "rnbsoul", Reggaeton: "latin", "Pop Latino": "latin", Afrobeats: "afrobeats", Dance: "dance", Electronic: "dance", Country: "country", "Singer/Songwriter": "pop", "Christian & Gospel": "rnbsoul", Jazz: "jazz" }
for (const [plat, want] of Object.entries(aliases)) {
  const got = mapPlatformGenre(plat)
  if (got !== want) throw new Error(`mapPlatformGenre("${plat}") = ${got}, want ${want}`)
}
console.log("OK platform genre aliases")

/* ---- URL parsing ---- */
const urls = [
  ["https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc", "spotify"],
  ["spotify:track:4uLU6hMCjMI75M1A2tKUQC", "spotify"],
  ["https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC", "spotify"],
  ["https://music.apple.com/us/album/despacito/1447401519?i=1447401620", "apple"],
  ["https://music.apple.com/us/song/despacito/1447401620", "apple"],
  ["https://music.apple.com/album/despacito/1447401519?i=1447401620&l=en", "apple"],
  ["https://www.youtube.com/watch?v=kJQP7kiw5Fk", "youtube"],
  ["https://music.youtube.com/watch?v=kJQP7kiw5Fk&feature=share", "youtube"],
  ["https://youtu.be/kJQP7kiw5Fk", "youtube"],
  ["https://vimeo.com/123", null],
]
for (const [u, want] of urls) {
  const p = parseStreamUrl(u)
  if (want === null ? p !== null : !p || p.platform !== want) throw new Error(`parseStreamUrl("${u}") = ${JSON.stringify(p)}, want ${want}`)
}
console.log("OK URL parsing")

/* ---- end-to-end on the demo-style kick buffer ---- */
const sr = 44100
const len = sr * 16
const L = new Float32Array(len)
const R = new Float32Array(len)
const beat = 60 / 126
for (let i = 0; i < len; i++) {
  const t = i / sr
  const b = t % beat
  const kick = Math.sin(2 * Math.PI * (110 - 65 * Math.min(1, b / 0.08)) * b) * Math.exp(-b * 9) * 0.85
  const hat = (Math.random() * 2 - 1) * Math.exp(-(b % (beat / 2)) * 60) * 0.12
  L[i] = kick * 0.7 + hat
  R[i] = kick * 0.7 + hat
}
const buffer = {
  length: len,
  sampleRate: sr,
  numberOfChannels: 2,
  getChannelData: (c) => (c === 0 ? L : R),
}
const f = await analyze(buffer, () => {})
const gm = matchGenre(f)
const cat = gm.category
if (!cat || !cat.subs.includes(gm.top.name)) throw new Error(`matchGenre category mismatch: ${gm.top.name} not in ${cat && cat.name}`)
console.log(`OK detection → category "${cat.name}" · sub "${gm.top.name}" (${gm.confidence}%) — Spotify ${cat.spotify} / Apple ${cat.apple} / YTM ${cat.ytm}`)
const s = scoreAnalysis(f, gm.top)
console.log("OK score", s.overall, "| issues:", buildIssues(f, gm.top, s).issues.length)

/* ---- custom measured reference flows through the same scoring path ---- */
const ref = targetFromFeatures(f, { name: "\"My ref\"", realm: "your reference track" })
const s2 = scoreAnalysis(f, ref)
const { issues } = buildIssues(f, ref, s2)
const plan = buildFixPlan(f, ref)
console.log("OK custom-target score", s2.overall, "| issues:", issues.length, "| plan target lufs:", plan.targetLufs?.toFixed(1))
console.log("\nALL SANITY CHECKS PASSED")
