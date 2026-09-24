import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getCachedHomePageData } from "@/lib/data/home";
import { createPageMetadata } from "@/lib/seo";
import { HeroSection } from "@/components/hero-section";
import { HomeFaq } from "@/components/public/home-faq";
import { WhyFhi } from "@/components/public/why-fhi";
import { FeaturedGate } from "@/components/public/featured-gate";
import { InView } from "@/components/public/in-view";
import { UaeMap } from "@/components/public/uae-map";
import { countByEmirate } from "@/lib/emirates";
import { InvestCta, type CtaStat } from "@/components/public/invest-cta";
import { faqPageSchema } from "@/lib/faqs";
import { fhiOrganizationSchema, webSiteSchema } from "@/lib/structured-data";
import { JsonLd } from "@/components/json-ld";
import { DeveloperMarquee, type DeveloperTileItem } from "@/components/public/developer-marquee";
import {
  FeaturedProjectsShowcase,
  type FeaturedProjectData,
} from "@/components/public/featured-projects-showcase";
import {
  Building2,
  TrendingUp,
  ShieldCheck,
  Star,
  ArrowRight,
  CheckCircle2,
  Award,
} from "lucide-react";

/** Revalidate homepage data from Supabase (ISR) */
export const revalidate = 120;

export const metadata: Metadata = createPageMetadata({
  // absolute: this title already carries the brand — the layout template would
  // append a second "| FHI Global". The head term leads: the page never used
  // the words "Dubai properties" before, and Google won't rank a page for a
  // phrase it doesn't contain. Brand searches still land here via the WebSite
  // schema and the site name Google shows separately.
  title: { absolute: "Dubai Properties for Sale — Off-Plan & Ready | FHI Global" },
  description:
    "Dubai properties for sale: off-plan launches and ready apartments, villas & penthouses from verified developers — prices, payment plans & handover dates.",
  openGraphTitle: "FHI Global — Dubai Properties for Sale",
  openGraphDescription:
    "Off-plan and ready properties for sale in Dubai from verified developers — prices, payment plans and handover dates.",
  pathname: "/",
  keywords: [
    "Dubai properties for sale",
    "Dubai properties",
    "Dubai real estate",
    "off-plan projects Dubai",
    "ready properties Dubai",
    "FHI Global",
  ],
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
  const { developers, featuredProjects, cityRows, wallImages } = await getCachedHomePageData();

  const devOptions = (developers ?? []).map((d) => ({
    id: d.id,
    name: d.name,
  }));

  // The hero's "popular" row — the developers with the most live projects,
  // counted from the catalog itself. Every link lands on a real portfolio
  // page with inventory behind it (the old hardcoded area names filtered on
  // `city`, which only ever holds "Dubai"/"Abu Dhabi", so they hit empty
  // result pages).
  const developerCounts = new Map<string, { name: string; slug: string; count: number }>();
  for (const row of cityRows) {
    const dev = row.developers as unknown as { name?: string | null; slug?: string | null } | null;
    if (!dev?.slug || !dev?.name) continue;
    const entry = developerCounts.get(dev.slug) ?? { name: dev.name, slug: dev.slug, count: 0 };
    entry.count += 1;
    developerCounts.set(dev.slug, entry);
  }
  const popularDevelopers = [...developerCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((d) => ({ label: d.name, href: `/${d.slug}` }));

  // Live projects per emirate, from the same published, active rows. The
  // city column is free text (a typo of Ras Al Khaimah and two Dubai
  // districts sit in it), so lib/emirates folds it into emirates. Feeds the
  // "Where we build" map and the closing CTA counters.
  const emirateCounts = countByEmirate(cityRows);
  const emirateCount = Object.keys(emirateCounts).length;
  const ctaStats: CtaStat[] = [
    { value: cityRows.length, label: "Live projects" },
    { value: developerCounts.size, label: "Developers" },
    ...(emirateCount >= 2 ? [{ value: emirateCount, label: "Emirates" }] : []),
  ];

  // Rotating spotlight in the hero — real featured projects, compact price.
  const heroStatusLabels: Record<string, string> = {
    pre_launch: "Pre-Launch",
    launch: "Launching Now",
    under_construction: "Under Construction",
    completed: "Completed",
  };
  // Prices below the floor are placeholder rows (e.g. launch_price_from = 1),
  // not real UAE property prices — suppress rather than headline them. (Same
  // guard on the SEO landing pages' "Starting from" stat.)
  const MIN_REALISTIC_PRICE_AED = 50_000;
  const heroPrice = (from: number | string | null, currency: string | null): string | null => {
    const n = Number(from);
    if (!Number.isFinite(n) || n < MIN_REALISTIC_PRICE_AED) return null;
    const code = (currency ?? "AED").toUpperCase();
    if (n >= 1_000_000) return `From ${code} ${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (n >= 1_000) return `From ${code} ${Math.round(n / 1_000)}K`;
    return `From ${code} ${n.toLocaleString("en-AE")}`;
  };
  const heroSpotlight = (featuredProjects ?? [])
    .filter((p) => p.main_image?.trim())
    .slice(0, 4)
    .map((p) => ({
      name: p.name,
      slug: p.slug ?? null,
      image: p.main_image as string,
      location: p.location || p.city || null,
      priceLabel: heroPrice(p.launch_price_from, p.currency),
      statusLabel: heroStatusLabels[p.status ?? ""] ?? null,
    }));

  return (
    <>
    {/* Brand entity + site name. Organization carries only real profile URLs
        in sameAs (bare platform domains corrupt entity reconciliation) and
        claims English only — there is no Arabic content to back "ar". */}
    <JsonLd schema={[fhiOrganizationSchema(), webSiteSchema()]} />
    {/* Pairs with the FAQ section below — this is what lets Google expand the
        answers underneath our search result. */}
    <JsonLd schema={faqPageSchema()} />
    {/* overflow-x-clip, not -hidden: hidden makes this div a scroll container
        and position: sticky inside it (the Featured Projects gate) stops
        pinning to the viewport. clip trims the same overflow without that. */}
    <div className="relative min-h-screen bg-[#fafafa] font-sans overflow-x-clip">
      {/* Ambient blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[700px] h-[700px] rounded-full opacity-30 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(200,245,255)_0%,rgba(255,255,255,0)_70%)]" />
      <div className="fixed bottom-0 right-[-5%] w-[600px] h-[600px] rounded-full opacity-25 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(250,240,210)_0%,rgba(255,255,255,0)_70%)]" />

      <HeroSection
        developers={devOptions}
        popular={popularDevelopers}
        spotlight={heroSpotlight}
        // Real counts from the catalogue, the same ones the closing CTA shows.
        facts={[
          `${cityRows.length} live projects`,
          `${developerCounts.size} developers`,
          "RERA licensed",
          "Dubai · United Arab Emirates",
        ]}
      />

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
                <div className="w-10 h-10 bg-[#d6b357]/15 border border-[#d6b357]/25 flex items-center justify-center shrink-0">
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
        <section className="relative py-16 overflow-hidden">
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

          <InView className="wf relative" threshold={0.2}>
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="wf-fade inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8913f]">
                    <span className="w-6 h-[3px] bg-[#d6b357]" aria-hidden="true" />
                    Our Partners
                  </p>
                  <h2 className="font-['Outfit'] text-3xl md:text-[42px] font-bold tracking-tight leading-[1.12] mt-3">
                    <span className="block text-[#0d1117]">
                      {["Trusted", "Developers,"].map((w, i) => (
                        <span key={w} className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: i }}>{w}</span></span>
                      ))}
                    </span>
                    <span className="block">
                      <span className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: 2 }} className="text-[#0d1117]">Building</span></span>
                      {["Dubai\u2019s", "Future"].map((w, i) => (
                        <span key={w} className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: 3 + i }} className="wf-gold">{w}</span></span>
                      ))}
                    </span>
                  </h2>
                  <p className="wf-fade text-[15.5px] leading-relaxed text-[#4b5563] mt-4" style={{ ["--d" as string]: "600ms" }}>
                    We collaborate with the UAE&rsquo;s most trusted and innovative real estate
                    developers to bring you exceptional properties and investment opportunities.
                  </p>
                </div>
                <Link
                  href="/developers"
                  className="wf-fade hidden sm:inline-flex items-center gap-2 text-sm font-bold text-[#0d1117] hover:text-[#b8913f] transition-colors shrink-0"
                  style={{ ["--d" as string]: "800ms" }}
                >
                  All developers
                  <span className="w-8 h-8 bg-[#d6b357] flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 text-[#001f3f]" />
                  </span>
                </Link>
              </div>
            </div>

            {/* Full-bleed marquee; tiles carry live project counts and morph
                into the developer page's logo on click. */}
            <DeveloperMarquee
              developers={(developers as DeveloperTileItem[]).map((d) => ({
                ...d,
                projectCount: developerCounts.get(d.slug)?.count ?? 0,
              }))}
            />
          </InView>
        </section>
      )}

      {/* ----------------------------------------------- */}
      {/* FEATURED PROJECTS                               */}
      {/* ----------------------------------------------- */}
      {/* The section opens behind two navy doors: a full-screen stage pinned
          while the reader scrolls through it, the doors sliding apart onto
          the skyline and the section title, then the cards. The section must
          not be overflow-hidden or the sticky stage would not pin. */}
      {featuredProjects && featuredProjects.length > 0 && (
        <section className="relative">
          <FeaturedGate count={featuredProjects.length} images={wallImages ?? []} />

          <div className="relative overflow-hidden py-16 md:py-20">
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
              <InView className="wf">
                <div className="wf-fade mb-10 flex items-center justify-between gap-6">
                  <p className="inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0d1117]">
                    <span className="w-6 h-[3px] bg-[#d6b357]" aria-hidden="true"></span>
                    {featuredProjects.length} featured {featuredProjects.length === 1 ? "project" : "projects"}
                  </p>
                  <Link
                    href="/projects"
                    className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-[#0d1117] hover:text-[#b8913f] transition-colors shrink-0"
                  >
                    Browse All Projects
                    <span className="w-8 h-8 bg-[#d6b357] flex items-center justify-center">
                      <ArrowRight className="w-4 h-4 text-[#001f3f]" />
                    </span>
                  </Link>
                </div>
              </InView>
              <FeaturedProjectsShowcase
                projects={featuredProjects as unknown as FeaturedProjectData[]}
              />
            </div>
          </div>
        </section>
      )}

      {/* ----------------------------------------------- */}
      {/* WHERE WE BUILD — the UAE lit by live counts     */}
      {/* ----------------------------------------------- */}
      <UaeMap counts={emirateCounts} />

      {/* ----------------------------------------------- */}
      {/* WHY FHI — "We connect serious investors…"        */}
      {/* ----------------------------------------------- */}
      <WhyFhi />

      {/* ----------------------------------------------- */}
      {/* FAQ                                             */}
      {/* ----------------------------------------------- */}
      <HomeFaq />

      {/* ----------------------------------------------- */}
      {/* CALL TO ACTION                                  */}
      {/* ----------------------------------------------- */}
      <InvestCta stats={ctaStats} />

    </div>
    </>
  );
}
