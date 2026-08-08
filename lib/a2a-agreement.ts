// Client-side generator for the Agent-to-Agent (A2A) Collaboration Agreement.
//
// Mirrors the printed two-page form: navy FHI letterhead, the two party
// blocks, scope tick-boxes, commission split, the fixed legal clauses
// (confidentiality, non-circumvention, duration, governing law) and a
// signature block per party with the drawn signatures embedded.
//
// pdf-lib is imported dynamically so it never ships in the initial bundle —
// same approach as lib/owner-documents/noc-pdf.ts, whose helpers this mirrors.

export type A2AScope = "inventory" | "client" | "both"

export type A2AParty = {
  fullName: string
  agency: string
  brn: string
  phone: string
  email: string
  /** PNG data URL of the drawn signature. */
  signatureDataUrl?: string
  signedName: string
  signedDate: string
}

export type A2AInput = {
  date: string
  partyA: A2AParty
  partyB: A2AParty
  scope: A2AScope | ""
  propertyRef: string
  clientName: string
  splitA: string
  splitB: string
  noticePeriodDays: string
  validUntil: string
}

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 54
const BODY = 9.5
const LEAD = 13

/** Keep to what built-in Helvetica (WinAnsi) can encode — exotic glyphs would throw. */
function safe(s: string): string {
  return String(s ?? "")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
}

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const comma = dataUrl.indexOf(",")
  if (comma < 0) return null
  try {
    const bin = atob(dataUrl.slice(comma + 1))
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

const SCOPE_LINES: Array<{ key: A2AScope; label: string }> = [
  { key: "inventory", label: "Inventory Sharing - sharing available property listings for marketing" },
  { key: "client", label: "Client Sharing - introducing prospective buyers/tenants to each other's listings" },
  { key: "both", label: "Both - full collaboration on inventory and client sharing" },
]

export async function buildA2APdfBlob(input: A2AInput): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib")

  const doc = await PDFDocument.create()
  const [W, H] = A4
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique)

  const navy = rgb(0.043, 0.137, 0.259)
  const gold = rgb(0.839, 0.702, 0.341)
  const ink = rgb(0.05, 0.07, 0.09)
  const gray = rgb(0.42, 0.45, 0.5)
  const hair = rgb(0.88, 0.89, 0.91)
  const fieldBg = rgb(0.949, 0.953, 0.961)

  // Signatures are embedded once and reused across pages.
  const embedSig = async (dataUrl?: string) => {
    if (!dataUrl) return null
    const bytes = dataUrlToBytes(dataUrl)
    if (!bytes) return null
    try {
      return await doc.embedPng(bytes)
    } catch {
      return null
    }
  }
  const sigA = await embedSig(input.partyA.signatureDataUrl)
  const sigB = await embedSig(input.partyB.signatureDataUrl)

  let logo: Awaited<ReturnType<typeof doc.embedPng>> | null = null
  try {
    const res = await fetch("/fhi-branding-navy.png")
    if (res.ok) logo = await doc.embedPng(await res.arrayBuffer())
  } catch {
    // Logo is decorative — never block the document over it.
  }

  let page = doc.addPage(A4)
  let y = 0

  /** Navy letterhead; every page opens with it. */
  const header = () => {
    const bandH = 74
    page.drawRectangle({ x: 0, y: H - bandH, width: W, height: bandH, color: navy })
    page.drawRectangle({ x: 0, y: H - bandH - 3, width: W, height: 3, color: gold })
    if (logo) {
      const logoH = 40
      const logoW = (logo.width / logo.height) * logoH
      page.drawImage(logo, { x: (W - logoW) / 2, y: H - bandH + (bandH - logoH) / 2, width: logoW, height: logoH })
    } else {
      const t = "FHI GLOBAL PROPERTY"
      page.drawText(t, { x: (W - bold.widthOfTextAtSize(t, 16)) / 2, y: H - 44, size: 16, font: bold, color: rgb(1, 1, 1) })
    }
    y = H - bandH - 34
  }

  const newPage = () => {
    page = doc.addPage(A4)
    header()
  }

  /** Reserve `need` points; break to a new page when the footer would collide. */
  const ensure = (need: number) => {
    if (y - need < 72) newPage()
  }

  const text = (
    s: string,
    opts: { x?: number; size?: number; font?: typeof font; color?: typeof ink } = {},
  ) => {
    page.drawText(safe(s), {
      x: opts.x ?? MARGIN,
      y,
      size: opts.size ?? BODY,
      font: opts.font ?? font,
      color: opts.color ?? ink,
    })
  }

  /** Word-wrapped paragraph. */
  const para = (s: string, opts: { size?: number; gap?: number; font?: typeof font; color?: typeof ink } = {}) => {
    const size = opts.size ?? BODY
    const f = opts.font ?? font
    const maxW = W - MARGIN * 2
    const words = safe(s).split(/\s+/)
    let line = ""
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (f.widthOfTextAtSize(next, size) > maxW && line) {
        ensure(LEAD)
        page.drawText(line, { x: MARGIN, y, size, font: f, color: opts.color ?? ink })
        y -= LEAD
        line = word
      } else {
        line = next
      }
    }
    if (line) {
      ensure(LEAD)
      page.drawText(line, { x: MARGIN, y, size, font: f, color: opts.color ?? ink })
      y -= LEAD
    }
    y -= opts.gap ?? 6
  }

  /** Navy section heading with the gold hairline under it. */
  const section = (title: string) => {
    ensure(40)
    text(title, { size: 11.5, font: bold, color: navy })
    y -= 6
    page.drawRectangle({ x: MARGIN, y, width: W - MARGIN * 2, height: 0.9, color: gold })
    y -= 16
  }

  /**
   * A labelled entry box. Filled values are drawn inside a light box (as the
   * printed form's grey fields); empties leave the box blank to be written in.
   */
  const field = (label: string, value: string, opts: { x?: number; labelW?: number; boxW?: number } = {}) => {
    const x = opts.x ?? MARGIN
    const labelW = opts.labelW ?? 96
    const boxW = opts.boxW ?? 240
    const boxH = 15
    page.drawText(safe(label), { x, y: y + 3.5, size: BODY, font, color: ink })
    page.drawRectangle({ x: x + labelW, y, width: boxW, height: boxH, color: fieldBg })
    page.drawRectangle({ x: x + labelW, y, width: boxW, height: boxH, borderColor: hair, borderWidth: 0.7 })
    const v = safe(value).trim()
    if (v) {
      // Shrink rather than overflow the box.
      let size = BODY
      while (font.widthOfTextAtSize(v, size) > boxW - 10 && size > 6) size -= 0.5
      page.drawText(v, { x: x + labelW + 5, y: y + 4, size, font, color: ink })
    }
  }

  /** One row of the party block; advances the cursor. */
  const fieldRow = (rows: Array<{ label: string; value: string; x?: number; labelW?: number; boxW?: number }>) => {
    ensure(26)
    for (const r of rows) field(r.label, r.value, { x: r.x, labelW: r.labelW, boxW: r.boxW })
    y -= 24
  }

  const partyBlock = (title: string, p: A2AParty) => {
    section(title)
    fieldRow([{ label: "Full Name:", value: p.fullName, boxW: 330 }])
    fieldRow([{ label: "Agency / Brokerage:", value: p.agency, labelW: 106, boxW: 320 }])
    fieldRow([
      { label: "BRN/ORN No.:", value: p.brn, labelW: 76, boxW: 130 },
      { label: "Phone:", value: p.phone, x: MARGIN + 226, labelW: 40, boxW: 140 },
    ])
    fieldRow([{ label: "Email:", value: p.email, labelW: 46, boxW: 300 }])
    y -= 4
  }

  // ── Page 1 ──────────────────────────────────────────────────────────────────
  header()

  const centered = (s: string, size: number, f: typeof font, color: typeof ink) => {
    const t = safe(s)
    page.drawText(t, { x: (W - f.widthOfTextAtSize(t, size)) / 2, y, size, font: f, color })
  }
  centered("AGENT-TO-AGENT (A2A) COLLABORATION AGREEMENT", 14, bold, navy)
  y -= 16
  centered("Inventory Listing & Client Sharing Agreement", 9.5, italic, gray)
  y -= 26

  para(
    'This Agent-to-Agent (A2A) Collaboration Agreement ("Agreement") is entered into on the date below, between the two real estate agents/brokers named below, for the purpose of sharing property inventory listings and/or client leads in a professional, transparent, and mutually beneficial manner.',
    { gap: 10 },
  )

  fieldRow([{ label: "Date:", value: input.date, labelW: 40, boxW: 170 }])
  y -= 2

  partyBlock("Party A - Introducing / Listing Agent", input.partyA)
  partyBlock("Party B - Collaborating Agent", input.partyB)

  section("Scope of Collaboration")
  for (const line of SCOPE_LINES) {
    ensure(22)
    const boxSize = 10
    const checked = input.scope === line.key
    page.drawRectangle({
      x: MARGIN,
      y: y - 1,
      width: boxSize,
      height: boxSize,
      color: checked ? navy : rgb(1, 1, 1),
      borderColor: checked ? navy : hair,
      borderWidth: 0.9,
    })
    if (checked) {
      page.drawText("X", { x: MARGIN + 2.2, y: y + 1, size: 8, font: bold, color: rgb(1, 1, 1) })
    }
    page.drawText(safe(line.label), { x: MARGIN + 18, y: y + 0.5, size: BODY, font, color: ink })
    y -= 18
  }
  y -= 6

  section("Property / Client Reference")
  fieldRow([{ label: "Property / Listing Ref.:", value: input.propertyRef, labelW: 112, boxW: 260 }])
  fieldRow([{ label: "Client Name (if applicable):", value: input.clientName, labelW: 136, boxW: 236 }])
  y -= 2

  section("Commission Split Agreement")
  para(
    "Upon successful closing of a sale or lease resulting from this collaboration, commission earned shall be split between the parties as follows:",
    { gap: 8 },
  )
  ensure(26)
  field("Party A Share:", input.splitA ? `${input.splitA} %` : "", { labelW: 82, boxW: 80 })
  field("Party B Share:", input.splitB ? `${input.splitB} %` : "", { x: MARGIN + 200, labelW: 82, boxW: 80 })
  y -= 26
  para(
    "Commission will be released only after full receipt of funds from the client, and both parties agree to settle payment within 7 business days of receipt unless otherwise agreed in writing.",
    { gap: 10 },
  )

  // ── Page 2 — clauses + signatures ───────────────────────────────────────────
  newPage()

  section("Confidentiality")
  para(
    "Both parties agree to keep all shared client information, property details, and commercial terms strictly confidential, and to use such information solely for the purpose of this collaboration.",
    { gap: 10 },
  )

  section("Non-Circumvention")
  para(
    "Neither party shall directly or indirectly approach, negotiate with, or transact with any client, landlord, seller, or property introduced by the other party without the introducing party's written consent, for the duration of this Agreement and for 12 months thereafter.",
    { gap: 10 },
  )

  section("Duration & Termination")
  para(
    "This Agreement remains valid from the date of signing until terminated by either party with written notice. Any deals introduced prior to termination remain subject to the agreed commission split above.",
    { gap: 8 },
  )
  ensure(26)
  field("Notice Period (days):", input.noticePeriodDays, { labelW: 108, boxW: 80 })
  field("Valid Until:", input.validUntil, { x: MARGIN + 220, labelW: 62, boxW: 130 })
  y -= 28

  section("Governing Law")
  para(
    "This Agreement shall be governed by the laws of the Emirate of Dubai and the United Arab Emirates. Any disputes shall first be referred to RERA/DLD mediation before formal legal proceedings.",
    { gap: 12 },
  )

  section("Signatures")

  const signatureBlock = (
    heading: string,
    p: A2AParty,
    sig: Awaited<ReturnType<typeof doc.embedPng>> | null,
  ) => {
    ensure(96)
    text(heading, { size: 10, font: bold, color: navy })
    y -= 18

    // The drawn signature sits above the ruled line.
    const lineY = y
    page.drawText("Signature:", { x: MARGIN, y: lineY, size: BODY, font, color: ink })
    const sigX = MARGIN + 70
    if (sig) {
      const sigH = 34
      const sigW = Math.min(190, (sig.width / sig.height) * sigH)
      page.drawImage(sig, { x: sigX, y: lineY, width: sigW, height: sigH })
    }
    page.drawLine({
      start: { x: sigX, y: lineY - 3 },
      end: { x: sigX + 210, y: lineY - 3 },
      thickness: 0.75,
      color: ink,
    })
    y -= 22

    fieldRow([{ label: "Name:", value: p.signedName || p.fullName, labelW: 70, boxW: 210 }])
    fieldRow([{ label: "Date:", value: p.signedDate || input.date, labelW: 70, boxW: 140 }])
    y -= 6
  }

  signatureBlock("Party A", input.partyA, sigA)
  signatureBlock("Party B", input.partyB, sigB)

  // ── Footer on every page ────────────────────────────────────────────────────
  const foot = safe("FHI Global Property  ·  Dubai, UAE  ·  fhiglobal.ae")
  for (const pg of doc.getPages()) {
    pg.drawRectangle({ x: MARGIN, y: 60, width: W - MARGIN * 2, height: 0.8, color: hair })
    pg.drawText(foot, { x: (W - font.widthOfTextAtSize(foot, 8.5)) / 2, y: 44, size: 8.5, font, color: gray })
  }

  const bytes = await doc.save()
  // pdf-lib returns Uint8Array<ArrayBufferLike>, which isn't a valid BlobPart
  // under the DOM lib's stricter typing — copy into a plain ArrayBuffer.
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Blob([ab], { type: "application/pdf" })
}

/** Build the agreement and hand it to the browser as a download. */
export async function downloadA2APdf(input: A2AInput, filename: string): Promise<void> {
  const blob = await buildA2APdfBlob(input)
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}
