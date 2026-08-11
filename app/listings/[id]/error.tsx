"use client"

import Link from "next/link"
import { TopBar } from "@/components/topbar"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

/**
 * Friendly boundary for transient listing-load failures. The page throws
 * instead of rendering this inline so the response status is a real 5xx —
 * crawlers retry a 500, but a 200 error page would index (and a 404 would
 * deindex a listing that still exists).
 */
export default function ListingError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-[#faf8f4] font-sans">
      <TopBar />
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-[#475569]">We couldn&apos;t load this listing. Please try again later.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-block text-[#d6b357] font-semibold hover:underline"
        >
          Try again
        </button>
        <Link href="/buy" className="mt-2 block text-[#d6b357] font-semibold hover:underline">
          Back to buy
        </Link>
      </div>
      <Footer />
    </div>
  )
}
