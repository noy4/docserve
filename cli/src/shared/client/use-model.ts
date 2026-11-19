import { useEffect, useState } from "react"

export interface Subscribable {
  subscribe(): (() => void) | void
}

/** Create a model once and run its `subscribe()`. */
export function useModel<T extends object>(create: () => T): T {
  const [model] = useState(create)
  useEffect(() => subscribe(model), [model])
  return model
}

function subscribe(model: object): (() => void) | void {
  const subscribable = model as Partial<Subscribable>
  if (typeof subscribable.subscribe !== "function") return
  return subscribable.subscribe()
}
