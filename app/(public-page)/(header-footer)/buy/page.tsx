import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { createPageMetadata } from "@/lib/seo"
import {
  deriveListings,
  listViewHrefFromSp,
  loadPublicAgentListings,
  type ListingSearchParams,
} from "@/lib/buy/listings-page-logic"
import { BuyFiltersLoader } from "./buy-filters-loader"
import { BuyListToolbar } from "@/components/buy/buy-list-toolbar"
import { BuyPropertyCard } from "@/components/buy/buy-property-card"
import {
  BuySidebarTop,
  BuySidebarNews,
  BuySidebarBottom,
  BuySidebarNewsSkeleton,
} from "@/components/buy/buy-sidebar"
import { BuyGoogleMap } from "@/components/buy/buy-google-map"
import { ChevronRight } from "lucide-react"

export const revalidate = 120

export const metadata: Metadata = createPageMetadata({
  title: "Buy Property in the United Arab Emirates | FHI Global",
  description:
    "Browse properties for sale in the UAE from FHI Global listings — filter by location, type, and budget. Listings are curated by our sales team.",
  pathname: "/buy",
  keywords: [
    "buy property UAE",
    "properties for sale Dubai",
    "FHI Global buy",
    "Dubai apartments for sale",
    "Abu Dhabi property",
  ],
})

function FiltersFallback() {
  return (
    <div
      className="flow-root w-full min-h-[152px] animate-pulse border-b border-[#e5e7eb] bg-white"
      aria-hidden
    />
  )
}

function ToolbarFallback() {
  return (
    <div className="h-10 w-full sm:w-48 shrink-0 rounded-full bg-[#f1f5f9] animate-pulse mb-0" aria-hidden />
  )
}

type Sp = Awaited<ListingSearchParams>

async function loadBuyListings() {
  return loadPublicAgentListings("buy")
}

function BuyMapPropertyListSkeleton() {
  return (
    <div className="space-y-5 animate-pulse pb-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden rounded-xl border border-[#d1d5db] bg-white shadow-sm md:flex-row"
        >
          <div className="aspect-[4/3] w-full bg-[#e2e8f0] md:w-[min(42%,320px)] md:min-h-[200px]" />
          <div className="flex flex-1 flex-col space-y-3 p-5">
            <div className="h-7 w-48 rounded bg-[#e2e8f0]" />
            <div className="h-3 w-full rounded bg-[#e2e8f0]" />
            <div className="h-3 w-3/4 rounded bg-[#e2e8f0]" />
          </div>
        </div>
      ))}
    </div>
  )
}

function BuyMapPropertyMapSkeleton() {
  return (
    <div className="min-h-[min(55vh,520px)] w-full rounded-xl border border-[#e8eaed] bg-[#e2e8f0] animate-pulse lg:min-h-[calc(100vh-9rem)]" />
  )
}

function BuyListingsSkeleton() {
  return (
    <div className="space-y-5">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-[#d1d5db] overflow-hidden flex flex-col md:flex-row animate-pulse shadow-sm"
        >
          <div className="w-full md:w-[min(42%,380px)] aspect-[4/3] md:min-h-[240px] bg-[#e2e8f0]" />
          <div className="flex-1 p-6 space-y-3">
            <div className="h-8 w-48 bg-[#e2e8f0] rounded" />
            <div className="h-4 w-full bg-[#e2e8f0] rounded" />
            <div className="h-4 w-3/4 bg-[#e2e8f0] rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

async function BuyMapListingSubtitle({ sp }: { sp: Sp }) {
  const { rows: agentRows, error: agentErr } = await loadBuyListings()
  const { totalLabel } = deriveListings(sp, agentRows, agentErr)
  if (agentErr || !totalLabel) return null
  return <p className="mt-1 text-sm text-[#64748b] sm:text-base">{totalLabel}</p>
}

async function BuyMapSplitList({ sp }: { sp: Sp }) {
  const { rows: agentRows, error: agentErr } = await loadBuyListings()
  const { properties } = deriveListings(sp, agentRows, agentErr)

  return (
    <div className="space-y-5 min-w-0 max-w-full">
      {agentErr && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          We couldn&apos;t load listings from the server. Check your connection and Supabase settings, then refresh
          the page.
        </div>
      )}
      {!agentErr && properties.length === 0 && (
        <div className="rounded-2xl border border-[#e8eaed] bg-white p-12 text-center">
          <p className="mb-4 text-[#475569]">
            No published sale listings match your filters yet. Try clearing filters or contact us for off-market
            options.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#d6b357] to-[#f0d890] px-6 py-3 text-sm font-bold text-[#001f3f]"
          >
            Contact an advisor
          </Link>
        </div>
      )}
      {!agentErr && properties.length > 0 && (
        <div className="flex flex-col gap-5">
          {properties.map((p) => (
            <BuyPropertyCard key={p.id} property={p} />
          ))}
        </div>
      )}
    </div>
  )
}

async function BuyMapSplitMap({ sp }: { sp: Sp }) {
  const { rows: agentRows, error: agentErr } = await loadBuyListings()
  const { mapMarkers } = deriveListings(sp, agentRows, agentErr)
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    ""

  return (
    <BuyGoogleMap
      apiKey={apiKey}
      markers={mapMarkers}
      listViewHref={listViewHrefFromSp(sp, "/buy")}
      fillHeight
    />
  )
}

async function BuyListingsColumn({ sp }: { sp: Sp }) {
  const { rows: agentRows, error: agentErr } = await loadBuyListings()
  const { properties, totalLabel } = deriveListings(sp, agentRows, agentErr)

  return (
    <>
      {agentErr && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          We couldn&apos;t load listings from the server. Check your connection and Supabase settings, then refresh
          the page.
        </div>
      )}
      {totalLabel && !agentErr && <p className="text-sm text-[#64748b]">{totalLabel}</p>}
      {!agentErr && properties.length === 0 && (
        <div className="rounded-2xl border border-[#e8eaed] bg-white p-12 text-center">
          <p className="text-[#475569] mb-4">
            No published sale listings match your filters yet. Try clearing filters or contact us for off-market
            options.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-gradient-to-r from-[#d6b357] to-[#f0d890] text-[#001f3f] text-sm font-bold"
          >
            Contact an advisor
          </Link>
        </div>
      )}
      {!agentErr &&
        properties.length > 0 &&
        properties.map((p) => <BuyPropertyCard key={p.id} property={p} />)}
    </>
  )
}

export default async function BuyPage({ searchParams }: { searchParams: ListingSearchParams }) {
  const sp = await searchParams
  const view = sp.view === "map" ? "map" : "list"

  const breadcrumbs = (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-[#6b7280] mb-4">
      <span className="text-[#0f2940] font-medium">For Sale:</span>
      <Link href="/" className="text-[#0f2940] hover:text-[#d6b357] transition-colors">
        Home
      </Link>
      <ChevronRight className="w-4 h-4 shrink-0 text-[#9ca3af]" />
      <span className="text-[#d6b357] font-semibold">Buy</span>
    </nav>
  )

  const titleRow = (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 md:gap-x-6 lg:flex-nowrap min-w-0 mb-6 lg:mb-7">
      <h1 className="font-['Outfit'] text-2xl sm:text-3xl md:text-[2.05rem] font-bold text-[#0f2940] tracking-tight leading-tight shrink-0 min-w-0">
        Properties for sale in the UAE
      </h1>
      <Suspense fallback={<ToolbarFallback />}>
        <BuyListToolbar listingBasePath="/buy" className="mb-0 w-full sm:w-auto shrink-0 min-w-0" />
      </Suspense>
    </div>
  )

  const mapViewTitleRow = (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-['Outfit'] text-2xl font-bold leading-tight tracking-tight text-[#0f2940] sm:text-3xl">
          Properties for sale in the UAE
        </h1>
        <Suspense
          fallback={<span className="mt-2 inline-block h-5 w-56 animate-pulse rounded bg-[#e2e8f0]" aria-hidden />}
        >
          <BuyMapListingSubtitle sp={sp} />
        </Suspense>
      </div>
      <Suspense fallback={<ToolbarFallback />}>
        <BuyListToolbar listingBasePath="/buy" className="mb-0 shrink-0" />
      </Suspense>
    </div>
  )

  return (
    <div
      className={`relative min-h-screen font-sans ${view === "map" ? "bg-[#f6f7f9]" : "bg-[#faf8f4]"}`}
    >
      {view !== "map" && (
        <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-20 blur-[100px] -z-10 bg-[radial-gradient(circle,rgb(200,235,255)_0%,transparent_70%)]" />
      )}

      <Suspense fallback={<FiltersFallback />}>
        <BuyFiltersLoader />
      </Suspense>

      {view === "map" ? (
        <div className="mx-auto max-w-[1920px] px-4 py-8 pb-16 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,50%)_minmax(0,1fr)] lg:items-start lg:gap-8">
            <div className="scrollbar-none min-w-0 max-w-full lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto">
              {breadcrumbs}
              {mapViewTitleRow}
              <Suspense fallback={<BuyMapPropertyListSkeleton />}>
                <BuyMapSplitList sp={sp} />
              </Suspense>
            </div>
            <div className="mt-0 min-h-[min(55vh,520px)] w-full min-w-0 max-w-full flex-1 overflow-hidden lg:sticky lg:top-24 lg:mt-0 lg:min-h-0 lg:self-start">
              <Suspense fallback={<BuyMapPropertyMapSkeleton />}>
                <BuyMapSplitMap sp={sp} />
              </Suspense>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
          <div className="flex flex-col lg:flex-row lg:items-start lg:gap-x-10 gap-8">
            <div className="min-w-0 flex-1 w-full">
              {breadcrumbs}
              {titleRow}

              <div className="space-y-5 min-w-0">
                <Suspense fallback={<BuyListingsSkeleton />}>
                  <BuyListingsColumn sp={sp} />
                </Suspense>
              </div>
            </div>

            <aside className="w-full min-w-0 space-y-6 lg:w-[min(100%,18.875rem)] lg:shrink-0 lg:sticky lg:top-24 lg:z-20 lg:bg-[#faf8f4] lg:pb-2 lg:pt-0">
              <BuySidebarTop />
              <Suspense fallback={<BuySidebarNewsSkeleton />}>
                <BuySidebarNews />
              </Suspense>
              <BuySidebarBottom searchBasePath="/buy" />
            </aside>
          </div>
        </div>
      )}

    </div>
  )
}
