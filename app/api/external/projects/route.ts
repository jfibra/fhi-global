import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { UUID_RE, pageParams, requireExternalKey } from "@/lib/external-api"
import { isLiveProject, isTestRecord } from "@/lib/listing-publish-checks"
import { parseHandover } from "@/lib/project-seo"
import { projectFloorPrice } from "@/lib/seo-inventory"
import { SITE_URL } from "@/lib/seo"

/**
 * GET /api/external/projects — the live projects for FHI's own systems (the
 * cross-company AI chat). Keyed (lib/external-api.ts). Read-only. The same
 * rules as the public site: published, active, not deleted, not a test
 * record; the "from" price is the honest floor (lib/seo-inventory
 * projectFloorPrice: the headline unless the unit table says otherwise).
 *
 *   ?developer=<id or slug>   ?stage=pre_launch|launch|under_construction|completed
 *   ?area=<words>             community, sub-community, location or city contains
 *   ?handover=<year>          projects handing over that year (delivery_quarter, else expected completion)
 *   ?q=<words>                name contains
 *   ?id=<id>  ?slug=<slug>    one project
 *   ?since=<ISO timestamp>    rows changed since then (updated_at)
 *   ?page=1&limit=50          limit ≤ 100; by name
 *
 * → { success, data: project[], meta: { total, page, limit, filters } }
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const COLUMNS =
  "id, name, slug, status, developer_id, location, region, community, sub_community, city, country, latitude, longitude, launch_price_from, launch_price_to, currency, down_payment_percentage, payment_plan_details, installment_available, booking_date, construction_start_date, expected_completion_date, delivery_date, delivery_quarter, number_of_buildings, total_units, floors, main_image, video_url, expected_roi, rental_yield, freehold, ownership_type, direct_from_developer, is_featured, is_published, is_active, deleted_at, published_at, updated_at, developers(id, name, slug, logo_url)"

// Units are read for the page's projects only (project_id in …): joining them for all 385 took 8 s.
const UNIT_COLUMNS = "id, project_id, unit_type, layout_name, bedrooms, bathrooms, size_sqft, size_sqm, price_from, price_to, available_units, is_available"

type Unit = {
  id: string
  project_id: number
  unit_type: string | null
  layout_name: string | null
  bedrooms: number | null
  bathrooms: number | null
  size_sqft: number | string | null
  size_sqm: number | string | null
  price_from: number | string | null
  price_to: number | string | null
  available_units: number | null
  is_available: boolean | null
}

type Row = {
  id: number
  name: string
  slug: string
  status: string | null
  developer_id: string | null
  location: string | null
  region: string | null
  community: string | null
  sub_community: string | null
  city: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  launch_price_from: number | string | null
  launch_price_to: number | string | null
  currency: string | null
  down_payment_percentage: number | string | null
  payment_plan_details: string | null
  installment_available: boolean | null
  booking_date: string | null
  construction_start_date: string | null
  expected_completion_date: string | null
  delivery_date: string | null
  delivery_quarter: string | null
  number_of_buildings: number | null
  total_units: number | null
  floors: number | null
  main_image: string | null
  video_url: string | null
  expected_roi: number | string | null
  rental_yield: number | string | null
  freehold: boolean | null
  ownership_type: string | null
  direct_from_developer: boolean | null
  is_featured: boolean | null
  is_published: boolean | null
  is_active: boolean | null
  deleted_at: string | null
  published_at: string | null
  updated_at: string | null
  developers: { id: string; name: string; slug: string | null; logo_url: string | null } | { id: string; name: string; slug: string | null; logo_url: string | null }[] | null
}

const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? null : Number(v))
const site = SITE_URL.replace(/\/$/, "")
const STAGES = ["pre_launch", "launch", "under_construction", "completed"]

export async function GET(req: NextRequest) {
  const denied = requireExternalKey(req)
  if (denied) return denied

  const q = req.nextUrl.searchParams
  const admin = createAdminSupabase()
  const { page, limit, from, to } = pageParams(q)
  const developer = (q.get("developer") ?? "").trim()
  const stage = (q.get("stage") ?? "").trim().toLowerCase()
  const area = (q.get("area") ?? "").trim().toLowerCase()
  const handoverYear = Number(q.get("handover") ?? "") || null
  const words = (q.get("q") ?? "").trim().toLowerCase()
  const oneId = (q.get("id") ?? "").trim()
  const oneSlug = (q.get("slug") ?? "").trim()
  const since = (q.get("since") ?? "").trim()
  if (stage && !STAGES.includes(stage)) return NextResponse.json({ error: `stage must be one of ${STAGES.join(", ")}.` }, { status: 400 })
  if (since && Number.isNaN(Date.parse(since))) return NextResponse.json({ error: "since must be an ISO timestamp." }, { status: 400 })
  if (oneId && !/^\d+$/.test(oneId)) return NextResponse.json({ error: "id must be a project id." }, { status: 400 })

  let query = admin.from("projects").select(COLUMNS).is("deleted_at", null).eq("is_published", true).limit(2000)
  if (oneId) query = query.eq("id", Number(oneId))
  if (oneSlug) query = query.eq("slug", oneSlug)
  if (stage) query = query.eq("status", stage)
  if (since) query = query.gte("updated_at", since)
  if (developer) {
    if (UUID_RE.test(developer)) query = query.eq("developer_id", developer)
    else {
      const { data: dev } = await admin.from("developers").select("id").eq("slug", developer).maybeSingle()
      if (!dev) return NextResponse.json({ success: true, data: [], meta: { total: 0, page, limit, filters: { developer } } })
      query = query.eq("developer_id", dev.id as string)
    }
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let rows = ((data ?? []) as unknown as Row[]).filter((p) => isLiveProject(p) && !isTestRecord({ title: p.name }))
  if (area) rows = rows.filter((p) => [p.community, p.sub_community, p.location, p.city, p.region].some((v) => (v ?? "").toLowerCase().includes(area)))
  if (words) rows = rows.filter((p) => words.split(/\s+/).every((w) => p.name.toLowerCase().includes(w)))
  if (handoverYear) rows = rows.filter((p) => parseHandover(p.delivery_quarter, p.expected_completion_date)?.year === handoverYear)
  rows.sort((a, b) => a.name.localeCompare(b.name))
  const total = rows.length
  const pageRows = rows.slice(from, to + 1)

  const unitsByProject = new Map<number, Unit[]>()
  if (pageRows.length) {
    const { data: units, error: unitError } = await admin.from("project_units").select(UNIT_COLUMNS).in("project_id", pageRows.map((p) => p.id)).limit(5000)
    if (unitError) return NextResponse.json({ error: unitError.message }, { status: 500 })
    for (const u of (units ?? []) as unknown as Unit[]) unitsByProject.set(u.project_id, [...(unitsByProject.get(u.project_id) ?? []), u])
  }

  const dataOut = pageRows.map((p) => {
    const dev = (Array.isArray(p.developers) ? p.developers[0] : p.developers) ?? null
    const handover = parseHandover(p.delivery_quarter, p.expected_completion_date)
    const projectUnits = unitsByProject.get(p.id) ?? []
    const units = projectUnits.map((u) => ({
      id: u.id,
      type: u.unit_type,
      layout: u.layout_name,
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms,
      size_sqft: num(u.size_sqft),
      size_sqm: num(u.size_sqm),
      price_from: num(u.price_from),
      price_to: num(u.price_to),
      available_units: u.available_units,
      available: u.is_available !== false,
    }))
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      url: `${site}/projects/${p.slug}`,
      stage: p.status,
      developer: dev ? { id: dev.id, name: dev.name, slug: dev.slug, logo_url: dev.logo_url } : null,
      where: { community: p.community, sub_community: p.sub_community, location: p.location, region: p.region, city: p.city, country: p.country, latitude: p.latitude, longitude: p.longitude },
      price: {
        /** The honest starting price: the headline unless the unit table says it is a placeholder. */
        from: projectFloorPrice({ launch_price_from: p.launch_price_from, project_units: projectUnits } as unknown as Parameters<typeof projectFloorPrice>[0]),
        launch_from: num(p.launch_price_from),
        launch_to: num(p.launch_price_to),
        currency: p.currency ?? "AED",
      },
      payment: { down_payment_percent: num(p.down_payment_percentage), plan: p.payment_plan_details, installments: p.installment_available },
      dates: {
        launch: p.booking_date,
        construction_start: p.construction_start_date,
        expected_completion: p.expected_completion_date,
        handover: p.delivery_date,
        handover_quarter: p.delivery_quarter,
        handover_label: handover ? `Q${handover.quarter} ${handover.year}` : null,
      },
      size: { buildings: p.number_of_buildings, units: p.total_units, floors: p.floors },
      returns: { expected_roi: num(p.expected_roi), rental_yield: num(p.rental_yield) },
      ownership: { freehold: p.freehold, type: p.ownership_type, direct_from_developer: p.direct_from_developer },
      units,
      media: { image: p.main_image, video: p.video_url },
      featured: p.is_featured === true,
      published_at: p.published_at,
      updated_at: p.updated_at,
    }
  })

  return NextResponse.json(
    { success: true, data: dataOut, meta: { total, page, limit, filters: { developer: developer || null, stage: stage || null, area: area || null, handover: handoverYear, q: words || null, since: since || null } } },
    { headers: { "cache-control": "no-store" } },
  )
}
