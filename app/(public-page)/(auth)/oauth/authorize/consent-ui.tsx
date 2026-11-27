"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { Check, ShieldCheck } from "lucide-react"

/** The consent screen's frame: the login page's look (white, Outfit, navy), one centred card. */
export function ConsentShell({ children, problem }: { children?: ReactNode; problem?: string }) {
  return (
    <div className="min-h-screen bg-[#f4f6f9] px-4 py-10 font-sans flex items-center justify-center">
      <div className="w-full max-w-[520px]">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-block" aria-label="FHI Global">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/FHI_Branding Set_PNG Copies-02.png" alt="FHI Global" className="mx-auto h-16 w-auto object-contain" />
          </Link>
        </div>
        <div className="rounded-2xl border border-[#e8eaed] bg-white p-7 shadow-[0_8px_32px_-12px_rgba(0,31,63,0.25)]">
          {problem ? (
            <>
              <h1 className="font-['Outfit'] text-[22px] font-bold leading-tight text-[#0d1117]">The sign-in was stopped</h1>
              <p className="mt-3 text-[14.5px] leading-relaxed text-[#374151]">{problem}</p>
              <p className="mt-4 text-[13px] text-[#6b7280]">You can close this window.</p>
            </>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  )
}

type Props = {
  app: string
  backHost: string
  name: string
  roleLabel: string
  items: string[]
  /** A role that manages events is offered the one permission that writes (lib/oauth/server.ts OAUTH_SCOPE_EVENTS). */
  eventsOffer?: boolean
  /** The box's words: company events for admin staff, the person's own for agents and team leaders. */
  eventsLabel?: string
  /** The person has the Connect Claude page in their dashboard (agents, team leaders) — where they disconnect. */
  ownPage?: boolean
  params: Record<string, string>
  blocked: "inactive" | "role" | null
}

export function ConsentUI({ app, backHost, name, roleLabel, items, eventsOffer = false, eventsLabel = "Create, change and publish company events", ownPage = true, params, blocked }: Props) {
  const [busy, setBusy] = useState<"allow" | "deny" | null>(null)
  // Ticked by default: the person sees it, and unticking keeps the connection reading-only.
  const [events, setEvents] = useState(true)
  const writes = eventsOffer && events
  const [error, setError] = useState<string | null>(null)

  const decide = async (decision: "allow" | "deny") => {
    setBusy(decision)
    setError(null)
    try {
      const res = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...params, decision, events: writes }),
      })
      const json = (await res.json().catch(() => ({}))) as { redirect?: string; error?: string }
      if (!res.ok || !json.redirect) {
        setError(json.error ?? "Something went wrong. Try again.")
        setBusy(null)
        return
      }
      window.location.assign(json.redirect)
    } catch {
      setError("Couldn't reach FHI. Check your connection and try again.")
      setBusy(null)
    }
  }

  // flex-1 only side by side: stacked on a phone it would shrink the buttons to the text's height (23 px).
  const btn = "inline-flex h-11 shrink-0 items-center justify-center rounded-xl px-5 text-[15px] font-semibold transition-colors disabled:opacity-60 sm:flex-1"

  return (
    <ConsentShell>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#eaf3fb] text-[#001f3f]">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="font-['Outfit'] text-[22px] font-bold leading-tight text-[#0d1117]">
            {writes ? `Allow ${app} to read your FHI data and manage events?` : `Allow ${app} to read your FHI data?`}
          </h1>
          <p className="mt-1.5 text-[14px] text-[#4b5563]">
            Signed in as <span className="font-semibold text-[#0d1117]">{name}</span> · {roleLabel}
          </p>
        </div>
      </div>

      {blocked === "inactive" ? (
        <p className="mt-5 rounded-xl border border-[#f3d9b1] bg-[#fff7e8] px-4 py-3 text-[14px] text-[#7a4b00]">
          This FHI account is not active, so {app} cannot be connected to it. Ask an admin to activate the account first.
        </p>
      ) : blocked === "role" ? (
        <p className="mt-5 rounded-xl border border-[#f3d9b1] bg-[#fff7e8] px-4 py-3 text-[14px] text-[#7a4b00]">
          Claude tools are available for agents, team leaders and admin staff. This account&apos;s role ({roleLabel}) is not included yet.
        </p>
      ) : (
        <>
          <p className="mt-5 text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">{app} will be able to read</p>
          <ul className="mt-2 space-y-2">
            {items.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[14.5px] leading-relaxed text-[#1f2937]">
                <Check className="mt-1 h-4 w-4 shrink-0 text-[#1f7a4d]" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {eventsOffer ? (
            <>
              <p className="mt-5 text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">{app} can also</p>
              <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-[#e8eaed] bg-[#fafbfc] px-4 py-3">
                <input
                  type="checkbox"
                  checked={events}
                  onChange={(e) => setEvents(e.target.checked)}
                  disabled={busy !== null}
                  className="mt-1 h-[18px] w-[18px] shrink-0 accent-[#001f3f]"
                />
                <span className="text-[14.5px] leading-relaxed text-[#1f2937]">
                  <span className="font-semibold">{eventsLabel}</span>
                  <span className="mt-0.5 block text-[13.5px] text-[#4b5563]">
                    Every event starts as a draft, and it goes live only when you ask for it. Nothing can be deleted. Untick this to keep {app} reading only.
                  </span>
                </span>
              </label>
            </>
          ) : null}
          <p className="mt-4 text-[13px] leading-relaxed text-[#6b7280]">
            {writes ? "Apart from events, nothing is written to FHI." : "Reading only — nothing is written to FHI."} You can disconnect any time{ownPage ? " from Connect Claude in your dashboard" : ""}, and a deactivated account is disconnected at once.
          </p>
        </>
      )}

      {error ? <p className="mt-4 rounded-xl border border-[#f5c2c7] bg-[#fdecee] px-4 py-3 text-[14px] text-[#842029]">{error}</p> : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {!blocked ? (
          <button type="button" onClick={() => void decide("allow")} disabled={busy !== null} className={`${btn} bg-[#001f3f] text-white hover:bg-[#002b57]`}>
            {busy === "allow" ? "Connecting…" : "Allow"}
          </button>
        ) : null}
        <button type="button" onClick={() => void decide("deny")} disabled={busy !== null} className={`${btn} border border-[#e8eaed] bg-white text-[#001f3f] hover:bg-[#f4f6f9]`}>
          {busy === "deny" ? "Cancelling…" : "Cancel"}
        </button>
      </div>
      <p className="mt-4 text-center text-[12.5px] text-[#9ca3af]">You will be sent back to {backHost}.</p>
    </ConsentShell>
  )
}
