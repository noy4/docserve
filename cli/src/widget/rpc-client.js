/**
 * @param {string} method
 * @param {any[]} [args]
 * @returns {Promise<any>}
 */
export async function callServer(method, args = []) {
  const response = await fetch("/__docserve/rpc", {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ method, args }),
  })

  let payload = null
  try {
    payload = await response.json()
  } catch { }

  const message = payload?.error?.message
  if (!response.ok || message)
    throw new Error(message ?? `/__docserve/rpc: ${response.status}`)
  return payload?.result
}
