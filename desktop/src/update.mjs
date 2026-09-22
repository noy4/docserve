// Checks GitHub Releases for a newer version. The build is unsigned, so there
// is no auto-update (electron-updater requires signing) — the tray shows a
// "New version available" item that opens the release page instead.
const REPO = "noy4/docserve"

export async function latestRelease() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { "User-Agent": "docserve-desktop", Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const { tag_name, html_url } = await res.json()
    return { version: String(tag_name).replace(/^v/, ""), url: html_url }
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
