import type { CSSProperties } from "react"
import { EmptyState } from "./components/EmptyState.js"
import { GalleryHeader } from "./components/GalleryHeader.js"
import { PageGrid } from "./components/PageGrid.js"
import { GalleryModel } from "./model.js"
import { PreviewModel } from "#shared/client/preview-model.js"
import { useLayoutModel, useModel } from "#shared/client/use-model.js"

export function App() {
  const model = useModel(() => new GalleryModel())
  const previews = useLayoutModel(() => new PreviewModel({ max: 3, rootMargin: "400px", scope: "viewport" }))

  const pages = model.pages.value
  const status = model.status.value
  const docs = model.docs
  const hue = docs?.hue ?? readFolderHue()

  return (
    <div className="docserve-gallery" style={{ "--folder-hue": String(hue) } as CSSProperties}>
      <GalleryHeader model={model} />
      {status === "error"
        ? (
          <EmptyState
            title="Could not load pages"
            action={{ label: "Retry", run: () => model.load({ force: true }) }}
          />
        )
        : status === "loading" && !pages.length
          ? <EmptyState title="Loading…" />
          : pages.length
            ? <PageGrid model={model} previews={previews} />
            : <EmptyState title="No HTML files found" path={docs?.path} />}
    </div>
  )
}

function readFolderHue(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--folder-hue").trim()
  const hue = Number(raw)
  return Number.isFinite(hue) ? hue : 210
}