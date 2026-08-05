"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * Live count of unread (never-opened, not archived) emails for the sidebar
 * badge — Gmail semantics, so opening a conversation clears it. Head-only
 * count through the browser client — RLS (admin-only SELECT on inquiries)
 * means non-admin sessions simply count 0, but callers gate with `enabled`
 * anyway so no query fires for roles without the nav item.
 *
 * Refreshes whenever `refreshKey` changes (the caller passes the pathname, so
 * reading emails shows up on the next navigation) and every two minutes while
 * idle, so a lead arriving mid-session surfaces on its own.
 */
export function useNewLeadsCount(enabled: boolean, refreshKey: string): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const fetchCount = async () => {
      try {
        const supabase = createClient()
        let { count: fresh, error } = await supabase
          .from("inquiries")
          .select("id", { count: "exact", head: true })
          .is("read_at", null)
          .is("deleted_at", null)
        // 42703: migration 031 not applied yet — status 'new' approximates unread.
        if (error?.code === "42703") {
          ;({ count: fresh, error } = await supabase
            .from("inquiries")
            .select("id", { count: "exact", head: true })
            .eq("status", "new")
            .is("deleted_at", null))
        }
        if (!cancelled && !error) setCount(fresh ?? 0)
      } catch {
        // Network hiccup — keep the last known count.
      }
    }

    void fetchCount()
    const timer = setInterval(() => void fetchCount(), 120_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [enabled, refreshKey])

  return count
}
