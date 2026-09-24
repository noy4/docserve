// Dev mode: unpackaged (electron .), sandboxed away from the installed app.
import { app } from "electron"
import os from "node:os"
import path from "node:path"

export const dev = !app.isPackaged

export function sandboxDev() {
  if (!dev) return
  app.setPath("userData", `${app.getPath("userData")}-dev`)
  process.env.DOCSERVE_HOME ||= path.join(os.homedir(), ".docserve-dev")
}
