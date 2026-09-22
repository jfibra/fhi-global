import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Award, ArrowLeft } from "lucide-react"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { parseCertificateSettings } from "@/lib/events/certificate"
import { EventCertificateClaim } from "@/components/public/event-certificate-claim"

type Props = { params: Promise<{ id: string }> }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Always fresh: the admin flips self-service on at the end of the event and
// attendees scan the QR straight away.
export const dynamic = "force-dynamic"

async function fetchEvent(idOrSlug: string) {
  const supabase = createPublicSupabaseClient()
  const q = supabase.from("events").select("id, slug, title, certificate").eq("status", "published").is("deleted_at", null)
  const { data, error } = UUID_RE.test(idOrSlug) ? await q.eq("id", idOrSlug).maybeSingle() : await q.eq("slug", idOrSlug).maybeSingle()
  if (error) throw new Error("Failed to load event")
  return data ?? null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const event = await fetchEvent(id)
  return {
    title: event ? `Your certificate — ${event.title}` : "Certificate",
    // A utility page for attendees, not something to rank.
    robots: { index: false, follow: false },
  }
}

export default async function EventCertificatePage({ params }: Props) {
  const { id } = await params
  const event = await fetchEvent(id)
  if (!event) notFound()
  const mode = parseCertificateSettings(event.certificate).selfService
  const back = `/events/${event.slug ?? event.id}`

  return (
    <main className="bg-[#fafafa] min-h-[70vh]">
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <Link href={back} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6b7280] hover:text-[#001f3f] mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> {event.title}
        </Link>
        <div className="bg-white rounded-2xl border border-[#e5e7eb] shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-full bg-[#001f3f] flex items-center justify-center shrink-0">
              <Award className="w-5 h-5 text-[#d6b357]" />
            </div>
            <div>
              <h1 className="font-['Outfit'] text-xl font-bold text-[#0d1117] leading-tight">Certificate of Attendance</h1>
              <p className="text-sm text-[#6b7280]">{event.title}</p>
            </div>
          </div>
          {mode === "off" ? (
            <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-5 py-8 text-center">
              <p className="font-semibold text-[#0f2940]">Certificates aren&apos;t available yet</p>
              <p className="text-sm text-[#6b7280] mt-1">They&apos;re released by the events team after the event. Please check back later.</p>
            </div>
          ) : (
            <EventCertificateClaim eventId={event.id} eventTitle={event.title} mode={mode} />
          )}
        </div>
        <p className="text-[11px] text-[#9ca3af] text-center mt-4">Your details are used only to issue your certificate and are never shared.</p>
      </div>
    </main>
  )
}
