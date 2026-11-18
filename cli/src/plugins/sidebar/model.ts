import { signal } from "@preact/signals-react"

export type SidebarView = "list" | "gallery"
export type SidebarStatus = "loading" | "ready" | "error"

export interface SidebarModelOptions {
  rpc: RpcBus
  view?: SidebarView
  open?: boolean
  onViewChange?: (view: SidebarView) => void
}

export class SidebarModel {
  readonly pages = signal<DocPage[]>([])
  readonly status = signal<SidebarStatus>("loading")
  readonly view = signal<SidebarView>("list")
  readonly open = signal(false)

  #rpc: RpcBus
  #request = 0
  #onViewChange: ((view: SidebarView) => void) | undefined

  constructor(options: SidebarModelOptions) {
    this.#rpc = options.rpc
    this.view.value = options.view ?? "list"
    this.open.value = options.open ?? false
    this.#onViewChange = options.onViewChange
  }

  setView(next: SidebarView): void {
    const view: SidebarView = next === "gallery" ? "gallery" : "list"
    if (view === this.view.value) return
    this.view.value = view
    this.#onViewChange?.(view)
  }

  toggleView(): void {
    this.setView(this.view.value === "list" ? "gallery" : "list")
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
