import type { GalleryModel } from "../model.js"

const FOLDER_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M6.1 10L4 18V8h17a2 2 0 0 0-2-2h-7l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h15c.9 0 1.7-.6 1.9-1.5l2.3-8.5zM19 18H6l1.6-6h13z" />
  </svg>
)

export function GalleryHeader({ model }: { model: GalleryModel }) {
  const docs = model.docs
  const servers = model.servers.value
  const count = model.pages.value.length
  const name = docs?.name ?? document.title
  const path = docs?.path ?? ""

  return (
    <>
      <div className="gallery-head">
        <h1 className="gallery-head__title">
          <span className="gallery-head__folder">{FOLDER_ICON}</span>
          <span className="gallery-head__name">{name}</span>
        </h1>
        <details
          className="gallery-head__servers"
          open={model.serversOpen.value}
          onToggle={(event) => model.setServersOpen(event.currentTarget.open)}
        >
          <summary>
            Running <span>({servers.length})</span>
          </summary>
          <div className="servers-menu">
            {servers.map((server) => <ServerRow key={server.url} server={server} />)}
          </div>
        </details>
      </div>
      <p className="gallery-sub">
        {path ? <code>{path}</code> : null}
        {path ? " — " : null}
        <b>{count}</b> files
      </p>
    </>
  )
}

function ServerRow({ server }: { server: DocServer }) {
  const current = server.current

  return (
    <a
      className={`servers-row${current ? " is-current" : ""}`}
      href={server.url}
      title={`${server.name} — ${server.path}`}
      aria-current={current ? "page" : undefined}
    >
      <span className="server-dot" />
      <span className="server-name">{server.name}</span>
      <span className="server-path">{server.path}</span>
      <span className="server-port">{server.port}</span>
      {current ? <span className="server-check">✓</span> : null}
    </a>
  )
}