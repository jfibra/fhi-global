import { createAdminSupabase } from "@/lib/admin-supabase"

// App-level audit writer. Complements the DB triggers (which own tamper-proof
// data-change rows): this records auth / security / admin-context events that
// need request info (IP, user-agent, URL), a friendly description, and the real
// human actor (admin routes write via the service-role client, so the trigger's
// auth.uid() is NULL → the trigger row shows "System" while this row names the
// person). Writing goes through the service-role client, which bypasses RLS.

export type AuditActor = {
  id: string | null
  name: string | null
  role: string | null
}

export type AuditRequestContext = {
  ip: string | null
  userAgent: string | null
  url: string | null
  requestId?: string | null
}

export type AuditEventInput = {
  category: string
  event: string
  source?: string
  actor?: AuditActor | null
  subjectType?: string | null
  subjectId?: string | null
  subjectLabel?: string | null
  description?: string | null
  oldValues?: unknown
  newValues?: unknown
  changedKeys?: string[] | null
} & Partial<AuditRequestContext>

/**
 * Insert an audit row. Never throws into the caller's path — a failed audit
 * write must not break the business action it is recording.
 */
export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    const admin = createAdminSupabase()
    await admin.from("audit_logs").insert({
      category: input.category,
      event: input.event,
      source: input.source ?? "app",
      actor_id: input.actor?.id ?? null,
      actor_name: input.actor?.name ?? "System",
      actor_role: input.actor?.role ?? null,
      subject_type: input.subjectType ?? null,
      subject_id: input.subjectId ?? null,
      subject_label: input.subjectLabel ?? null,
      description: input.description ?? null,
      old_values: input.oldValues ?? null,
      new_values: input.newValues ?? null,
      changed_keys: input.changedKeys ?? null,
      ip_address: input.ip ?? null,
      user_agent: input.userAgent ?? null,
      url: input.url ?? null,
      request_id: input.requestId ?? null,
    })
  } catch {
    // swallow — auditing is best-effort and must never surface to the user
  }
}

// Resolve the client IP from proxy-set headers, preferring ones the client
// cannot forge. cf-connecting-ip / x-real-ip are overwritten by Cloudflare /
// the reverse proxy; the left-most X-Forwarded-For entry is client-controllable
// (a request can prepend a fake), so it is only a last resort — important for an
// audit trail where a spoofed IP would mislead an investigation.
function resolveIp(get: (name: string) => string | null): string | null {
  const cf = get("cf-connecting-ip")
  if (cf) return cf.trim()
  const real = get("x-real-ip")
  if (real) return real.trim()
  const xff = get("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  return null
}

/** Extract request context from a Web/Next Request (route handlers). */
export function requestContextFromRequest(req: Request): AuditRequestContext {
  const h = req.headers
  return {
    ip: resolveIp((n) => h.get(n)),
    userAgent: h.get("user-agent"),
    url: h.get("referer"),
  }
}

/** Extract request context inside a Server Action (no NextRequest available). */
export async function requestContextFromHeaders(): Promise<AuditRequestContext> {
  const { headers } = await import("next/headers")
  const h = await headers()
  return {
    ip: resolveIp((n) => h.get(n)),
    userAgent: h.get("user-agent"),
    url: null,
  }
}
