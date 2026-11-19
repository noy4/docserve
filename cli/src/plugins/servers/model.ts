import { signal } from "@preact/signals-react"

export type ServersStatus = "idle" | "loading" | "ready" | "error"

export interface ServersPosition {
  left: number
  top: number
}

export class ServersModel {
  readonly open = signal(false)
  readonly servers = signal<DocServer[]>([])
  readonly status = signal<ServersStatus>("idle")
  readonly error = signal<string | null>(null)
  readonly position = signal<ServersPosition | null>(null)

  #rpc: RpcContext
  #anchor: HTMLElement | null = null
  #timer: ReturnType<typeof setInterval> | null = null
  #request = 0

  constructor(rpc: RpcContext) {
    this.#rpc = rpc
  }

  static fromContext(ctx: DocserveContext): ServersModel {
    return new ServersModel(ctx.rpc)
  }

  setAnchor(element: HTMLElement | null): void {
    this.#anchor = element
    this.layout()
  }

  toggle(): void {
    this.setOpen(!this.open.value)
  }

  setOpen(next: boolean): void {
    this.open.value = next
    if (!next) {
      this.#stopPolling()
      return
    }

    this.layout()
    requestAnimationFrame(() => {
      if (this.open.value) this.layout()
    })
    this.load({ force: true })
    this.#startPolling()
  }

  close(): void {
    this.setOpen(false)
  }

  async load({ force = false }: { force?: boolean } = {}): Promise<void> {
    const id = ++this.#request
    if (!this.servers.value.length) this.status.value = "loading"
    this.error.value = null

    try {
      const result = await this.#rpc.call("docserve:servers:list", { force })
      if (id !== this.#request) return
      this.servers.value = Array.isArray(result) ? (result as DocServer[]) : []
      this.status.value = "ready"
    } catch (err) {
      if (id !== this.#request) return
      this.error.value = err instanceof Error ? err.message : String(err)
      this.status.value = "error"
    }
  }

  layout(): void {
    const anchor = this.#anchor
    if (!anchor || !this.open.value) return

    const rect = anchor.getBoundingClientRect()
    const width = 220
    const margin = 10
    const maxLeft = Math.max(margin, window.innerWidth - width - margin)
    const left = Math.min(Math.max(margin, rect.left + rect.width / 2 - width / 2), maxLeft)
    const top = Math.max(margin, rect.top - margin)
    this.position.value = { left, top }
  }

  dispose(): void {
    this.#stopPolling()
    this.#anchor = null
    this.#request++
  }

  #startPolling(): void {
    this.#stopPolling()
    this.#timer = setInterval(() => {
      this.load({ force: true })
    }, 5000)
  }

  #stopPolling(): void {
    if (!this.#timer) return
    clearInterval(this.#timer)
    this.#timer = null
  }
}
