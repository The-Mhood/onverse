#!/usr/bin/env node
// Offline research comparison. Imported JSON is data, never a command/source path.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createMeteringReferenceCases } from "../../tests/fixtures/meteringReferenceCases.js"
import { createIntegratedLoudnessCandidate, CANDIDATE_PROFILE } from "./integrated-loudness-candidate.mjs"

const root = fileURLToPath(new URL("../../", import.meta.url))
const sourceCommit = "67b33abe1558160ed76ada1322329b0e9e058b02"
const sourceHashes = {
  "ebur128/ebur128.c": "c2fc562f1088cacab4d21250b6e04996ef36c7694ea901e08cc4d64eb542b78d",
  "ebur128/ebur128.h": "a988fa03828bcdd6258e6c52300d709a58727272a9ce6cd3fbf351f090517111",
  "ebur128/queue/sys/queue.h": "8b284031772b1ba2035d9b05b24f2cb9b23e7bd324bcccb5e3fcc57d34aafa48",
  "COPYING": "d6b4754bb67bdd08b97d5d11b2d7434997a371585a78fe77007149df3af8d09c",
}
const referenceCodePaths = [
  "scripts/validation/libebur128-reference.c", "scripts/validation/run-metering-reference.mjs",
  "tests/fixtures/meteringReferenceCases.js", "tests/fixtures/audioBuffers.js",
]
const candidatePaths = [
  "scripts/validation/integrated-loudness-candidate.mjs", "scripts/validation/compare-loudness-candidate.mjs",
  "tests/audio/integratedLoudnessCandidate.test.js",
]
const sha = bytes => createHash("sha256").update(bytes).digest("hex")
const codeHash = path => sha(readFileSync(resolve(root, path)))
const near = (actual, expected, tolerance, label) => {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${label}: ${actual} versus ${expected} (tolerance ${tolerance})`)
}
function pcmHash(buffer) {
  const bytes = Buffer.alloc(buffer.length * buffer.numberOfChannels * 4)
  for (let n = 0; n < buffer.length; n++) for (let c = 0; c < buffer.numberOfChannels; c++) {
    bytes.writeFloatLE(buffer.getChannelData(c)[n], (n * buffer.numberOfChannels + c) * 4)
  }
  return sha(bytes)
}

export function compareLoudnessCandidateReport(reference) {
  assert.equal(reference?.kind, "test-only-independent-reference", "wrong reference report kind")
  assert.equal(reference.upstream?.repository, "jiixyj/libebur128", "wrong reference repository")
  assert.equal(reference.upstream?.commit, sourceCommit, "wrong reference commit")
  for (const [path, hash] of Object.entries(sourceHashes)) {
    assert.equal(reference.upstream.files?.[path], hash, `wrong upstream source hash: ${path}`)
  }
  // Only fixed local paths are read. Never read/execute report.workDirectory or
  // arbitrary keys from report.localCode. These checks aren't a digital signature.
  for (const path of referenceCodePaths) {
    assert.equal(reference.localCode?.[path], codeHash(path), `stale reference code: ${path}`)
  }
  assert.equal(reference.summary?.passed, true, "reference verification did not pass")
  assert.equal(reference.modes, "EBUR128_MODE_I | EBUR128_MODE_TRUE_PEAK; no histogram; no dual mono", "wrong reference mode")
  assert.equal(reference.boundaryPolicy, "loudness queried at original end; 64 zero frames then flush peak tail only", "wrong boundary policy")
  const cases = createMeteringReferenceCases()
  assert.equal(reference.summary.fixtures, cases.length, "reference fixture count")
  assert.ok(Array.isArray(reference.measurements), "missing reference measurements")
  assert.equal(reference.measurements.length, cases.length, "incomplete reference measurements")
  const rows = new Map()
  for (const row of reference.measurements) {
    assert.ok(row && typeof row.id === "string" && !rows.has(row.id), "invalid or duplicate reference ID")
    rows.set(row.id, row)
  }
  // Preflight ALL evidence before running any candidate stream.
  for (const test of cases) {
    const { id, recipe, buffer } = test
    const r = rows.get(id)
    assert.ok(r, `missing reference fixture: ${id}`)
    assert.equal(r.libraryVersion, "1.2.6", id)
    assert.equal(r.sampleRate, buffer.sampleRate, `${id}: rate`)
    assert.equal(r.channels, buffer.numberOfChannels, `${id}: channels`)
    assert.equal(r.inputFrames, buffer.length, `${id}: frames`)
    assert.equal(r.peakTailFrames, 64, `${id}: tail`)
    const layout = buffer.numberOfChannels === 1 ? "native-mono-center" : "stereo-LR"
    assert.equal(r.layout, layout, `${id}: layout`)
    assert.deepEqual(r.recipe, recipe, `${id}: recipe`)
    assert.equal(r.recipeSha256, sha(JSON.stringify({ sampleRate: buffer.sampleRate,
      layout, frames: buffer.length, recipe })), `${id}: recipe hash`)
    assert.equal(r.pcmSha256, pcmHash(buffer), `${id}: PCM hash`)
    assert.ok(["valid", "below-gate", "insufficient-duration"].includes(r.loudnessStatus), `${id}: invalid reference status`)
    if (r.loudnessStatus === "valid") assert.ok(Number.isFinite(r.lufs), `${id}: nonfinite reference LUFS`)
    else assert.equal(r.lufs, null, `${id}: unavailable reference must not be numeric`)
  }

  const measurements = []
  let runs = 0, maxDifferenceLu = 0, worstFixture = null, maxChunkDifferenceLu = 0
  for (const { id, buffer } of cases) {
    const ref = rows.get(id)
    const data = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c))
    const chunks = [...new Set([buffer.length, 1, 127, 128, 4096])]
    let whole
    for (const chunk of chunks) {
      const candidate = createIntegratedLoudnessCandidate({ sampleRate: buffer.sampleRate, channels: data.length })
      for (let off = 0; off < buffer.length; off += chunk) candidate.addFrames(data.map(c => c.subarray(off, off + chunk)))
      const result = candidate.finish()
      runs++
      assert.equal(result.status, ref.loudnessStatus, `${id}: status`)
      assert.equal(result.profile, CANDIDATE_PROFILE)
      assert.equal(result.frames, buffer.length)
      assert.equal(result.completeWindows, Math.max(0, Math.floor((buffer.length - buffer.sampleRate * 0.4) / (buffer.sampleRate * 0.1)) + 1))
      if (result.status === "valid") {
        near(result.lufs, ref.lufs, 0.1, `${id}: independent reference`)
        const difference = Math.abs(result.lufs - ref.lufs)
        if (difference > maxDifferenceLu) { maxDifferenceLu = difference; worstFixture = id }
      } else assert.equal(result.lufs, null, `${id}: no fabricated floor`)
      if (whole) {
        if (whole.lufs !== null) {
          near(result.lufs, whole.lufs, 1e-6, `${id}: chunk parity`)
          maxChunkDifferenceLu = Math.max(maxChunkDifferenceLu, Math.abs(result.lufs - whole.lufs))
        }
        assert.deepEqual(result, whole, `${id}: chunk state/evidence parity`)
      } else whole = result
    }
    assert.equal(pcmHash(buffer), ref.pcmSha256, `${id}: immutable PCM`)
    measurements.push({ id, pcmSha256: ref.pcmSha256, recipeSha256: ref.recipeSha256,
      chunksChecked: chunks, referenceLufs: ref.lufs,
      differenceLu: whole.lufs === null ? null : whole.lufs - ref.lufs, candidate: whole })
  }
  return {
    kind: "research-loudness-candidate-comparison", profile: CANDIDATE_PROFILE,
    reference: { repository: "jiixyj/libebur128", commit: sourceCommit, version: "1.2.6", sourceHashes },
    localCode: Object.fromEntries([...referenceCodePaths, ...candidatePaths].map(path => [path, codeHash(path)])),
    summary: { passed: true, fixtures: cases.length, candidateRuns: runs,
      referenceToleranceLu: 0.1, chunkToleranceLu: 1e-6,
      maxDifferenceLu, worstFixture, maxChunkDifferenceLu },
    limitations: ["Research-only, 30-second input bound, mono/LR at 44.1/48 kHz",
      "Shared filter-parameter assumptions; no official normative-vector certification",
      "No true-peak candidate, production integration, automatic-gain safety fix or listening claim"],
    measurements,
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2)
    assert.ok(args.length === 2 && args[0] === "--reference", "usage: compare-loudness-candidate.mjs --reference REPORT.json")
    const info = statSync(args[1])
    assert.ok(info.isFile() && info.size <= 2 * 1024 * 1024, "reference report must be a file no larger than 2 MiB")
    const bytes = readFileSync(args[1])
    const report = compareLoudnessCandidateReport(JSON.parse(bytes.toString("utf8")))
    report.referenceReportSha256 = sha(bytes)
    console.log(JSON.stringify(report, null, 2))
  } catch (error) {
    console.error(`Candidate comparison failed: ${error.message}`)
    process.exitCode = 1
  }
}
