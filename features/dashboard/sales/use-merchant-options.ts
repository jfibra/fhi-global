"use client"

import { useEffect, useState } from "react"
import type { MerchantOption } from "@/app/api/merchants/options/route"

/**
 * The accepted merchants of the Merchant Partnership Programme, for Record
 * Your Sale's "Came through a merchant QR" on a rental and for naming the
 * merchant on a sale. One fetch per page, shared through a module cache.
 */

let cache: MerchantOption[] | null = null
let inflight: Promise<MerchantOption[]> | null = null

async function load(): Promise<MerchantOption[]> {
  if (cache) return cache
  inflight ??= fetch("/api/merchants/options", { cache: "no-store" })
    .then(async (res) => {
      const json = (await res.json().catch(() => ({}))) as { options?: MerchantOption[] }
      cache = res.ok && Array.isArray(json.options) ? json.options : []
      return cache
    })
    .catch(() => {
      cache = []
      return cache
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function useMerchantOptions(enabled = true): MerchantOption[] {
  const [options, setOptions] = useState<MerchantOption[]>(() => cache ?? [])
  useEffect(() => {
    if (!enabled) return
    let active = true
    load().then((list) => {
      if (active) setOptions(list)
    })
    return () => {
      active = false
    }
  }, [enabled])
  return options
}

/** "Bayt Al Noor Restaurant · M-4K7Q" for a tagged sale, or null while unknown. */
export function useMerchantLabel(merchantId: string | null | undefined): string | null {
  const options = useMerchantOptions(!!merchantId)
  if (!merchantId) return null
  const m = options.find((o) => o.id === merchantId)
  return m ? `${m.business_name}${m.code ? ` · ${m.code}` : ""}` : null
}
