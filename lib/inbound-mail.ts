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

/** One mailbox to poll: the house account (ownerId null, feeds the admin
 *  mailroom and lead threads) or a personal mailbox (rows visible only to
 *  that profile). All share the provider password from the environment. */
type MailAccount = { user: string; ownerId: string | null }

/**
 * Which mailboxes to sync:
 *  - "all"          — house + every assigned personal mailbox (admin callers)
 *  - a profile id   — just that person's mailbox (their page visit/refresh)
 */
export type SyncScope = "all" | { ownerId: string }

// Coalesce concurrent callers per scope — mail servers throttle parallel
// logins quickly, and the page fires visit + interval + refresh.
const inflight = new Map<string, Promise<InboundSyncResult>>()

export function syncInboundEmails(scope: SyncScope = "all"): Promise<InboundSyncResult> {
  const key = scope === "all" ? "all" : scope.ownerId
  let p = inflight.get(key)
  if (!p) {
    p = doSync(scope).finally(() => { inflight.delete(key) })
    inflight.set(key, p)
  }
  return p
}

async function listAccounts(scope: SyncScope): Promise<MailAccount[]> {
  const config = getConfig()
  if (!config) return []
  const admin = createAdminSupabase()
  const { data } = await admin
    .from("profiles")
    .select("id, mailbox_address")
    .not("mailbox_address", "is", null)
  const personal: MailAccount[] = ((data ?? []) as Array<{ id: string; mailbox_address: string | null }>)
    .map((r) => ({ user: (r.mailbox_address ?? "").trim().toLowerCase(), ownerId: r.id }))
    .filter((a) => a.user)
  if (scope !== "all") return personal.filter((a) => a.ownerId === scope.ownerId)
  return [{ user: config.user.trim().toLowerCase(), ownerId: null }, ...personal]
}

async function doSync(scope: SyncScope): Promise<InboundSyncResult> {
  const config = getConfig()
  if (!config) throw new Error("Inbound mail is not configured (set IMAP_* or SMTP_* in .env.local).")

  const accounts = await listAccounts(scope)
  let checked = 0
  let ingested = 0
  let lastError: unknown = null
  // Serial on purpose: parallel IMAP logins get throttled, and each account
  // is quick (ranged search over the last week).
  for (const account of accounts) {
    try {
      const r = await Promise.race([
        fetchAndIngest(config, account),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("IMAP sync timed out")), SYNC_TIMEOUT_MS),
        ),
      ])
      checked += r.checked
      ingested += r.ingested
    } catch (err) {
      // One broken mailbox must not block the rest.
      lastError = err
    }
  }
  if (checked === 0 && ingested === 0 && lastError && accounts.length === 1) throw lastError
  return { checked, ingested }
}

/**
 * Keep only what the sender actually typed. Mail clients append the whole
 * history below a reply ("On <date> <name> wrote:" + "> "-quoted lines,
 * Outlook's "-----Original Message-----" or underscore rule) — Gmail hides
 * that behind an ellipsis, so storing it verbatim made threads unreadable.
 * The untouched original still lives in the real mailbox.
 */
function trimQuotedReply(text: string): string {
  const lines = text.split(/\r?\n/)
  let cut = lines.length
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.startsWith(">")) { cut = i; break }
    if (/^-{2,}\s*Original Message\s*-{2,}$/i.test(line) || /^_{10,}$/.test(line)) { cut = i; break }
    // "On <date> ... wrote:" — often wrapped across two or three lines.
    if (/^On\s/.test(line)) {
      const joined = [line, lines[i + 1]?.trim() ?? "", lines[i + 2]?.trim() ?? ""].join(" ")
      if (/wrote:\s*$/.test(line) || /wrote:/.test(joined)) { cut = i; break }
    }
  }
  const trimmed = lines.slice(0, cut).join("\n").trim()
  // A reply that is ONLY a quote (forwards, "see below") keeps the original.
  return trimmed || text.trim()
}

type ParsedInbound = {
  messageId: string
  fromEmail: string
  fromName: string | null
  subject: string
  date: Date
  text: string
}

async function fetchAndIngest(
  config: NonNullable<ReturnType<typeof getConfig>>,
  account: MailAccount,
): Promise<InboundSyncResult> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    // Personal mailboxes share the provider password; AUTH must be the
    // mailbox itself (same rule the sender side follows).
    auth: { user: account.user, pass: config.pass },
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
        text: trimQuotedReply((mail.text || htmlToText(mail.html) || "").trim()),
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
  const mailbox = account.user

  for (const p of fresh) {
    if (p.fromEmail === mailbox) continue // never ingest our own mail

    // ilike with escaped wildcards = case-insensitive exact match.
    const pattern = p.fromEmail.replace(/([%_\\])/g, "\\$1")

    // The house mailbox routes lead replies onto their lead threads; a
    // personal mailbox never does — its mail is the owner's correspondence.
    let lead: { id: string; name: string } | null = null
    if (account.ownerId === null) {
      const { data } = await admin
        .from("inquiries")
        .select("id, name")
        .ilike("email", pattern)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string; name: string }>()
      lead = data ?? null
    }

    // Not a lead? Still ours if this mailbox's owner has emailed that address
    // from the dashboard — the reply threads under that correspondence.
    // Anything else (newsletters, internal mail) stays in the real mailbox.
    let corresponded = false
    if (!lead) {
      let q = admin
        .from("inquiry_emails")
        .select("id")
        .eq("direction", "outbound")
        .ilike("to_email", pattern)
        .limit(1)
      if (account.ownerId) q = q.eq("sent_by", account.ownerId)
      const { data: sentTo } = await q.maybeSingle<{ id: string }>()
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
      owner_id: account.ownerId,
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
