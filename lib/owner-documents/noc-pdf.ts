// Client-side generator for the owner's NOC ("No Objection Certificate" /
// Authorization-to-Advertise letter). Built from the details the owner enters on
// the public intake page, downloaded for them to sign and re-upload. pdf-lib is
// dynamically imported so it never ships in the initial bundle — only pulled in
// when the owner clicks "Download NOC letter".

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
  /** Pre-formatted "valid until" date, or "" for the blank/"until revoked" line. */
  validUntil: string
}

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 56
const BODY_SIZE = 11
const LINE_HEIGHT = 16
const BLANK = "________________________"

const fill = (v: string) => (v.trim() ? v.trim() : BLANK)

/** Build the NOC authorization letter as a PDF Blob. */
export async function buildNocPdfBlob(input: NocPdfInput): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib")

  const doc = await PDFDocument.create()
  const page = doc.addPage(A4)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const { width } = page.getSize()
  const maxWidth = width - MARGIN * 2
  const ink = rgb(0.05, 0.07, 0.09)
  let y = A4[1] - MARGIN

  // Wrap a string to maxWidth for the given font/size.
  const wrap = (text: string, f: typeof font, size: number): string[] => {
    const words = text.split(/\s+/)
    const lines: string[] = []
    let line = ""
    for (const w of words) {
      const next = line ? `${line} ${w}` : w
      if (f.widthOfTextAtSize(next, size) > maxWidth && line) {
        lines.push(line)
        line = w
      } else {
        line = next
      }
    }
    if (line) lines.push(line)
    return lines
  }

  const draw = (
    text: string,
    opts: { font?: typeof font; size?: number; gap?: number; x?: number } = {},
  ) => {
    const f = opts.font ?? font
    const size = opts.size ?? BODY_SIZE
    const x = opts.x ?? MARGIN
    for (const line of wrap(text, f, size)) {
      page.drawText(line, { x, y, size, font: f, color: ink })
      y -= LINE_HEIGHT
    }
    if (opts.gap) y -= opts.gap
  }

  // Heading
  draw("NO OBJECTION CERTIFICATE", { font: bold, size: 15, gap: 2 })
  draw("(Owner's Authorization to Advertise)", { font: bold, size: 10, gap: 12 })

  draw(`Date: ${fill(input.date)}`, { gap: 10 })
  draw("To Whom It May Concern,", { gap: 10 })

  draw(
    `I, ${fill(input.ownerName)}, holder of Emirates ID/Passport No. ${fill(input.ownerIdNumber)}, being the legal owner of the property described below:`,
    { gap: 10 },
  )

  draw("Property Details:", { font: bold, gap: 4 })
  const bulletX = MARGIN + 16
  draw(`•  Property Name/Building: ${fill(input.building)}`, { x: bulletX })
  draw(`•  Unit Number: ${fill(input.unitNumber)}`, { x: bulletX })
  draw(`•  Community/Area: ${fill(input.community)}`, { x: bulletX })
  draw(`•  Title Deed Number: ${fill(input.titleDeedNumber)}`, { x: bulletX, gap: 12 })

  draw(
    `Hereby authorize and grant my full consent to ${fill(input.agencyName)} to advertise, market, and arrange viewings of the above-mentioned property for the purpose of sale and/or lease.`,
    { gap: 10 },
  )
  draw(
    "I confirm that I have no objection to prospective buyers or tenants being accompanied by the authorized real estate agent for property inspections and viewings at mutually agreed times.",
    { gap: 10 },
  )
  draw(
    `This authorization shall remain valid until ${fill(input.validUntil)} or until revoked by me in writing.`,
    { gap: 40 },
  )

  // Signature block
  draw("Owner Signature: ______________________________", { gap: 12 })
  draw(`Name: ${fill(input.ownerName)}`, { gap: 4 })
  draw(`Date: ${fill(input.date)}`)

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
