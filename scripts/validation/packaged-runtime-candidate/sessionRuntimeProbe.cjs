// REVIEW CANDIDATE ONLY. Adoption requires explicit review; no storage qualification.
// Proposed destination: electron/diagnostics/sessionRuntimeProbe.cjs.
// Capability observation only: no project files, disk DB, workers, IPC or updater.
"use strict"
const fs = require("node:fs")
const path = require("node:path")
const { createHash } = require("node:crypto")
const FLAG = "--mov-session-runtime-probe"
const MiB = 1024 * 1024
const PUBLIC_CODES = new Set([
  "INVALID_PROBE_ARGUMENTS", "ELECTRON_MAIN_REQUIRED", "ELECTRON_API_UNAVAILABLE",
  "RUN_AS_NODE_REFUSED", "PACKAGED_MAC_REQUIRED", "EARLY_ENTRY_REQUIRED",
  "BUILTIN_SQLITE_UNAVAILABLE", "SQLITE_CAPABILITY_CHECK_FAILED", "SQLITE_CLOSE_FAILED",
  "RAW_ASAR_FS_UNAVAILABLE", "ARTIFACT_LAYOUT_UNREVIEWED", "ARTIFACT_UNSAFE",
  "ARTIFACT_TOO_LARGE", "ARTIFACT_CHANGED", "ARTIFACT_TIMEOUT", "ARTIFACT_CLOSE_FAILED",
  "ERR_SQLITE_ERROR", "ENOENT", "EACCES", "EPERM", "EIO", "EBADF", "ELOOP", "EMFILE", "ENOMEM"
])
function check(ok, code) { if (!ok) throw Object.assign(Error(code), { code }) }
function safeProblems(error, depth = 0) {
  if (depth < 4 && error instanceof AggregateError) return error.errors.slice(0, 8).flatMap(e => safeProblems(e, depth + 1))
  return [PUBLIC_CODES.has(error?.code) ? error.code : "PROBE_FAILED"]
}
function sqliteCapabilities() {
  let Database
  try { Database = require("node:sqlite").DatabaseSync } catch { check(false, "BUILTIN_SQLITE_UNAVAILABLE") }
  check(typeof Database === "function", "BUILTIN_SQLITE_UNAVAILABLE")
  let db, primary
  try {
    db = new Database(":memory:")
    db.exec("PRAGMA foreign_keys=ON; CREATE TABLE parent(id INTEGER PRIMARY KEY) STRICT; CREATE TABLE child(id INTEGER PRIMARY KEY,parent_id INTEGER REFERENCES parent(id)) STRICT; BEGIN IMMEDIATE; INSERT INTO parent VALUES(1); INSERT INTO child VALUES(1,1); COMMIT")
    let fk
    try { db.exec("INSERT INTO child VALUES(2,404)") } catch (error) { fk = error }
    check(fk?.errcode === 787, "SQLITE_CAPABILITY_CHECK_FAILED")
    db.exec("BEGIN IMMEDIATE; INSERT INTO parent VALUES(2); ROLLBACK")
    const scalar = sql => Object.values(db.prepare(sql).get())[0]
    check(scalar("SELECT count(*) FROM parent") === 1 && scalar("SELECT count(*) FROM child") === 1 && scalar("PRAGMA foreign_keys") === 1, "SQLITE_CAPABILITY_CHECK_FAILED")
    const version = scalar("SELECT sqlite_version()"), compileOptions = db.prepare("PRAGMA compile_options").all().map(r => Object.values(r)[0])
    check(typeof version === "string" && version === process.versions.sqlite && compileOptions.length <= 512 && compileOptions.every(x => typeof x === "string" && x.length <= 512), "SQLITE_CAPABILITY_CHECK_FAILED")
    return { available: true, version, compileOptions, memoryOnly: true, strictTables: true, foreignKeyRejection: true, transactionRollback: true }
  } catch (error) { primary = error; throw error }
  finally {
    if (db) try { db.close() } catch {
      const error = Object.assign(Error("SQLITE_CLOSE_FAILED"), { code: "SQLITE_CLOSE_FAILED" })
      throw primary ? new AggregateError([primary, error], "SQLite probe and close failed") : error
    }
  }
}
function rawHash(raw, filename, limit, deadline) {
  check(path.isAbsolute(filename) && path.normalize(filename) === filename && raw.realpathSync(filename) === filename, "ARTIFACT_LAYOUT_UNREVIEWED")
  let fd, primary
  try {
    fd = raw.openSync(filename, raw.constants.O_RDONLY | raw.constants.O_NOFOLLOW | raw.constants.O_NONBLOCK)
    const before = raw.fstatSync(fd, { bigint: true })
    check(before.isFile() && before.nlink === 1n, "ARTIFACT_UNSAFE")
    check(before.size > 0n && before.size <= BigInt(limit), "ARTIFACT_TOO_LARGE")
    const hash = createHash("sha256"), buffer = Buffer.alloc(256 * 1024)
    let offset = 0
    for (;;) {
      check(process.hrtime.bigint() <= deadline, "ARTIFACT_TIMEOUT")
      const n = raw.readSync(fd, buffer, 0, Math.min(buffer.length, limit + 1 - offset), offset)
      if (!n) break
      offset += n
      check(offset <= limit, "ARTIFACT_TOO_LARGE")
      hash.update(buffer.subarray(0, n))
    }
    const after = raw.fstatSync(fd, { bigint: true }), named = raw.lstatSync(filename, { bigint: true })
    check(named.isFile() && !named.isSymbolicLink() && named.nlink === 1n && BigInt(offset) === before.size &&
      [after, named].every(s => ["dev", "ino", "size", "mtimeNs", "ctimeNs"].every(k => s[k] === before[k])), "ARTIFACT_CHANGED")
    return { sha256: hash.digest("hex"), bytes: offset }
  } catch (error) { primary = error; throw error }
  finally {
    if (fd !== undefined) try { raw.closeSync(fd) } catch {
      const error = Object.assign(Error("ARTIFACT_CLOSE_FAILED"), { code: "ARTIFACT_CLOSE_FAILED" })
      throw primary ? new AggregateError([primary, error], "Artifact read and close failed") : error
    }
  }
}
function artifactIdentity(app) {
  const appPath = app.getAppPath()
  check(typeof process.resourcesPath === "string" && path.isAbsolute(process.resourcesPath) &&
    appPath === path.join(process.resourcesPath, "app.asar") &&
    __filename === path.join(appPath, "electron", "diagnostics", "sessionRuntimeProbe.cjs"), "ARTIFACT_LAYOUT_UNREVIEWED")
  let raw
  try { raw = require("original-fs") } catch { check(false, "RAW_ASAR_FS_UNAVAILABLE") }
  const deadline = process.hrtime.bigint() + 30_000_000_000n
  const identity = {
    executable: rawHash(raw, process.execPath, 256 * MiB, deadline),
    appAsar: rawHash(raw, appPath, 512 * MiB, deadline),
    logicalSources: {}, observedBytesNotLoadedCodeAttestation: true, fullRuntimeBundleHashed: false
  }
  // Electron's patched fs reads logical ASAR members. Never pretend raw fs can
  // open an interior member; the raw archive hash above identifies archive bytes.
  for (const [name, filename] of [["electron/main.cjs", path.join(appPath, "electron", "main.cjs")], ["electron/diagnostics/sessionRuntimeProbe.cjs", __filename]]) {
    const stat = fs.statSync(filename)
    check(Number.isSafeInteger(stat.size) && stat.size > 0 && stat.size <= 64 * 1024, "ARTIFACT_TOO_LARGE")
    const bytes = fs.readFileSync(filename)
    check(bytes.length === stat.size, "ARTIFACT_CHANGED")
    identity.logicalSources[name] = { sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length }
  }
  return identity
}
function run() {
  const report = {
    profile: "packaged-session-runtime-capability-candidate-v1",
    status: "blocked", evidenceClass: "unattested-capability-observation",
    runtime: { node: process.version, sqlite: process.versions.sqlite ?? null, electron: process.versions.electron ?? null,
      chrome: process.versions.chrome ?? null, processType: process.type ?? "node", platform: process.platform, arch: process.arch,
      runAsNode: process.env.ELECTRON_RUN_AS_NODE === "1", appIsPackaged: null, appWasReady: null },
    productionReady: false, storageQualificationPassed: false, productionAdapterImplemented: false,
    apfsVerified: false, hardwareFlushProven: false, powerLossProven: false,
    missingGates: ["actual-Mac-arm64-and-x64-records", "APFS-confirmation", "packaged-ownership-and-killed-owner-recovery",
      "packaged-useful-PCM-transaction-crash-matrix", "production-full-ledger-migration-backup-and-I/O-faults", "real-application-IPC-UI-audio-workflow"]
  }
  let app, exitCode = 2
  try {
    // Resolve app only to ensure even invalid diagnostic invocations terminate.
    if (process.versions.electron && process.type === "browser") {
      try { app = require("electron").app } catch { check(false, "ELECTRON_API_UNAVAILABLE") }
    }
    check(process.argv.length === 2 && process.argv[1] === FLAG, "INVALID_PROBE_ARGUMENTS")
    check(process.versions.electron && process.type === "browser", "ELECTRON_MAIN_REQUIRED")
    check(!report.runtime.runAsNode, "RUN_AS_NODE_REFUSED")
    check(app && typeof app.exit === "function", "ELECTRON_API_UNAVAILABLE")
    report.runtime.appIsPackaged = app.isPackaged
    report.runtime.appWasReady = app.isReady()
    check(app.isPackaged === true && process.platform === "darwin" && ["arm64", "x64"].includes(process.arch), "PACKAGED_MAC_REQUIRED")
    check(report.runtime.appWasReady === false, "EARLY_ENTRY_REQUIRED")
    report.sqlite = sqliteCapabilities()
    report.artifacts = artifactIdentity(app)
    report.status = "capability-only-pass"
    exitCode = 0
  } catch (error) { report.problems = safeProblems(error) }
  // Fixed stdout JSON only. No report path/SQL/script/command/worker arguments.
  // Synchronous write before app.exit; an output failure MUST exit nonzero.
  try { fs.writeSync(1, JSON.stringify(report) + "\n") } catch { exitCode = 1 }
  if (app && typeof app.exit === "function") app.exit(exitCode)
  else if (process.versions.electron && process.type === "browser") process.exit(1)
  else process.exitCode = exitCode
  return report
}
module.exports = Object.freeze({ run })
