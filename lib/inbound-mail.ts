import { ImapFlow } from "imapflow"
import { simpleParser } from "mailparser"
import { createAdminSupabase } from "@/lib/admin-supabase"

/**
 * Server-only IMAP sync — pulls lead replies out of the company mailbox and
 * into inquiry_emails, so a conversation on the Emails page shows both sides.
 *
 * How a message qualifies: its From address matches an inquiry's email (the
 * newest inquiry wins if the same person inquired twice). Everything else in
 * the mailbox — newsletters, spam, internal mail — is left untouched; this
 * only mirrors messages that belong to a lead conversation. Matched leads are
 * flipped back to unread so the reply surfaces in the inbox badge.
 *
 * Config: IMAP_HOST/PORT/USER/PASS in .env.local, each falling back to the
 * SMTP_* equivalents (Gmail serves IMAP on imap.googlemail.com:993 with the
 * same app password — IMAP must be enabled in the Google account settings).
 */

const WINDOW_DAYS = 7
const MAX_BATCH = 50
// A reply with a huge attachment isn't worth streaming into a lambda — the
// message stays in the real mailbox either way.
const MAX_SOURCE_BYTES = 2_000_000
const BODY_CAP = 20_000
const SYNC_TIMEOUT_MS = 50_000

function getConfig() {
  const smtpHost = process.env.SMTP_HOST ?? ""
  // smtp.googlemail.com → imap.googlemail.com; same convention on most hosts.
  const host = process.env.IMAP_HOST || (smtpHost ? smtpHost.replace(/^smtp\./i, "imap.") : "")
  const port = Number(process.env.IMAP_PORT ?? 993)
  const user = process.env.IMAP_USER || process.env.SMTP_USER
  const pass = process.env.IMAP_PASS || process.env.SMTP_PASS
  if (!host || !user || !pass) return null
  return { host, port, user, pass }
}

export function hasInboundMailConfig(): boolean {
  return getConfig() !== null
}

export type InboundSyncResult = { checked: number; ingested: number }

// Coalesce concurrent callers (page visit + manual refresh) onto one IMAP
// session — mail servers throttle parallel logins quickly.
let inflight: Promise<InboundSyncResult> | null = null

export function syncInboundEmails(): Promise<InboundSyncResult> {
  if (!inflight) {
    inflight = doSync().finally(() => { inflight = null })
  }
  return inflight
}

async function doSync(): Promise<InboundSyncResult> {
  const config = getConfig()
  if (!config) throw new Error("Inbound mail is not configured (set IMAP_* or SMTP_* in .env.local).")
  return Promise.race([
    fetchAndIngest(config),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("IMAP sync timed out")), SYNC_TIMEOUT_MS),
    ),
  ])
}

type ParsedInbound = {
  messageId: string
  fromEmail: string
  fromName: string | null
  subject: string
  date: Date
  text: string
}

async function fetchAndIngest(config: NonNullable<ReturnType<typeof getConfig>>): Promise<InboundSyncResult> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: config.user, pass: config.pass },
    logger: false,
  })

  // Collect raw messages first, parse after the connection is released —
  // slow work inside the fetch stream stalls the IMAP session.
  const sources: Buffer[] = []
  await client.connect()
  try {
    const lock = await client.getMailboxLock("INBOX")
    try {
      const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000)
      const uids = await client.search({ since }, { uid: true })
      const batch = (uids || []).slice(-MAX_BATCH)
      if (batch.length > 0) {
        for await (const msg of client.fetch(batch, { uid: true, source: true }, { uid: true })) {
          if (msg.source && msg.source.length <= MAX_SOURCE_BYTES) sources.push(msg.source)
        }
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }

  const parsed: ParsedInbound[] = []
  for (const source of sources) {
    try {
      const mail = await simpleParser(source)
      const from = mail.from?.value?.[0]
      if (!mail.messageId || !from?.address) continue
      parsed.push({
        messageId: mail.messageId,
        fromEmail: from.address.toLowerCase(),
        fromName: from.name?.trim() || null,
        subject: (mail.subject || "(no subject)").slice(0, 200),
        date: mail.date ?? new Date(),
        text: (mail.text || htmlToText(mail.html) || "").trim(),
      })
    } catch {
      // One unparseable message shouldn't sink the run.
    }
  }
  if (parsed.length === 0) return { checked: 0, ingested: 0 }

  const admin = createAdminSupabase()

  // Dedup: anything whose Message-ID we've already stored is done forever.
  const { data: existing } = await admin
    .from("inquiry_emails")
    .select("message_id")
    .in("message_id", parsed.map((p) => p.messageId))
  const known = new Set((existing ?? []).map((r: { message_id: string | null }) => r.message_id))
  const fresh = parsed.filter((p) => !known.has(p.messageId))

  let ingested = 0
  const touchedLeads = new Set<string>()
  const mailbox = (process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "").toLowerCase()

  for (const p of fresh) {
    if (p.fromEmail === mailbox) continue // never ingest our own mail

    // ilike with escaped wildcards = case-insensitive exact match.
    const pattern = p.fromEmail.replace(/([%_\\])/g, "\\$1")
    const { data: lead } = await admin
      .from("inquiries")
      .select("id, name")
      .ilike("email", pattern)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; name: string }>()

    // Not a lead? Still ours if we've ever emailed that address from the
    // dashboard — a reply to a composed email threads under it in Sent.
    // Anything else (newsletters, internal mail) stays in the real mailbox.
    let corresponded = false
    if (!lead) {
      const { data: sentTo } = await admin
        .from("inquiry_emails")
        .select("id")
        .eq("direction", "outbound")
        .ilike("to_email", pattern)
        .limit(1)
        .maybeSingle<{ id: string }>()
      corresponded = Boolean(sentTo)
    }
    if (!lead && !corresponded) continue

    const { error } = await admin.from("inquiry_emails").insert({
      inquiry_id: lead?.id ?? null,
      direction: "inbound",
      status: "received",
      from_email: p.fromEmail,
      from_name: p.fromName ?? lead?.name ?? null,
      to_email: mailbox,
      subject: p.subject,
      body_text: p.text.slice(0, BODY_CAP) || "(empty message)",
      message_id: p.messageId,
      // The email's own date, so the thread sorts by when it was written.
      created_at: p.date.toISOString(),
    })
    if (!error) {
      ingested++
      if (lead) touchedLeads.add(lead.id)
    }
  }

  // A fresh reply makes the conversation unread again — same mechanics as a
  // brand-new inquiry, so the inbox bolds it and the badge counts it.
  if (touchedLeads.size > 0) {
    await admin
      .from("inquiries")
      .update({ read_at: null, updated_at: new Date().toISOString() })
      .in("id", [...touchedLeads])
  }

  return { checked: parsed.length, ingested }
}

/** Crude but safe: inbound HTML is reduced to text — we never render lead HTML. */
function htmlToText(html: string | false | undefined): string {
  if (!html) return ""
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
