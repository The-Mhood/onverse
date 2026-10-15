/* MusicOnVerse — stream-link reference resolver.
 *
 * Turns a Spotify / Apple Music / YouTube Music link into a usable analysis
 * reference entirely in the browser:
 *   - Apple Music links resolve through Apple's public iTunes Lookup API,
 *     which also exposes the official 30-second audio preview (CORS-open),
 *     so those become REAL sample-level references.
 *   - Spotify links resolve via Spotify's oEmbed endpoint (title) then are
 *     matched against the iTunes catalog for canonical title, artist and the
 *     platform genre, which maps onto our category tree.
 *   - YouTube / YouTube Music links resolve via the noembed proxy (the
 *     youtube oEmbed endpoint is CORS-blocked and no longer JSONP-capable),
 *     then the same iTunes catalog match adds genre.
 *
 * Streaming the full track into the page is not possible from these
 * platforms (DRM / terms / no public audio endpoint) — when no audio is
 * available the resolved track is matched against the closest mastered
 * profile for its platform genre, and the UI says so honestly.
 */
import { mapPlatformGenre, categoryProfile } from "./genre.js"

const PLATFORM_META = {
  spotify: { name: "Spotify", color: "oklch(75% 0.15 160)" },
  apple: { name: "Apple Music", color: "oklch(70% 0.2 10)" },
  youtube: { name: "YouTube Music", color: "oklch(75% 0.18 25)" },
}

export function platformMeta(p) {
  return PLATFORM_META[p] || { name: p, color: "oklch(70% 0.1 293)" }
}

/* ---------- URL parsing ---------- */
export function parseStreamUrl(raw) {
  const url = (raw || "").trim()
  if (!url) return null
  let m
  m = url.match(/spotify:track:([A-Za-z0-9]{22})/) ||
    url.match(/(?:open\.spotify\.com|spotify\.link)(?:\/(?:intl-)?[a-z]{2}(?:-[a-zA-Z]{2})?)?\/track\/([A-Za-z0-9]{22})/)
  if (m) return { platform: "spotify", id: m[1], kind: "track" }

  m = url.match(/music\.apple\.com\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?(?:album\/[^/?]+\/(\d+)(?:\?[^#]*?i=(\d+))?|song\/[^/?]+\/(\d+)|track\/[^/?]+\/(\d+))/)
  if (m) {
    const albumId = m[1] && !m[2] && !m[3] ? m[1] : null
    const id = m[2] || m[3] || m[4] || albumId
    if (id) return { platform: "apple", id, kind: m[2] || m[3] || m[4] ? "track" : "album" }
  }

  m = url.match(/(?:youtube\.com\/(?:watch\?[^#]*v=|music\/|shorts\/)|music\.youtube\.com\/watch\?[^#]*v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  if (m) return { platform: "youtube", id: m[1], kind: "video" }

  return null
}

/* ---------- tiny fetch helpers ---------- */
async function getJson(url, timeoutMs = 12000) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

const itunesBase = (path, params) =>
  `https://itunes.apple.com/${path}?${new URLSearchParams(params)}`

function pickItunesResult(results, wantArtist) {
  if (!results || !results.length) return null
  const songs = results.filter((r) => r.kind === "song" && r.trackName)
  const pool = songs.length ? songs : results
  // prefer an explicit artist match when we know one
  if (wantArtist) {
    const hit = pool.find((r) =>
      (r.artistName || "").toLowerCase().includes(wantArtist.toLowerCase()))
    if (hit) return hit
  }
  return pool[0]
}

async function itunesLookup(id) {
  return getJson(itunesBase("lookup", { id, country: "US" }))
}

async function itunesSearch(term, artist) {
  const res = await getJson(itunesBase("search", {
    term: term.slice(0, 200),
    entity: "song",
    limit: 8,
    country: "US",
  }))
  return pickItunesResult(res.results, artist)
}

/* ---------- platform resolvers ---------- */
async function resolveSpotify(id) {
  let oemb = null
  try {
    oemb = await getJson(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${id}&format=json`)
  } catch { /* offline / blocked */ }
  const meta = { platform: "spotify", id, kind: "track" }
  if (!oemb || !oemb.title) {
    meta.title = null
    meta.identityKnown = false
    return meta
  }
  meta.title = oemb.title
  meta.thumbnail = oemb.thumbnail_url
  meta.identityKnown = true
  // enrich artist + genre via the iTunes catalog (same global releases)
  try {
    const it = await itunesSearch(oemb.title, null)
    if (it) {
      meta.artist = it.artistName
      meta.genre = it.primaryGenreName
      meta.cat = mapPlatformGenre(it.primaryGenreName)
      meta.thumbnail = meta.thumbnail || it.artworkUrl100?.replace("100x100", "300x300")
    }
  } catch { /* best-effort */ }
  return meta
}

async function resolveApple(id, kind) {
  try {
    const res = await itunesLookup(id)
    const r = (res.results || []).find((x) => String(x.trackId) === String(id) || String(x.collectionId) === String(id)) ||
      (res.results || [])[0]
    if (!r) throw new Error("Not found in the Apple Music catalog.")
    const isTrack = r.wrapperType === "track" || r.kind === "song"
    const meta = {
      platform: "apple",
      id,
      kind: isTrack ? "track" : kind,
      title: isTrack ? r.trackName : r.collectionName,
      artist: isTrack ? r.artistName : r.artistName || r.collectionArtistName,
      genre: r.primaryGenreName,
      cat: mapPlatformGenre(r.primaryGenreName),
      thumbnail: r.artworkUrl100?.replace("100x100", "300x300"),
      previewUrl: isTrack ? r.previewUrl : null,
      identityKnown: true,
    }
    return meta
  } catch (err) {
    return { platform: "apple", id, kind, error: err.message || "Apple Music lookup failed", identityKnown: false }
  }
}

async function resolveYoutube(id) {
  try {
    const oemb = await getJson(`https://noembed.com/embed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`)
    if (!oemb || oemb.error) throw new Error(oemb?.error || "noembed failed")
    const rawTitle = String(oemb.title || "").replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s*\[[^\]]*\]\s*/g, " ").replace(/\s+/g, " ").trim()
    let title = rawTitle
    let artist = null
    const dash = rawTitle.lastIndexOf(" - ")
    if (dash > 0) {
      const maybeArtist = rawTitle.slice(0, dash).trim()
      const maybeTitle = rawTitle.slice(dash + 3).trim()
      if (maybeArtist.length > 2 && maybeTitle.length > 1) {
        artist = maybeArtist
        title = maybeTitle
      }
    }
    const meta = { platform: "youtube", id, kind: "video", title, artist, identityKnown: true, thumbnail: oemb.thumbnail_url }
    if (!artist) artist = String(oemb.author_name || "").replace(/VEVO| - Topic$/i, "").trim()
    meta.artist = artist
    // enrich with canonical info + genre from iTunes
    try {
      const term = title + (artist ? ` ${artist}` : "")
      const it = await itunesSearch(term, artist)
      if (it) {
        meta.genre = it.primaryGenreName
        meta.cat = mapPlatformGenre(it.primaryGenreName)
        meta.thumbnail = meta.thumbnail || it.artworkUrl100?.replace("100x100", "300x300")
        if (!it.artistName.toLowerCase().includes(artist.toLowerCase())) meta.artist = it.artistName
      }
    } catch { /* best-effort */ }
    return meta
  } catch (err) {
    return { platform: "youtube", id, kind: "video", error: err.message || "YouTube lookup failed", identityKnown: false }
  }
}

/* ---------- public API ---------- */
export async function resolveStreamUrl(raw) {
  const parsed = parseStreamUrl(raw)
  if (!parsed) return { error: "That doesn't look like a Spotify, Apple Music or YouTube Music link." }
  let meta
  if (parsed.platform === "spotify") meta = await resolveSpotify(parsed.id)
  else if (parsed.platform === "apple") meta = await resolveApple(parsed.id, parsed.kind)
  else meta = await resolveYoutube(parsed.id)
  meta.inputUrl = raw.trim()
  return meta
}

/* the mastered fingerprint to stand in when a resolved track has no audio */
export function profileForResolved(meta) {
  const cat = meta.cat ? categoryProfile(meta.cat) : null
  return cat
}

/* fetch + decode an Apple Music 30 s preview into an AudioBuffer */
export async function fetchPreviewBuffer(previewUrl) {
  const res = await fetch(previewUrl)
  if (!res.ok) throw new Error(`Preview download failed (HTTP ${res.status})`)
  const ab = await res.arrayBuffer()
  const ctx = new AudioContext()
  try {
    return await ctx.decodeAudioData(ab)
  } finally {
    await ctx.close()
  }
}
