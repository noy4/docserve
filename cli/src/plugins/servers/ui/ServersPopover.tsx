import { useEffect } from "react"
import type { ServersModel } from "../model.js"

export interface ServersPopoverProps {
  model: ServersModel
}

export function ServersPopover({ model }: ServersPopoverProps) {
  const open = model.open.value
  const position = model.position.value
  const servers = model.servers.value
  const status = model.status.value
  const error = model.error.value

  useEffect(() => {
    if (!open) return
    const update = () => model.layout()
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
    }
  }, [open, model])

  if (!open || !position) return null

  const note = status === "error"
    ? error ?? "Could not load servers"
    : status === "loading"
      ? "Loading…"
      : "No running servers"

  return (
    <section
      className="docserve-servers"
      style={{ left: `${position.left}px`, top: `${position.top}px` }}
      role="dialog"
      aria-label="Running servers"
    >
      <header className="docserve-servers__head">
        <span>Running</span>
        <span className="docserve-servers__count">({servers.length})</span>
      </header>
      <div className="docserve-servers__list">
        {servers.length
          ? servers.map((server) => <ServerRow key={server.url} server={server} />)
          : <p className="docserve-servers__note">{note}</p>}
      </div>
    </section>
  )
}

function ServerRow({ server }: { server: DocServer }) {
  const current = server.current

  return (
    <a
      className={`docserve-servers__row${current ? " is-current" : ""}`}
      href={server.url}
      aria-current={current ? "page" : undefined}
      title={`${server.name} — ${server.path}`}
    >
      <span className="docserve-servers__dot" />
      <span className="docserve-servers__name">{server.name}</span>
      <span className="docserve-servers__path">{server.path}</span>
      <span className="docserve-servers__port">{server.port}</span>
      {current ? <span className="docserve-servers__check">✓</span> : null}
    </a>
  )
}
