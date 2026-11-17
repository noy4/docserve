// Live reload over the server's /__reload websocket, with reconnect backoff.

/**
 * @typedef {object} LiveHandle
 * @property {() => void} close
 * @property {() => boolean} isOpen
 */

/**
 * Subscribe to reload events. Reconnects with exponential backoff; a dropped
 * socket never reloads the page by itself.
 * @param {object} options
 * @param {string} [options.path]
 * @param {(message: LiveMessage) => void} options.onMessage
 * @param {() => void} [options.onOpen]
 * @returns {LiveHandle}
 */
export function connectLive({ path = "/__reload", onMessage, onOpen }) {
  const MIN_DELAY = 500
  const MAX_DELAY = 10000

  /** @type {WebSocket | null} */
  let socket = null
  let delay = MIN_DELAY
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null
  let closed = false

  open()

  return {
    close() {
      closed = true
      if (timer) clearTimeout(timer)
      timer = null
      socket?.close()
      socket = null
    },
    isOpen() {
      return socket?.readyState === WebSocket.OPEN
    },
  }

  function open() {
    if (closed) return
    const proto = location.protocol === "https:" ? "wss:" : "ws:"
    const ws = new WebSocket(`${proto}//${location.host}${path}`)
    socket = ws

    ws.addEventListener("open", () => {
      if (closed) return
      delay = MIN_DELAY
      onOpen?.()
    })

    ws.addEventListener("message", (event) => {
      if (closed) return
      let message
      try {
        message = JSON.parse(event.data)
      } catch {
        return
      }
      if (message && typeof message === "object") onMessage(message)
    })

    ws.addEventListener("close", () => {
      if (closed || socket !== ws) return
      socket = null
      schedule()
    })

    ws.addEventListener("error", () => {
      // A failed connect also fires close; nothing to do here.
    })
  }

  function schedule() {
    if (closed || timer) return
    timer = setTimeout(() => {
      timer = null
      open()
    }, delay)
    delay = Math.min(delay * 2, MAX_DELAY)
  }
}