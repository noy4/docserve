import { apiFiles } from "../docs/files.mjs"

export function registerFiles(rpc, { docsDir }) {
  rpc.register("docserve:pages:list", () => apiFiles(docsDir))
}
