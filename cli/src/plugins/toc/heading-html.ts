const BLOCKED = [
  "script",
  "style",
  "link",
  "iframe",
  "object",
  "embed",
  "button",
  "input",
  "select",
  "textarea",
  "template",
]

export function headingHtml(element: HTMLHeadingElement): string {
  const clone = element.cloneNode(true) as HTMLElement

  for (const node of [clone, ...clone.querySelectorAll("*")]) {
    node.removeAttribute("id")
    node.removeAttribute("tabindex")
    node.removeAttribute("contenteditable")
    for (const attribute of [...node.attributes]) {
      if (attribute.name.toLowerCase().startsWith("on"))
        node.removeAttribute(attribute.name)
    }
  }

  for (const anchor of [...clone.querySelectorAll("a")])
    anchor.replaceWith(...anchor.childNodes)

  for (const blocked of clone.querySelectorAll(BLOCKED.join(",")))
    blocked.remove()

  for (const icon of clone.querySelectorAll("iconify-icon, svg, img")) {
    icon.removeAttribute("width")
    icon.removeAttribute("height")
  }

  return clone.innerHTML
}
