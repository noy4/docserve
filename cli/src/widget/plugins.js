// Plugin registry: run `setup` once per id and keep its cleanup.

/**
 * @param {() => DocserveContext} getContext  Resolved when a plugin is set up,
 *   so the registry can exist before the context is fully assembled.
 * @returns {{ use: (plugin: DocservePlugin) => DocserveContext, dispose: () => void }}
 */
export function createPlugins(getContext) {
  /** @type {Map<string, () => void>} */
  const cleanups = new Map()

  return { use, dispose }

  /**
   * @param {DocservePlugin} plugin
   * @returns {DocserveContext}
   */
  function use(plugin) {
    const ctx = getContext()
    if (!plugin || typeof plugin.id !== "string" || !plugin.id) throw new TypeError("use expects a plugin with an id")
    if (cleanups.has(plugin.id)) return ctx

    const cleanup = plugin.setup?.(ctx)
    cleanups.set(plugin.id, typeof cleanup === "function" ? cleanup : () => {})
    return ctx
  }

  /** Run every cleanup in reverse registration order. */
  function dispose() {
    for (const cleanup of [...cleanups.values()].reverse()) {
      try {
        cleanup()
      } catch (error) {
        console.error("[docserve] plugin cleanup failed", error)
      }
    }
    cleanups.clear()
  }
}