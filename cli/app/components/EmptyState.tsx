import type { ReactNode } from "react"

export interface EmptyStateProps {
  title: string
  children?: ReactNode
  path?: string
  action?: { label: string; run: () => void }
}

export function EmptyState({ title, children, path, action }: EmptyStateProps) {
  return (
    <div className="gallery-empty">
      <p className="gallery-empty__title">{title}</p>
      {children ?? (path ? <p>Place .html files in <code>{path}</code> and they will appear here automatically</p> : null)}
      {action
        ? (
          <button type="button" onClick={action.run}>
            {action.label}
          </button>
        )
        : null}
    </div>
  )
}