import "server-only"

import QRCode from "qrcode"

/**
 * The merchant's QR as a PNG: navy modules on white, quiet zone of four, big
 * enough to print on a roll-up banner. Everything else (the flyer) embeds it.
 */
export async function merchantQrPng(url: string, width = 1024): Promise<Buffer> {
  return QRCode.toBuffer(url, { type: "png", width, margin: 4, errorCorrectionLevel: "M", color: { dark: "#001f3fff", light: "#ffffffff" } })
}
