"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Copy, ExternalLink, Eye, EyeOff, KeyRound, RefreshCw, Sparkles, Unplug, Webhook } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { isAdminStaffRole, roleToLabel } from "@/lib/app-roles"
import { API_ENDPOINTS, canSeeApiPage, type ApiEndpoint } from "@/lib/api-catalog"

/**
 * API — the keyed external endpoints and their key, for the one account that
 * builds the group's AI chat against FHI (lib/api-catalog.ts API_PAGE_OWNERS,
 * Juliecor 2026-11-17). Everything on the page is built from the catalog, so
 * a new endpoint is one entry there. The key comes from
 * GET /api/admin/api-page and is shown masked; example links open with it.
 */

type Status = { configured: boolean; key: string | null; site: string; environment: string }

/** Questions that show what the connector can answer — the admin FHI Assistant's tools behind the MCP (lib/mcp/server.ts). */
const CLAUDE_QUESTIONS = [
  "How many visitors did the website get this week, and where did they come from?",
  "Which Google keywords bring people to fhiglobal.ae?",
  "What is waiting for validation in the sales pipeline?",
  "Who has a birthday in the next two weeks?",
  "Which support tickets are still open?",
]

function CopyButton({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
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
    <button type="button" onClick={() => void copy()} className={`inline-flex items-center gap-1.5 rounded-lg border border-[#e8eaed] bg-white px-2.5 py-1.5 text-[13px] font-semibold text-[#001f3f] hover:bg-[#f4f6f9] ${className}`}>
      {done ? <Check className="h-3.5 w-3.5 text-[#059669]" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Copied" : label}
    </button>
  )
}

type SignIn = { id: string; user_id: string; name: string | null; role: string | null; status: string | null; client_name: string | null; created_at: string; last_used_at: string | null }

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "never")

/** Who connected their own Claude through the sign-in (POST /api/mcp/me), with Disconnect. */
function ClaudeSignIns() {
  const [rows, setRows] = useState<SignIn[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void fetch("/api/admin/connected-apps", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ apps: SignIn[] }>) : Promise.reject(new Error("Couldn't load the Claude sign-ins."))))
      .then((d) => {
        if (live) setRows(d.apps)
      })
      .catch((e: Error) => {
        if (live) setError(e.message)
      })
    return () => {
      live = false
    }
  }, [])

  const disconnect = async (id: string) => {
    setBusy(id)
    try {
      const res = await fetch(`/api/admin/connected-apps/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Couldn't disconnect.")
      setRows((list) => (list ?? []).filter((r) => r.id !== id))
    } catch {
      setError("Couldn't disconnect. Try again.")
    } finally {
      setBusy(null)
      setConfirming(null)
    }
  }

  return (
    <section className="rounded-2xl border border-[#e8eaed] bg-white px-5 py-4 shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-['Outfit'] text-[16px] font-bold text-[#001f3f]">Claude sign-ins</p>
        {rows ? <span className="text-[13px] text-[#6b7280]">{rows.length ? `${rows.length} connected` : "Nobody connected yet"}</span> : null}
      </div>
      <p className="mt-1 text-[14px] text-[#374151]">
        Agents and team leaders who connected their own Claude with their FHI login (Connect Claude in their dashboard). Each reads only their own data. Disconnecting refuses their next call; they can connect again.
      </p>
      {error ? <p className="mt-3 text-[14px] text-[#b42318]">{error}</p> : null}
      {rows && rows.length ? (
        <ul className="mt-3 divide-y divide-[#f0f2f5]">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="font-semibold text-[#0d1117]">
                  {r.name ?? "Unknown account"} <span className="font-normal text-[#6b7280]">· {roleToLabel(r.role)}</span>
                </p>
                <p className="text-[13px] text-[#6b7280]">
                  {r.client_name?.trim() || "Claude"} · connected {when(r.created_at)} · last used {when(r.last_used_at)}
                </p>
              </div>
              {confirming === r.id ? (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => void disconnect(r.id)} disabled={busy === r.id} className="rounded-lg bg-[#b42318] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#912018] disabled:opacity-60">
                    {busy === r.id ? "Disconnecting…" : "Yes, disconnect"}
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} className="rounded-lg border border-[#e8eaed] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#001f3f] hover:bg-[#f4f6f9]">
                    Keep
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirming(r.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#e8eaed] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#001f3f] hover:bg-[#f4f6f9]">
                  <Unplug className="h-3.5 w-3.5" /> Disconnect
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function EndpointCard({ e, base, apiKey }: { e: ApiEndpoint; base: string; apiKey: string | null }) {
  const url = `${base}${e.path}`
  const curl = `curl -H "Authorization: Bearer ${apiKey ?? "<key>"}" "${url}?${e.examples[0]?.query ?? ""}"`
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e8eaed] bg-white shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e8eaed] px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-['Outfit'] text-[18px] font-bold text-[#001f3f]">{e.name}</h2>
          <p className="mt-0.5 text-[14px] text-[#6b7280]">{e.summary}</p>
        </div>
        <code className="rounded-lg bg-[#001f3f] px-2.5 py-1.5 text-[13px] font-semibold text-white">
          GET {e.path}
        </code>
      </div>

      <div className="grid gap-5 px-5 py-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-bold tracking-[0.12em] text-[#6b7280]">WHAT COMES BACK</p>
            <p className="mt-1 text-[14px] leading-relaxed text-[#374151]">{e.returns}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-[0.12em] text-[#6b7280]">PARAMETERS</p>
            <dl className="mt-1.5 divide-y divide-[#f0f2f5] rounded-xl border border-[#e8eaed]">
              {e.params.map((p) => (
                <div key={p.name} className="flex gap-3 px-3 py-2">
                  <dt className="w-[108px] shrink-0 font-mono text-[13px] font-semibold text-[#001f3f]">{p.name}</dt>
                  <dd className="text-[13.5px] text-[#374151]">{p.meaning}</dd>
                </div>
              ))}
            </dl>
          </div>
          {e.notes?.length ? (
            <ul className="list-disc space-y-1 pl-5 text-[13.5px] text-[#6b7280]">
              {e.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-bold tracking-[0.12em] text-[#6b7280]">TRY IT</p>
            <div className="mt-1.5 flex flex-col gap-2">
              {e.examples.map((x) => {
                const href = `${url}?${apiKey ? `key=${encodeURIComponent(apiKey)}&` : ""}${x.query}`
                return (
                  <div key={x.query} className="flex items-center gap-2 rounded-xl border border-[#e8eaed] bg-[#f8fafd] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-[#111827]">{x.label}</p>
                      <p className="truncate font-mono text-[12px] text-[#6b7280]">
                        {e.path}?{x.query}
                      </p>
                    </div>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-disabled={!apiKey}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold ${apiKey ? "bg-[#001f3f] text-white hover:bg-[#002b57]" : "pointer-events-none bg-[#e8eaed] text-[#9ca3af]"}`}
                    >
                      Open <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )
              })}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-[0.12em] text-[#6b7280]">FROM CODE</p>
            <div className="mt-1.5 rounded-xl bg-[#0d1117] p-3">
              <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed text-[#e6edf3]">{curl}</pre>
              <div className="mt-2 flex justify-end">
                <CopyButton text={curl} label="Copy curl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function ApiPage() {
  const { user, role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role) && canSeeApiPage(user?.id))
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [show, setShow] = useState(false)
  const [base, setBase] = useState("")

  // Promise callbacks rather than await: state is set when the answer arrives, never inside the effect itself.
  const load = useCallback(
    () =>
      fetch("/api/admin/api-page", { cache: "no-store" })
        .then((res) => res.json().catch(() => ({})).then((json: Partial<Status> & { error?: string }) => ({ res, json })))
        .then(({ res, json }) => {
          if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status}).`)
          setBase(window.location.origin)
          setStatus(json as Status)
          setError(null)
        })
        .catch((e: Error) => setError(e.message)),
    [],
  )

  useEffect(() => {
    if (!allowed) return
    void load()
  }, [allowed, load])

  if (!allowed) return null

  const apiKey = status?.key ?? null
  const masked = apiKey ? `${apiKey.slice(0, 6)}${"•".repeat(Math.max(8, apiKey.length - 10))}${apiKey.slice(-4)}` : null

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 font-['Outfit'] text-2xl font-bold text-[#0d1117]">
            <Webhook className="h-6 w-6 text-[#b8913f]" aria-hidden="true" />
            API
          </h1>
          <p className="mt-1 text-[14px] text-[#6b7280]">
            The endpoints FHI gives the group&apos;s AI chat. This page is for your account only. Links on this page call <span className="font-semibold text-[#374151]">{base || "this site"}</span>; the live site answers the same way at https://fhiglobal.ae once the key is set in Vercel.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-xl border border-[#e8eaed] bg-white px-3 py-2 text-[14px] font-semibold text-[#374151] hover:bg-[#f4f6f9]">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* The key */}
      <section className="rounded-2xl border border-[#e8eaed] bg-white px-5 py-4 shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)]">
        <div className="flex flex-wrap items-center gap-3">
          <KeyRound className="h-5 w-5 text-[#b8913f]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-['Outfit'] text-[16px] font-bold text-[#001f3f]">API key</p>
            {error ? (
              <p className="text-[14px] text-[#be123c]">{error}</p>
            ) : !status ? (
              <p className="text-[14px] text-[#6b7280]">Checking…</p>
            ) : status.configured ? (
              <p className="text-[14px] text-[#374151]">
                Set on this server ({status.environment}). Send it as <code className="rounded bg-[#f4f6f9] px-1.5 py-0.5 font-mono text-[12.5px]">Authorization: Bearer &lt;key&gt;</code>, or add <code className="rounded bg-[#f4f6f9] px-1.5 py-0.5 font-mono text-[12.5px]">?key=</code> to a link for a quick look.
              </p>
            ) : (
              <p className="text-[14px] text-[#b45309]">
                Not set on this server ({status.environment}). Add <code className="rounded bg-[#fffbeb] px-1.5 py-0.5 font-mono text-[12.5px]">FHI_EXTERNAL_API_KEY</code> to the environment (Vercel → Settings → Environment Variables) and redeploy; until then the endpoints answer 503.
              </p>
            )}
          </div>
          {apiKey ? (
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-lg bg-[#f4f6f9] px-3 py-2 font-mono text-[13px] text-[#111827]">{show ? apiKey : masked}</code>
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide key" : "Show key"} className="inline-flex items-center gap-1.5 rounded-lg border border-[#e8eaed] bg-white px-2.5 py-1.5 text-[13px] font-semibold text-[#374151] hover:bg-[#f4f6f9]">
                {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {show ? "Hide" : "Show"}
              </button>
              <CopyButton text={apiKey} label="Copy key" />
            </div>
          ) : null}
        </div>
      </section>

      {/* The same endpoints as tools for Claude (app/api/mcp, lib/mcp/server.ts). */}
      <section className="rounded-2xl border border-[#e8eaed] bg-white px-5 py-4 shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)]">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#b8913f]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-['Outfit'] text-[16px] font-bold text-[#001f3f]">Connect to Claude (MCP)</p>
            <p className="mt-1 text-[14px] text-[#374151]">
              Every endpoint below is a read-only tool Claude can call while you chat: sales, top sellers, sales summary, accounts, projects, developers, teams, events, merchants. So is everything the admin FHI Assistant can read: website traffic and search keywords from Google, leads, the pipeline, tickets, purchases, websites, listings, clients, reviews, the activity log, member lookup, owner documents, events, news, data health. The server is{" "}
              <code className="rounded bg-[#f4f6f9] px-1.5 py-0.5 font-mono text-[12.5px]">{status?.site ?? base}/api/mcp</code> and it takes the same key. Agents and team leaders use the sign-in address{" "}
              <code className="rounded bg-[#f4f6f9] px-1.5 py-0.5 font-mono text-[12.5px]">{status?.site ?? base}/api/mcp/me</code> from Connect Claude in their dashboard: no key, their FHI login, and their Claude reads only their own data (an admin signing in there gets these same tools).
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-[#e8eaed] bg-[#f8fafc] px-4 py-3 text-[13.5px] leading-relaxed text-[#374151]">
                <p className="font-semibold text-[#0d1117]">In claude.ai</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                  <li>Customize → Connectors → Add → Add custom connector.</li>
                  <li>Name: FHI Global. URL: <code className="font-mono text-[12.5px]">{status?.site ?? base}/api/mcp</code>.</li>
                  <li>Authentication: no sign-in, and add a request header <code className="font-mono text-[12.5px]">Authorization</code> with the value <code className="font-mono text-[12.5px]">Bearer &lt;key&gt;</code>. If the connector settings offer no header field, use the URL <code className="font-mono text-[12.5px]">{status?.site ?? base}/api/mcp?key=&lt;key&gt;</code> instead.</li>
                  <li>Add, then ask Claude anything about FHI&apos;s data.</li>
                </ol>
              </div>
              <div className="rounded-xl border border-[#e8eaed] bg-[#f8fafc] px-4 py-3 text-[13.5px] leading-relaxed text-[#374151]">
                <p className="font-semibold text-[#0d1117]">In Claude Code</p>
                <div className="mt-1 flex items-start gap-2 rounded-lg bg-[#0d1117] px-3 py-2">
                  <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed text-[#e6edf3]">{`claude mcp add --transport http fhi ${status?.site ?? base}/api/mcp --header "Authorization: Bearer ${apiKey ?? "<key>"}"`}</pre>
                  <CopyButton text={`claude mcp add --transport http fhi ${status?.site ?? base}/api/mcp --header "Authorization: Bearer ${apiKey ?? "<key>"}"`} label="Copy" />
                </div>
                <p className="mt-2">For FH ONE, the Messages API&apos;s MCP connector takes the same URL and key.</p>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-[#e8eaed] bg-[#f8fafc] px-4 py-3 text-[13.5px] leading-relaxed text-[#374151]">
              <p className="font-semibold text-[#0d1117]">Things to ask Claude</p>
              <ul className="mt-1.5 space-y-1.5">
                {CLAUDE_QUESTIONS.map((q) => (
                  <li key={q} className="flex items-center justify-between gap-3">
                    <span className="min-w-0">&ldquo;{q}&rdquo;</span>
                    <CopyButton text={q} label="Copy" className="shrink-0" />
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[13px] text-[#6b7280]">claude.ai reads the tool list when the connector is added. When new tools are added here, remove the connector and add it again once; changes inside a tool need nothing.</p>
            </div>
          </div>
        </div>
      </section>

      <ClaudeSignIns />

      {API_ENDPOINTS.map((e) => (
        <EndpointCard key={e.key} e={e} base={base} apiKey={apiKey} />
      ))}

      <p className="text-[13px] text-[#9ca3af]">
        Full field list with sample responses: <code className="font-mono">guides/external-api.md</code> in the repo. The older users route for Rentsouq is separate and is not listed here.
      </p>
    </div>
  )
}
