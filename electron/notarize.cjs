// MusicOnVerse — electron-builder afterSign hook.
// Notarizes the signed .app with @electron/notarize and staples the ticket.
// Credentials come from the environment (never from files in this repo):
//   API-key style:   APPLE_API_KEY (path to .p8)  APPLE_API_KEY_ID  APPLE_API_ISSUER
//   Apple-ID style:  APPLE_ID  APPLE_APP_SPECIFIC_PASSWORD  APPLE_TEAM_ID
"use strict"

const { notarize } = require("@electron/notarize")
const { execFileSync } = require("node:child_process")
const path = require("node:path")

module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== "darwin") return
  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)

  // Gate 1: signatures only happen when signing credentials are set.
  const hasApiCreds =
    process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER
  const hasAppleIdCreds =
    process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID
  if (!hasApiCreds && !hasAppleIdCreds) {
    console.log("[notarize] skipping — no notarization credentials in the environment")
    return
  }

  // Gate 2: the app must actually be signed with a Developer ID Application cert.
  let sig = ""
  try {
    sig = execFileSync("codesign", ["-dv", "--verbose=4", appPath], { stdio: "pipe" }).toString()
  } catch (err) {
    console.log("[notarize] skipping — app is not codesigned", err.message)
    return
  }
  if (!sig.includes("Developer ID Application")) {
    console.log("[notarize] skipping — app signature is not a Developer ID Application cert")
    return
  }

  console.log(`[notarize] submitting ${appPath} to Apple...`)
  await notarize({ appPath })
  console.log("[notarize] approved by Apple — stapling ticket into the app")
  execFileSync("xcrun", ["stapler", "staple", appPath], { stdio: "inherit" })
  console.log("[notarize] ticket stapled")
}
