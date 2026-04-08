import { NextRequest, NextResponse } from "next/server"

type TargetField = "description" | "about_project"

type Payload = {
  target?: TargetField
  name?: string
  status?: string
  location?: string
  city?: string
  country?: string
  developerName?: string
  customPrompt?: string
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 })
  }

  try {
    const body = (await req.json()) as Payload
    const target: TargetField = body.target === "about_project" ? "about_project" : "description"
    const name = String(body.name ?? "").trim()
    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 })
    }

    const facts = [
      `Project name: ${name}`,
      body.developerName ? `Developer: ${body.developerName}` : "",
      body.status ? `Status: ${body.status}` : "",
      body.location ? `Location: ${body.location}` : "",
      body.city ? `City: ${body.city}` : "",
      body.country ? `Country: ${body.country}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    const system =
      target === "description"
        ? "You are a senior real-estate copywriter. Write one concise listing description sentence. Tone: premium, factual, clear. No emoji. No markdown."
        : "You are a senior real-estate copywriter. Write a polished About Project paragraph for a property detail page in 90-140 words. Tone: premium, factual, trustworthy. No emoji. No markdown."

    const userPrompt =
      target === "description"
        ? `Write a short description under 180 characters.\n\n${facts}\n\nUser preference: ${String(body.customPrompt ?? "").trim() || "Not provided"}`
        : `Write an About Project paragraph based on these facts:\n\n${facts}\n\nUser preference: ${String(body.customPrompt ?? "").trim() || "Not provided"}`

    const rawModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash"
    const model = rawModel.replace(/^models\//, "")
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${system}\n\n${userPrompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: target === "description" ? 90 : 300,
        },
      }),
    })

    const data = (await r.json()) as {
      error?: { message?: string }
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>
        }
      }>
    }

    if (!r.ok) {
      const raw = data.error?.message ?? "Gemini request failed"
      const lower = raw.toLowerCase()
      const mapped =
        lower.includes("quota") || lower.includes("billing") || lower.includes("insufficient_quota")
          ? "Gemini quota exceeded. Add billing/credits in your Google AI account, then try again."
          : raw
      return NextResponse.json(
        { error: mapped },
        { status: 502 },
      )
    }

    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim()
    if (!text) {
      return NextResponse.json({ error: "No content generated" }, { status: 502 })
    }

    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ error: "Failed to generate content" }, { status: 500 })
  }
}

