(() => {
  const nav = document.getElementById("toc")
  if (!nav) return

  const offset = 96
  const range = resolveRange(parseOutline(nav.dataset.outline))

  const headings = [...document.querySelectorAll(".container :is(h1, h2, h3, h4, h5, h6)")].filter((h) => {
    if (!range || !h.hasChildNodes()) return false
    const level = Number(h.tagName[1])
    return level >= range[0] && level <= range[1]
  })
  if (headings.length < 2) return

  const seen = {}
  for (const h of headings) {
    if (h.id) continue
    const slug = h.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    seen[slug] = (seen[slug] ?? 0) + 1
    h.id = seen[slug] > 1 ? `${slug}-${seen[slug]}` : slug
  }

  const marker = el("div", { class: "toc-marker" })
  nav.append(
    el("div", { class: "toc-title", text: "On this page" }),
    el("div", { class: "toc-content" }, [marker, list(buildTree(headings))]),
  )

  const links = new Map([...nav.querySelectorAll("a")].map((a) => [a.getAttribute("href").slice(1), a]))
  const update = () => {
    let current = headings[0]
    for (const h of headings) {
      if (h.getBoundingClientRect().top <= offset) current = h
    }
    for (const a of links.values()) a.classList.remove("active")
    const active = links.get(current.id)
    active?.classList.add("active")
    marker.style.opacity = active ? "1" : "0"
    if (active) marker.style.top = `${active.offsetTop + (active.offsetHeight - marker.offsetHeight) / 2}px`
  }
  addEventListener("scroll", update, { passive: true })
  update()

  // ---

  // nav[data-outline] — "2,3" | "2" | "deep" | "false" · default [2, 3]
  function parseOutline(value) {
    if (value == null) return [2, 3]
    if (value === "deep") return "deep"
    if (value === "false") return false
    const levels = value.split(",").map(Number)
    return levels.length > 1 ? levels : levels[0]
  }

  // VitePress theme.outline equivalent — number | [min, max] | "deep" | false
  function resolveRange(outline) {
    if (outline === false) return null
    const v = (typeof outline === "object" && !Array.isArray(outline) ? outline.level : outline) ?? 2
    return typeof v === "number" ? [v, v] : v === "deep" ? [2, 6] : v
  }

  function link(element) {
    const a = el("a", {
      href: `#${element.id}`,
      html: element.innerHTML,
      onclick: (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        e.preventDefault()
        element.scrollIntoView({ behavior: "smooth" })
        history.replaceState(null, "", `#${element.id}`)
      },
    })
    a.querySelector("iconify-icon")?.removeAttribute("width")
    return a
  }

  function list(nodes) {
    return el(
      "ul",
      {},
      nodes.map((node) =>
        el("li", {}, [link(node.element), ...(node.children.length ? [list(node.children)] : [])]),
      ),
    )
  }

  function buildTree(headings) {
    const roots = []
    const stack = []
    for (const element of headings) {
      const node = { element, level: Number(element.tagName[1]), children: [] }
      while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop()
      if (stack.length) stack[stack.length - 1].children.push(node)
      else roots.push(node)
      stack.push(node)
    }
    return roots
  }

  // https://github.com/cloudflare/cloudflare-os/blob/main/packages/bundled-blueprints/libraries/ui/src/dom.ts
  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag)
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue
      if (key === "class") node.className = value
      else if (key === "text") node.textContent = value
      else if (key === "html") node.innerHTML = value
      else if (key === "style" && typeof value === "object") Object.assign(node.style, value)
      else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value)
      else node.setAttribute(key, value === true ? "" : String(value))
    }
    for (const child of Array.isArray(children) ? children : [children]) {
      if (child == null || child === false) continue
      node.append(child)
    }
    return node
  }
})()
