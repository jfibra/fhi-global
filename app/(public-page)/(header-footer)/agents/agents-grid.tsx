"use client"

// Search + grid for the public agents directory.
//
// Filtering is client-side on purpose: the whole roster is ~50 people, already
// on the page, so matching as you type beats a round trip. If the roster ever
// runs to hundreds this should move to a server query with a URL param, the
// way /projects and /developers work.

import { useMemo, useState } from "react"
import Image from "next/image"
import { MessageCircle, Phone, Search, Users } from "lucide-react"

export type PublicAgent = {
  id: string
  name: string
  photo: string | null
  phone: string | null
  whatsapp: string | null
}

export function AgentsGrid({ agents }: { agents: PublicAgent[] }) {
  const [query, setQuery] = useState("")

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return agents
    // Every whitespace-separated term must appear somewhere in the name, so
    // "mar cruz" finds "Maria Santa Cruz" regardless of word order.
    const terms = q.split(/\s+/)
    return agents.filter((a) => {
      const name = a.name.toLowerCase()
      return terms.every((t) => name.includes(t))
    })
  }, [agents, query])

  return (
    <>
      <div className="relative w-full sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search agents…"
          aria-label="Search agents by name"
          className="w-full bg-white border border-[#e5e8ec] pl-10 pr-4 py-3 text-sm text-[#0d1117] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f]"
        />
      </div>

      <div className="mt-8">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white border border-[#e5e8ec] text-center">
            <Users className="w-8 h-8 text-[#001f3f]/25 mb-3" />
            <p className="font-['Outfit'] font-semibold text-[#0d1117] text-sm mb-1">
              {agents.length === 0 ? "No agents listed yet" : `No agents match “${query.trim()}”`}
            </p>
            <p className="text-[#6b7280] text-xs">
              {agents.length === 0 ? "Please check back shortly." : "Try a different spelling or a first name."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            {results.map((a) => (
              <div
                key={a.id}
                className="group bg-white border border-[#e5e8ec] overflow-hidden transition-shadow duration-300 hover:shadow-[0_14px_40px_-16px_rgba(0,20,40,0.25)] flex flex-col"
              >
                {/* Portrait. object-top because headshots crop badly from the
                    centre — chins and foreheads go first. */}
                <div className="relative aspect-[4/5] bg-[#eef1f5] overflow-hidden">
                  {a.photo ? (
                    <Image
                      src={a.photo}
                      alt={a.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 20vw"
                      className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center bg-[#001f3f] p-6">
                      <Image
                        src="/FHI_Branding_White.png"
                        alt=""
                        width={150}
                        height={46}
                        className="w-[72%] max-w-[150px] h-auto object-contain opacity-90"
                        aria-hidden="true"
                      />
                    </span>
                  )}
                </div>

                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-['Outfit'] text-[15px] font-bold text-[#0d1117] leading-snug group-hover:text-[#b8913f] transition-colors line-clamp-2">
                    {a.name}
                  </h3>

                  {/* Contact row. Only the channels this agent actually has —
                      a dead tel: link is worse than no button. */}
                  {(a.phone || a.whatsapp) && (
                    <div className="mt-3 pt-3 border-t border-[#eef0f3] flex items-center gap-2">
                      {a.phone && (
                        <a
                          href={`tel:${a.phone.replace(/\s+/g, "")}`}
                          aria-label={`Call ${a.name}`}
                          className="flex-1 inline-flex items-center justify-center py-2 border border-[#e5e8ec] text-[#4b5563] hover:border-[#d6b357] hover:text-[#b8913f] transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}
                      {a.whatsapp && (
                        <a
                          href={`https://wa.me/${a.whatsapp.replace(/[^\d]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`WhatsApp ${a.name}`}
                          className="flex-1 inline-flex items-center justify-center py-2 border border-[#e5e8ec] text-[#4b5563] hover:border-[#25d366] hover:text-[#25d366] transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
