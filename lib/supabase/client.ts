import { createBrowserClient } from "@supabase/ssr"

// Singleton — every service module calls createClient(); returning a fresh
// browser client each time spawns a separate GoTrueClient, and each one
// registers its own `navigator.locks` auth-token refresh lock. Many clients
// then contend for the same "lock:sb-…-auth-token" and time out after 10s
// ("Acquiring an exclusive Navigator LockManager lock … timed out"). One
// shared instance = one lock.
let client: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  if (client) return client

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables for browser client")
  }

  client = createBrowserClient(supabaseUrl, supabaseAnonKey)
  return client
}
