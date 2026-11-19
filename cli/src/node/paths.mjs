import { join } from "node:path"
import { fileURLToPath } from "node:url"

export const PACKAGE_ROOT = fileURLToPath(new URL("../..", import.meta.url))
export const PACKAGE_JSON = join(PACKAGE_ROOT, "package.json")
export const GALLERY_TEMPLATE = join(PACKAGE_ROOT, "index.html")
export const WIDGET_SOURCE_DIR = join(PACKAGE_ROOT, "src", "widget")
export const PLUGINS_SOURCE_DIR = join(PACKAGE_ROOT, "src", "plugins")
export const WIDGET_DIST_DIR = join(PACKAGE_ROOT, "dist", "widget")
