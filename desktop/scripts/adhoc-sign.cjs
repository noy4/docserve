// afterPack hook: ad-hoc sign the packaged app.
//
// Apple Silicon requires every binary to be at least ad-hoc signed, and the
// Info.plist rewrite below invalidates Electron's prebuilt ad-hoc signature —
// unsigned/broken bundles are reported as "damaged" by macOS. Re-signing the
// whole bundle with the ad-hoc identity fixes both.
const { execSync } = require("node:child_process")

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return
  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`
  execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: "inherit" })
  execSync(`codesign --verify --deep --strict "${appPath}"`, { stdio: "inherit" })
}
