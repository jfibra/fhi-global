"use client"

import { useCallback, useEffect, useState } from "react"
import type { MerchantMePayload } from "@/lib/merchant/types"

/**
 * The merchant's own record (GET /api/merchant/me), shared by every page of
 * the merchant dashboard; an agent or admin passes the merchant's id to read
 * someone else's. `reload` after an upload or a save.
 */
export function useMerchant(merchantId?: string | null) {
  const [data, setData] = useState<MerchantMePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // A promise chain rather than async/await: the state updates live in the
  // callbacks, which is what react-hooks/set-state-in-effect asks for.
  const reload = useCallback(() => {
    const url = merchantId ? `/api/merchant/me?merchant=${encodeURIComponent(merchantId)}` : "/api/merchant/me"
    return fetch(url, { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as MerchantMePayload & { error?: string }
        if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status}).`)
        return json
      })
      .then((json) => {
        setData(json)
        setError(null)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load your merchant record."))
      .finally(() => setLoading(false))
  }, [merchantId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, error, loading, reload }
}
