/**
 * GA4 event helper — safe to call anywhere client-side. No-ops when GA is
 * not loaded (NEXT_PUBLIC_GA_ID unset, blocked, or SSR), so callers never
 * need to guard. Lead events measured: click_whatsapp, click_phone,
 * click_email, submit_inquiry.
 */
export function gaEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return
  const w = window as unknown as { gtag?: (...args: unknown[]) => void }
  if (typeof w.gtag === "function") w.gtag("event", name, params ?? {})
}
