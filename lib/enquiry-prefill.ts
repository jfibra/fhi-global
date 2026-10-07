/**
 * Hands a message from one page to the /contact enquiry form — today the
 * mortgage calculator's "Get a Real Quote": the buyer's figures arrive typed
 * into the message, ready to edit and send.
 *
 * It goes through localStorage (30-minute expiry), not the URL: /contact is a
 * static page and a query string would make it dynamic, and storage (unlike
 * sessionStorage) survives a middle-click or "open in new tab" on the link.
 * The form reads it with useSyncExternalStore, so there is no setState-in-effect
 * and no hydration mismatch (the server snapshot is always "none"), and clears it
 * once the message has been sent. Every call is a no-op when storage is
 * unavailable — the link still opens /contact, just without the figures.
 */

const KEY = "fhi:enquiry-prefill"
const TTL_MS = 30 * 60_000

export type EnquiryPrefill = {
  from: "mortgage-calculator"
  /** One of the contact form's stored subjects (e.g. "General Inquiry"); the form picks that reason. */
  subject?: string
  message: string
  at: number
}

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((fn) => fn())

export function saveEnquiryPrefill(prefill: Omit<EnquiryPrefill, "at">): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...prefill, at: Date.now() }))
    notify()
  } catch {
    // storage unavailable
  }
}

export function clearEnquiryPrefill(): void {
  try {
    window.localStorage.removeItem(KEY)
    notify()
  } catch {
    // storage unavailable
  }
}

function parse(raw: string | null): EnquiryPrefill | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<EnquiryPrefill>
    if (v.from !== "mortgage-calculator" || typeof v.message !== "string" || !v.message.trim() || typeof v.at !== "number") return null
    if (Date.now() - v.at > TTL_MS) {
      window.localStorage.removeItem(KEY)
      return null
    }
    return { from: v.from, subject: typeof v.subject === "string" ? v.subject : undefined, message: v.message, at: v.at }
  } catch {
    return null
  }
}

// useSyncExternalStore needs a snapshot that is referentially stable until the storage changes.
let lastRaw: string | null | undefined
let lastValue: EnquiryPrefill | null = null

/** The pending prefill, or null (none saved, expired, or unreadable). Client-only. */
export function readEnquiryPrefill(): EnquiryPrefill | null {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(KEY)
  } catch {
    return null
  }
  if (raw === lastRaw) return lastValue
  lastRaw = raw
  lastValue = parse(raw)
  return lastValue
}

export function subscribeEnquiryPrefill(onChange: () => void): () => void {
  listeners.add(onChange)
  // Another tab saved or cleared it.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) onChange()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onStorage)
  }
}
