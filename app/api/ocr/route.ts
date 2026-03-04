import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/ocr
 *
 * Attempts to extract identity information from an uploaded ID image.
 *
 * Current implementation uses regex pattern-matching on base64-decoded image
 * data as a lightweight fallback. Integrate Google Cloud Vision, AWS Textract,
 * or a similar service here for production-quality results.
 *
 * Body: { imageBase64: string, mimeType?: string }
 *
 * Response: { name, idNumber, dateOfBirth, expiryDate, countryCode, warning? }
 */
export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType } = await req.json() as { imageBase64?: string; mimeType?: string }

    if (!imageBase64) {
      return NextResponse.json({ warning: "No image provided. Please fill in your details manually." }, { status: 200 })
    }

    // â”€â”€ If a real OCR service API key is configured, use it â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Example: Google Cloud Vision
    const gcpKey = process.env.GOOGLE_CLOUD_VISION_API_KEY
    if (gcpKey) {
      try {
        const visionRes = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${gcpKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requests: [{
                image: { content: imageBase64 },
                features: [{ type: "TEXT_DETECTION", maxResults: 1 }],
              }],
            }),
          }
        )
        const visionData = await visionRes.json()
        const text: string = visionData?.responses?.[0]?.fullTextAnnotation?.text ?? ""
        if (text) {
          return NextResponse.json(extractFromText(text))
        }
      } catch {
        // Fall through to manual fallback
      }
    }

    // â”€â”€ Lightweight fallback: regex on raw base64 decoded text â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // This has very limited accuracy â€” it may catch numeric patterns in
    // low-entropy parts of the encoded data. Real text extraction via OCR
    // is strongly recommended. Return fields empty with a clear warning.
    return NextResponse.json({
      name:        "",
      idNumber:    "",
      dateOfBirth: "",
      expiryDate:  "",
      countryCode: "AE",
      warning:     "No OCR service is configured. Please review and fill in your document details manually.",
    })
  } catch (err) {
    console.error("[/api/ocr]", err)
    return NextResponse.json({
      name: "", idNumber: "", dateOfBirth: "", expiryDate: "", countryCode: "AE",
      warning: "OCR processing failed. Please fill in your details manually.",
    }, { status: 200 })
  }
}

// â”€â”€ Text extraction helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface OcrResult {
  name:        string
  idNumber:    string
  dateOfBirth: string
  expiryDate:  string
  countryCode: string
  warning?:    string
}

function extractFromText(text: string): OcrResult {
  // UAE Emirates ID: 784-XXXX-XXXXXXX-X
  const emiratesIdMatch = text.match(/784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d/)
  const idNumber = emiratesIdMatch ? emiratesIdMatch[0].replace(/\s/g, "") : ""

  // Date patterns: DD/MM/YYYY or DD-MM-YYYY or YYYY-MM-DD
  const dateMatches = [...text.matchAll(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})\b/g)]
    .map(m => normaliseDate(m[1]))
    .filter(Boolean)

  const dateOfBirth = dateMatches[0] ?? ""
  const expiryDate  = dateMatches[1] ?? ""

  // Country code
  const ccMatch = text.match(/\b(ARE|UAE|AE|USA|US|GBR|GB|IND|IN|PAK|PK|PHL|PH)\b/i)
  const countryCode = ccMatch ? iso3toIso2(ccMatch[1].toUpperCase()) : "AE"

  // Name: look for lines in ALL CAPS (common on passports/IDs)
  const capsLines = text.split("\n")
    .map(l => l.trim())
    .filter(l => /^[A-Z\s]{4,40}$/.test(l) && !l.match(/^(UAE|UNITED|ARAB|EMIRATES|PASSPORT|IDENTITY)/))
  const name = capsLines[0] ?? ""

  const warning = !name && !idNumber
    ? "We could not read the document clearly. Please review and fill in your details manually."
    : undefined

  return { name, idNumber, dateOfBirth, expiryDate, countryCode, warning }
}

function normaliseDate(raw: string): string {
  // Attempt to output as YYYY-MM-DD for <input type="date" />
  const parts = raw.split(/[\/\-]/)
  if (parts.length !== 3) return ""
  if (parts[0].length === 4) return raw.replace(/\//g, "-") // already YYYY-MM-DD
  const [d, m, y] = parts
  const year = y.length === 2 ? `20${y}` : y
  return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
}

function iso3toIso2(code: string): string {
  const map: Record<string, string> = { ARE: "AE", UAE: "AE", USA: "US", GBR: "GB", IND: "IN", PAK: "PK", PHL: "PH" }
  return map[code] ?? code.slice(0, 2)
}
