import "server-only"

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib"
import { AGREEMENT_BACKGROUND, AGREEMENT_CLAUSES, AGREEMENT_DRAFT_NOTE, AGREEMENT_TITLE } from "@/lib/merchant/agreement-text"
import { MERCHANT_INCENTIVE_AED, MERCHANT_PAY_DAY } from "@/lib/merchant/rules"

/**
 * The Merchant Partnership Agreement as a PDF, pre-filled with the merchant's
 * details (the first page's key terms) and, when the merchant signed on
 * screen, with the drawn signature embedded. A4, built-in Helvetica, the same
 * recipe as the A2A agreement (lib/a2a-agreement.ts).
 */

export type AgreementInput = {
  businessName: string
  category: string | null
  address: string | null
  tradeLicenceNumber: string | null
  tradeLicenceAuthority: string | null
  signatoryName: string | null
  signatoryTitle: string | null
  emiratesIdNumber: string | null
  bankAccountName: string | null
  bankName: string | null
  /** Masked, never the full IBAN on the printed form. */
  ibanMasked: string | null
  voucherOffer: string | null
  code: string | null
  startsOn: string | null
  endsOn: string | null
  agentName: string | null
  /** PNG data URL of the merchant's drawn signature; omitted for the blank form. */
  signatureDataUrl?: string | null
  signedName?: string | null
  signedDate?: string | null
}

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 54
const BODY = 9.5
const LEAD = 13
const NAVY = rgb(0 / 255, 31 / 255, 63 / 255)
const GOLD = rgb(214 / 255, 179 / 255, 87 / 255)
const INK = rgb(13 / 255, 17 / 255, 23 / 255)
const GREY = rgb(107 / 255, 114 / 255, 128 / 255)
const LINE = rgb(229 / 255, 232 / 255, 236 / 255)

const safe = (s: string) =>
  String(s ?? "")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const comma = dataUrl.indexOf(",")
  if (comma < 0) return null
  try {
    return new Uint8Array(Buffer.from(dataUrl.slice(comma + 1), "base64"))
  } catch {
    return null
  }
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = safe(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ""
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line)
      line = w
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "____________"

export async function merchantAgreementPdf(input: AgreementInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`${AGREEMENT_TITLE} - ${input.businessName}`)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique)
  const [W, H] = A4
  const textW = W - MARGIN * 2

  let signature: PDFImage | null = null
  if (input.signatureDataUrl) {
    const bytes = dataUrlToBytes(input.signatureDataUrl)
    if (bytes) {
      try {
        signature = await doc.embedPng(bytes)
      } catch {
        signature = null
      }
    }
  }

  const pages: PDFPage[] = []
  let page = newPage()
  let y = H - MARGIN - 36

  function newPage(): PDFPage {
    const p = doc.addPage(A4)
    pages.push(p)
    // Navy band with the title, gold rule, the draft note.
    p.drawRectangle({ x: 0, y: H - 34, width: W, height: 34, color: NAVY })
    p.drawRectangle({ x: 0, y: H - 36, width: W, height: 2, color: GOLD })
    p.drawText(AGREEMENT_TITLE, { x: MARGIN, y: H - 22, size: 11, font: bold, color: rgb(1, 1, 1) })
    const brand = "rentsouq.ae  ·  FHI Global Property LLC  ·  MCG Properties LLC"
    p.drawText(brand, { x: W - MARGIN - font.widthOfTextAtSize(brand, 7.5), y: H - 21, size: 7.5, font, color: GOLD })
    p.drawText(AGREEMENT_DRAFT_NOTE, { x: MARGIN, y: H - 50, size: 7.5, font: italic, color: GREY })
    return p
  }

  function ensure(height: number) {
    if (y - height < MARGIN + 30) {
      page = newPage()
      y = H - MARGIN - 36
    }
  }

  function paragraph(text: string, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; gap?: number; indent?: number } = {}) {
    const f = opts.font ?? font
    const size = opts.size ?? BODY
    const indent = opts.indent ?? 0
    const lines = wrap(text, f, size, textW - indent)
    ensure(lines.length * LEAD + (opts.gap ?? 6))
    for (const line of lines) {
      page.drawText(line, { x: MARGIN + indent, y, size, font: f, color: opts.color ?? INK })
      y -= LEAD
    }
    y -= opts.gap ?? 6
  }

  function heading(text: string, plain: string) {
    ensure(LEAD * 3)
    y -= 4
    page.drawText(safe(text), { x: MARGIN, y, size: 11, font: bold, color: NAVY })
    y -= LEAD
    paragraph(`In plain words: ${plain}`, { font: italic, size: 8.5, color: GREY, gap: 4 })
  }

  /** A two-column grid of labelled values, boxed. */
  function keyTerms(rows: Array<[string, string]>) {
    const colW = textW / 2
    const rowH = 24
    const lines = Math.ceil(rows.length / 2)
    ensure(lines * rowH + 20)
    const top = y
    page.drawRectangle({ x: MARGIN, y: top - lines * rowH - 8, width: textW, height: lines * rowH + 8, borderColor: LINE, borderWidth: 1, color: rgb(250 / 255, 251 / 255, 253 / 255) })
    rows.forEach(([label, value], i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const x = MARGIN + 10 + col * colW
      const yy = top - 12 - row * rowH
      page.drawText(safe(label).toUpperCase(), { x, y: yy, size: 6.5, font: bold, color: GREY })
      const v = safe(value || "____________")
      const vSize = 9
      const maxW = colW - 20
      let shown = v
      while (font.widthOfTextAtSize(shown, vSize) > maxW && shown.length > 4) shown = shown.slice(0, -2)
      if (shown !== v) shown = `${shown.slice(0, -1)}…`.replace("…", "...")
      page.drawText(shown, { x, y: yy - 10, size: vSize, font, color: INK })
    })
    y = top - lines * rowH - 18
  }

  // ── Page 1: title, parties, key terms ────────────────────────────────────
  page.drawText(AGREEMENT_TITLE, { x: MARGIN, y, size: 20, font: bold, color: INK })
  y -= 24
  paragraph("Between RentSouq (FHI Global Property LLC and MCG Properties LLC) and the Merchant named below, for the Merchant Partnership Programme on rentsouq.ae.", { color: GREY, size: 9, gap: 10 })

  page.drawText("The parties", { x: MARGIN, y, size: 11, font: bold, color: NAVY })
  y -= LEAD + 2
  paragraph(`(1) RentSouq, meaning FHI Global Property LLC and MCG Properties LLC together, the operators of the property rental platform rentsouq.ae (the "Platform"). Each is a limited liability company licensed in Dubai.`, { gap: 4 })
  paragraph(`(2) The Merchant, being the business named below, acting through its authorised signatory (the "Merchant" or "you").`, { gap: 8 })

  page.drawText("The Merchant", { x: MARGIN, y, size: 11, font: bold, color: NAVY })
  y -= LEAD + 4
  keyTerms([
    ["Business name", input.businessName],
    ["Kind of business", input.category ?? ""],
    ["Trade licence no.", input.tradeLicenceNumber ?? ""],
    ["Issuing authority", input.tradeLicenceAuthority ?? ""],
    ["Address", input.address ?? ""],
    ["Introduced by (FHI agent)", input.agentName ?? ""],
    ["Authorised signatory", input.signatoryName ?? ""],
    ["Title", input.signatoryTitle ?? ""],
    ["Signatory's Emirates ID no.", input.emiratesIdNumber ?? ""],
    ["Merchant code", input.code ?? "issued on acceptance"],
  ])

  page.drawText("Key terms", { x: MARGIN, y, size: 11, font: bold, color: NAVY })
  y -= LEAD + 4
  keyTerms([
    ["Start date", fmtDate(input.startsOn)],
    ["End date", fmtDate(input.endsOn)],
    ["Merchant incentive per closed deal", `AED ${MERCHANT_INCENTIVE_AED}`],
    ["Paid", `${MERCHANT_PAY_DAY}th of the following month`],
    ["Customer voucher", input.voucherOffer ?? ""],
    ["Posting by the Merchant", "Twice a month on its own channels"],
    ["Bank account name", input.bankAccountName ?? ""],
    ["Bank · IBAN", [input.bankName, input.ibanMasked].filter(Boolean).join(" · ")],
  ])

  page.drawText("Background", { x: MARGIN, y, size: 11, font: bold, color: NAVY })
  y -= LEAD + 2
  for (const p of AGREEMENT_BACKGROUND) paragraph(p, { gap: 4 })
  y -= 4

  // ── The clauses ──────────────────────────────────────────────────────────
  for (const clause of AGREEMENT_CLAUSES) {
    heading(clause.title, clause.plain)
    for (const p of clause.paragraphs) paragraph(p, { gap: 4, indent: 10 })
  }

  // ── Signatures ───────────────────────────────────────────────────────────
  ensure(150)
  y -= 6
  page.drawText("Signatures", { x: MARGIN, y, size: 11, font: bold, color: NAVY })
  y -= LEAD
  paragraph("By signing below, each party confirms that it has read and understood this Agreement and that its signatory is authorised to sign.", { gap: 10 })

  const colW = textW / 2 - 10
  const blocks: Array<{ title: string; name: string; role: string; sig: PDFImage | null; date: string }> = [
    { title: "The Merchant", name: input.signedName ?? input.signatoryName ?? "", role: input.signatoryTitle ?? "Authorised signatory", sig: signature, date: input.signedDate ?? "" },
    { title: "For RentSouq", name: "", role: "FHI Global Property LLC / MCG Properties LLC", sig: null, date: "" },
  ]
  const top = y
  blocks.forEach((b, i) => {
    const x = MARGIN + i * (colW + 20)
    page.drawText(b.title, { x, y: top, size: 9, font: bold, color: INK })
    const lineY = top - 58
    if (b.sig) {
      const maxW = colW - 10
      const maxH = 44
      const scale = Math.min(maxW / b.sig.width, maxH / b.sig.height)
      page.drawImage(b.sig, { x: x + 4, y: lineY + 3, width: b.sig.width * scale, height: b.sig.height * scale })
    }
    page.drawLine({ start: { x, y: lineY }, end: { x: x + colW, y: lineY }, thickness: 0.8, color: INK })
    page.drawText("Signature", { x, y: lineY - 10, size: 6.5, font: bold, color: GREY })
    page.drawText(safe(b.name) || "Name: ____________________", { x, y: lineY - 24, size: 8.5, font, color: INK })
    page.drawText(safe(b.role), { x, y: lineY - 36, size: 7.5, font, color: GREY })
    page.drawText(`Date: ${safe(b.date) || "____________"}`, { x, y: lineY - 48, size: 7.5, font, color: GREY })
  })
  y = top - 120

  // Page numbers.
  pages.forEach((p, i) => {
    const label = `Page ${i + 1} of ${pages.length}`
    p.drawText(label, { x: W - MARGIN - font.widthOfTextAtSize(label, 7.5), y: MARGIN - 24, size: 7.5, font, color: GREY })
    p.drawText(safe(`${AGREEMENT_TITLE} - ${input.businessName}`), { x: MARGIN, y: MARGIN - 24, size: 7.5, font, color: GREY })
  })

  return doc.save()
}
