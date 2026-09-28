"use client"

// Search + A to Z + grid for the public agents directory.
//
// Filtering is client-side on purpose: the whole roster is ~50 people, already
// on the page, so matching as you type beats a round trip. If the roster ever
// runs to hundreds this should move to a server query with a URL param, the
// way /projects and /developers work.

import { useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, Globe, MessageCircle, Phone, Search, Star, UserRound, Users } from "lucide-react"
import { InView } from "@/components/public/in-view"

export type PublicAgent = {
  id: string
  name: string
  photo: string | null
  /** The photo was uploaded to FHI (not a Google account picture). */
  uploaded: boolean
  leader: boolean
  phone: string | null
  whatsapp: string | null
  /** Published agent website slug (/website/<slug>). */
  website: string | null
  /** Approved client reviews only. */
  rating: { average: number; count: number } | null
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase()

/**
 * Stands in for a missing portrait: a darkened skyline title card with the
 * agent's monogram in a gold ring, so the gap reads as designed rather than
 * empty. Replaced automatically once the agent uploads a photo.
 */
export function TitleCard({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const lg = size === "lg"
  return (
    <span className="absolute inset-0 overflow-hidden bg-[#06182e]">
      <Image src="/background/dubai.webp" alt="" fill sizes={lg ? "33vw" : "20vw"} className="object-cover object-bottom opacity-30 grayscale" aria-hidden="true" />
      <span className="absolute inset-0 bg-gradient-to-t from-[#06182e] via-[#06182e]/60 to-[#06182e]/85" aria-hidden="true" />
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        <span
          className={`flex items-center justify-center rounded-full border border-[#d6b357]/70 font-['Outfit'] font-bold text-[#d6b357] ${
            lg ? "h-32 w-32 text-[46px]" : "h-20 w-20 text-[28px]"
          }`}
        >
          {initials(name)}
        </span>
        <Image
          src="/FHI_Branding_White.png"
          alt=""
          width={120}
          height={37}
          className={`opacity-50 ${lg ? "w-[104px]" : "w-[72px]"}`}
          style={{ height: "auto" }}
          aria-hidden="true"
        />
      </span>
    </span>
  )
}

export function AgentsGrid({ agents }: { agents: PublicAgent[] }) {
  const [query, setQuery] = useState("")
  const [letter, setLetter] = useState("")

  const letters = useMemo(() => [...new Set(agents.map((a) => a.name.charAt(0).toUpperCase()))].sort(), [agents])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    // Every whitespace-separated term must appear somewhere in the name, so
    // "mar cruz" finds "Maria Santa Cruz" regardless of word order.
    const terms = q ? q.split(/\s+/) : []
    return agents.filter((a) => {
      if (letter && a.name.charAt(0).toUpperCase() !== letter) return false
      const name = a.name.toLowerCase()
      return terms.every((t) => name.includes(t))
    })
  }, [agents, query, letter])

  return (
    <>
      {/* Toolbar — search, letters and the live count; sticks under the slim header */}
      <div className="z-[40] mt-8 border-y border-[#e8eaed] bg-white/85 backdrop-blur-xl lg:sticky lg:top-[72px]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:gap-5 lg:px-8">
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name…"
              aria-label="Search agents by name"
              className="w-full border border-[#e5e8ec] bg-white py-2.5 pl-10 pr-4 text-sm text-[#0d1117] placeholder:text-[#9ca3af] focus:border-[#001f3f] focus:outline-none"
            />
          </div>
          <div role="group" aria-label="First letter" className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
            <button type="button" onClick={() => setLetter("")} aria-pressed={!letter} className={`ag-letter ${!letter ? "ag-letter--on" : ""}`}>
              All
            </button>
            {letters.map((l) => (
              <button key={l} type="button" onClick={() => setLetter(letter === l ? "" : l)} aria-pressed={letter === l} className={`ag-letter ${letter === l ? "ag-letter--on" : ""}`}>
                {l}
              </button>
            ))}
          </div>
          <span className="shrink-0 text-[13px] text-[#6b7280]">
            <span className="font-['Outfit'] text-[15px] font-bold text-[#0d1117]">{results.length}</span> advisor{results.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-[#e5e8ec] bg-white py-24 text-center">
            <Users className="mb-3 h-8 w-8 text-[#001f3f]/25" />
            <p className="mb-1 font-['Outfit'] text-sm font-semibold text-[#0d1117]">
              {agents.length === 0 ? "No agents listed yet" : `No advisors match “${[letter, query.trim()].filter(Boolean).join(" · ")}”`}
            </p>
            <p className="text-xs text-[#6b7280]">
              {agents.length === 0 ? "Please check back shortly." : "Try a different spelling or a first name."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
            {results.map((a, i) => {
              const wa = a.whatsapp?.replace(/[^\d]/g, "")
              return (
                <InView
                  key={a.id}
                  as="article"
                  threshold={0.15}
                  className="ag-card group flex flex-col border border-[#e5e8ec] bg-white"
                  style={{ ["--i" as string]: i % 5 }}
                >
                  {/* Portrait → the agent's public profile. object-top because
                      headshots crop badly from the centre. */}
                  <Link href={`/business-card/${a.id}`} aria-label={`${a.name}: view profile`} className="relative block aspect-[4/5] overflow-hidden bg-[#0b2a4d]">
                    {a.photo ? (
                      <Image
                        src={a.photo}
                        alt={a.name}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                        className="ag-card-img object-cover object-top"
                      />
                    ) : (
                      <TitleCard name={a.name} />
                    )}
                    {a.leader && (
                      <span className="absolute left-2.5 top-2.5 bg-[#d6b357] px-2 py-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#001f3f]">
                        Team leader
                      </span>
                    )}
                    {a.rating && (
                      <span
                        className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 bg-[#06182e]/80 px-2 py-1 text-[11px] font-bold text-white backdrop-blur"
                        title={`${a.rating.count} approved client review${a.rating.count === 1 ? "" : "s"}`}
                      >
                        <Star className="h-3 w-3 fill-[#d6b357] text-[#d6b357]" />
                        {a.rating.average.toFixed(1)}
                        <span className="font-semibold text-white/60">({a.rating.count})</span>
                      </span>
                    )}
                    <span className="ag-card-veil" aria-hidden="true">
                      View profile <ArrowUpRight className="h-3.5 w-3.5 text-[#d6b357]" />
                    </span>
                  </Link>

                  <div className="flex flex-1 flex-col p-3 sm:p-4">
                    <h3 className="line-clamp-2 font-['Outfit'] text-[14px] font-bold leading-snug text-[#0d1117] transition-colors group-hover:text-[#8a6d2b] sm:text-[15px]">
                      <Link href={`/business-card/${a.id}`}>{a.name}</Link>
                    </h3>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#b8913f]">
                      {a.leader ? "Team leader" : "Property advisor"}
                    </p>
                    {/* Only the channels this agent actually has — a dead
                        tel: link is worse than no button. */}
                    <div className="mt-auto flex gap-1.5 pt-3">
                        {wa && (
                          <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${a.name}`} className="ag-act ag-act--wa flex-1">
                            <MessageCircle className="h-4 w-4" />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </a>
                        )}
                        {a.phone && (
                          <a href={`tel:${a.phone.replace(/\s+/g, "")}`} aria-label={`Call ${a.name}`} className="ag-act">
                            <Phone className="h-4 w-4" />
                          </a>
                        )}
                        {a.website && (
                          <Link href={`/website/${a.website}`} aria-label={`${a.name}'s website`} title="Personal website" className="ag-act">
                            <Globe className="h-4 w-4" />
                          </Link>
                        )}
                        {/* No number on file: the profile is still one tap away. */}
                        {!wa && !a.phone && (
                          <Link href={`/business-card/${a.id}`} className="ag-act flex-1">
                            <UserRound className="h-4 w-4" /> Profile
                          </Link>
                        )}
                      </div>
                  </div>
                </InView>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
