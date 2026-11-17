// Dock toggle plus a left panel that lists every page, as rows or preview cards.
import { decoded, displayDate, el, icon, pageUrl } from "../../widget/lib/dom.js"
import { persisted, persistedFlag } from "../../widget/lib/storage.js"

const ICON_SIDEBAR = icon('<rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" />')
const ICON_GRID = icon('<rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />')
const ICON_LIST = icon('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />')
const ICON_FOLDER =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.1 10L4 18V8h17a2 2 0 0 0-2-2h-7l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h15c.9 0 1.7-.6 1.9-1.5l2.3-8.5zM19 18H6l1.6-6h13z"/></svg>'

const THUMB_W = 960
const MAX_PREVIEWS = 2

/**
 * @returns {DocservePlugin}
 */
export function sidebarPlugin() {
  return {
    id: "sidebar",
    setup(ctx) {
      const openState = persistedFlag("docserve:sidebar:open")
      const viewState = persisted("docserve:sidebar:view", /** @type {"list" | "gallery"} */ ("list"))
      /** @type {"list" | "gallery"} */
      let view = viewState.value
      /** @type {DocPage[]} */
      let pages = []
      /** @type {HTMLElement | null} */
      let activeItem = null
      let request = 0

      const name = el("span", {
        class: "docserve-sidebar__name",
        text: ctx.docs?.name || "Pages",
        title: ctx.docs?.name || "Pages",
      })
      const docsPath = el("code", {
        class: "docserve-sidebar__path",
        text: ctx.docs?.path || "",
        title: ctx.docs?.path || "",
      })
      const files = el("span", { class: "docserve-sidebar__files" })
      const listButton = el("button", {
        type: "button",
        class: "docserve-sidebar__view",
        "aria-label": "List view",
        title: "List view",
        html: ICON_LIST,
        onclick: () => setView("list"),
      })
      const galleryButton = el("button", {
        type: "button",
        class: "docserve-sidebar__view",
        "aria-label": "Gallery view",
        title: "Gallery view",
        html: ICON_GRID,
        onclick: () => setView("gallery"),
      })
      const homeLink = el("a", { class: "docserve-sidebar__home", href: "/", title: "Open gallery" }, [
        el("span", { class: "docserve-sidebar__icon", html: ICON_FOLDER }),
        name,
      ])
      const viewTabs = el("div", { class: "docserve-sidebar__views", role: "group", "aria-label": "View" }, [
        listButton,
        galleryButton,
      ])
      const closeButton = el("button", {
        type: "button",
        class: "docserve-sidebar__close",
        "aria-label": "Close sidebar",
        title: "Close sidebar",
        html: ICON_SIDEBAR,
        onclick: () => setOpen(false),
      })
      const sub = el("div", { class: "docserve-sidebar__sub" }, [docsPath, files, viewTabs])
      docsPath.hidden = !ctx.docs
      const list = el("nav", { class: "docserve-sidebar__list", "aria-label": "Pages" })
      const element = el("aside", { class: "docserve-sidebar", "aria-label": ctx.docs?.name || "Pages" }, [
        el("header", { class: "docserve-sidebar__head" }, [
          el("div", { class: "docserve-sidebar__title" }, [
            homeLink,
            closeButton,
          ]),
          sub,
        ]),
        list,
      ])
      element.dataset.view = view
      if (ctx.docs) element.style.setProperty("--docserve-sidebar-hue", String(ctx.docs.hue))
      syncViewButtons()
      list.append(el("p", { class: "docserve-sidebar__empty", text: "Loading…" }))

      ctx.ui.style("/__docserve/plugins/sidebar/sidebar.css")

      const panel = ctx.ui.panel({
        side: "left",
        width: "min(280px, 86vw)",
        open: openState.value,
        element,
      })

      const previews = createPreviews(list)
      const resize = new ResizeObserver(() => previews.fit())
      resize.observe(list)

      const offToggle = ctx.commands.register({
        id: "plugin:sidebar:toggle",
        title: "Toggle sidebar",
        group: "View",
        icon: ICON_SIDEBAR,
        keys: ["[", "Alt+B"],
        run: () => setOpen(!panel.isOpen()),
      })

      const offClose = ctx.commands.register({
        id: "plugin:sidebar:close",
        title: "Close sidebar",
        keys: ["Escape"],
        showInPalette: false,
        when: () => panel.isOpen(),
        run: () => setOpen(false),
      })

      const offView = ctx.commands.register({
        id: "plugin:sidebar:view",
        title: "Toggle sidebar view",
        group: "View",
        icon: ICON_GRID,
        keys: ["v"],
        when: () => panel.isOpen(),
        run: () => setView(view === "list" ? "gallery" : "list"),
      })

      const item = ctx.dock.add({
        id: "sidebar",
        label: "Toggle sidebar",
        icon: ICON_SIDEBAR,
        group: "main",
        command: "plugin:sidebar:toggle",
        isActive: () => panel.isOpen(),
      })

      const offChange = ctx.on("change", (change) => {
        if (change.pages.length || change.contentSetChanged) load(true)
      })
      const offOpen = ctx.on("open", () => load(true))
      const offStart = ctx.on("start", () => {
        if (panel.isOpen()) scrollActive()
      })

      load()
      scrollActive()

      return () => {
        offToggle()
        offClose()
        offView()
        offChange()
        offOpen()
        offStart()
        item.remove()
        panel.remove()
        resize.disconnect()
        previews.reset()
      }

      /**
       * @param {boolean} next
       */
      function setOpen(next) {
        panel.setOpen(next)
        item.update()
        openState.value = next
        if (!next) return
        if (view === "gallery") previews.fit()
        scrollActive()
      }

      /**
       * @param {"list" | "gallery"} next
       */
      function setView(next) {
        view = next === "gallery" ? "gallery" : "list"
        viewState.value = view
        element.dataset.view = view
        syncViewButtons()
        render()
      }

      function syncViewButtons() {
        listButton.setAttribute("aria-pressed", String(view === "list"))
        galleryButton.setAttribute("aria-pressed", String(view === "gallery"))
      }

      /**
       * @param {boolean} [force]
       */
      async function load(force = false) {
        const id = ++request
        try {
          pages = /** @type {DocPage[]} */ (await ctx.rpc.call("docserve:pages:list", { force }))
          if (id === request) render()
        } catch {
          if (id === request) renderError()
        }
      }

      function render() {
        files.textContent = `${pages.length} ${pages.length === 1 ? "file" : "files"}`
        viewTabs.style.display = pages.length ? "" : "none"
        const scrollTop = list.scrollTop
        list.replaceChildren()
        previews.reset()
        activeItem = null

        if (!pages.length) {
          list.append(el("p", { class: "docserve-sidebar__empty", text: "No pages" }))
          return
        }

        const target = pageUrl(ctx.page)
        for (const page of pages) {
          const link = view === "gallery" ? galleryCard(page, target) : listRow(page, target)
          list.append(link)
        }

        list.scrollTop = scrollTop
        if (view === "gallery") previews.fit()
        if (panel.isOpen()) scrollActive()
      }

      /**
       * @param {DocPage} page
       * @param {string} target
       */
      function listRow(page, target) {
        const link = el("a", {
          class: "docserve-sidebar__item",
          href: page.url,
          title: page.title,
          "aria-current": isActive(page, target) ? "page" : null,
        }, [
          el("span", { class: "docserve-sidebar__title" }, [
            page.favicon
              ? el("img", {
                class: "docserve-sidebar__favicon",
                src: page.favicon,
                alt: "",
                loading: "lazy",
                onerror: (e) => e.currentTarget.remove(),
              })
              : null,
            el("span", { text: pageLabel(page) }),
          ]),
          el("span", { class: "docserve-sidebar__date", text: displayDate(page.created) }),
        ])
        if (isActive(page, target)) activeItem = link
        return link
      }

      /**
       * @param {DocPage} page
       * @param {string} target
       */
      function galleryCard(page, target) {
        const thumb = el("div", { class: "docserve-sidebar__thumb" }, [
          el("iframe", { tabindex: -1, title: pageLabel(page), "data-src": page.url }),
        ])
        previews.watch(thumb)

        const active = isActive(page, target)
        const card = el("a", {
          class: "docserve-sidebar__card",
          href: page.url,
          title: page.title,
          "aria-current": active ? "page" : null,
        }, [
          thumb,
          el("div", { class: "docserve-sidebar__meta" }, [
            el("div", { class: "docserve-sidebar__card-title" }, [
              page.favicon
                ? el("img", {
                  class: "docserve-sidebar__favicon",
                  src: page.favicon,
                  alt: "",
                  loading: "lazy",
                  onerror: (e) => e.currentTarget.remove(),
                })
                : null,
              el("span", { text: pageLabel(page) }),
            ]),
            el("div", { class: "docserve-sidebar__card-date", text: displayDate(page.created) }),
          ]),
        ])
        if (active) activeItem = card
        return card
      }

      function renderError() {
        files.textContent = ""
        viewTabs.style.display = "none"
        activeItem = null
        previews.reset()
        list.replaceChildren(el("div", { class: "docserve-sidebar__empty" }, [
          el("p", { text: "Could not load pages" }),
          el("button", { type: "button", class: "docserve-sidebar__retry", text: "Retry", onclick: () => load(true) }),
        ]))
      }

      function scrollActive() {
        activeItem?.scrollIntoView({ block: "nearest" })
      }

      /**
       * @param {DocPage} page
       * @param {string} target
       * @returns {boolean}
       */
      function isActive(page, target) {
        return page.url === target || decoded(page.url) === `/${ctx.page}`
      }
    },
  }
}

/**
 * @param {DocPage} page
 * @returns {string}
 */
function pageLabel(page) {
  return page.title || decoded(page.url)
}

/**
 * Lazy iframe previews for the gallery view: observed against the scrolling
 * list, at most MAX_PREVIEWS loading at once.
 * @param {HTMLElement} root
 */
function createPreviews(root) {
  const queue = []
  let active = 0

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      observer.unobserve(entry.target)
      const iframe = entry.target.querySelector("iframe")
      const src = iframe?.getAttribute("data-src")
      if (iframe && src) {
        queue.push({ iframe, src })
        pump()
      }
    }
  }, { root, rootMargin: "150px" })

  function pump() {
    while (active < MAX_PREVIEWS && queue.length) {
      const item = queue.shift()
      if (!item || !item.iframe.isConnected) continue
      active++
      item.iframe.addEventListener("load", () => {
        active = Math.max(0, active - 1)
        pump()
      }, { once: true })
      item.iframe.src = item.src
    }
  }

  return {
    /** @param {HTMLElement} thumb */
    watch(thumb) {
      observer.observe(thumb)
    },
    fit() {
      for (const thumb of root.querySelectorAll(".docserve-sidebar__thumb")) {
        const iframe = thumb.querySelector("iframe")
        if (!iframe || !thumb.clientWidth) continue
        const scale = thumb.clientWidth / THUMB_W
        iframe.style.width = `${THUMB_W}px`
        iframe.style.height = `${Math.round(thumb.clientHeight / scale)}px`
        iframe.style.transform = `scale(${scale})`
      }
    },
    reset() {
      observer.disconnect()
      queue.length = 0
      active = 0
    },
  }
}
