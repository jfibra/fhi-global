"use client"

import { Suspense } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight, Cake, FileImage, LayoutTemplate } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { canUsePosterMaker } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { PosterMakerClient } from "./poster-maker-client"
import { BirthdayStudio } from "./birthday-studio"
import { TileMockup } from "@/components/dashboard/hub-tile-mockups"

const STUDIOS = [
  {
    type: "listings",
    icon: FileImage,
    title: "Listing Posters",
    desc: "Create flyers and Just Listed / Sold announcement posters from any published listing — multiple templates and skins.",
    mock: "listing-posters",
  },
  {
    type: "projects",
    icon: LayoutTemplate,
    title: "Project Posters",
    desc: "Open a published project's Poster Studio — three designs across story, square, and print formats.",
    mock: "project-posters",
  },
  {
    type: "birthday",
    icon: Cake,
    title: "Birthday Poster",
    desc: "Greet a teammate or client — drop in a photo, position it in the frame, and add their name.",
    mock: "birthday-poster",
  },
] as const

/** Landing: choose which poster studio to open. */
function StudioBento({ pathname }: { pathname: string }) {
  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] flex items-center gap-2">
          <LayoutTemplate className="w-6 h-6 text-[#001f3f]" />
          Poster Maker
        </h1>
        <p className="text-sm text-[#6b7280] mt-1">
          Choose a studio — create branded flyers and posters for print and social media.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl">
        {STUDIOS.map(({ type, icon: Icon, title, desc, mock }) => (
          <Link
            key={type}
            href={`${pathname}?type=${type}`}
            className="group relative bg-white rounded-2xl border border-[#e8eaed] p-6 shadow-[0_2px_16px_rgba(0,0,0,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_-8px_rgba(0,31,63,0.25)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#001f3f] flex items-center justify-center">
                <Icon className="w-6 h-6 text-[#d6b357]" />
              </div>
              {/* Miniature of the format this studio produces. */}
              <TileMockup kind={mock} />
            </div>
            <h2 className="mt-4 font-['Outfit'] text-lg font-bold text-[#0d1117]">{title}</h2>
            <p className="mt-1.5 text-sm text-[#6b7280] leading-relaxed">{desc}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#001f3f]">
              Open studio
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function PosterMakerPageInner() {
  const { role } = useAuth()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const allowed = useRequireAllowed(canUsePosterMaker(role))
  if (!allowed) return null

  const type = searchParams.get("type")
  if (type !== "listings" && type !== "projects" && type !== "birthday") {
    return <StudioBento pathname={pathname} />
  }

  return (
    <div className="w-full space-y-4">
      <Link
        href={pathname}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6b7280] hover:text-[#001f3f] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All studios
      </Link>
      {type === "birthday" ? (
        <BirthdayStudio />
      ) : (
        <PosterMakerClient key={type} source={type} />
      )}
    </div>
  )
}

export default function PosterMakerPage() {
  return (
    <Suspense fallback={null}>
      <PosterMakerPageInner />
    </Suspense>
  )
}
