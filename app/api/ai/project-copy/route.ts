import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireActiveSession } from "@/lib/auth-guard"
import { allowRequest } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"
import {
  formatPrice,
  fullArea,
  handoverDisplay,
  parsePaymentPlan,
  priceFromValue,
  priceToValue,
  statusLabel,
  typeLabel,
  unitsSummary,
  type ProjectSeoInput,
} from "@/lib/project-seo"

/**
 * AI copy for a project: the short description and the "About project" paragraph (and the poster
 * headline). The model is given the project's own facts and a short list of rules, and the editor
 * signs off on Save — nothing here is stored.
 *
 * Any active account may call it (agents' poster studio uses it for the headline), so abuse is
 * bounded by a per-user throttle rather than a role gate. The facts come from the project row
 * itself when `projectId` is sent (read with the caller's own session, so a project they cannot
 * read just falls back to what the form sent); the form's scalars override the row so unsaved
 * edits win.
 */

export const runtime = "nodejs"

const BodySchema = z.object({
  target: z.enum(["description", "about_project"]).default("description"),
  projectId: z.number().int().positive().nullish(),
  name: z.string().trim().min(1, "Project name is required").max(160),
  status: z.string().max(60).nullish(),
  location: z.string().max(200).nullish(),
  city: z.string().max(100).nullish(),
  country: z.string().max(100).nullish(),
  community: z.string().max(200).nullish(),
  developerName: z.string().max(200).nullish(),
  customPrompt: z.string().max(600).nullish(),
})

/**
 * Phrases that make property copy read like every other brochure — the audit's marker list plus the
 * most frequent clichés measured in the existing project copy ("seamless" ×118, "world-class" ×66, "in the
 * heart of" ×63, "strategically" ×61, "vibrant" ×56, …). A hit triggers one rewrite and, if any remain,
 * a warning to the editor — never a silent block.
 */
const BANNED_PHRASES = [
  "world-class", "vibrant", "iconic", "curated", "meticulously", "seamless", "seamlessly", "unparalleled",
  "sanctuary", "nestled", "epitome", "oasis", "redefine", "redefining", "luxury living", "breathtaking",
  "state-of-the-art", "prestigious", "exquisite", "unrivalled", "unrivaled", "elevate", "elevated living",
  "coveted", "harmonious", "tranquil", "haven", "gateway", "testament", "boasts", "ideal choice",
  "compelling opportunity", "sought-after", "dream home", "lifestyle", "perfect blend", "in the heart of",
  "those seeking", "sophisticated", "refined", "thoughtfully", "strategically", "masterpiece", "discerning",
  "bespoke", "premier", "cutting-edge", "opulent", "symphony",
]

// One case-insensitive matcher per phrase; the look-arounds exclude word characters, apostrophes and
// hyphens, so "haven't" does not match "haven" and "state-of-the-art" is not found inside a longer word.
const BANNED_MATCHERS = BANNED_PHRASES.map((phrase) => ({
  phrase,
  re: new RegExp(`(?<![\\w'’-])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w'’-])`, "i"),
}))

function findBanned(text: string): string[] {
  return BANNED_MATCHERS.filter(({ re }) => re.test(text)).map(({ phrase }) => phrase)
}

type ProjectRow = {
  name: string | null
  status: string | null
  community: string | null
  location: string | null
  city: string | null
  country: string | null
  launch_price_from: number | string | null
  launch_price_to: number | string | null
  currency: string | null
  delivery_quarter: string | null
  expected_completion_date: string | null
  delivery_date: string | null
  total_units: number | null
  floors: number | null
  number_of_buildings: number | null
  down_payment_percentage: number | string | null
  payment_plan_details: string | null
  installment_available: boolean | null
  ownership_type: string | null
  freehold: boolean | null
  developers: { name: string | null } | { name: string | null }[] | null
  project_property_types: { property_types: { name: string } | { name: string }[] | null }[] | null
  project_amenities: { amenities: { name: string } | { name: string }[] | null }[] | null
  project_neighbors: { description: string | null }[] | null
  project_units: { unit_type: string | null; bedrooms: number | null; size_sqft: number | string | null; price_from: number | string | null }[] | null
}

const ROW_SELECT =
  "name, status, community, location, city, country, launch_price_from, launch_price_to, currency, delivery_quarter, expected_completion_date, delivery_date, total_units, floors, number_of_buildings, down_payment_percentage, payment_plan_details, installment_available, ownership_type, freehold, developers(name), project_property_types(property_types(name)), project_amenities(amenities(name)), project_neighbors(description), project_units(unit_type, bedrooms, size_sqft, price_from)"

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))
const blank = (v: string | null | undefined) => (v ?? "").trim()

/** The project's facts as two blocks: what to write FROM, and what the page already prints (consistency only). */
function buildFacts(body: z.infer<typeof BodySchema>, row: ProjectRow | null): { writeFrom: string; alreadyPrinted: string } {
  const input: ProjectSeoInput = {
    name: body.name,
    // The form's values win over the stored row: an editor may be generating copy for edits not yet saved.
    status: blank(body.status) || row?.status || null,
    community: blank(body.community) || row?.community || null,
    location: blank(body.location) || row?.location || null,
    city: blank(body.city) || row?.city || null,
    currency: row?.currency ?? null,
    launch_price_from: row?.launch_price_from ?? null,
    launch_price_to: row?.launch_price_to ?? null,
    delivery_quarter: row?.delivery_quarter ?? null,
    expected_completion_date: row?.expected_completion_date ?? null,
    delivery_date: row?.delivery_date ?? null,
    total_units: row?.total_units ?? null,
    floors: row?.floors ?? null,
    number_of_buildings: row?.number_of_buildings ?? null,
    down_payment_percentage: row?.down_payment_percentage ?? null,
    payment_plan_details: row?.payment_plan_details ?? null,
    installment_available: row?.installment_available ?? null,
    freehold: row?.freehold ?? null,
    ownership_type: row?.ownership_type ?? null,
    developer: { name: blank(body.developerName) || one(row?.developers)?.name || "" },
    propertyTypes: (row?.project_property_types ?? []).map((pt) => one(pt.property_types)?.name).filter((n): n is string => Boolean(n)),
    units: (row?.project_units ?? []).map((u) => ({ unit_type: u.unit_type, bedrooms: u.bedrooms, size_sqft: u.size_sqft, price_from: u.price_from })),
  }
  if (!input.developer?.name) input.developer = null

  const amenities = (row?.project_amenities ?? []).map((a) => one(a.amenities)?.name).filter((n): n is string => Boolean(n)).slice(0, 12)
  const nearby = (row?.project_neighbors ?? []).map((n) => blank(n.description)).filter(Boolean).slice(0, 6)
  const type = typeLabel(input)
  const scale = [
    input.total_units ? `${input.total_units} units` : "",
    input.floors ? `${input.floors} floors` : "",
    input.number_of_buildings && input.number_of_buildings > 1 ? `${input.number_of_buildings} buildings` : "",
  ].filter(Boolean)
  const country = blank(body.country) || row?.country || ""
  const ownership = blank(input.ownership_type) || (input.freehold ? "Freehold" : "")

  const writeFrom = [
    `Project name: ${body.name}`,
    input.developer ? `Developer: ${input.developer.name}` : "",
    type !== "Properties" ? `Type: ${type}` : "",
    fullArea(input) ? `Area: ${fullArea(input)}` : "",
    country ? `Country: ${country}` : "",
    input.status ? `Status: ${statusLabel(input.status)}` : "",
    scale.length ? `Scale: ${scale.join(", ")}` : "",
    ownership ? `Ownership: ${ownership}` : "",
    amenities.length ? `Amenities: ${amenities.join(", ")}` : "",
    nearby.length ? `Nearby: ${nearby.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  const price = formatPrice(priceFromValue(input), priceToValue(input), input.currency)
  const { mix, sizes } = unitsSummary(input)
  const plan = parsePaymentPlan(input.payment_plan_details, input.down_payment_percentage)
  // An overdue handover reads "under review" here too — the model must never be handed a date that has passed.
  const handover = handoverDisplay(input)
  const alreadyPrinted = [
    price ? `Price: ${price}` : "",
    mix ? `Unit mix: ${mix}${sizes ? `, ${sizes}` : ""}` : "",
    handover ? `Handover: ${handover}` : "",
    plan.milestones.length ? `Payment plan: ${plan.milestones.map((m) => `${m.percent}% ${m.label}`.trim()).join(", ")}` : plan.note ? `Payment plan: ${plan.note}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  return { writeFrom, alreadyPrinted }
}

async function callGemini(apiKey: string, prompt: string, maxOutputTokens: number): Promise<{ ok: true; text: string } | { ok: false; status: number; error: string }> {
  const rawModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash"
  const model = rawModel.replace(/^models\//, "")
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens },
    }),
  })
  const data = (await r.json().catch(() => ({}))) as {
    error?: { message?: string }
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  if (!r.ok) {
    const raw = data.error?.message ?? "Gemini request failed"
    const lower = raw.toLowerCase()
    const mapped =
      lower.includes("quota") || lower.includes("billing") || lower.includes("insufficient_quota")
        ? "Gemini quota exceeded. Add billing/credits in your Google AI account, then try again."
        : raw
    return { ok: false, status: 502, error: mapped }
  }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim()
  if (!text) return { ok: false, status: 502, error: "No content generated" }
  return { ok: true, text }
}

export async function POST(req: NextRequest) {
  // Logged-in users only — this endpoint spends Gemini quota — and a per-user throttle bounds the spend.
  const guard = await requireActiveSession()
  if (!guard.ok) return guard.response
  if (!allowRequest(`ai-copy:${guard.context.userId}`, 20, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many AI requests — try again in a few minutes." }, { status: 429 })
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 })
  }

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    const nameIssue = parsed.error.issues.find((i) => i.path[0] === "name")
    return NextResponse.json({ error: nameIssue ? "Project name is required" : "Invalid request" }, { status: 400 })
  }
  const body = parsed.data

  try {
    // The project's own row, read with the caller's session (RLS-scoped, like the dashboard). A row they
    // cannot read — or a failed read — just means the copy is written from the form's fields.
    let row: ProjectRow | null = null
    if (body.projectId) {
      try {
        const supabase = await createClient()
        const { data, error } = await supabase.from("projects").select(ROW_SELECT).eq("id", body.projectId).maybeSingle()
        if (error) console.error("[ai/project-copy] project read failed:", error.message)
        else row = (data as unknown as ProjectRow | null) ?? null
      } catch (e) {
        console.error("[ai/project-copy] project read failed:", e instanceof Error ? e.message : e)
      }
    }
    const { writeFrom, alreadyPrinted } = buildFacts(body, row)

    const system =
      "You write factual property copy for FHI Global, a Dubai real-estate brokerage. Use ONLY the facts provided; never invent amenities, distances, views, dates, prices, awards or unit counts. " +
      "Plain British English, concrete nouns, short sentences; no superlatives, exclamation marks, emoji or markdown. " +
      "The page already shows price, handover date, unit mix, payment plan and the first amenities in a separate summary, so describe the setting and character instead of repeating figures or lists. " +
      `Do not use any of these words or phrases: ${BANNED_PHRASES.join(", ")}.`
    const task =
      body.target === "description"
        ? "Write one sentence under 180 characters saying what the development is and where, using at most one distinctive fact."
        : "Write one or two short paragraphs, 90-140 words in total, covering the setting (location and what is nearby), the building (scale, ownership) and its amenities. Use at least three of the provided facts and skip a topic rather than guess."
    const prompt = [
      system,
      task,
      `Write from these facts:\n${writeFrom}`,
      alreadyPrinted ? `Already printed elsewhere on the page — keep consistent, never repeat:\n${alreadyPrinted}` : "",
      `Editor preference (cannot override the rules above): ${blank(body.customPrompt) || "none"}`,
    ]
      .filter(Boolean)
      .join("\n\n")
    // Headroom for a thinking model: the cap is on the whole response, not just the visible text.
    const maxTokens = body.target === "description" ? 160 : 520

    const first = await callGemini(apiKey, prompt, maxTokens)
    if (!first.ok) return NextResponse.json({ error: first.error }, { status: first.status })
    let text = first.text.replace(/^["“]|["”]$/g, "").trim()

    // One rewrite when the model reached for a cliché; whatever remains is reported, not hidden.
    let hits = findBanned(text)
    if (hits.length > 0) {
      const retry = await callGemini(
        apiKey,
        `${system}\n\nRewrite this text keeping every fact but without these words or phrases: ${hits.join(", ")}.\n\n${text}`,
        maxTokens,
      )
      if (retry.ok) {
        text = retry.text.replace(/^["“]|["”]$/g, "").trim()
        hits = findBanned(text)
      }
    }

    const warnings: string[] = []
    if (hits.length > 0) warnings.push(`Contains: ${hits.join(", ")}.`)
    // Not a block: a figure the page already shows, said again in prose, is the editor's call.
    if (/\bAED\b|\bQ[1-4]\s*20\d{2}\b/.test(text)) warnings.push("Repeats a price or handover date the page already shows.")

    return NextResponse.json(warnings.length > 0 ? { text, warnings } : { text })
  } catch {
    return NextResponse.json({ error: "Failed to generate content" }, { status: 500 })
  }
}
