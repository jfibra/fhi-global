import { NextRequest, NextResponse } from "next/server"
import { fetchCategoriesCountries, newsConfigured } from "@/lib/news-service"
import { allowRequest, clientIp } from "@/lib/rate-limit"

export const runtime = "nodejs"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Newsletter sign-up, forwarded to the HomesPH News /external/subscribe
 * endpoint with the site key server-side (the subscription is attributed to
 * the fhiglobal site by the authenticated key). The upstream requires
 * categories[] + countries[]; we derive both from the category × country
 * pairs actually distributed to this site so subscribers get the content
 * this site actually carries.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown }
  const email = typeof body.email === "string" ? body.email.trim() : ""

  if (!EMAIL_RE.test(email) || email.length > 255) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 422 })
  }
  if (!newsConfigured()) {
    return NextResponse.json({ error: "Newsletter is not available right now." }, { status: 503 })
  }
  // Strict per-IP cap — this endpoint creates upstream subscribers and sends
  // welcome emails, so it must not be usable for subscription bombing.
  if (!allowRequest(`news-subscribe:${clientIp(req.headers)}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts — try again later." }, { status: 429 })
  }

  const pairs = await fetchCategoriesCountries()
  const categories = [...new Set(pairs.map((p) => p.category))]
  const countries = [...new Set(pairs.map((p) => p.country))]

  try {
    const res = await fetch(
      `${(process.env.HOMESPH_NEWS_API_URL ?? "").replace(/\/+$/, "").replace(/\/external\/articles$/, "")}/external/subscribe`,
      {
        method: "POST",
        headers: {
          "X-Site-Api-Key": process.env.HOMESPH_NEWS_API_KEY ?? "",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          email,
          categories: categories.length ? categories : ["Real Estate"],
          countries: countries.length ? countries : ["United Arab Emirates"],
          features: "Daily",
        }),
      },
    )

    // 201 = new subscriber, 200 = already subscribed/re-activated — both success.
    if (res.status === 200 || res.status === 201) {
      return NextResponse.json({ ok: true })
    }
    if (res.status === 422) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 422 })
    }
    return NextResponse.json({ error: "Couldn't subscribe right now — try again later." }, { status: 502 })
  } catch {
    return NextResponse.json({ error: "Couldn't subscribe right now — try again later." }, { status: 502 })
  }
}
