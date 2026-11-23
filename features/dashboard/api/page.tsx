"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Copy, ExternalLink, Eye, EyeOff, KeyRound, RefreshCw, Sparkles, Webhook } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { isAdminStaffRole } from "@/lib/app-roles"
import { API_ENDPOINTS, canSeeApiPage, type ApiEndpoint } from "@/lib/api-catalog"

/**
 * API — the keyed external endpoints and their key, for the one account that
 * builds the group's AI chat against FHI (lib/api-catalog.ts API_PAGE_OWNERS,
 * Juliecor 2026-11-17). Everything on the page is built from the catalog, so
 * a new endpoint is one entry there. The key comes from
 * GET /api/admin/api-page and is shown masked; example links open with it.
 */

type Status = { configured: boolean; key: string | null; site: string; environment: string }

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
              Every endpoint below is also a read-only tool Claude can call while you chat: sales, top sellers, sales summary, accounts, projects, developers, teams, events, merchants. The server is{" "}
              <code className="rounded bg-[#f4f6f9] px-1.5 py-0.5 font-mono text-[12.5px]">{status?.site ?? base}/api/mcp</code> and it takes the same key.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-[#e8eaed] bg-[#f8fafc] px-4 py-3 text-[13.5px] leading-relaxed text-[#374151]">
                <p className="font-semibold text-[#0d1117]">In claude.ai</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                  <li>Customize → Connectors → Add → Add custom connector.</li>
                  <li>Name: FHI Global. URL: <code className="font-mono text-[12.5px]">{status?.site ?? base}/api/mcp</code>.</li>
                  <li>Authentication: no sign-in, and add a request header <code className="font-mono text-[12.5px]">Authorization</code> with the value <code className="font-mono text-[12.5px]">Bearer &lt;key&gt;</code>.</li>
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
          </div>
        </div>
      </section>

      {API_ENDPOINTS.map((e) => (
        <EndpointCard key={e.key} e={e} base={base} apiKey={apiKey} />
      ))}

      <p className="text-[13px] text-[#9ca3af]">
        Full field list with sample responses: <code className="font-mono">guides/external-api.md</code> in the repo. The older users route for Rentsouq is separate and is not listed here.
      </p>
    </div>
  )
}
