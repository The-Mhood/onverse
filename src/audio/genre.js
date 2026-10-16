/* MusicOnVerse — built-in genre profiles and platform-category mappings.
 * Category aliases and labels support reference resolution across Spotify,
 * Apple Music, and YouTube Music. The numeric genre targets are illustrative
 * hand-authored heuristics, not measurements of a chart-track corpus or
 * independently verified platform recommendations. They use the same feature
 * space the analyzer measures (loudness LUFS, dynamic crest, spectral centroid,
 * stereo correlation and width, 7-band EQ balance).
 *
 * bands order: sub, bass, low, mid, high, presence, air
 */

export const BAND_KEYS = ["sub", "bass", "low", "mid", "high", "presence", "air"]

export const BAND_META = {
  sub: { name: "Sub Bass", range: "20–60 Hz", freq: 45, kind: "ls" },
  bass: { name: "Bass", range: "60–250 Hz", freq: 120, kind: "ls" },
  low: { name: "Low-Mid", range: "250–500 Hz", freq: 380, kind: "pk" },
  mid: { name: "Mid", range: "500–2 kHz", freq: 1000, kind: "pk" },
  high: { name: "High-Mid", range: "2–5 kHz", freq: 3200, kind: "pk" },
  presence: { name: "Presence", range: "5–10 kHz", freq: 7000, kind: "pk" },
  air: { name: "Air", range: "10–20 kHz", freq: 12000, kind: "hs" },
}

/* neutral reference curve (relative band dB) */
export const NEUTRAL = { sub: -8, bass: -3, low: -4, mid: -3, high: -4, presence: -6, air: -11 }

const P = (name, spotify, d) => ({ name, spotify, ...d })

export const GENRES = [
  /* ---------- Hip-Hop ---------- */
  P("Hip-Hop", "Spotify · Hip-Hop", { bpm: [82, 100], lufs: -8.5, crest: 9, centroid: 2100, corr: 0.45, width: -8, bands: { ...NEUTRAL, sub: -4, bass: 0, low: -3, mid: -5, high: -6, presence: -9, air: -16 } }),
  P("Trap", "Spotify · Trap", { bpm: [135, 165], lufs: -8, crest: 10, centroid: 1900, corr: 0.4, width: -10, bands: { ...NEUTRAL, sub: -3, bass: -1, low: -4, mid: -6, high: -6, presence: -10, air: -17 } }),
  P("Drill", "Spotify · UK Drill", { bpm: [138, 150], lufs: -8.5, crest: 9, centroid: 2000, corr: 0.42, width: -9, bands: { ...NEUTRAL, sub: -3, bass: -1, low: -4, mid: -5, high: -5, presence: -10, air: -17 } }),
  P("Phonk", "Spotify · Phonk", { bpm: [120, 145], lufs: -8.5, crest: 11, centroid: 1700, corr: 0.4, width: -9, bands: { ...NEUTRAL, sub: -4, bass: 1, low: -5, mid: -7, high: -5, presence: -9, air: -18 } }),
  P("Lo-Fi", "Spotify · Lo-Fi Beats", { bpm: [70, 90], lufs: -13, crest: 13, centroid: 2400, corr: 0.55, width: -2, bands: { ...NEUTRAL, sub: -9, bass: -2, low: -2, mid: -3, high: -5, presence: -8, air: -16 } }),
  /* ---------- R&B / Soul ---------- */
  P("R&B", "Spotify · R&B", { bpm: [60, 90], lufs: -10.5, crest: 11, centroid: 2600, corr: 0.55, width: -3, bands: { ...NEUTRAL, sub: -9, bass: -2, low: -4, mid: -4, high: -3, presence: -4, air: -10 } }),
  P("Soul", "Spotify · Soul", { bpm: [80, 110], lufs: -11, crest: 11, centroid: 2800, corr: 0.55, width: -2, bands: { ...NEUTRAL, sub: -10, bass: -3, low: -5, mid: -3, high: -4, presence: -5, air: -11 } }),
  P("Funk", "Spotify · Funk", { bpm: [100, 120], lufs: -10, crest: 12, centroid: 2600, corr: 0.5, width: -2, bands: { ...NEUTRAL, sub: -10, bass: -2, low: -3, mid: -2, high: -3, presence: -4, air: -11 } }),
  P("Gospel", "Apple Music · Gospel", { bpm: [70, 100], lufs: -9.5, crest: 12, centroid: 2900, corr: 0.55, width: -2, bands: { ...NEUTRAL, sub: -10, bass: -3, low: -4, mid: -2, high: -3, presence: -4, air: -9 } }),
  /* ---------- Pop ---------- */
  P("Pop", "Spotify · Pop", { bpm: [100, 124], lufs: -9.5, crest: 8, centroid: 3200, corr: 0.5, width: -4, bands: { ...NEUTRAL, sub: -10, high: -3, presence: -5, air: -10 } }),
  P("K-Pop", "Spotify · K-Pop", { bpm: [95, 130], lufs: -8.5, crest: 8, centroid: 3400, corr: 0.5, width: -4, bands: { ...NEUTRAL, sub: -7, bass: -2, low: -5, mid: -3, high: -2, presence: -4, air: -9 } }),
  P("Singer-Songwriter", "Spotify · Singer-Songwriter", { bpm: [70, 110], lufs: -11.5, crest: 13, centroid: 2700, corr: 0.55, width: -1, bands: { ...NEUTRAL, sub: -12, bass: -4, low: -4, mid: -3, high: -4, presence: -5, air: -10 } }),
  /* ---------- Latin · Reggaeton ---------- */
  P("Latin", "Spotify · Latin", { bpm: [88, 120], lufs: -9.5, crest: 11, centroid: 2900, corr: 0.5, width: -3, bands: { ...NEUTRAL, sub: -9, bass: -2, low: -3, mid: -2, high: -3, presence: -4, air: -10 } }),
  P("Reggaeton", "Spotify · Reggaeton", { bpm: [92, 104], lufs: -8.5, crest: 10, centroid: 2200, corr: 0.45, width: -6, bands: { ...NEUTRAL, sub: -1, bass: 1, low: -3, mid: -5, high: -3, presence: -6, air: -12 } }),
  /* ---------- Afrobeats ---------- */
  P("Afrobeats", "Spotify · Afro", { bpm: [100, 118], lufs: -9.5, crest: 11, centroid: 2800, corr: 0.52, width: -2, bands: { ...NEUTRAL, sub: -9, bass: -2, low: -3, mid: -2, high: -3, presence: -4, air: -10 } }),
  P("Amapiano", "Spotify · Amapiano", { bpm: [110, 116], lufs: -9, crest: 10, centroid: 2500, corr: 0.5, width: -3, bands: { ...NEUTRAL, sub: -6, bass: -1, low: -3, mid: -3, high: -4, presence: -5, air: -12 } }),
  /* ---------- Dance & Electronic ---------- */
  P("House", "Spotify · House", { bpm: [120, 128], lufs: -9, crest: 9, centroid: 3200, corr: 0.5, width: -5, bands: { ...NEUTRAL, sub: -7, bass: -2, low: -5, mid: -4, high: -3, presence: -5, air: -11 } }),
  P("EDM", "Spotify · Electronic Dance", { bpm: [126, 132], lufs: -8, crest: 8, centroid: 3400, corr: 0.45, width: -7, bands: { ...NEUTRAL, sub: -5, bass: -1, low: -6, mid: -4, high: -2, presence: -4, air: -12 } }),
  P("Techno", "Spotify · Techno", { bpm: [128, 145], lufs: -8.5, crest: 8, centroid: 3000, corr: 0.5, width: -5, bands: { ...NEUTRAL, sub: -6, bass: -1, low: -6, mid: -4, high: -3, presence: -5, air: -12 } }),
  P("Trance", "Spotify · Trance", { bpm: [136, 142], lufs: -8.5, crest: 8, centroid: 3300, corr: 0.48, width: -6, bands: { ...NEUTRAL, sub: -6, bass: -1, low: -6, mid: -4, high: -2, presence: -4, air: -11 } }),
  P("Drum & Bass", "Spotify · Drum & Bass", { bpm: [170, 178], lufs: -8.5, crest: 10, centroid: 2700, corr: 0.45, width: -6, bands: { ...NEUTRAL, sub: -5, bass: 0, low: -5, mid: -4, high: -3, presence: -4, air: -11 } }),
  P("Dubstep", "Spotify · Dubstep", { bpm: [138, 146], lufs: -7.5, crest: 9, centroid: 2500, corr: 0.45, width: -7, bands: { ...NEUTRAL, sub: -3, bass: 0, low: -5, mid: -4, high: -3, presence: -4, air: -13 } }),
  P("Ambient", "Spotify · Ambient", { bpm: [60, 90], lufs: -16, crest: 13, centroid: 2600, corr: 0.6, width: 0, bands: { ...NEUTRAL, sub: -10, bass: -4, low: -4, mid: -3, high: -4, presence: -5, air: -9 } }),
  /* ---------- Rock ---------- */
  P("Rock", "Spotify · Rock", { bpm: [110, 140], lufs: -9.5, crest: 10, centroid: 2800, corr: 0.5, width: -3, bands: { ...NEUTRAL, sub: -12, bass: -3, low: -3, mid: -2, high: -3, presence: -4, air: -10 } }),
  P("Indie / Alt", "Spotify · Indie & Alternative", { bpm: [100, 130], lufs: -10.5, crest: 11, centroid: 3000, corr: 0.5, width: -2, bands: { ...NEUTRAL, sub: -12, bass: -3, low: -4, mid: -3, high: -4, presence: -5, air: -10 } }),
  P("Grunge", "Spotify · Grunge", { bpm: [100, 120], lufs: -9, crest: 12, centroid: 2600, corr: 0.5, width: -2, bands: { ...NEUTRAL, sub: -13, bass: -3, low: -2, mid: -1, high: -4, presence: -5, air: -11 } }),
  P("Punk", "Spotify · Punk", { bpm: [160, 200], lufs: -8.5, crest: 11, centroid: 3300, corr: 0.48, width: -3, bands: { ...NEUTRAL, sub: -14, bass: -4, low: -3, mid: -2, high: -2, presence: -3, air: -9 } }),
  P("Metal", "Spotify · Metal", { bpm: [130, 180], lufs: -8.5, crest: 12, centroid: 3200, corr: 0.48, width: -4, bands: { ...NEUTRAL, sub: -14, bass: -4, low: -3, mid: -1, high: -3, presence: -4, air: -11 } }),
  /* ---------- Country ---------- */
  P("Country", "Spotify · Country", { bpm: [88, 120], lufs: -9.5, crest: 11, centroid: 2800, corr: 0.5, width: -3, bands: { ...NEUTRAL, sub: -12, bass: -3, low: -4, mid: -2, high: -3, presence: -4, air: -10 } }),
  /* ---------- Folk ---------- */
  P("Folk", "Spotify · Folk", { bpm: [90, 120], lufs: -11, crest: 12, centroid: 2600, corr: 0.55, width: -1, bands: { ...NEUTRAL, sub: -13, bass: -4, low: -4, mid: -3, high: -4, presence: -5, air: -10 } }),
  /* ---------- Blues ---------- */
  P("Blues", "Spotify · Blues", { bpm: [70, 120], lufs: -11, crest: 13, centroid: 2400, corr: 0.55, width: -2, bands: { ...NEUTRAL, sub: -12, bass: -3, low: -3, mid: -2, high: -4, presence: -5, air: -11 } }),
  /* ---------- Jazz ---------- */
  P("Jazz", "Spotify · Jazz", { bpm: [80, 180], lufs: -14, crest: 14, centroid: 3300, corr: 0.55, width: -1, bands: { ...NEUTRAL, sub: -13, bass: -4, low: -5, mid: -4, high: -3, presence: -4, air: -8 } }),
  /* ---------- Classical ---------- */
  P("Classical", "Spotify · Classical", { bpm: [60, 140], lufs: -18, crest: 16, centroid: 3000, corr: 0.6, width: 0, bands: { ...NEUTRAL, sub: -14, bass: -5, low: -5, mid: -3, high: -3, presence: -4, air: -7 } }),
  /* ---------- Reggae ---------- */
  P("Reggae", "Spotify · Reggae", { bpm: [70, 95], lufs: -10, crest: 12, centroid: 2400, corr: 0.55, width: -2, bands: { ...NEUTRAL, sub: -7, bass: -1, low: -3, mid: -3, high: -4, presence: -5, air: -12 } }),
  P("Dancehall", "Spotify · Dancehall", { bpm: [95, 110], lufs: -9, crest: 10, centroid: 2300, corr: 0.5, width: -3, bands: { ...NEUTRAL, sub: -5, bass: -1, low: -4, mid: -4, high: -4, presence: -5, air: -12 } }),
]

/* ------------------------------------------------------------------ */
/* Platform category tree — the genres as they appear on Spotify,      */
/* Apple Music and YouTube Music, each holding its sub-genres above.   */
/* ------------------------------------------------------------------ */
export const CATEGORIES = [
  { id: "hiphop", name: "Hip-Hop", spotify: "Hip-Hop", apple: "Hip-Hop/Rap", ytm: "Hip hop", subs: ["Hip-Hop", "Trap", "Drill", "Phonk", "Lo-Fi"] },
  { id: "rnbsoul", name: "R&B / Soul", spotify: "R&B", apple: "R&B/Soul", ytm: "R&B", subs: ["R&B", "Soul", "Funk", "Gospel"] },
  { id: "pop", name: "Pop", spotify: "Pop", apple: "Pop", ytm: "Pop", subs: ["Pop", "K-Pop", "Singer-Songwriter"] },
  { id: "latin", name: "Latin · Reggaeton", spotify: "Latin", apple: "Latino", ytm: "Latin music", subs: ["Reggaeton", "Latin"] },
  { id: "afrobeats", name: "Afrobeats", spotify: "Afro", apple: "Afrobeat", ytm: "Afrobeats", subs: ["Afrobeats", "Amapiano"] },
  { id: "dance", name: "Dance & Electronic", spotify: "Dance", apple: "Dance", ytm: "Dance & electronic", subs: ["House", "EDM", "Techno", "Trance", "Drum & Bass", "Dubstep", "Ambient"] },
  { id: "rock", name: "Rock", spotify: "Rock", apple: "Rock", ytm: "Rock", subs: ["Rock", "Indie / Alt", "Grunge", "Punk", "Metal"] },
  { id: "country", name: "Country", spotify: "Country", apple: "Country", ytm: "Country & folk", subs: ["Country"] },
  { id: "folk", name: "Folk", spotify: "Folk", apple: "Folk", ytm: "Folk & acoustic", subs: ["Folk"] },
  { id: "blues", name: "Blues", spotify: "Blues", apple: "Blues", ytm: "Blues", subs: ["Blues"] },
  { id: "jazz", name: "Jazz", spotify: "Jazz", apple: "Jazz", ytm: "Jazz", subs: ["Jazz"] },
  { id: "classical", name: "Classical", spotify: "Classical", apple: "Classical", ytm: "Classical", subs: ["Classical"] },
  { id: "reggae", name: "Reggae", spotify: "Reggae", apple: "Reggae", ytm: "Reggae", subs: ["Reggae", "Dancehall"] },
]

const byName = {}
for (const g of GENRES) byName[g.name] = g

export function genreByName(name) {
  return byName[name] || null
}

export function categoryForGenre(name) {
  for (const c of CATEGORIES) if (c.subs.includes(name)) return c
  return null
}

export function categoryById(id) {
  return CATEGORIES.find((c) => c.id === id) || null
}

/* Built-in profile selected for a category (its first listed sub-genre). */
export function categoryProfile(id) {
  const c = categoryById(id)
  if (!c) return null
  return genreByName(c.subs[0])
}

/* iTunes / platform genre strings → our category tree */
const CAT_ALIASES = [
  { re: /hip.?hop|rap|trap|drill|phonk|boom.?bap/i, id: "hiphop" },
  { re: /\br&b|rnb|soul|funk|neo.?soul|gospel|christian/i, id: "rnbsoul" },
  { re: /reggaeton|pop latino|urbano|bachata|corridos|mexican/i, id: "latin" },
  { re: /afrobeat|afrobeats|amapiano|afropop|afro.?fusion/i, id: "afrobeats" },
  { re: /singer.?songwriter|k.?pop|mandopop|j.?pop|pop/i, id: "pop" },
  { re: /dance|electronic|edm|house|techno|trance|drum.?and.?bass|dubstep|ambient|electronica/i, id: "dance" },
  { re: /rock|alternative|indie|punk|grunge|metal|emo|hardcore/i, id: "rock" },
  { re: /country|americana|bluegrass/i, id: "country" },
  { re: /\bfolk\b|acoustic/i, id: "folk" },
  { re: /\bblues\b/i, id: "blues" },
  { re: /\bjazz\b|swing|bebop/i, id: "jazz" },
  { re: /classical|orchestral|opera|instrumental/i, id: "classical" },
  { re: /reggae|dancehall|soca|ska|dub/i, id: "reggae" },
]

export function mapPlatformGenre(str) {
  if (!str) return null
  const s = String(str)
  for (const a of CAT_ALIASES) if (a.re.test(s)) return a.id
  return null
}

/* feature vector distance — lower is a closer match */
export function genreDistance(f, g) {
  const [bLo, bHi] = g.bpm
  let bpmDev = 0
  if (f.tempo.bpm < bLo) bpmDev = (bLo - f.tempo.bpm) / 60
  else if (f.tempo.bpm > bHi) bpmDev = (f.tempo.bpm - bHi) / 60
  const lufsDev = Math.abs(f.lufs - g.lufs) * 0.7
  const centDev = Math.abs(Math.log2(Math.max(f.centroid, 60) / g.centroid)) * 1.2
  const corrDev = Math.abs(f.stereo.corr - g.corr) * 2
  const widthDev = Math.abs(f.stereo.widthDb - g.width) * 0.8
  const crestDev = Math.abs(f.crestDb - g.crest) * 0.5
  let bandDev = 0
  for (const k of BAND_KEYS) bandDev += Math.abs(f.bands[k] - g.bands[k])
  bandDev = (bandDev / BAND_KEYS.length) * 2.4
  return bpmDev + lufsDev + centDev + corrDev + widthDev + crestDev + bandDev
}

export function matchGenre(f) {
  const scored = GENRES.map((g) => ({ genre: g, distance: genreDistance(f, g) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3)
  const [best, second] = scored
  const spread = second ? second.distance - best.distance : 1.2
  const closeness = Math.max(0, 1 - best.distance / 2.6)
  const confidence = Math.round(
    Math.min(1, closeness * 0.55 + Math.min(1, spread / 0.7) * 0.45) * 100,
  )
  return {
    top: best.genre,
    category: categoryForGenre(best.genre.name),
    confidence,
    candidates: scored.map((s) => ({ genre: s.genre, distance: s.distance })),
  }
}
