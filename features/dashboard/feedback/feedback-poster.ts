// Builds the printable "scan to review" poster for an agent's feedback link.
//
// Drawn on a canvas rather than assembled from DOM so the download is a single
// flat PNG an agent can print, AirDrop, or drop into a chat — no fonts to
// embed, no layout to reflow. A4 proportions at 1080px wide prints crisply at
// A5/A4 and still reads on a phone screen.
//
// Everything it loads (the logo, the QR data URL) is same-origin, so the
// canvas is never tainted and toDataURL always succeeds.

const W = 1080
const H = 1528
const NAVY = "#001f3f"
const GOLD = "#d6b357"

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Could not load ${src}`))
    img.src = src
  })
}

/** Centre `text` at `y`, shrinking the font until it fits within `maxWidth`. */
function centeredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  opts: { size: number; weight?: string; color: string; maxWidth?: number; spacing?: string },
) {
  const maxWidth = opts.maxWidth ?? W - 140
  let size = opts.size
  const font = (s: number) => `${opts.weight ?? "bold"} ${s}px Outfit, "Segoe UI", Helvetica, Arial, sans-serif`
  ctx.font = font(size)
  // letterSpacing is Chromium-only; harmless where unsupported.
  ctx.letterSpacing = opts.spacing ?? "0px"
  while (ctx.measureText(text).width > maxWidth && size > 12) {
    size -= 2
    ctx.font = font(size)
  }
  ctx.fillStyle = opts.color
  ctx.textAlign = "center"
  ctx.fillText(text, W / 2, y)
  ctx.letterSpacing = "0px"
}

export async function buildFeedbackPoster(input: {
  qrDataUrl: string
  agentName: string
  /** Shown at the foot of the poster, e.g. "fhiglobal.ae". */
  siteLabel: string
}): Promise<string> {
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas is unavailable in this browser.")

  // Web fonts may still be loading on a cold page; without this the poster
  // silently falls back to a system font.
  try {
    await document.fonts.ready
  } catch {
    // Font loading API missing — fallbacks in the font stack cover it.
  }

  // Background + gold rules top and bottom.
  ctx.fillStyle = NAVY
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = GOLD
  ctx.fillRect(0, 0, W, 14)
  ctx.fillRect(0, H - 14, W, 14)

  // Logo.
  try {
    const logo = await loadImage("/FHI_Branding_White.png")
    const logoW = 400
    const logoH = (logo.height / logo.width) * logoW
    ctx.drawImage(logo, (W - logoW) / 2, 70, logoW, logoH)
  } catch {
    centeredText(ctx, "FHI GLOBAL PROPERTY", 160, { size: 44, color: "#ffffff", spacing: "2px" })
  }

  centeredText(ctx, "CUSTOMER FEEDBACK", 300, { size: 24, color: GOLD, spacing: "6px" })
  centeredText(ctx, "How did I do?", 388, { size: 76, color: "#ffffff" })
  centeredText(ctx, "Scan the code to leave a quick review", 442, {
    size: 28,
    weight: "normal",
    color: "rgba(255,255,255,0.72)",
  })

  // QR on a white card — squared, matching the rest of the brand.
  const cardSize = 700
  const cardX = (W - cardSize) / 2
  const cardY = 500
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(cardX, cardY, cardSize, cardSize)

  const qr = await loadImage(input.qrDataUrl)
  const qrSize = 600
  ctx.drawImage(qr, (W - qrSize) / 2, cardY + (cardSize - qrSize) / 2, qrSize, qrSize)

  centeredText(ctx, "POINT YOUR PHONE CAMERA AT THE CODE", 1275, {
    size: 22,
    color: "rgba(255,255,255,0.6)",
    spacing: "3px",
  })

  // Gold divider, then who the review is for.
  ctx.fillStyle = GOLD
  ctx.fillRect((W - 120) / 2, 1320, 120, 4)

  centeredText(ctx, "YOUR ADVISOR", 1378, { size: 20, color: GOLD, spacing: "5px" })
  centeredText(ctx, input.agentName, 1436, { size: 44, color: "#ffffff" })
  centeredText(ctx, input.siteLabel, 1486, {
    size: 24,
    weight: "normal",
    color: "rgba(255,255,255,0.45)",
    spacing: "2px",
  })

  return canvas.toDataURL("image/png")
}
