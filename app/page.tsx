import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getCachedHomePageData } from "@/lib/data/home";
import { createPageMetadata } from "@/lib/seo";
import { TopBar } from "@/components/topbar";
import { Header } from "@/components/header";
import { HeroSection } from "@/components/hero-section";
import {
  DeveloperCard,
  type DeveloperCardData,
} from "@/components/developer-card";
import { ProjectCard, type ProjectCardData } from "@/components/project-card";
import { Footer } from "@/components/footer";
import {
  Building2,
  TrendingUp,
  ShieldCheck,
  Star,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  Users,
  Award,
  Globe,
  Zap,
  BadgeCheck,
} from "lucide-react";

/** Revalidate homepage data from Supabase (ISR) */
export const revalidate = 120;

export const metadata: Metadata = createPageMetadata({
  title: "FHI Global — Dubai Real Estate | Premium Property Projects",
  description:
    "Discover premium off-plan and ready properties from Dubai's top developers. Explore luxury apartments, villas, and penthouses.",
  openGraphTitle: "FHI Global — Dubai's Premier Real Estate Portal",
  openGraphDescription: "Discover premium off-plan and ready properties from Dubai's top developers.",
  pathname: "/",
  keywords: ["Dubai real estate", "off-plan projects Dubai", "luxury apartments Dubai", "FHI Global"],
});

const STATS = [
  {
    icon: Building2,
    label: "Active Projects",
    value: "3,400+",
    sub: "across all UAE",
  },
  {
    icon: TrendingUp,
    label: "Sales Volume (2024)",
    value: "AED 528B",
    sub: "year on year growth",
  },
  {
    icon: Star,
    label: "Avg. Rental ROI",
    value: "6–8%",
    sub: "industry-leading returns",
  },
  {
    icon: ShieldCheck,
    label: "RERA Registered",
    value: "100%",
    sub: "fully compliant",
  },
];

const WHY_US = [
  {
    icon: ShieldCheck,
    title: "Verified Developers",
    desc: "Every developer on our platform is vetted, RERA-registered, and financially screened.",
  },
  {
    icon: Award,
    title: "Premium Listings",
    desc: "Curated portfolio of the finest residential and investment projects in Dubai.",
  },
  {
    icon: TrendingUp,
    title: "Strong ROI",
    desc: "Dubai consistently delivers 6–8% rental yields — among the highest returns globally.",
  },
  {
    icon: Users,
    title: "Expert Team",
    desc: "Our multilingual agents guide you end-to-end, from search to handover.",
  },
  {
    icon: Globe,
    title: "International Reach",
    desc: "Serving investors from 50+ countries seeking Dubai real estate.",
  },
  {
    icon: Zap,
    title: "Fast Transactions",
    desc: "End-to-end support from first viewing to SPA signing — in record time.",
  },
];

const TRUST = [
  {
    icon: ShieldCheck,
    title: "RERA Licensed",
    desc: "All our developers and listings comply with Dubai Land Department regulations.",
  },
  {
    icon: CheckCircle2,
    title: "Verified Listings",
    desc: "Every project undergoes rigorous due diligence before appearing on our platform.",
  },
  {
    icon: Award,
    title: "Award-Winning Service",
    desc: "Recognized for excellence in real estate advisory and client satisfaction.",
  },
];

export default async function HomePage() {
  const { developers, featuredProjects, cityRows } = await getCachedHomePageData();

  const uniqueCities = [
    ...new Set(cityRows.map((r) => r.city).filter(Boolean) as string[]),
  ].sort();
  const devOptions = (developers ?? []).map((d) => ({
    id: d.id,
    name: d.name,
  }));

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fhiglobal.com";
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "FHI Global",
    url: siteUrl,
    logo: `${siteUrl}/android-chrome-512x512.png`,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        areaServed: "AE",
        availableLanguage: ["en", "ar"],
      },
    ],
    sameAs: [
      "https://www.linkedin.com",
      "https://www.instagram.com",
      "https://www.facebook.com",
    ],
  };

  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
    />
    <div className="relative min-h-screen bg-[#fafafa] font-sans overflow-x-hidden">
      {/* Ambient blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[700px] h-[700px] rounded-full opacity-30 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(200,245,255)_0%,rgba(255,255,255,0)_70%)]" />
      <div className="fixed bottom-0 right-[-5%] w-[600px] h-[600px] rounded-full opacity-25 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(250,240,210)_0%,rgba(255,255,255,0)_70%)]" />

      <TopBar />
      <Header />
      <HeroSection developers={devOptions} cities={uniqueCities} />

      {/* ----------------------------------------------- */}
      {/* STATS BANNER                                    */}
      {/* ----------------------------------------------- */}
      {/* <section className="relative bg-gradient-to-r from-[#001f3f] to-[#002a52] overflow-hidden">
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="absolute inset-0 bg-gradient-to-r from-[#d6b357]/10 via-transparent to-[#d6b357]/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-0 md:divide-x md:divide-white/10">
            {STATS.map(({ icon: Icon, label, value, sub }) => (
              <div key={label} className="flex items-center gap-4 px-4 md:px-8 first:pl-0 last:pr-0">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#d6b357]/25 to-[#d6b357]/10 border border-[#d6b357]/20 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-[#d6b357]" />
                </div>
                <div>
                  <p className="font-['Outfit'] text-2xl font-bold text-white leading-none">{value}</p>
                  <p className="text-xs text-white/50 mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d6b357]/40 to-transparent" />
      </section> */}

      {/* ----------------------------------------------- */}
      {/* FEATURED DEVELOPERS                             */}
      {/* ----------------------------------------------- */}
      {developers && developers.length > 0 && (
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-0">
            {/* Section header */}
            <div className="flex items-end justify-between mb-14">
              <div>
                <div className="inline-flex items-center px-3 py-1.5 bg-white border border-[#e5e5e5] rounded-full text-xs font-semibold uppercase tracking-wider mb-5 shadow-sm">
                  <span className="w-2 h-2 bg-[#d6b357] rounded-full mr-2" />
                  Our Partners
                </div>
                <h2 className="font-['Outfit'] text-4xl md:text-5xl font-bold tracking-tight">
                  Featured{" "}
                  <span className="bg-gradient-to-r from-[#001f3f] to-[#d6b357] bg-clip-text text-transparent">
                    Developers
                  </span>
                </h2>
              </div>
              <Link
                href="/developers"
                className="hidden sm:inline-flex items-center gap-2 bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md"
              >
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {developers.map((dev) => (
                <DeveloperCard
                  key={dev.id}
                  developer={dev as DeveloperCardData}
                />
              ))}
            </div>

            <div className="mt-8 sm:hidden text-center">
              <Link
                href="/developers"
                className="bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-6 py-3 rounded-full font-semibold text-sm inline-flex items-center gap-2"
              >
                View All Developers <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ----------------------------------------------- */}
      {/* FEATURED PROJECTS                               */}
      {/* ----------------------------------------------- */}
      {featuredProjects && featuredProjects.length > 0 && (
        <section className="py-24 bg-[#f5f3ef]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-14">
              <div>
                <div className="inline-flex items-center px-3 py-1.5 bg-white border border-[#e5e5e5] rounded-full text-xs font-semibold uppercase tracking-wider mb-5 shadow-sm">
                  <span className="w-2 h-2 bg-[#d6b357] rounded-full mr-2 animate-pulse" />
                  Hand-Picked Selection
                </div>
                <h2 className="font-['Outfit'] text-4xl md:text-5xl font-bold tracking-tight">
                  Featured{" "}
                  <span className="bg-gradient-to-r from-[#001f3f] to-[#d6b357] bg-clip-text text-transparent">
                    Projects
                  </span>
                </h2>
              </div>
              <Link
                href="/projects?featured=true"
                className="hidden sm:inline-flex items-center gap-2 bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md"
              >
                Browse All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredProjects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p as unknown as ProjectCardData}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ----------------------------------------------- */}
      {/* WHY CHOOSE US                                   */}
      {/* ----------------------------------------------- */}
      <section className="relative py-24 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <Image
            src="https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/Dubai%20Image%20Ratio%201920x800/3.png"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-center"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/92 via-white/88 to-white/92" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center px-3 py-1.5 bg-white border border-[#e5e5e5] rounded-full text-xs font-semibold uppercase tracking-wider mb-5 shadow-sm">
              <span className="w-2 h-2 bg-[#001f3f] rounded-full mr-2" />
              Why FHI Global
            </div>
            <h2 className="font-['Outfit'] text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Your Trusted{" "}
              <span className="bg-gradient-to-r from-[#001f3f] to-[#d6b357] bg-clip-text text-transparent">
                Real Estate Partner
              </span>
            </h2>
            <p className="text-[#6b7280] text-lg leading-relaxed">
              We connect serious investors with the right developers and
              projects — backed by expertise, transparency, and a proven track
              record.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_US.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group bg-white/40 backdrop-blur-2xl p-8 rounded-[32px] border border-white border-opacity-60 shadow-xl shadow-black/5 flex flex-col gap-5 transition-all duration-300 hover:translate-y-[-8px] hover:shadow-2xl hover:shadow-[#001f3f]/10"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#001f3f]/10 to-[#001f3f]/5 group-hover:from-[#001f3f] group-hover:to-[#002a52] flex items-center justify-center transition-all duration-300 shadow-sm">
                  <Icon className="w-5 h-5 text-[#001f3f] group-hover:text-[#d6b357] transition-colors duration-300" />
                </div>
                <div>
                  <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117] mb-2">
                    {title}
                  </h3>
                  <p className="text-sm text-[#555] leading-relaxed">{desc}</p>
                </div>
                <div className="mt-auto pt-2">
                  <span className="text-xs font-mono text-[#d6b357] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    fhiglobal.com
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------- */}
      {/* CALL TO ACTION                                  */}
      {/* ----------------------------------------------- */}
      <section className="relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <Image
            src="https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/Dubai%20Image%20Ratio%201920x1080/7.png"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-center"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#001f3f]/92 via-[#002a52]/90 to-[#001428]/95" />
        </div>
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d6b357]/50 to-transparent" />
        <div className="absolute top-[-80px] left-[-80px] w-[500px] h-[500px] rounded-full opacity-25 blur-[120px] bg-[radial-gradient(circle,#d6b357,transparent)] pointer-events-none" />
        <div className="absolute bottom-[-60px] right-[-60px] w-[400px] h-[400px] rounded-full opacity-15 blur-[100px] bg-[radial-gradient(circle,#60a5fa,transparent)] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-28 text-center">
          {/* Glassmorphism inner card */}
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[40px] px-8 md:px-16 py-14 shadow-2xl shadow-black/20">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#d6b357]/15 border border-[#d6b357]/25 rounded-full text-xs font-semibold uppercase tracking-wider text-[#d6b357] mb-8 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d6b357] animate-pulse" />
              Ready to Invest?
            </div>
            <h2 className="font-['Outfit'] text-4xl md:text-6xl font-bold text-white leading-[1.1] mb-5 tracking-tight">
              Start Exploring
              <br />
              <span className="bg-gradient-to-r from-[#d6b357] to-[#f0d890] bg-clip-text text-transparent">
                Luxury Properties.
              </span>
            </h2>
            <p className="text-white/55 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
              Browse hundreds of premium developments — from off-plan launches
              to ready-to-move investments in Dubai&apos;s finest communities.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/projects"
                className="bg-gradient-to-r from-[#d6b357] to-[#f0d890] text-[#001f3f] px-9 py-[18px] rounded-full font-bold text-base transition-all duration-300 hover:translate-y-[-2px] hover:shadow-[0_12px_28px_rgba(214,179,87,0.4)] flex items-center gap-2"
              >
                Browse Projects <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/contact"
                className="px-9 py-[18px] rounded-full font-semibold text-base bg-[rgba(255,255,255,0.08)] border border-white/20 text-white transition-all hover:bg-white/15 hover:border-white/35 flex items-center gap-2"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
    </>
  );
}
