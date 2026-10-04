import type { Metadata } from "next"
import { cookies } from "next/headers"
import { JD_COOKIE, isJohndorfSession } from "@/lib/johndorf/session"
import { JohndorfLanding } from "./landing"

export const dynamic = "force-dynamic"

const description = "Homes and communities for every Filipino family — across Cebu, Cagayan de Oro, Davao, Iligan and Butuan, since 1986."
const image = { url: "/johndorf/site/palmava.jpg", width: 1440, height: 810, alt: "Palmava by Johndorf" }

// Shared by link, so it carries its own preview (still noindex via the layout).
export const metadata: Metadata = {
  title: "Always there",
  description,
  openGraph: { title: "Johndorf Ventures Corporation — Always there.", description, siteName: "Johndorf Ventures Corporation", images: [image] },
  twitter: { card: "summary_large_image", title: "Johndorf Ventures Corporation — Always there.", description, images: [image.url] },
}

/** Johndorf's landing page (lib/johndorf/company.ts) — open to anyone; only the Montierra map needs the login. */
export default async function JohndorfHomePage() {
  const signedIn = isJohndorfSession((await cookies()).get(JD_COOKIE)?.value)
  return <JohndorfLanding signedIn={signedIn} />
}
