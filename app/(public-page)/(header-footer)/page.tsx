import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getCachedHomePageData } from "@/lib/data/home";
import { createPageMetadata } from "@/lib/seo";
import { HeroSection } from "@/components/hero-section";
import { Reveal } from "@/components/public/reveal";
import { HomeFaq } from "@/components/public/home-faq";
import { faqPageSchema } from "@/lib/faqs";
import { fhiOrganizationSchema, webSiteSchema } from "@/lib/structured-data";
import { JsonLd } from "@/components/json-ld";
import {
  DeveloperLogoCarousel,
  type DeveloperLogoItem,
} from "@/components/public/developer-logo-carousel";
import { ProjectCard, type ProjectCardData } from "@/components/project-card";
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
  MessageCircle,
} from "lucide-react";

/** Revalidate homepage data from Supabase (ISR) */
export const revalidate = 120;

export const metadata: Metadata = createPageMetadata({
  // absolute: the brand leads this title already — the layout template would
  // append a second "| FHI Global".
  title: { absolute: "FHI Global — Dubai Real Estate | Premium Property Projects" },
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
    <div className="relative min-h-screen bg-[#fafafa] font-sans overflow-x-hidden">
      {/* Ambient blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[700px] h-[700px] rounded-full opacity-30 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(200,245,255)_0%,rgba(255,255,255,0)_70%)]" />
      <div className="fixed bottom-0 right-[-5%] w-[600px] h-[600px] rounded-full opacity-25 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(250,240,210)_0%,rgba(255,255,255,0)_70%)]" />

      <HeroSection developers={devOptions} popular={popularDevelopers} spotlight={heroSpotlight} />

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

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section header */}
            <Reveal>
            <div className="mb-10 max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8913f]">Our Partners</p>
              <h2 className="font-['Outfit'] text-3xl md:text-[42px] font-bold tracking-tight leading-[1.12] mt-3">
                <span className="text-[#0d1117]">Trusted Developers,</span>
                <br />
                <span className="text-[#0d1117]">Building </span>
                <span className="text-[#b8913f]">Dubai&rsquo;s Future</span>
              </h2>
              <p className="text-[15.5px] leading-relaxed text-[#4b5563] mt-4">
                We collaborate with the UAE&rsquo;s most trusted and innovative real estate
                developers to bring you exceptional properties and investment opportunities.
              </p>
            </div>
            </Reveal>

            <Reveal>
              <DeveloperLogoCarousel
                developers={developers as DeveloperLogoItem[]}
              />
            </Reveal>

          </div>

          {/* Navy sweep with gold trim along the bottom edge (mockup) */}
          {/* <div className="absolute bottom-0 left-0 right-0 pointer-events-none" aria-hidden="true">
            <svg viewBox="0 0 1440 110" preserveAspectRatio="none" className="block w-full h-[70px] sm:h-[90px]">
              <path d="M0,110 L0,58 C420,100 980,4 1440,44 L1440,110 Z" fill="#d6b357" />
              <path d="M0,110 L0,72 C420,112 980,20 1440,58 L1440,110 Z" fill="#001f3f" />
            </svg>
          </div> */}
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
                <div className="inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0d1117] mb-5"><span className="w-6 h-[3px] bg-[#d6b357]" aria-hidden="true"></span>
                  Hand-Picked Selection
                </div>
                <h2 className="font-['Outfit'] text-4xl md:text-5xl font-bold tracking-tight">
                  <span className="text-[#0d1117]">Featured</span>{" "}
                  <span className="text-[#b8913f]">Projects</span>
                </h2>
                <p className="text-[#4b5563] text-base leading-relaxed mt-4 max-w-xl">
                  A curated selection of Dubai&apos;s most sought-after developments,
                  hand-picked by our team for quality, location, and returns.
                </p>
              </div>
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
      {/* Rebuilt to the approved mockup. Gone: the "Why FHI Global" eyebrow and
          the "Your Trusted Real Estate Partner" headline (the sub-line says it
          better and one heading beats two), the gold-rimmed navy ellipse behind
          the cards, the navy icon blocks, the gold top trims and the big rotated
          watermarks. What's left is the point: an ornament, one statement, and
          six facts. */}
      <section className="relative pt-24 pb-24 overflow-hidden">
        {/* Background — skyline photo, fading to the page before the cards so
            the lower row sits on plain white like the mockup. */}
        <div className="absolute inset-0">
          <Image
            src="/background/developers.webp"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-center"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/60 to-[#f7f8fa]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header — the mockup's building ornament, then the statement. */}
          <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="flex items-center justify-center gap-3 mb-6" aria-hidden="true">
              <span className="h-px w-20 bg-[#d6b357]/70" />
              <Building2 className="w-6 h-6 text-[#b8913f]" />
              <span className="h-px w-20 bg-[#d6b357]/70" />
            </div>
            <h2 className="font-['Outfit'] text-3xl md:text-[42px] font-bold tracking-tight text-[#0d1117] leading-[1.15]">
              We connect serious investors with
              <br className="hidden sm:block" /> the right developers and projects
            </h2>
            <span className="block w-14 h-[3px] bg-[#d6b357] mx-auto mt-6 mb-5" aria-hidden="true" />
            <p className="text-[#6b7280] text-lg leading-relaxed">
              Backed by expertise, transparency,
              <br className="hidden sm:block" /> and a proven track record.
            </p>
          </div>
          </Reveal>

          {/* Six facts — icon beside the text, hairline between them, as drawn. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_US.map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={(i % 3) * 120} className="h-full">
              <div className="group h-full bg-white border border-[#e8eaed] p-6 flex items-start gap-5 transition-shadow duration-300 hover:shadow-[0_14px_40px_-18px_rgba(0,20,40,0.22)]">
                <Icon className="w-9 h-9 shrink-0 text-[#b8913f]" strokeWidth={1.25} aria-hidden="true" />
                <div className="min-w-0 border-l border-[#eef0f3] pl-5">
                  <h3 className="font-['Outfit'] text-[17px] font-bold text-[#0d1117]">
                    {title}
                  </h3>
                  <span className="block w-8 h-[3px] bg-[#d6b357] mt-2 mb-3" aria-hidden="true" />
                  <p className="text-sm text-[#6b7280] leading-relaxed">{desc}</p>
                </div>
              </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------- */}
      {/* FAQ                                             */}
      {/* ----------------------------------------------- */}
      <HomeFaq />

      {/* ----------------------------------------------- */}
      {/* CALL TO ACTION                                  */}
      {/* ----------------------------------------------- */}
      {/* Rebuilt to the approved mockup: a split banner. The photo is the
          section, and a light panel occupies the left with a diagonal seam
          cutting across it — so the pool and skyline stay fully visible on the
          right instead of being covered by a centred navy card. */}
      <section className="relative overflow-hidden">
        {/* Photo — the whole section */}
        <div className="absolute inset-0">
          <Image
            src="/background/dubai.webp"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-center"
            aria-hidden="true"
          />
        </div>

        {/* Light panel with the mockup's diagonal seam. Two layers: an opaque
            wedge for the copy to sit on, and a softer wedge just past it so the
            transition into the photo is a gradient rather than a hard line. On
            mobile the wedge becomes a plain vertical scrim — a diagonal across a
            narrow screen would cut through the text. */}
        <div
          className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-[#f7f8fa] via-[#f7f8fa]/95 to-[#f7f8fa]/0 md:w-[62%] md:bg-[#f7f8fa]/95"
          style={{ clipPath: "polygon(0 0, 100% 0, 78% 100%, 0 100%)" }}
          aria-hidden="true"
        />
        <div
          className="hidden md:block absolute inset-y-0 left-0 w-[72%] bg-gradient-to-r from-transparent via-transparent to-[#f7f8fa]/0"
          style={{ clipPath: "polygon(60% 0, 100% 0, 82% 100%, 42% 100%)", background: "linear-gradient(90deg, rgba(247,248,250,0.85), rgba(247,248,250,0))" }}
          aria-hidden="true"
        />

        <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <Reveal>
          <div className="max-w-xl">
            {/* Badge — solid navy block with the gold label, as drawn. */}
            <div className="inline-flex items-center gap-2 bg-[#0a2647] px-3.5 py-2 mb-7">
              <TrendingUp className="w-3.5 h-3.5 text-[#d6b357]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#d6b357]">
                Ready to Invest?
              </span>
            </div>

            <h2 className="font-['Outfit'] text-4xl md:text-[52px] font-bold leading-[1.08] tracking-tight">
              <span className="block text-[#0d1117]">Start Exploring</span>
              <span className="block text-[#b8913f]">Luxury Properties.</span>
            </h2>

            <span className="block w-14 h-[3px] bg-[#d6b357] mt-6 mb-6" aria-hidden="true" />

            <p className="text-[#4b5563] text-[16.5px] leading-[1.7] max-w-md">
              Browse hundreds of premium developments — from off-plan launches
              to ready-to-move investments in Dubai&apos;s finest communities.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link
                href="/projects"
                className="inline-flex items-center justify-center gap-2.5 bg-[#d6b357] hover:bg-[#c8a544] text-[#001f3f] px-7 py-4 font-bold text-[15px] transition-colors duration-300"
              >
                <Building2 className="w-[18px] h-[18px]" />
                Browse Projects
                <ArrowRight className="w-[18px] h-[18px]" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2.5 bg-white hover:bg-[#f0f2f5] border border-[#0a2647]/25 text-[#0d1117] px-7 py-4 font-bold text-[15px] transition-colors duration-300"
              >
                <MessageCircle className="w-[18px] h-[18px] text-[#b8913f]" />
                Contact Us
              </Link>
            </div>
          </div>
          </Reveal>
        </div>
      </section>

    </div>
    </>
  );
}
