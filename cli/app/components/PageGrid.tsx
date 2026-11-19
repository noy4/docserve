import { useCallback, useState } from "react"
import { displayDate, writeClipboard } from "../../src/widget/lib/dom.js"
import type { PreviewModel } from "#shared/client/preview-model.js"
import type { GalleryModel } from "../model.js"

const COPY_ICON = (
  <svg className="ic-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

const CHECK_ICON = (
  <svg className="ic-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export interface PageGridProps {
  model: GalleryModel
  previews: PreviewModel
}

export function PageGrid({ model, previews }: PageGridProps) {
  return (
    <div className="page-grid">
      {model.pages.value.map((page) => (
        <PageCard key={page.url} page={page} previews={previews} />
      ))}
    </div>
  )
}

function PageCard({ page, previews }: { page: DocPage; previews: PreviewModel }) {
  const label = page.title || decodeURIComponent(page.url)
  const date = displayDate(page.created)
  const setThumb = useCallback((element: HTMLDivElement | null) => previews.watch(element), [previews])

  return (
    <a className="page-card" href={page.url} target="_blank" rel="noopener">
      <div className="page-card__preview">
        <div ref={setThumb} className="page-card__thumb">
          <iframe tabIndex={-1} title={label} data-src={page.url} />
        </div>
        <CopyPath path={page.filePath} />
      </div>
      <div className="page-card__meta">
        <div className="page-card__title">
          <Favicon src={page.favicon} />
          <span>{label}</span>
        </div>
        <div className="page-card__date">{date}</div>
      </div>
    </a>
  )
}

function Favicon({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return null

  return (
    <img
      className="page-card__favicon"
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

function CopyPath({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      className={`copy-btn${copied ? " copied" : ""}`}
      title={path}
      aria-label="Copy file path"
      onClick={async (event) => {
        event.preventDefault()
        event.stopPropagation()
        try {
          await writeClipboard(path)
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        } catch { }
      }}
    >
      {COPY_ICON}
      {CHECK_ICON}
    </button>
  )
}