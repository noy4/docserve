import { apiFiles } from "../files.mjs"

export function registerFiles(rpc, { docsDir }) {
  rpc.register("docserve:pages:list", () => apiFiles(docsDir))
}
