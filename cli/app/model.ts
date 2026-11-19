import { signal } from "@preact/signals-react"
import { connectLive } from "../src/widget/live.js"
import { callServer } from "../src/widget/rpc-client.js"

export type GalleryStatus = "loading" | "ready" | "error"

const SERVERS_REFRESH_MS = 5000

export class GalleryModel {
  readonly pages = signal<DocPage[]>([])
  readonly status = signal<GalleryStatus>("loading")
  readonly servers = signal<DocServer[]>([])
  readonly docs = readDocsInfo()
  readonly serversOpen = signal(false)

  #request = 0
  #serversRequest = 0
  #live: { close: () => void } | null = null
  #serversTimer: ReturnType<typeof setInterval> | null = null
  #onVisibility: (() => void) | null = null

  subscribe(): () => void {
    this.#live = connectLive({
      onOpen: () => {
        this.load({ force: true })
        this.loadServers({ force: true })
      },
      onMessage: (message) => this.#onMessage(message),
    })

    this.#onVisibility = () => {
      if (!document.hidden && this.serversOpen.value) this.loadServers({ force: true })
    }
    document.addEventListener("visibilitychange", this.#onVisibility)

    this.load()
    this.loadServers()

    return () => {
      this.#live?.close()
      this.#live = null
      if (this.#onVisibility) {
        document.removeEventListener("visibilitychange", this.#onVisibility)
        this.#onVisibility = null
      }
      this.#stopServersPoll()
    }
  }

  /** Open/close the Running menu; polling only runs while it is open. */
  setServersOpen(open: boolean): void {
    if (this.serversOpen.value === open) return
    this.serversOpen.value = open
    if (open) {
      this.loadServers({ force: true })
      this.#startServersPoll()
    } else {
      this.#stopServersPoll()
    }
  }

  async load({ force = false }: { force?: boolean } = {}): Promise<void> {
    const id = ++this.#request
    if (!this.pages.value.length) this.status.value = "loading"

    try {
      const result = await callServer("docserve:pages:list", force ? [{ force: true }] : [])
      if (id !== this.#request) return
      this.pages.value = Array.isArray(result) ? (result as DocPage[]) : []
      this.status.value = "ready"
    } catch {
      if (id !== this.#request) return
      this.status.value = "error"
    }
  }

  async loadServers({ force = false }: { force?: boolean } = {}): Promise<void> {
    const id = ++this.#serversRequest

    try {
      const result = await callServer("docserve:servers:list", force ? [true] : [])
      if (id !== this.#serversRequest) return
      const servers = Array.isArray(result) ? (result as DocServer[]) : []
      this.servers.value = servers
    } catch { }
  }

  #startServersPoll(): void {
    if (this.#serversTimer) return
    this.#serversTimer = setInterval(() => this.loadServers({ force: true }), SERVERS_REFRESH_MS)
  }

  #stopServersPoll(): void {
    if (!this.#serversTimer) return
    clearInterval(this.#serversTimer)
    this.#serversTimer = null
  }

  #onMessage(message: LiveMessage): void {
    if (message.type !== "change") return
    if (message.templateChanged) {
      location.reload()
      return
    }
    if (message.contentSetChanged || message.pages.length) this.load({ force: true })
  }
}
/** Folder identity written into the shell's `#app` dataset by the server. */
function readDocsInfo(): DocsInfo | undefined {
  const host = document.getElementById("app")
  if (!host) return undefined
  const name = host.dataset.docsName || ""
  const path = host.dataset.docsPath || ""
  if (!name && !path) return undefined
  const hue = Number(host.dataset.docsHue)
  return { name: name || path, path: path || name, hue: Number.isFinite(hue) ? hue : 0 }
}
