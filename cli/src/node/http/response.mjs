const NO_STORE = { "cache-control": "no-store" }

/**
 * @param {any} body
 * @param {number} [status]
 * @returns {Response}
 */
export function json(body, status = 200) {
  return Response.json(body, { status, headers: NO_STORE })
}

/**
 * @param {string} body
 * @param {number} [status]
 * @param {Record<string, string>} [headers]
 * @returns {Response}
 */
export function text(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", ...headers },
  })
}

/**
 * @param {string} [body]
 * @returns {Response}
 */
export function notFound(body = "Not Found") {
  return text(body, 404, NO_STORE)
}
