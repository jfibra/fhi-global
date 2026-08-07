// Client-side generator for the owner's NOC ("No Objection Certificate" /
// Authorization-to-Advertise letter). Built from the details the owner enters on
// the public intake page, downloaded for them to sign and re-upload. pdf-lib is
// dynamically imported so it never ships in the initial bundle — only pulled in
// when the owner clicks "Download NOC letter".
//
// Filled-in values are drawn UNDERLINED (a line under the answer text), matching
// the paper template where each blank is an underline in the sentence.

export type NocPdfInput = {
  /** Pre-formatted date string (e.g. "7 August 2026"). */
  date: string
  ownerName: string
  ownerIdNumber: string
  building: string
  unitNumber: string
  community: string
  titleDeedNumber: string
  /** Who the owner authorizes — e.g. "FHI Global Real Estate (Agent: Jane Doe)". */
  agencyName: string
  /** Pre-formatted "valid until" date, or "" for the blank line. */
  validUntil: string
}

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 56
const BODY_SIZE = 11
const LINE_HEIGHT = 16
const BLANK = "________________________"

/** A stretch of text in a paragraph; `underline` = it's a filled-in answer. */
type Run = { text: string; underline?: boolean }

/**
 * Keep only characters the built-in Helvetica (WinAnsi) can encode, so an owner
 * entering exotic glyphs (e.g. Arabic) can never crash PDF generation. Common
 * smart punctuation is folded to ASCII; anything else outside printable Latin-1
 * is dropped.
 */
function safe(s: string): string {
  return s
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    // Keep printable Latin-1 plus the bullet (U+2022, which WinAnsi/Helvetica
    // renders at 0x95); drop anything else (e.g. Arabic) so it can't crash.
    .replace(/[^\x20-\x7E\xA0-\xFF•]/g, "")
}

/** Build the NOC authorization letter as a PDF Blob. */
export async function buildNocPdfBlob(input: NocPdfInput): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib")

  const doc = await PDFDocument.create()
  const page = doc.addPage(A4)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const maxWidth = A4[0] - MARGIN * 2
  const ink = rgb(0.05, 0.07, 0.09)
  const bulletX = MARGIN + 16
  let y = A4[1] - MARGIN

  // A filled value → underlined text; an empty one → a blank underline.
  const val = (s: string): Run => (s.trim() ? { text: s.trim(), underline: true } : { text: BLANK })

  // Lay out a sequence of runs with word-wrap, drawing an underline beneath any
  // run marked as an answer (including the spaces inside a multi-word answer).
  function drawRuns(
    runs: Run[],
    opts: { size?: number; x?: number; gap?: number; font?: typeof font } = {},
  ) {
    const size = opts.size ?? BODY_SIZE
    const startX = opts.x ?? MARGIN
    const f = opts.font ?? font
    const spaceW = f.widthOfTextAtSize(" ", size)

    type W = { text: string; underline: boolean; runId: number; w: number }
    const words: W[] = []
    runs.forEach((run, runId) => {
      for (const part of safe(run.text).split(" ")) {
        if (!part) continue
        words.push({ text: part, underline: !!run.underline, runId, w: f.widthOfTextAtSize(part, size) })
      }
    })

    let line: W[] = []
    let lineW = 0
    const flush = () => {
      let x = startX
      for (let i = 0; i < line.length; i++) {
        const wd = line[i]
        page.drawText(wd.text, { x, y, size, font: f, color: ink })
        if (wd.underline) {
          page.drawLine({ start: { x, y: y - 2 }, end: { x: x + wd.w, y: y - 2 }, thickness: 0.75, color: ink })
        }
        const next = line[i + 1]
        if (next) {
          const gapStart = x + wd.w
          // Continue the underline across the space inside a multi-word answer.
          if (wd.underline && next.underline && wd.runId === next.runId) {
            page.drawLine({ start: { x: gapStart, y: y - 2 }, end: { x: gapStart + spaceW, y: y - 2 }, thickness: 0.75, color: ink })
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

  const draw = (text: string, opts: { size?: number; x?: number; gap?: number; font?: typeof font } = {}) =>
    drawRuns([{ text }], opts)

  // Heading
  draw("NO OBJECTION CERTIFICATE", { font: bold, size: 15, gap: 2 })
  draw("(Owner's Authorization to Advertise)", { font: bold, size: 10, gap: 12 })

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
  drawRuns([{ text: "•  Title Deed Number: " }, val(input.titleDeedNumber)], { x: bulletX, gap: 12 })

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
    { gap: 40 },
  )

  // Signature line (owner's name + date already appear above).
  draw("Owner Signature: ______________________________")

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
