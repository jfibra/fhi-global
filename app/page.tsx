import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getCachedHomePageData } from "@/lib/data/home";
import { createPageMetadata } from "@/lib/seo";
import { TopBar } from "@/components/topbar";
import { Header } from "@/components/header";
import { HeroSection } from "@/components/hero-section";
import { Reveal } from "@/components/public/reveal";
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
  Sparkles,
  MessageCircle,
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fhiglobal.ae";
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
        <section className="relative pt-24 pb-36 overflow-hidden">
          {/* Background photo with soft white wash (approved mockup) */}
          <div className="absolute inset-0">
            <Image
              src="/background/developers.webp"
              alt=""
              fill
              sizes="100vw"
              className="object-cover object-center"
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/80 to-white/75" />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section header */}
            <Reveal>
            <div className="flex items-end justify-between mb-14">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-[#d6b357]/50 rounded-full text-xs font-bold uppercase tracking-wider text-[#001f3f] mb-5 shadow-sm">
                  <Star className="w-3.5 h-3.5 text-[#d6b357] fill-[#d6b357]" />
                  Our Partners
                </div>
                <h2 className="font-['Outfit'] text-4xl md:text-5xl font-bold tracking-tight">
                  <span className="text-[#0d1117]">Featured</span>{" "}
                  <span className="bg-gradient-to-r from-[#001f3f] to-[#d6b357] bg-clip-text text-transparent">
                    Developers
                  </span>
                </h2>
                <p className="text-[#4b5563] text-base leading-relaxed mt-4 max-w-xl">
                  We collaborate with the most trusted and innovative real estate developers in Dubai
                  to bring you exceptional properties and investment opportunities.
                </p>
              </div>
              <Link
                href="/developers"
                className="hidden sm:inline-flex items-center gap-3 bg-[#001f3f] text-white pl-6 pr-2 py-2 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-[0_10px_30px_-6px_rgba(0,31,63,0.5)] shadow-md shrink-0"
              >
                View All Developers
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d6b357] to-[#b8913f] flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-[#001f3f]" />
                </span>
              </Link>
            </div>
            </Reveal>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {developers.map((dev, i) => (
                <Reveal key={dev.id} delay={(i % 2) * 130}>
                  <DeveloperCard developer={dev as DeveloperCardData} />
                </Reveal>
              ))}
            </div>

            <div className="mt-8 sm:hidden text-center">
              <Link
                href="/developers"
                className="bg-[#001f3f] text-white pl-6 pr-2 py-2 rounded-full font-semibold text-sm inline-flex items-center gap-3"
              >
                View All Developers
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d6b357] to-[#b8913f] flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-[#001f3f]" />
                </span>
              </Link>
            </div>
          </div>

          {/* Navy sweep with gold trim along the bottom edge (mockup) */}
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none" aria-hidden="true">
            <svg viewBox="0 0 1440 110" preserveAspectRatio="none" className="block w-full h-[70px] sm:h-[90px]">
              <path d="M0,110 L0,58 C420,100 980,4 1440,44 L1440,110 Z" fill="#d6b357" />
              <path d="M0,110 L0,72 C420,112 980,20 1440,58 L1440,110 Z" fill="#001f3f" />
            </svg>
          </div>
        </section>
      )}

      {/* ----------------------------------------------- */}
      {/* FEATURED PROJECTS                               */}
      {/* ----------------------------------------------- */}
      {featuredProjects && featuredProjects.length > 0 && (
        <section className="relative py-24 overflow-hidden">
          {/* Faint skyline backdrop — heavy white wash so the cards stay the focus */}
          <div className="absolute inset-0">
            <Image
              src="/background/home.webp"
              alt=""
              fill
              sizes="100vw"
              className="object-cover object-center"
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/85 to-white/92" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
            <div className="flex items-end justify-between mb-14">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-[#d6b357]/50 rounded-full text-xs font-bold uppercase tracking-wider text-[#001f3f] mb-5 shadow-sm">
                  <Star className="w-3.5 h-3.5 text-[#d6b357] fill-[#d6b357]" />
                  Hand-Picked Selection
                </div>
                <h2 className="font-['Outfit'] text-4xl md:text-5xl font-bold tracking-tight">
                  <span className="text-[#0d1117]">Featured</span>{" "}
                  <span className="bg-gradient-to-r from-[#001f3f] to-[#d6b357] bg-clip-text text-transparent">
                    Projects
                  </span>
                </h2>
                <p className="text-[#4b5563] text-base leading-relaxed mt-4 max-w-xl">
                  A curated selection of Dubai&apos;s most sought-after developments,
                  hand-picked by our team for quality, location, and returns.
                </p>
              </div>
              <Link
                href="/projects?featured=true"
                className="hidden sm:inline-flex items-center gap-3 bg-[#001f3f] text-white pl-6 pr-2 py-2 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-[0_10px_30px_-6px_rgba(0,31,63,0.5)] shadow-md shrink-0"
              >
                Browse All Projects
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d6b357] to-[#b8913f] flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-[#001f3f]" />
                </span>
              </Link>
            </div>
            </Reveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredProjects.map((p, i) => (
                <Reveal key={p.id} delay={(i % 3) * 120}>
                  <ProjectCard project={p as unknown as ProjectCardData} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ----------------------------------------------- */}
      {/* WHY CHOOSE US                                   */}
      {/* ----------------------------------------------- */}
      <section className="relative pt-24 pb-24 overflow-hidden">
        {/* Background — bright skyline photo with a navy curve rising behind the cards */}
        <div className="absolute inset-0">
          <Image
            src="/background/developers.webp"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-center"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/85 via-white/45 to-transparent" />
          {/* Gold-rimmed navy ellipse (approved mockup's curved base) */}
          <div
            className="absolute -bottom-[380px] left-1/2 -translate-x-1/2 w-[190%] h-[760px] rounded-[50%] border-4 border-[#d6b357]/70 bg-gradient-to-b from-[#00203f] to-[#000d1c] shadow-[0_-20px_60px_rgba(0,13,28,0.4)]"
            aria-hidden="true"
          />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-[#d6b357]/50 rounded-full text-xs font-bold uppercase tracking-wider text-[#001f3f] mb-5 shadow-sm">
              <Star className="w-3.5 h-3.5 text-[#d6b357] fill-[#d6b357]" />
              Why FHI Global
            </div>
            <h2 className="font-['Outfit'] text-4xl md:text-5xl font-bold tracking-tight mb-4">
              <span className="text-[#0d1117]">Your Trusted</span>{" "}
              <span className="bg-gradient-to-r from-[#001f3f] to-[#d6b357] bg-clip-text text-transparent">
                Real Estate Partner
              </span>
            </h2>
            {/* Gold ornamental divider (mockup) */}
            <div className="flex items-center justify-center gap-2 mb-5" aria-hidden="true">
              <span className="h-px w-20 bg-gradient-to-r from-transparent to-[#d6b357]/80" />
              <Building2 className="w-4 h-4 text-[#d6b357]" />
              <span className="h-px w-20 bg-gradient-to-l from-transparent to-[#d6b357]/80" />
            </div>
            <p className="text-[#374151] text-lg leading-relaxed">
              We connect serious investors with the right developers and
              projects — backed by expertise, transparency, and a proven track
              record.
            </p>
          </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_US.map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={(i % 3) * 120} className="h-full">
              <div
                className="group relative h-full bg-white rounded-[24px] p-8 shadow-[0_12px_40px_-8px_rgba(0,20,40,0.25)] overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_60px_-10px_rgba(0,20,40,0.35)]"
              >
                {/* Gold top trim */}
                <span className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#d6b357] via-[#f0d890] to-[#d6b357]/30" aria-hidden="true" />
                {/* Faint gold watermark */}
                <Icon className="absolute -bottom-7 -right-7 w-36 h-36 text-[#d6b357]/10 -rotate-6" aria-hidden="true" />
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#001f3f] to-[#003366] flex items-center justify-center shadow-md mb-5">
                  <Icon className="w-6 h-6 text-[#d6b357]" />
                </div>
                <h3 className="font-['Outfit'] text-xl font-bold text-[#0d1117] mb-2">
                  {title}
                </h3>
                <span className="block w-9 h-[3px] rounded-full bg-[#d6b357] mb-3" aria-hidden="true" />
                <p className="relative text-sm text-[#555] leading-relaxed">{desc}</p>
              </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------- */}
      {/* CALL TO ACTION                                  */}
      {/* ----------------------------------------------- */}
      <section className="relative overflow-hidden">
        {/* Background — dusk marina photo, kept bright around the navy card */}
        <div className="absolute inset-0">
          <Image
            src="/background/dubai.webp"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-center"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#001428]/40 via-[#001428]/20 to-[#001428]/50" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          {/* Solid navy card with gold border (approved mockup) */}
          <Reveal direction="zoom">
          <div className="relative overflow-hidden bg-gradient-to-b from-[#0a1f38] to-[#04101f] border-2 border-[#d6b357]/70 rounded-[40px] px-8 md:px-16 py-14 shadow-[0_30px_90px_-20px_rgba(0,10,25,0.8)]">
            {/* Subtle dot texture inside the card */}
            <div
              className="absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  "radial-gradient(circle, #fff 1px, transparent 1px)",
                backgroundSize: "26px 26px",
              }}
              aria-hidden="true"
            />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-5 py-2 border border-[#d6b357]/60 rounded-full text-xs font-bold uppercase tracking-[0.15em] text-[#d6b357] mb-8">
                <Sparkles className="w-3.5 h-3.5" />
                Ready to Invest?
              </div>
              <h2 className="font-['Outfit'] text-4xl md:text-6xl font-bold text-white leading-[1.1] mb-6 tracking-tight">
                Start Exploring
                <br />
                <span className="bg-gradient-to-r from-[#d6b357] to-[#f0d890] bg-clip-text text-transparent">
                  Luxury Properties.
                </span>
              </h2>
              {/* Gold ornamental divider */}
              <div className="flex items-center justify-center gap-2 mb-6" aria-hidden="true">
                <span className="h-px w-28 bg-gradient-to-r from-transparent to-[#d6b357]/70" />
                <Building2 className="w-4 h-4 text-[#d6b357]" />
                <span className="h-px w-28 bg-gradient-to-l from-transparent to-[#d6b357]/70" />
              </div>
              <p className="text-white/70 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
                Browse hundreds of premium developments — from off-plan launches
                to ready-to-move investments in Dubai&apos;s finest communities.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/projects"
                  className="bg-gradient-to-r from-[#d6b357] to-[#f0d890] text-[#001f3f] px-9 py-[18px] rounded-full font-bold text-base transition-all duration-300 hover:translate-y-[-2px] hover:shadow-[0_12px_28px_rgba(214,179,87,0.4)] flex items-center gap-2"
                >
                  <Building2 className="w-5 h-5" />
                  Browse Projects <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/contact"
                  className="px-9 py-[18px] rounded-full font-semibold text-base border border-[#d6b357]/60 text-white transition-all hover:bg-[#d6b357]/10 hover:border-[#d6b357] flex items-center gap-2"
                >
                  Contact Us <MessageCircle className="w-5 h-5 text-[#d6b357]" />
                </Link>
              </div>
            </div>
          </div>
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
    </>
  );
}
