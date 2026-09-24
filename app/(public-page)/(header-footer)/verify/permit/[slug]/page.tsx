import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Building2, Lock, ShieldCheck } from "lucide-react"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { createPageMetadata } from "@/lib/seo"
import { normalizeTrakheesiLink } from "@/lib/trakheesi"
import { InView } from "@/components/public/in-view"
import { HoldToContinue } from "@/components/public/hold-to-continue"

/**
 * Permit verification interstitial. A project's Trakheesi QR links here
 * rather than straight to the DLD, so the reader sees what they are about to
 * verify (project, developer, permit) and exactly where they are going
 * (trakheesi.dubailand.gov.ae) before they leave the site. The link is
 * re-validated against the DLD domain on every render.
 */

type Props = { params: Promise<{ slug: string }> }

export const revalidate = 300

async function loadProject(slug: string) {
  const supabase = createPublicSupabaseClient()
  const { data } = await supabase
    .from("projects")
    .select("name, slug, main_image, trakheesi_permit_url, trakheesi_permit_number, trakheesi_permit_link, developers(name, slug, logo_url, logo_bg)")
    .eq("slug", slug)
    .eq("is_active", true)
    .eq("is_published", true)
    .is("deleted_at", null)
    .maybeSingle()
  return data as
    | {
        name: string
        slug: string
        main_image: string | null
        trakheesi_permit_url: string | null
        trakheesi_permit_number: string | null
        trakheesi_permit_link: string | null
        developers: { name: string; slug: string | null; logo_url: string | null; logo_bg: string | null } | null
      }
    | null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const project = await loadProject(slug)
  return createPageMetadata({
    title: project ? `Verify the Trakheesi permit for ${project.name}` : "Verify a Trakheesi permit",
    description: "Check a project's Dubai Land Department advertising permit before you continue to the DLD's validation page.",
    pathname: `/verify/permit/${slug}`,
    robots: { index: false, follow: false },
  })
}

export default async function VerifyPermitPage({ params }: Props) {
  const { slug } = await params
  const project = await loadProject(slug)
  const link = normalizeTrakheesiLink(project?.trakheesi_permit_link)
  if (!project || !project.trakheesi_permit_url || !link) notFound()

  const host = new URL(link).hostname
  const dev = project.developers
  const projectHref = dev?.slug ? `/${dev.slug}/${project.slug}` : `/projects/${project.slug}`

  return (
    <div className="vp wf relative min-h-[70vh] bg-[#fafafa] overflow-x-clip">
      <noscript>
        <style>{`.vp [class*="wf-"] { opacity: 1 !important; transform: none !important; filter: none !important; }`}</style>
      </noscript>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(180deg,#06182e_0%,#06182e_55%,rgba(6,24,46,0)_100%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-40 top-0 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(214,179,87,0.16),rgba(214,179,87,0))]" aria-hidden="true" />

      <InView className="relative mx-auto max-w-3xl px-4 pb-20 pt-12 sm:px-6 lg:px-8 lg:pt-16" threshold={0.1} rootMargin="0px">
        <Link href={projectHref} className="wf-fade inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/70 transition-colors hover:text-[#f0d89b]">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to {project.name}
        </Link>

        <p className="mt-8 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.3em] text-[#f0d89b]">
          <span className="wf-rule h-px w-10 bg-[#d6b357]" aria-hidden="true" />
          <span className="wf-fade" style={{ ["--d" as string]: "200ms" }}>Permit verification</span>
        </p>
        <h1 className="mt-4 font-['Outfit'] text-[34px] font-bold leading-[1.05] tracking-tight text-white sm:text-[44px]">
          {["Verify", "this", "permit", "with"].map((w, i) => (
            <span key={w} className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: i }}>{w}</span></span>
          ))}
          <span className="block">
            {["the", "Dubai", "Land", "Department."].map((w, i) => (
              <span key={w} className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: 4 + i }} className="wf-gold">{w}</span></span>
            ))}
          </span>
        </h1>

        <div className="wf-fade mt-10 border border-[#e5e8ec] bg-white shadow-[0_24px_70px_-30px_rgba(0,20,40,0.35)]" style={{ ["--d" as string]: "700ms" }}>
          <div className="grid grid-cols-1 sm:grid-cols-5">
            {/* The permit */}
            <div className="border-b border-[#eef0f3] p-6 sm:col-span-2 sm:border-b-0 sm:border-r">
              <div className="border border-[#e5e8ec] bg-white p-3">
                <div className="relative aspect-square w-full">
                  <Image src={project.trakheesi_permit_url} alt={`Trakheesi permit QR code for ${project.name}`} fill unoptimized sizes="320px" className="object-contain" />
                </div>
              </div>
              {project.trakheesi_permit_number && (
                <dl className="mt-4">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8913f]">Permit number</dt>
                  <dd className="mt-1 font-['Outfit'] text-[18px] font-bold tabular-nums text-[#0d1117]">{project.trakheesi_permit_number}</dd>
                </dl>
              )}
            </div>

            {/* What it is for, and where you are going */}
            <div className="p-6 sm:col-span-3 sm:p-8">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d6b357]/50 bg-[#d6b357]/10"><ShieldCheck className="h-5 w-5 text-[#b8913f]" /></span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8913f]">Trakheesi advertising permit</p>
                  <p className="mt-1 font-['Outfit'] text-[22px] font-bold leading-tight text-[#0d1117]">{project.name}</p>
                  {dev && (
                    <p className="mt-1 flex items-center gap-2 text-[14px] text-[#6b7280]">
                      <Building2 className="h-3.5 w-3.5 text-[#b8913f]" /> {dev.name}
                    </p>
                  )}
                </div>
              </div>

              <p className="mt-6 text-[15px] leading-relaxed text-[#374151]">
                Trakheesi is the Dubai Land Department&rsquo;s permit system for real estate advertising. The DLD&rsquo;s own page will show whether this permit is valid and what it covers.
              </p>

              <div className="mt-6 flex items-start gap-3 border border-[#e5e8ec] bg-[#f7f8fa] p-4">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#b8913f]" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280]">Opens in a new tab</p>
                  <p className="mt-1 truncate font-['Outfit'] text-[16px] font-bold text-[#0d1117]">{host}</p>
                  <p className="mt-0.5 text-[12px] text-[#6b7280]">The official Dubai Land Department domain.</p>
                </div>
              </div>

              <div className="mt-6">
                <HoldToContinue href={link} label="Hold to open the DLD page" />
              </div>
            </div>
          </div>
        </div>

        <p className="wf-fade mt-6 text-center text-[12px] text-[#6b7280]" style={{ ["--d" as string]: "900ms" }}>
          FHI Global publishes permit codes exactly as issued by the developer. Verification happens on the DLD&rsquo;s site, not ours.
        </p>
      </InView>
    </div>
  )
}
