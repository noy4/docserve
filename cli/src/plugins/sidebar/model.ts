import { signal } from "@preact/signals-react"
import { persisted, persistedBool } from "../../widget/lib/persisted-signal.js"

export type SidebarView = "list" | "gallery"
export type SidebarGrouping = "none" | "month"
export type SidebarStatus = "loading" | "ready" | "error"

export interface SidebarModelOptions {
  rpc: RpcContext
}

export class SidebarModel {
  readonly pages = signal<DocPage[]>([])
  readonly status = signal<SidebarStatus>("loading")
  readonly view = persisted<SidebarView>("docserve:sidebar:view", "list")
  readonly grouping = persisted<SidebarGrouping>("docserve:sidebar:grouping", "month")
  readonly open = persistedBool("docserve:sidebar:open")

  #rpc: RpcContext
  #request = 0

  constructor(options: SidebarModelOptions) {
    this.#rpc = options.rpc
  }

  setView(next: SidebarView): void {
    this.view.value = next
  }

  toggleView(): void {
    this.setView(this.view.value === "list" ? "gallery" : "list")
  }

  setGrouping(next: SidebarGrouping): void {
    this.grouping.value = next
  }

  toggleGrouping(): void {
    this.setGrouping(this.grouping.value === "month" ? "none" : "month")
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
