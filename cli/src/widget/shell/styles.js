// Widget stylesheets: waiting for them to load, and re-fetching them on change.

/**
 * @param {HTMLLinkElement} link
 * @returns {Promise<void>}
 */
export function settled(link) {
  if (link.sheet) return Promise.resolve()
  return new Promise((resolve) => {
    link.addEventListener("load", () => resolve(), { once: true })
    link.addEventListener("error", () => resolve(), { once: true })
  })
}

/**
 * Re-fetch every same-origin stylesheet, page and shadow root alike, so edits
 * apply without a reload.
 * @param {ParentNode[]} scopes
 */
export function reloadStyles(scopes) {
  const stamp = String(Date.now())
  for (const scope of scopes) {
    for (const link of scope.querySelectorAll('link[rel~="stylesheet"]')) {
      if (!(link instanceof HTMLLinkElement)) continue
      const url = new URL(link.href, location.href)
      if (url.origin !== location.origin) continue
      url.searchParams.set("__docserve_rev", stamp)
      link.href = url.href
    }
  }
}
