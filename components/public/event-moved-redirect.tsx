"use client"

import { useEffect } from "react"
import { ArrowRight, CalendarDays } from "lucide-react"

/**
 * An agent's own event lives on their website (migration 057). Its old
 * /events/<slug> link — already shared, maybe printed as a flyer QR — forwards
 * there, keeping `?src=qr` (so a scan still counts as one) and `#register`
 * (so it still lands on the form). Done on the client because that page is
 * statically cached and a server redirect there would drop the query string.
 */
export function EventMovedRedirect({ to, title, hostName }: { to: string; title: string; hostName: string | null }) {
  useEffect(() => {
    window.location.replace(to + window.location.search + window.location.hash)
  }, [to])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16 bg-[#fafafa]">
      <div className="max-w-md w-full bg-white border border-[#e5e8ec] p-8 text-center">
        <span className="mx-auto mb-4 w-12 h-12 bg-[#001f3f] flex items-center justify-center">
          <CalendarDays className="w-6 h-6 text-[#d6b357]" />
        </span>
        <p className="font-['Outfit'] text-lg font-bold text-[#0f2940]">{title}</p>
        <p className="mt-2 text-sm text-[#6b7280]">
          This event is now on {hostName ? <span className="font-semibold text-[#0f2940]">{hostName}</span> : "the host agent"}&apos;s
          website. Taking you there…
        </p>
        <a
          href={to}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-[#001f3f] text-white text-sm font-bold hover:bg-[#00356b] transition-colors"
        >
          Open the event
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  )
}
