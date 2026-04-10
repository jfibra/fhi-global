import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { isSalesPipelineRole } from "@/lib/app-roles"

type Body = {
  title?: string
  listing_kind?: string
  price?: number | null
  currency?: string
  projectName?: string | null
  customPrompt?: string
}

export async function POST(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) {
    return session.response
  }

  const role = session.context.profile.role
  if (!isSalesPipelineRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 })
  }

  try {
    const body = (await req.json()) as Body
    const title = String(body.title ?? "").trim()
    if (!title) {
      return NextResponse.json({ error: "Title is required to generate a description" }, { status: 400 })
    }

    const kind = String(body.listing_kind ?? "sale").toLowerCase() === "rent" ? "rent" : "sale"
    const priceLine =
      body.price != null && Number.isFinite(Number(body.price))
        ? `Price: ${Number(body.price).toLocaleString()} ${String(body.currency ?? "AED").trim() || "AED"}`
        : ""
    const projectLine = body.projectName?.trim() ? `Linked development: ${body.projectName.trim()}` : ""
    const custom = String(body.customPrompt ?? "").trim()

    const facts = [
      `Listing title: ${title}`,
      `Listing type: ${kind === "rent" ? "For rent" : "For sale"}`,
      priceLine,
      projectLine,
    ]
      .filter(Boolean)
      .join("\n")

    const system =
      "You are a senior UAE real-estate copywriter. Write one polished listing description for an agent's property listing. Tone: premium, clear, trustworthy. No emoji, no markdown, no bullet lists. Output must be exactly one paragraph: a single continuous block of prose with no line breaks and no multiple paragraphs."

    const userPrompt = `Write 90–180 words in a single paragraph only (no blank lines, no second paragraph) suitable for a web listing detail page.\n\n${facts}\n\nExtra direction from the agent: ${custom || "None — use best judgment."}`

    const rawModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash"
    const model = rawModel.replace(/^models\//, "")
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${system}\n\n${userPrompt}` }] }],
          generationConfig: {
            temperature: 0.65,
            maxOutputTokens: 500,
          },
        }),
      },
    )

    const data = (await r.json()) as {
      error?: { message?: string }
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }

    if (!r.ok) {
      const raw = data.error?.message ?? "Gemini request failed"
      const lower = raw.toLowerCase()
      const mapped =
        lower.includes("quota") || lower.includes("billing") || lower.includes("insufficient_quota")
          ? "Gemini quota exceeded. Check billing in Google AI Studio, then try again."
          : raw
      return NextResponse.json({ error: mapped }, { status: 502 })
    }

    const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim()
    if (!raw) {
      return NextResponse.json({ error: "No content generated" }, { status: 502 })
    }

    const text = raw.replace(/\s+/g, " ").trim()

    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ error: "Failed to generate description" }, { status: 500 })
  }
}
