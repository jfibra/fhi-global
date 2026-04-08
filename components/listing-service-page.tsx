import Link from "next/link"
import { TopBar } from "@/components/topbar"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

type ListingServicePageProps = {
  title: string
  description: string
}

export function ListingServicePage({ title, description }: ListingServicePageProps) {
  return (
    <div className="relative min-h-screen bg-[#fafafa] font-sans overflow-x-hidden">
      <TopBar />
      <Header />

      <main className="relative pt-28 pb-24 px-5 sm:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#001f3f]/50 mb-4">{title}</p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[#001f3f] tracking-tight mb-6">
            {title} with FHI Global
          </h1>
          <p className="text-[#001f3f]/70 leading-relaxed mb-10">{description}</p>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-8 py-3 text-sm font-semibold text-[#001f3f] bg-gradient-to-r from-[#d6b357] to-[#f0d890] hover:from-[#c9a449] hover:to-[#e8d080] rounded-full transition-all duration-300 shadow-md hover:shadow-lg"
          >
            Get in touch
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}
