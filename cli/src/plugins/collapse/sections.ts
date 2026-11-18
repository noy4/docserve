import { collectHeadings, ensureIds, findRoot } from "../../widget/lib/headings.js"

export interface CollapseSection {
  id: string
  heading: HTMLHeadingElement
  level: number
  body: Element[]
  button?: HTMLButtonElement
  parent: CollapseSection | null
}

export interface CollapseCollect {
  sections: CollapseSection[]
  wrappers: HTMLElement[]
}

const EXCLUDED = "nav, aside, header, footer, [data-collapse-ignore], #docserve-dock-host, [data-docserve-widget]"
const DEFAULT_LEVELS: [number, number] = [2, 4]
const SKIP = new Set(["SCRIPT", "STYLE", "LINK", "TEMPLATE", "NOSCRIPT"])

export function collectSections(doc: Document = document): CollapseCollect {
  const source = doc.body ?? doc.documentElement
  if (!source) return { sections: [], wrappers: [] }

  const root = findRoot(doc, "data-collapse-root")
  if (!root) return { sections: [], wrappers: [] }
  if ((root.getAttribute("data-collapse") ?? source.getAttribute("data-collapse")) === "false")
    return { sections: [], wrappers: [] }

  const raw = root.getAttribute("data-collapse-levels") ?? source.getAttribute("data-collapse-levels")
  const range = parseLevels(raw)
  if (!range) return { sections: [], wrappers: [] }

  const headings = collectHeadings(root, range, EXCLUDED)
  ensureIds(headings, doc)

  const wrappers: HTMLElement[] = []
  const sections: CollapseSection[] = headings
    .map((heading) => ({
      id: heading.id,
      heading,
      level: Number(heading.tagName[1]),
      body: bodyNodes(heading, wrappers, doc),
      parent: null,
    }))
    .filter((section) => section.body.length)

  const stack: CollapseSection[] = []
  for (const section of sections) {
    while (stack.length && stack[stack.length - 1].level >= section.level) stack.pop()
    section.parent = stack[stack.length - 1] ?? null
    stack.push(section)
  }

  return { sections, wrappers }
}

function parseLevels(value: string | null | undefined): [number, number] | null {
  if (value === "false") return null
  if (!value || value.trim() === "") return [...DEFAULT_LEVELS]
  if (value === "deep") return [2, 6]

  const parts = value.split(/[,-]/).map((part) => Number(part.trim())).filter(Number.isFinite)
  if (!parts.length) return [...DEFAULT_LEVELS]

  const min = clampLevel(parts[0])
  const max = clampLevel(parts.length > 1 ? parts[1] : parts[0])
  return min <= max ? [min, max] : [max, min]
}

function clampLevel(value: number): number {
  return Math.min(6, Math.max(1, Math.round(value)))
}

function bodyNodes(heading: HTMLHeadingElement, wrappers: HTMLElement[], doc: Document): Element[] {
  const level = Number(heading.tagName[1])
  const nodes: Element[] = []

  let node = heading.nextSibling
  while (node) {
    const next = node.nextSibling

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      if (element.matches("#docserve-dock-host, [data-docserve-widget]")) break
      if (/^H[1-6]$/.test(element.tagName) && Number(element.tagName[1]) <= level) break
      if (SKIP.has(element.tagName) || element.matches("[data-collapse-ignore]")) {
        node = next
        continue
      }
      nodes.push(element)
    } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      const wrapper = doc.createElement("span")
      wrapper.className = "docserve-collapse__text"
      node.replaceWith(wrapper)
      wrapper.append(node)
      wrappers.push(wrapper)
      nodes.push(wrapper)
    }

    node = next
  }

  return nodes
}
