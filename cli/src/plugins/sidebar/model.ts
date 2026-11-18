import { signal } from "@preact/signals-react"
import { persisted, persistedBool } from "../../widget/lib/persisted-signal.js"
import { ResizeModel } from "./resize-model.js"
import { TreeModel } from "./tree-model.js"

export type SidebarView = "list" | "gallery" | "tree"
export type SidebarGrouping = "none" | "month" | "folder"
export type SidebarStatus = "loading" | "ready" | "error"

export interface SidebarModelOptions {
  rpc: RpcContext
  docs?: DocsInfo
  currentPage: string
}

export class SidebarModel {
  readonly docs?: DocsInfo
  readonly currentPage: string
  readonly pages = signal<DocPage[]>([])
  readonly status = signal<SidebarStatus>("loading")
  readonly view = persisted<SidebarView>("docserve:sidebar:view", "list")
  readonly grouping = persisted<SidebarGrouping>("docserve:sidebar:grouping", "month")
  readonly tree = new TreeModel(this.pages)
  readonly resizer = new ResizeModel()
  readonly open = persistedBool("docserve:sidebar:open")

  #rpc: RpcContext
  #request = 0

  constructor(options: SidebarModelOptions) {
    this.#rpc = options.rpc
    this.docs = options.docs
    this.currentPage = options.currentPage
  }

  static fromContext(ctx: DocserveContext): SidebarModel {
    return new SidebarModel({
      rpc: ctx.rpc,
      docs: ctx.docs,
      currentPage: ctx.page,
    })
  }

  setView(next: SidebarView): void {
    this.view.value = next
  }

  toggleView(): void {
    this.setView(nextView(this.view.value))
  }

  setGrouping(next: SidebarGrouping): void {
    this.grouping.value = next
  }

  toggleGrouping(): void {
    this.setGrouping(nextGrouping(this.grouping.value))
  }

  setOpen(next: boolean): void {
    this.open.value = next
  }

  async load({ force = false }: { force?: boolean } = {}): Promise<void> {
    const id = ++this.#request
    if (!this.pages.value.length) this.status.value = "loading"

    try {
      const result = await this.#rpc.call("docserve:pages:list", { force })
      if (id !== this.#request) return
      this.pages.value = Array.isArray(result) ? (result as DocPage[]) : []
      this.status.value = "ready"
    } catch {
      if (id !== this.#request) return
      this.status.value = "error"
    }
  }
}

const VIEWS: SidebarView[] = ["list", "gallery", "tree"]
const GROUPINGS: SidebarGrouping[] = ["none", "month", "folder"]

function nextView(current: SidebarView): SidebarView {
  const index = VIEWS.indexOf(current)
  return VIEWS[(index + 1) % VIEWS.length]
}

function nextGrouping(current: SidebarGrouping): SidebarGrouping {
  const index = GROUPINGS.indexOf(current)
  return GROUPINGS[(index + 1) % GROUPINGS.length]
}
