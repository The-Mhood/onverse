#!/usr/bin/env node
// Test-only external reference builder. Never imported by the app. Downloads are
// explicit, pinned and hash-checked; no shell evaluation, npm install or bundling.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { execFileSync, spawnSync } from "node:child_process"
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, relative, isAbsolute, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { createMeteringReferenceCases } from "../../tests/fixtures/meteringReferenceCases.js"

const script = fileURLToPath(import.meta.url)
const root = fileURLToPath(new URL("../../", import.meta.url))
const upstream = {
  repository: "jiixyj/libebur128", commit: "67b33abe1558160ed76ada1322329b0e9e058b02",
  files: {
    "ebur128/ebur128.c": "c2fc562f1088cacab4d21250b6e04996ef36c7694ea901e08cc4d64eb542b78d",
    "ebur128/ebur128.h": "a988fa03828bcdd6258e6c52300d709a58727272a9ce6cd3fbf351f090517111",
    "ebur128/queue/sys/queue.h": "8b284031772b1ba2035d9b05b24f2cb9b23e7bd324bcccb5e3fcc57d34aafa48",
    "COPYING": "d6b4754bb67bdd08b97d5d11b2d7434997a371585a78fe77007149df3af8d09c",
  },
  licenses: { library: "MIT", bundledQueueHeader: "BSD-3-Clause" },
}
const hash = data => createHash("sha256").update(data).digest("hex")
const near = (actual, expected, tolerance, label) => {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${label}: ${actual} versus ${expected} (tolerance ${tolerance})`)
}
const execute = (command, args, options = {}) => execFileSync(command, args, {
  encoding: "utf8", timeout: 30000, maxBuffer: 8 * 1024 * 1024, ...options,
})

function interleave(buffer) {
  const output = Buffer.alloc(buffer.length * buffer.numberOfChannels * 4)
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const sample = buffer.getChannelData(c)[i]
      assert.ok(Number.isFinite(sample), "fixture must be finite")
      output.writeFloatLE(sample, (i * buffer.numberOfChannels + c) * 4)
    }
  }
  return output
}

function main(args) {
  if (args.length === 1 && args[0] === "--help") {
    console.log("Usage: node scripts/validation/run-metering-reference.mjs --fetch\n" +
      "   or: node scripts/validation/run-metering-reference.mjs --source-dir /external/pinned-source\n" +
      "Requires existing Node, gcc; --fetch also requires authenticated gh. JSON to stdout; scratch artifacts outside Git.")
    return
  }
  const fetch = args.length === 1 && args[0] === "--fetch"
  const offline = args.length === 2 && args[0] === "--source-dir"
  assert.ok(fetch || offline, "choose --fetch or --source-dir PATH (no other arguments)")
  const outside = (path, label) => {
    const resolved = realpathSync(path)
    const rel = relative(realpathSync(root), resolved)
    assert.ok(rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel),
      `${label} must be outside repository`)
    return resolved
  }
  const sourceDir = offline ? outside(args[1], "source directory") : undefined
  const work = mkdtempSync(join(outside(tmpdir(), "temporary directory"), "musiconverse-reference-"))
  const source = join(work, "source")
  // Stage exactly the verified bytes; don't compile mutable caller source paths.
  for (const [path, expected] of Object.entries(upstream.files)) {
    const bytes = fetch ? Buffer.from(execute("gh", ["api",
      `repos/${upstream.repository}/contents/${path}?ref=${upstream.commit}`,
      "--jq", ".content"]), "base64") : readFileSync(join(sourceDir, path))
    assert.equal(hash(bytes), expected, `source hash mismatch: ${path}`)
    const destination = join(source, path)
    mkdirSync(dirname(destination), { recursive: true })
    writeFileSync(destination, bytes, { flag: "wx" })
  }
  // The bundled BSD queue notice remains in the verified header beside MIT COPYING.
  const wrapper = fileURLToPath(new URL("./libebur128-reference.c", import.meta.url))
  const wrapperCopy = join(work, "libebur128-reference.c")
  writeFileSync(wrapperCopy, readFileSync(wrapper), { flag: "wx" })
  const binary = join(work, "reference")
  const flags = ["-std=c99", "-D_GNU_SOURCE", "-O2", "-Wall", "-Wextra",
    "-I", join(source, "ebur128"), "-I", join(source, "ebur128/queue")]
  const object = join(work, "ebur128.o")
  const commands = [
    [...flags, "-c", join(source, "ebur128/ebur128.c"), "-o", object],
    [...flags, "-Werror", wrapperCopy, object, "-lm", "-o", binary],
  ]
  const compilerVersion = execute("gcc", ["--version"]).split("\n")[0]
  const compileDiagnostics = []
  for (const args of commands) {
    const result = spawnSync("gcc", args, { encoding: "utf8", timeout: 30000 })
    if (result.stderr) {
      process.stderr.write(result.stderr)
      compileDiagnostics.push(result.stderr.replaceAll(work, "$WORK"))
    }
    assert.equal(result.error, undefined, "compiler could not execute")
    assert.equal(result.signal, null, "compiler crashed or timed out")
    assert.equal(result.status, 0, "compiler failed")
  }
  console.error(`Built pinned libebur128 reference outside repository: ${work}`)

  let negativeChecks = 0
  function rejects(command, commandArgs, pattern, options = {}) {
    const result = spawnSync(command, commandArgs, { encoding: "utf8", timeout: 30000, ...options })
    assert.equal(result.error, undefined, "negative check failed to execute")
    assert.equal(result.signal, null, "negative check crashed or timed out")
    assert.ok(result.status !== 0, "negative check unexpectedly succeeded")
    assert.match(result.stderr, pattern)
    assert.equal(result.stdout, "", "failed run must not publish successful JSON")
    negativeChecks++
  }
  const small = join(work, "small.f32le")
  writeFileSync(small, Buffer.alloc(4))
  rejects(binary, [], /usage:/)
  for (const [rate, channels, frames, chunk, pattern] of [
    ["32000", "1", "1", "1", /unsupported sample rate/],
    ["48000", "3", "1", "1", /unsupported channel layout/],
    ["48000", "1", "0", "1", /integer out of range/],
    ["48000", "1", "-1", "1", /unsigned decimal/],
    ["48000", "1", "1", "0", /integer out of range/],
    ["48000", "1", "1440001", "1", /30-second limit/],
    ["48000", "1", "1", "1440001", /30-second limit/],
    ["48000", "1", "2", "1", /truncated input/],
  ]) rejects(binary, [small, rate, channels, frames, chunk], pattern)
  rejects(binary, [join(work, "missing"), "48000", "1", "1", "1"], /cannot open/)
  for (const tail of ["0", "63", "1025"]) {
    rejects(binary, [small, "48000", "1", "1", "1", tail],
      tail === "0" ? /integer out of range/ : /peak tail must be/)
  }
  for (const [name, bytes, pattern] of [
    ["partial", Buffer.alloc(3), /truncated input/],
    ["extra", Buffer.alloc(8), /extra input/],
    ...[NaN, Infinity, -Infinity].map((value, i) => {
      const bytes = Buffer.alloc(4); bytes.writeFloatLE(value)
      return [`nonfinite-${i}`, bytes, /nonfinite PCM/]
    }),
  ]) {
    const path = join(work, `${name}.f32le`)
    writeFileSync(path, bytes)
    rejects(binary, [path, "48000", "1", "1", "1"], pattern)
  }
  rejects(process.execPath, [script], /choose --fetch/)
  rejects(process.execPath, [script, "--unknown"], /choose --fetch/)
  rejects(process.execPath, [script, "--fetch", "--source-dir", source], /choose --fetch/)
  rejects(process.execPath, [script, "--source-dir", root], /outside repository/)
  rejects(process.execPath, [script, "--source-dir", source], /temporary directory must be outside repository/, {
    env: { ...process.env, TMPDIR: root, TMP: root, TEMP: root },
  })
  const corrupt = join(work, "corrupt-source")
  mkdirSync(join(corrupt, "ebur128"), { recursive: true })
  writeFileSync(join(corrupt, "ebur128/ebur128.c"), "corrupt")
  rejects(process.execPath, [script, "--source-dir", corrupt], /source hash mismatch/)
  const emptyPath = join(work, "empty-path"); mkdirSync(emptyPath)
  rejects(process.execPath, [script, "--source-dir", source], /gcc/, {
    env: { ...process.env, PATH: emptyPath },
  })

  const cases = createMeteringReferenceCases()
  assert.equal(new Set(cases.map(test => test.id)).size, cases.length, "unique fixture IDs")
  const measurements = []
  let chunkRuns = 0
  for (const { id, name, recipe, buffer } of cases) {
    const input = interleave(buffer)
    const path = join(work, `${id}.f32le`)
    writeFileSync(path, input)
    const chunks = [...new Set([buffer.length, 1, 127, 4096])]
    let first
    for (const chunk of chunks) {
      const result = JSON.parse(execute(binary, [path, String(buffer.sampleRate),
        String(buffer.numberOfChannels), String(buffer.length), String(chunk)]))
      chunkRuns++
      assert.equal(result.libraryVersion, "1.2.6")
      assert.equal(result.inputFrames, buffer.length)
      assert.equal(result.sampleRate, buffer.sampleRate)
      assert.equal(result.channels, buffer.numberOfChannels)
      assert.equal(result.chunkFrames, chunk)
      assert.equal(result.peakTailFrames, 64)
      assert.equal(result.channelSamplePeaks.length, buffer.numberOfChannels)
      assert.equal(result.channelTruePeaks.length, buffer.numberOfChannels)
      let samplePeak = 0
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        for (const sample of buffer.getChannelData(c)) samplePeak = Math.max(samplePeak, Math.abs(sample))
      }
      near(result.samplePeakLinear, samplePeak, 1e-12, `${id}: exact sample peak`)
      assert.ok(result.truePeakLinear >= samplePeak, `${id}: reconstructed sample lower bound`)
      const expectedStatus = buffer.length < buffer.sampleRate * 0.4 ? "insufficient-duration" :
        ["silence", "below-gate"].includes(name) ? "below-gate" : "valid"
      assert.equal(result.loudnessStatus, expectedStatus, id)
      if (expectedStatus === "valid") assert.ok(Number.isFinite(result.lufs), id)
      else assert.equal(result.lufs, null, id)
      if (first) {
        assert.equal(result.loudnessStatus, first.loudnessStatus)
        for (const key of ["lufs", "samplePeakDb", "truePeakDb"]) {
          if (first[key] === null) assert.equal(result[key], null)
          else near(result[key], first[key], 1e-6, `${id}: chunk parity ${key}`)
        }
      } else first = result
    }
    const longerTail = JSON.parse(execute(binary, [path, String(buffer.sampleRate),
      String(buffer.numberOfChannels), String(buffer.length), String(buffer.length), "128"]))
    assert.equal(longerTail.peakTailFrames, 128)
    assert.equal(longerTail.loudnessStatus, first.loudnessStatus)
    assert.equal(longerTail.lufs, first.lufs, `${id}: peak flush cannot change captured loudness`)
    near(longerTail.truePeakLinear, first.truePeakLinear, 1e-12, `${id}: 64/128-frame tail parity`)
    assert.equal(hash(interleave(buffer)), hash(input), `${id}: source immutability`)
    const layout = buffer.numberOfChannels === 1 ? "native-mono-center" : "stereo-LR"
    const recipeSha256 = hash(JSON.stringify({ sampleRate: buffer.sampleRate,
      layout, frames: buffer.length, recipe }))
    measurements.push({ id, recipe, recipeSha256, layout, pcmSha256: hash(input), chunksChecked: chunks,
      peakTailFramesChecked: [64, 128], ...first })
  }
  let analyticalChecks = 0
  for (const rate of [44100, 48000]) {
    const get = name => measurements.find(row => row.id === `${rate}-${name}`)
    const check = (actual, expected, tolerance, label) => {
      near(actual, expected, tolerance, `${rate}: ${label}`); analyticalChecks++
    }
    check(get("stereo").lufs - get("mono").lufs, 10 * Math.log10(2), 1e-4, "stereo sum versus mono")
    check(get("inverted").lufs, get("stereo").lufs, 1e-4, "polarity invariance")
    check(get("inverted").truePeakDb, get("stereo").truePeakDb, 1e-6, "peak polarity invariance")
    check(get("left-only").lufs, get("mono").lufs, 1e-4, "left-only versus mono")
    check(get("right-only").lufs, get("mono").lufs, 1e-4, "right-only versus mono")
    check(get("unequal").lufs - get("mono").lufs, 10 * Math.log10(1.25), 1e-4, "unequal channel energy")
    check(get("half-amplitude").lufs - get("mono").lufs, 20 * Math.log10(0.5), 1e-4, "gain law")
    assert.ok(get("phase-quarter-rate").truePeakDb - get("phase-quarter-rate").samplePeakDb > 1,
      "reference must detect substantial inter-sample rise")
    analyticalChecks++
    assert.equal(get("silence").samplePeakDb, null)
    assert.equal(get("silence").truePeakDb, null)
    analyticalChecks += 2
  }
  const localCode = Object.fromEntries([
    "scripts/validation/libebur128-reference.c", "scripts/validation/run-metering-reference.mjs",
    "tests/fixtures/meteringReferenceCases.js", "tests/fixtures/audioBuffers.js",
  ].map(path => [path, hash(readFileSync(join(root, path)))]))
  console.log(JSON.stringify({
    kind: "test-only-independent-reference", upstream, localCode,
    toolchain: { compilerVersion,
      commands: commands.map(args => ["gcc", ...args.map(value => value.replaceAll(work, "$WORK"))]),
      compileDiagnostics,
      nodeVersion: process.version, platform: process.platform, architecture: process.arch },
    workDirectory: work,
    inputFormat: "interleaved IEEE-754 float32 little-endian; explicit native-mono/LR layout",
    modes: "EBUR128_MODE_I | EBUR128_MODE_TRUE_PEAK; no histogram; no dual mono",
    boundaryPolicy: "loudness queried at original end; 64 zero frames then flush peak tail only",
    summary: { fixtures: measurements.length, chunkRuns, tailChecks: measurements.length,
      referenceRuns: chunkRuns + measurements.length, negativeChecks, analyticalChecks,
      chunkToleranceDbOrLu: 1e-6, channelToleranceLu: 1e-4, passed: true },
    limitations: ["Not an official conformance certificate or normative test pack",
      "No replacement meter, rendering, limiter, UI or application dependency",
      "No production auto-gain protection installed; existing defects remain"],
    measurements,
  }, null, 2))
}

try { main(process.argv.slice(2)) }
catch (error) {
  console.error(`Metering reference failed: ${error.message}`)
  process.exitCode = 1
}
