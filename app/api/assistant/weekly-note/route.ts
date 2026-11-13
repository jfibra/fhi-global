import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { weeklyNoteTokenOk } from "@/lib/weekly-note"

/**
 * The "Stop these notes" link in the weekly coaching note (lib/weekly-note.ts):
 * GET ?u=<user id>&t=<token>&on=0 switches the person's notes off
 * (profiles.metadata.assistant_weekly_note = "off"); on=1 switches them back
 * on. The token is an HMAC of the user id with CRON_SECRET, so the link works
 * without a login and cannot be forged for someone else. Nothing else about
 * the account is touched.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const page = (title: string, body: string, status = 200) =>
  new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>
<body style="margin:0;background:#eef1f5;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937;">
<div style="max-width:520px;margin:48px auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px -16px rgba(0,20,45,.35);">
<div style="background:#001f3f;border-bottom:3px solid #d6b357;padding:26px 32px;color:#fff;font-weight:700;font-size:18px;">FHI Global</div>
<div style="padding:30px 32px;"><h1 style="margin:0 0 10px;font-size:22px;color:#0d1117;">${title}</h1><p style="margin:0;font-size:15px;line-height:1.7;color:#4b5563;">${body}</p></div>
</div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  )

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const userId = q.get("u")?.trim() ?? ""
  const on = q.get("on") === "1"
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !weeklyNoteTokenOk(userId, q.get("t"))) return page("This link is not valid", "Open the latest weekly note and use the link at the bottom of it.", 400)

  const admin = createAdminSupabase()
  const { data, error } = await admin.from("profiles").select("metadata").eq("id", userId).maybeSingle<{ metadata: Record<string, unknown> | null }>()
  if (error || !data) return page("This link is not valid", "We could not find the account this link belongs to.", 404)
  const { assistant_weekly_note: _old, ...rest } = data.metadata ?? {}
  void _old
  const { error: upErr } = await admin.from("profiles").update({ metadata: on ? rest : { ...rest, assistant_weekly_note: "off" } }).eq("id", userId)
  if (upErr) return page("Something went wrong", "Please try the link again in a moment.", 500)

  const resume = `${req.nextUrl.origin}/api/assistant/weekly-note?u=${userId}&t=${q.get("t")}&on=1`
  const stop = `${req.nextUrl.origin}/api/assistant/weekly-note?u=${userId}&t=${q.get("t")}&on=0`
  return on
    ? page("Weekly notes are back on", `You will get FHI Assistant's coaching note every Monday morning again. <a href="${stop}" style="color:#8a6d2a;">Stop them</a> any time.`)
    : page("You won't get the weekly notes anymore", `FHI Assistant will stop emailing you on Mondays. Your reminders still arrive, and everything stays available in the chat. Changed your mind? <a href="${resume}" style="color:#8a6d2a;">Turn the notes back on</a>.`)
}
