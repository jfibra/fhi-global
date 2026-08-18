"use client"

// The homepage omnisearch — one white bar that searches the live catalog as
// the visitor types. Suggestions are grouped (Projects / Developers /
// Communities) and each one deep-links to its own page; Enter with nothing
// picked runs the full projects search. Built for the hero: square, hairline
// dividers, gold action — no chrome.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Building2, Loader2, MapPin, Search } from "lucide-react"

type Suggestion =
  | { kind: "project"; name: string; href: string; detail: string | null; price: string | null; image: string | null }
  | { kind: "developer"; name: string; href: string; logo: string | null }
  | { kind: "city"; name: string; href: string }

type ApiPayload = {
  projects?: Array<{
    name: string
    slug: string | null
    city: string | null
    image: string | null
    devSlug: string | null
    devName: string | null
    price: number | null
    currency: string | null
  }>
  developers?: Array<{ name: string; slug: string | null; logo_url: string | null }>
  cities?: string[]
}

/** Compact money: 2.6M / 940K. */
function money(value: number, currency: string): string {
  if (value >= 999_500) {
    const m = value / 1_000_000
    return `From ${currency} ${m.toFixed(m >= 10 ? 1 : 2)}M`
  }
  if (value >= 1_000) return `From ${currency} ${Math.round(value / 1_000)}K`
  return `From ${currency} ${value.toLocaleString("en-US")}`
}

export function HeroSearch() {
  const router = useRouter()
  const [term, setTerm] = useState("")
  const [items, setItems] = useState<Suggestion[]>([])
  const [openFor, setOpenFor] = useState("") // the term the current items answer
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState(-1)
  const [focused, setFocused] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Debounced live lookup against /api/home-search.
  const lookup = useCallback((value: string) => {
    clearTimeout(debounceRef.current)
    const q = value.trim()
    if (q.length < 2) {
      setItems([])
      setOpenFor("")
      setBusy(false)
      return
    }
    setBusy(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/home-search?q=${encodeURIComponent(q)}`)
        const data = (await res.json()) as ApiPayload
        const next: Suggestion[] = [
          ...(data.projects ?? []).map((p): Suggestion => ({
            kind: "project",
            name: p.name,
            href: p.slug ? (p.devSlug ? `/${p.devSlug}/${p.slug}` : `/projects/${p.slug}`) : "/projects",
            detail: [p.devName, p.city].filter(Boolean).join(" · ") || null,
            image: p.image,
            price:
              typeof p.price === "number" && p.price > 0
                ? money(p.price, (p.currency ?? "AED").toUpperCase())
                : null,
          })),
          ...(data.developers ?? []).map((d): Suggestion => ({
            kind: "developer",
            name: d.name,
            href: d.slug ? `/${d.slug}` : "/developers",
            logo: d.logo_url,
          })),
          ...(data.cities ?? []).map((c): Suggestion => ({
            kind: "city",
            name: c,
            href: `/projects?city=${encodeURIComponent(c)}`,
          })),
        ]
        setItems(next)
        setOpenFor(q)
        setActive(-1)
      } catch {
        setItems([])
        setOpenFor("")
      } finally {
        setBusy(false)
      }
    }, 220)
  }, [])
  useEffect(() => () => clearTimeout(debounceRef.current), [])

  // Click outside closes the panel.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setFocused(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  const showPanel = focused && term.trim().length >= 2 && (items.length > 0 || busy || openFor !== "")
  const allHref = `/projects?q=${encodeURIComponent(term.trim())}`

  const go = useCallback(
    (href: string) => {
      setFocused(false)
      router.push(href)
    },
    [router],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setFocused(false)
      return
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      if (items.length === 0) return
      setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + items.length + 1) % (items.length + 1) - 1)
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      if (active >= 0 && items[active]) go(items[active].href)
      else if (term.trim()) go(allHref)
    }
  }

  const groups = useMemo(
    () =>
      [
        { label: "Projects", kinds: items.filter((i) => i.kind === "project") },
        { label: "Developers", kinds: items.filter((i) => i.kind === "developer") },
        { label: "Communities", kinds: items.filter((i) => i.kind === "city") },
      ].filter((g) => g.kinds.length > 0),
    [items],
  )

  return (
    <div ref={boxRef} className="relative w-full">
      {/* The bar */}
      <div className="flex items-stretch bg-white shadow-[0_24px_70px_-24px_rgba(0,10,30,0.55)]">
        <div className="flex flex-1 items-center gap-3.5 px-5">
          {busy ? (
            <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin text-[#b8913f]" />
          ) : (
            <Search className="h-[18px] w-[18px] shrink-0 text-[#b8913f]" />
          )}
          <input
            type="text"
            value={term}
            onChange={(e) => {
              setTerm(e.target.value)
              lookup(e.target.value)
            }}
            onFocus={() => setFocused(true)}
            onKeyDown={onKeyDown}
            placeholder="Search projects, developers or communities…"
            aria-label="Search projects, developers or communities"
            className="w-full bg-transparent py-[18px] text-[15px] text-[#0f2940] placeholder:text-[#9aa3ae] focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => term.trim() && go(allHref)}
          className="flex shrink-0 items-center gap-2 bg-[#d6b357] px-7 text-xs font-bold uppercase tracking-[0.18em] text-[#001f3f] transition-colors duration-300 hover:bg-[#c8a544]"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search</span>
        </button>
      </div>

      {/* Live results */}
      {showPanel && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden bg-white shadow-[0_30px_80px_-20px_rgba(0,10,30,0.55)]">
          {items.length === 0 && !busy ? (
            <p className="px-5 py-4 text-sm text-[#6b7280]">
              Nothing in the catalog matches <strong className="text-[#0f2940]">“{openFor}”</strong> yet.
            </p>
          ) : (
            <>
              {groups.map((g) => (
                <div key={g.label}>
                  <p className="border-b border-[#f0f2f5] bg-[#fbfaf7] px-5 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#b8913f]">
                    {g.label}
                  </p>
                  {g.kinds.map((s) => {
                    const idx = items.indexOf(s)
                    return (
                      <button
                        key={`${s.kind}-${s.name}`}
                        type="button"
                        onClick={() => go(s.href)}
                        onMouseEnter={() => setActive(idx)}
                        className={`flex w-full items-center gap-3 border-b border-[#f5f6f8] px-5 py-3 text-left transition-colors ${
                          idx === active ? "bg-[#faf7ee]" : "bg-white"
                        }`}
                      >
                        {s.kind === "project" &&
                          (s.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={s.image}
                              alt=""
                              className="h-10 w-12 shrink-0 border border-[#eceef1] object-cover"
                            />
                          ) : (
                            <span className="flex h-10 w-12 shrink-0 items-center justify-center bg-[#001f3f]">
                              <Building2 className="h-4 w-4 text-[#d6b357]" />
                            </span>
                          ))}
                        {s.kind === "developer" &&
                          (s.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={s.logo}
                              alt=""
                              className="h-8 w-8 shrink-0 border border-[#eceef1] bg-white object-contain p-0.5"
                            />
                          ) : (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#eceef1] bg-white">
                              <Building2 className="h-4 w-4 text-[#9aa3ae]" />
                            </span>
                          ))}
                        {s.kind === "city" && (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#f4f5f7]">
                            <MapPin className="h-4 w-4 text-[#b8913f]" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[#0f2940]">{s.name}</span>
                          {s.kind === "project" && s.detail && (
                            <span className="block truncate text-xs text-[#8a93a0]">{s.detail}</span>
                          )}
                          {s.kind === "developer" && (
                            <span className="block text-xs text-[#8a93a0]">Developer portfolio</span>
                          )}
                          {s.kind === "city" && (
                            <span className="block text-xs text-[#8a93a0]">Browse projects in this community</span>
                          )}
                        </span>
                        {s.kind === "project" && s.price && (
                          <span className="shrink-0 text-xs font-bold text-[#b8913f]">{s.price}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
              <button
                type="button"
                onClick={() => go(allHref)}
                className="flex w-full items-center justify-between px-5 py-3.5 text-left text-sm font-bold text-[#001f3f] transition-colors hover:bg-[#faf7ee]"
              >
                See all results for “{term.trim()}”
                <ArrowRight className="h-4 w-4 text-[#b8913f]" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
