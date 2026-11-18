import ICON_CHEVRON_RAW from "~icons/lucide/chevron-right?raw&width=16&height=16"
import { el, iconSvg } from "../../widget/lib/dom.js"
import type { CollapseSection } from "./sections.js"

const ICON_CHEVRON = iconSvg(ICON_CHEVRON_RAW)
const HIDDEN_CLASS = "docserve-collapse__hidden"
const SECTION_COLLAPSED_CLASS = "docserve-collapse__collapsed"

export function mountSections(sections: CollapseSection[], onToggle: (id: string) => void): () => void {
  const controller = new AbortController()

  for (const section of sections) {
    const button = el("button", {
      type: "button",
      class: "docserve-collapse__toggle",
      "data-collapse-toggle": "",
      "aria-expanded": "true",
      "aria-label": "Collapse section",
      title: "Collapse section",
      html: ICON_CHEVRON,
    }) as HTMLButtonElement

    button.addEventListener("click", () => onToggle(section.id), { signal: controller.signal })

    section.heading.classList.add("docserve-collapse__heading")
    section.heading.prepend(button)
    section.button = button
  }

  return () => {
    controller.abort()

    for (const section of sections) {
      section.button?.remove()
      section.button = undefined
      section.heading.classList.remove("docserve-collapse__heading")
      section.heading.parentElement?.classList.remove(SECTION_COLLAPSED_CLASS)
      for (const node of section.body) node.classList.remove(HIDDEN_CLASS)
    }
  }
}

export function applyState(sections: CollapseSection[], collapsed: string[], enabled: boolean): void {
  const collapsedIds = new Set(collapsed)
  const hidden = new Set<Element>()

  if (enabled) {
    for (const section of sections) {
      if (!collapsedIds.has(section.id)) continue
      for (const node of section.body) hidden.add(node)
    }
  }

  for (const section of sections) {
    for (const node of section.body)
      node.classList.toggle(HIDDEN_CLASS, enabled && hidden.has(node))

    section.heading.classList.toggle("docserve-collapse__heading", enabled)

    const parent = section.heading.parentElement
    if (!enabled)
      parent?.classList.remove(SECTION_COLLAPSED_CLASS)
    else if (parent?.tagName === "SECTION" && isSectionHead(section.heading))
      parent.classList.toggle(SECTION_COLLAPSED_CLASS, collapsedIds.has(section.id))

    const button = section.button
    if (!button) continue

    const open = !collapsedIds.has(section.id)
    const label = open ? "Collapse section" : "Expand section"
    button.setAttribute("aria-expanded", String(open))
    button.title = label
    button.setAttribute("aria-label", label)
  }
}

function isSectionHead(heading: HTMLHeadingElement): boolean {
  let node = heading.previousElementSibling
  while (node) {
    if (/^H[1-6]$/.test(node.tagName)) return false
    node = node.previousElementSibling
  }
  return true
}
