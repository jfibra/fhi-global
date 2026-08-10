// Client-side generator for the owner's NOC ("No Objection Certificate" /
// Authorization-to-Advertise letter). Built from the details the owner enters on
// the public intake page, downloaded for them to sign and re-upload.
//
// Designed as a branded FHI letterhead document: navy header band with the FHI
// logo + gold rule, centered title, the letter body with filled-in answers
// drawn UNDERLINED, a signature block, and a footer. pdf-lib is dynamically
// imported so it never ships in the initial bundle.

export type NocPdfInput = {
  /** Pre-formatted date string (e.g. "7 August 2026"). */
  date: string
  ownerName: string
  ownerIdNumber: string
  building: string
  unitNumber: string
  community: string
  titleDeedNumber: string
  /** Who the owner authorizes — e.g. "FHI Global Property (Agent: Jane Doe)". */
  agencyName: string
  /** Pre-formatted "valid until" date, or "" for the blank line. */
  validUntil: string
  /** Optional PNG data URL of the owner's drawn signature, embedded on the line. */
  signatureDataUrl?: string
}

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 54
const BODY_SIZE = 11
const LINE_HEIGHT = 16
const BLANK = "________________________"

/** A stretch of text in a paragraph; `underline` = it's a filled-in answer. */
type Run = { text: string; underline?: boolean }

/**
 * Keep only characters the built-in Helvetica (WinAnsi) can encode — plus the
 * bullet (U+2022, which WinAnsi renders at 0x95) — so an owner entering exotic
 * glyphs (e.g. Arabic) can never crash PDF generation.
 */
function safe(s: string): string {
  return s
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\xA0-\xFF•]/g, "")
}

/** Decode a `data:image/png;base64,...` URL to bytes for pdf-lib embedding. */
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

/** Build the NOC authorization letter as a branded PDF Blob. */
export async function buildNocPdfBlob(input: NocPdfInput): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib")

  const doc = await PDFDocument.create()
  const [W, H] = A4
  const page = doc.addPage(A4)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const navy = rgb(0.043, 0.137, 0.259)
  const gold = rgb(0.839, 0.702, 0.341)
  const ink = rgb(0.05, 0.07, 0.09)
  const gray = rgb(0.42, 0.45, 0.5)
  const hair = rgb(0.9, 0.91, 0.93)

  const maxWidth = W - MARGIN * 2
  const bulletX = MARGIN + 16

  // ── Header band + logo + gold rule ─────────────────────────────────────────
  const bandH = 108
  page.drawRectangle({ x: 0, y: H - bandH, width: W, height: bandH, color: navy })
  page.drawRectangle({ x: 0, y: H - bandH - 3, width: W, height: 3, color: gold })
  try {
    const res = await fetch("/fhi-branding-navy.png")
    if (res.ok) {
      const logo = await doc.embedPng(await res.arrayBuffer())
      const logoH = 62
      const logoW = (logo.width / logo.height) * logoH
      page.drawImage(logo, {
        x: (W - logoW) / 2,
        y: H - bandH + (bandH - logoH) / 2,
        width: logoW,
        height: logoH,
      })
    }
  } catch {
    // Logo is decorative — a fetch/embed failure must not break the document.
  }

  let y = H - bandH - 46

  const center = (text: string, size: number, f: typeof font, color: typeof ink) => {
    const t = safe(text)
    const w = f.widthOfTextAtSize(t, size)
    page.drawText(t, { x: (W - w) / 2, y, size, font: f, color })
  }
  center("NO OBJECTION CERTIFICATE", 18, bold, navy)
  y -= 17
  center("Owner's Authorization to Advertise", 10.5, font, gray)
  y -= 30

  // ── Body: word-wrapped runs, filled answers underlined ──────────────────────
  const val = (s: string): Run => (s.trim() ? { text: s.trim(), underline: true } : { text: BLANK })

  function drawRuns(
    runs: Run[],
    opts: { size?: number; x?: number; gap?: number; font?: typeof font; color?: typeof ink } = {},
  ) {
    const size = opts.size ?? BODY_SIZE
    const startX = opts.x ?? MARGIN
    const f = opts.font ?? font
    const color = opts.color ?? ink
    const spaceW = f.widthOfTextAtSize(" ", size)

    type Word = { text: string; underline: boolean; runId: number; w: number }
    const words: Word[] = []
    runs.forEach((run, runId) => {
      for (const part of safe(run.text).split(" ")) {
        if (!part) continue
        words.push({ text: part, underline: !!run.underline, runId, w: f.widthOfTextAtSize(part, size) })
      }
    })

    let line: Word[] = []
    let lineW = 0
    const flush = () => {
      let x = startX
      for (let i = 0; i < line.length; i++) {
        const wd = line[i]
        page.drawText(wd.text, { x, y, size, font: f, color })
        if (wd.underline) {
          page.drawLine({ start: { x, y: y - 2 }, end: { x: x + wd.w, y: y - 2 }, thickness: 0.75, color })
        }
        const next = line[i + 1]
        if (next) {
          const gapStart = x + wd.w
          if (wd.underline && next.underline && wd.runId === next.runId) {
            page.drawLine({ start: { x: gapStart, y: y - 2 }, end: { x: gapStart + spaceW, y: y - 2 }, thickness: 0.75, color })
          }
          x = gapStart + spaceW
        }
      }
      y -= LINE_HEIGHT
      line = []
      lineW = 0
    }

    for (const wd of words) {
      const needed = (line.length ? spaceW : 0) + wd.w
      if (line.length && lineW + needed > maxWidth) flush()
      lineW += (line.length ? spaceW : 0) + wd.w
      line.push(wd)
    }
    if (line.length) flush()
    if (opts.gap) y -= opts.gap
  }

  const draw = (text: string, opts: { size?: number; x?: number; gap?: number; font?: typeof font; color?: typeof ink } = {}) =>
    drawRuns([{ text }], opts)

  drawRuns([{ text: "Date: " }, val(input.date)], { gap: 10 })
  draw("To Whom It May Concern,", { gap: 10 })

  drawRuns(
    [
      { text: "I, " },
      val(input.ownerName),
      { text: ", holder of Emirates ID/Passport No. " },
      val(input.ownerIdNumber),
      { text: ", being the legal owner of the property described below:" },
    ],
    { gap: 10 },
  )

  draw("Property Details:", { font: bold, gap: 4 })
  drawRuns([{ text: "•  Property Name/Building: " }, val(input.building)], { x: bulletX })
  drawRuns([{ text: "•  Unit Number: " }, val(input.unitNumber)], { x: bulletX })
  drawRuns([{ text: "•  Community/Area: " }, val(input.community)], { x: bulletX })
  drawRuns([{ text: "•  Title Deed / Oqood No.: " }, val(input.titleDeedNumber)], { x: bulletX, gap: 12 })

  drawRuns(
    [
      { text: "Hereby authorize and grant my full consent to " },
      val(input.agencyName),
      { text: " to advertise, market, and arrange viewings of the above-mentioned property for the purpose of sale and/or lease." },
    ],
    { gap: 10 },
  )
  draw(
    "I confirm that I have no objection to prospective buyers or tenants being accompanied by the authorized real estate agent for property inspections and viewings at mutually agreed times.",
    { gap: 10 },
  )
  drawRuns(
    [
      { text: "This authorization shall remain valid until " },
      val(input.validUntil),
      { text: " or until revoked by me in writing." },
    ],
    { gap: 46 },
  )

  // ── Signature block (embeds the owner's drawn signature if provided) ─────────
  const sigLabelY = y
  page.drawText("Owner Signature:", { x: MARGIN, y: sigLabelY, size: BODY_SIZE, font, color: ink })
  const sigX = MARGIN + 112
  if (input.signatureDataUrl) {
    const bytes = dataUrlToBytes(input.signatureDataUrl)
    if (bytes) {
      try {
        const sig = await doc.embedPng(bytes)
        const sigH = 42
        const sigW = Math.min(210, (sig.width / sig.height) * sigH)
        page.drawImage(sig, { x: sigX, y: sigLabelY, width: sigW, height: sigH })
      } catch {
        // signature is best-effort; the ruled line below still stands
      }
    }
  }
  page.drawLine({ start: { x: sigX, y: sigLabelY - 3 }, end: { x: sigX + 230, y: sigLabelY - 3 }, thickness: 0.75, color: ink })
  // Printed name under the line — the "printed name" the signature sits over.
  y = sigLabelY - 18
  if (input.ownerName.trim()) {
    page.drawText(safe(input.ownerName.trim()), { x: sigX, y, size: 10.5, font: bold, color: ink })
    y -= 12
  }
  page.drawText("Signature over printed name", { x: sigX, y, size: 8, font, color: gray })

  // ── Footer ──────────────────────────────────────────────────────────────────
  const footY = 44
  page.drawRectangle({ x: MARGIN, y: footY + 16, width: W - MARGIN * 2, height: 0.8, color: hair })
  const foot = safe("FHI Global Property  ·  Dubai, UAE  ·  fhiglobal.ae")
  page.drawText(foot, { x: (W - font.widthOfTextAtSize(foot, 8.5)) / 2, y: footY, size: 8.5, font, color: gray })

  const bytes = await doc.save()
  // Copy into a plain ArrayBuffer — pdf-lib returns Uint8Array<ArrayBufferLike>,
  // which isn't assignable to BlobPart under the DOM lib's stricter typing.
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Blob([ab], { type: "application/pdf" })
}

/** Generate the NOC letter and trigger a browser download. */
export async function downloadNocPdf(input: NocPdfInput, filename: string): Promise<void> {
  const blob = await buildNocPdfBlob(input)
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
