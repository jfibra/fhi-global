"use client"

import { useEffect, useState } from "react"
import { Check, Copy, ExternalLink, Plug, Unplug } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { roleInList } from "@/lib/app-roles"
import { TutorialVideo } from "./tutorial-video"

/**
 * Connect Claude (boss via Juliecor, 2026-11-24): how an agent or team
 * leader connects their own Claude to FHI with their FHI login, what it can
 * read, and the connections they have (with Disconnect). Since 2026-11-27 a
 * connection may also create, change and publish the person's OWN events
 * (the ticked box on the Allow screen; lib/mcp/events.ts) — a connection
 * made before that is marked "Reading only". The server side is
 * lib/oauth/server.ts + POST /api/mcp/me; the list is
 * GET /api/account/connected-apps. Agents and team leaders ("connect-claude"
 * in SUB_PATH_ROLES).
 */

const ROLES = ["agent", "team_leader"] as const

type App = { id: string; client_name: string | null; created_at: string; last_used_at: string | null; events?: boolean }

// claude.ai's connectors list (Plugins → Connectors on a personal account, seen 2026-11-24).
const CLAUDE_CONNECTORS_URL = "https://claude.ai/plugins?filter=connectors-only"

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "never")

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      window.setTimeout(() => setDone(false), 1500)
    } catch {
      window.prompt("Copy this:", text)
    }
  }
  return (
    <button type="button" onClick={() => void copy()} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#e8eaed] bg-white px-2.5 py-1.5 text-[13px] font-semibold text-[#001f3f] hover:bg-[#f4f6f9]">
      {done ? <Check className="h-3.5 w-3.5 text-[#1f7a4d]" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Copied" : "Copy"}
    </button>
  )
}

export default function ConnectClaudePage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(roleInList(role, ROLES))
  const leader = role === "team_leader"

  const [origin, setOrigin] = useState("")
  const [apps, setApps] = useState<App[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!allowed) return
    let live = true
    void fetch("/api/account/connected-apps", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ apps: App[] }>) : Promise.reject(new Error("Couldn't load your connections."))))
      .then((d) => {
        if (!live) return
        setOrigin(window.location.origin)
        setApps(d.apps)
      })
      .catch((e: Error) => {
        if (!live) return
        setOrigin(window.location.origin)
        setLoadError(e.message)
      })
    return () => {
      live = false
    }
  }, [allowed])

  if (!allowed) return null

  const serverUrl = `${origin || "https://fhiglobal.ae"}/api/mcp/me`

  const disconnect = async (id: string) => {
    setBusy(id)
    try {
      const res = await fetch(`/api/account/connected-apps/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Couldn't disconnect.")
      setApps((list) => (list ?? []).filter((a) => a.id !== id))
    } catch {
      setLoadError("Couldn't disconnect. Try again.")
    } finally {
      setBusy(null)
      setConfirming(null)
    }
  }

  const questions = [
    "How are my sales this year, and what is waiting for validation?",
    "Which of my leads haven't been contacted yet?",
    "Who registered through my link this month?",
    "How am I doing on my goal?",
    ...(leader ? ["Who in my team needs help?", "How is my team doing this quarter?"] : ["What is on the Top Sales board this month?"]),
    "Create an event: Property Talk at Azizi Venice Sales Gallery, 12 December 2026, 3 pm, 30 seats.",
    "Make an event like my last one, on 15 January 2027 at 10 am.",
  ]

  const card = "rounded-2xl border border-[#e8eaed] bg-white px-5 py-4 shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)]"

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-['Outfit'] text-2xl font-bold text-[#0d1117]">
          <Plug className="h-6 w-6 text-[#001f3f]" />
          Connect Claude
        </h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Ask your own Claude about your sales, leads{leader ? ", team" : ""} and recruits, and create your own events by talking. It reads only your data, and only while you keep it connected.
        </p>
      </div>

      <TutorialVideo className={card} />

      <section className={card}>
        <h2 className="font-['Outfit'] text-[17px] font-bold text-[#0d1117]">Three steps, once</h2>
        <ol className="mt-3 space-y-3 text-[14.5px] leading-relaxed text-[#374151]">
          <li className="flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#001f3f] font-['Outfit'] text-[13px] font-bold text-white">1</span>
            <div className="min-w-0">
              <p className="font-semibold text-[#0d1117]">Open Claude&apos;s connectors</p>
              <p>
                On a computer, open claude.ai and click Plugins in the left menu (on some accounts it is called Customize). Choose Connectors, then Add, then Add custom connector. A free Claude account works.
              </p>
              <a href={CLAUDE_CONNECTORS_URL} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#001f3f] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#002b57]">
                Open claude.ai connectors <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#001f3f] font-['Outfit'] text-[13px] font-bold text-white">2</span>
            <div className="min-w-0">
              <p className="font-semibold text-[#0d1117]">Fill in the connector</p>
              <p>Name: FHI Global. MCP server URL: paste this address, then press Continue.</p>
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-[#f4f6f9] px-3 py-2">
                <code className="min-w-0 flex-1 break-all font-mono text-[13px] text-[#0d1117]">{serverUrl}</code>
                <CopyButton text={serverUrl} />
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#001f3f] font-['Outfit'] text-[13px] font-bold text-white">3</span>
            <div className="min-w-0">
              <p className="font-semibold text-[#0d1117]">Sign in and press Allow</p>
              <p>Claude opens the FHI sign-in. Use your usual FHI login, read what Claude will be able to see, and press Allow. Keep &ldquo;Create, change and publish your own events&rdquo; ticked if you want Claude to make events for you. Then ask Claude anything about your work, on the computer or in the Claude app on your phone.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-['Outfit'] text-[17px] font-bold text-[#0d1117]">Connected</h2>
          {apps ? <span className="text-[13px] text-[#6b7280]">{apps.length ? `${apps.length} connection${apps.length === 1 ? "" : "s"}` : "Nothing connected yet"}</span> : null}
        </div>
        {loadError ? <p className="mt-3 text-[14px] text-[#b42318]">{loadError}</p> : null}
        {apps && apps.length ? (
          <ul className="mt-3 divide-y divide-[#f0f2f5]">
            {apps.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[#0d1117]">
                    {a.client_name?.trim() || "Claude"}
                    <span className={`ml-2 inline-block rounded-full px-2 py-0.5 align-middle text-[12px] font-semibold ${a.events ? "bg-[#fdf6e3] text-[#7a5a00]" : "bg-[#f0f2f5] text-[#4b5563]"}`}>
                      {a.events ? "Can create events" : "Reading only"}
                    </span>
                  </p>
                  <p className="text-[13px] text-[#6b7280]">
                    Connected {when(a.created_at)} · last used {when(a.last_used_at)}
                  </p>
                  {!a.events ? (
                    <p className="mt-0.5 text-[13px] text-[#6b7280]">To let Claude create your events, disconnect here, remove the connector in Claude and add it again.</p>
                  ) : null}
                </div>
                {confirming === a.id ? (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => void disconnect(a.id)} disabled={busy === a.id} className="rounded-lg bg-[#b42318] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#912018] disabled:opacity-60">
                      {busy === a.id ? "Disconnecting…" : "Yes, disconnect"}
                    </button>
                    <button type="button" onClick={() => setConfirming(null)} className="rounded-lg border border-[#e8eaed] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#001f3f] hover:bg-[#f4f6f9]">
                      Keep
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirming(a.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#e8eaed] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#001f3f] hover:bg-[#f4f6f9]">
                    <Unplug className="h-3.5 w-3.5" /> Disconnect
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : apps ? (
          <p className="mt-3 text-[14px] text-[#6b7280]">When you press Allow on the FHI sign-in, the connection appears here and you can disconnect it any time.</p>
        ) : !loadError ? (
          <p className="mt-3 text-[14px] text-[#9ca3af]">Loading…</p>
        ) : null}
      </section>

      <section className={card}>
        <h2 className="font-['Outfit'] text-[17px] font-bold text-[#0d1117]">Things to ask Claude</h2>
        <ul className="mt-3 space-y-2 text-[14.5px] text-[#374151]">
          {questions.map((q) => (
            <li key={q} className="flex items-center justify-between gap-3">
              <span>&ldquo;{q}&rdquo;</span>
              <CopyButton text={q} />
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[13px] leading-relaxed text-[#6b7280]">
          Claude reads your own record{leader ? " and your team's" : ""}, plus what the dashboard shows everyone. Other people&apos;s amounts are never included. The only thing it can write is your own events, and only if you kept that box ticked: every event starts as a draft, goes live when you say so, and nothing can be deleted. Admins can see that you connected, never your chats.
        </p>
      </section>
    </div>
  )
}
