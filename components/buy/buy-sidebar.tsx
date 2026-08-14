import Image from "next/image"
import Link from "next/link"
import { Bell, Star } from "lucide-react"
import { fetchArticles } from "@/lib/news-service"

function fmt(dateStr: string) {
  if (!dateStr) return ""
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  } catch {
    return dateStr
  }
}

function recommendedForListingBase(base: "/buy" | "/rent") {
  return [
    { label: "Apartments in Downtown Dubai", href: `${base}?q=Downtown+Dubai&type=apartment` },
    { label: "2 bedroom homes in Dubai Marina", href: `${base}?q=Marina&beds=2` },
    { label: "Villas in Palm Jumeirah", href: `${base}?q=Palm&type=villa` },
    { label: "Properties in Abu Dhabi", href: `${base}?q=Abu+Dhabi` },
    { label: "Featured projects", href: "/projects?featured=true" },
  ]
}

const USEFUL = [
  { label: "Apartments for rent in the UAE", href: "/rent?q=UAE&type=apartment" },
  { label: "Villa compound for sale", href: "/buy?q=villa+compound+UAE&type=villa" },
  { label: "All projects", href: "/projects" },
  { label: "Developers", href: "/developers" },
  { label: "News & insights", href: "/news" },
  { label: "Contact an advisor", href: "/contact" },
]

/** Skeleton for the async news block so the main column can stream without waiting on the news API. */
export function BuySidebarNewsSkeleton() {
  return (
    <div
      className="border border-[#e8eaed] bg-white p-5 shadow-sm animate-pulse"
      aria-hidden
    >
      <div className="h-4 w-48 bg-[#e2e8f0] mb-4" />
      <ul className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <li key={i} className="flex gap-3">
            <div className="w-20 h-14 shrink-0 bg-[#e2e8f0]" />
            <div className="flex-1 space-y-2 min-w-0">
              <div className="h-3 bg-[#e2e8f0] w-full" />
              <div className="h-3 bg-[#e2e8f0] w-4/5" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function BuySidebarTop() {
  return (
    <>
      <div className="border border-[#e8e4dc] bg-[#e8e6e1] min-h-[200px] flex flex-col items-center justify-center gap-1 py-8 px-4">
        <span className="text-sm font-bold tracking-[0.2em] text-[#9ca3af]">ADS</span>
        <span className="text-xs text-[#94a3b8]">Advertisement</span>
      </div>

      <Link
        href="/contact"
        className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-white border-2 border-[#d6b357] text-[#c9a449] text-[11px] font-bold uppercase tracking-[0.12em] hover:bg-[#fffdf8] transition-colors shadow-sm"
      >
        <Bell className="w-4 h-4 text-[#d6b357] shrink-0" />
        Alert me of new properties
      </Link>
    </>
  )
}

async function loadSidebarArticles() {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 5000)
  try {
    return (await fetchArticles(1, { signal: ac.signal })).slice(0, 5)
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

export async function BuySidebarNews() {
  const articles = await loadSidebarArticles()

  return (
    <div className="border border-[#e8eaed] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 border-b border-[#001f3f]/10 pb-3 mb-4">
        <Star className="w-3.5 h-3.5 text-[#d6b357] fill-[#d6b357]" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#001f3f]">
          UAE latest updates
        </h3>
      </div>
      {articles.length === 0 ? (
        <p className="text-sm text-[#64748b]">
          News feed loads when the news API is configured.{" "}
          <Link href="/news" className="text-[#d6b357] font-medium hover:underline">
            Visit News
          </Link>
        </p>
      ) : (
        <ul className="space-y-4">
          {articles.map((item) => (
            <li key={item.id}>
              <Link href={`/news/${item.slug}`} className="flex gap-3 group">
                <div className="relative w-20 h-14 shrink-0 overflow-hidden bg-[#f1f5f9]">
                  <Image
                    src={item.img}
                    alt=""
                    fill
                    className="object-cover group-hover:scale-105 transition-transform"
                    sizes="80px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#001f3f] leading-snug line-clamp-3 group-hover:text-[#d6b357] transition-colors">
                    {item.title}
                  </p>
                  {item.date && (
                    <p className="text-[10px] text-[#94a3b8] mt-1">{fmt(item.date)}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function BuySidebarBottom({ searchBasePath = "/buy" }: { searchBasePath?: "/buy" | "/rent" }) {
  const recommended = recommendedForListingBase(searchBasePath)
  return (
    <>
      <div className="border border-[#e8eaed] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#001f3f]/10 pb-3 mb-4">
          <Star className="w-3.5 h-3.5 text-[#d6b357] fill-[#d6b357]" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#001f3f]">
            Recommended searches
          </h3>
        </div>
        <ul className="space-y-2.5">
          {recommended.map((r) => (
            <li key={r.href}>
              <Link
                href={r.href}
                className="text-sm text-[#475569] hover:text-[#d6b357] transition-colors leading-snug"
              >
                {r.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="border border-[#e8eaed] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#001f3f]/10 pb-3 mb-4">
          <Star className="w-3.5 h-3.5 text-[#d6b357] fill-[#d6b357]" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#001f3f]">
            Useful links
          </h3>
        </div>
        <ul className="space-y-2.5">
          {USEFUL.map((r) => (
            <li key={r.href}>
              <Link
                href={r.href}
                className="text-sm text-[#475569] hover:text-[#d6b357] transition-colors"
              >
                {r.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="border border-[#e8e4dc] bg-[#e8e6e1] min-h-[160px] flex flex-col items-center justify-center gap-1 py-8 px-4">
        <span className="text-sm font-bold tracking-[0.2em] text-[#9ca3af]">ADS</span>
        <span className="text-xs text-[#94a3b8]">Advertisement</span>
      </div>
    </>
  )
}
