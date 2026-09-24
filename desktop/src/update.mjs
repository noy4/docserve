// Checks GitHub Releases for a newer version. The build is unsigned, so there
// is no auto-update (electron-updater requires signing) — the tray shows a
// "New version available" item that opens the release page instead.
const REPO = "noy4/docserve"

export async function latestRelease() {
  try {
    // The repo also publishes CLI releases (cli-v*); only desktop releases
    // are compared against the app version.
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=20`, {
      headers: { "User-Agent": "docserve-desktop", Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const releases = await res.json()
    const release = (Array.isArray(releases) ? releases : [])
      .find((r) => !r.draft && !r.prerelease && !/^cli-v/.test(String(r?.tag_name ?? "")))
    if (!release) return null
    return { version: String(release.tag_name).replace(/^v/, ""), url: release.html_url }
  } catch {
    return null
  }
}

export function isNewer(release, current) {
  const a = release.split(".").map(Number)
  const b = current.split(".").map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false
  }
  return false
}
