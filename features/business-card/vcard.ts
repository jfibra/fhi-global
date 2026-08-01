/**
 * vCard 3.0 for the public profile's "Save Card" button.
 *
 * 3.0 rather than 4.0 on purpose: it is what macOS Contacts, iOS and Android all
 * import cleanly, and 4.0's `PHOTO:data:` URI form is the one part Apple still
 * reads inconsistently — so the photo goes in as base64 the 3.0 way.
 *
 * The goal is the card in the reference screenshot: photo, job title above the
 * name, phone and email — i.e. a contact that looks finished the moment it lands
 * in the address book, not a bare name and number.
 */

export type VCardInput = {
  /** Already title-cased — the card should read the way the page does. */
  fullname: string
  title: string
  email: string
  /** E.164, e.g. +639101930243. */
  phoneE164: string
  /** Absolute URL of this profile page. */
  url: string
  tagline: string
  /** Same-origin (proxied) avatar URL, or null. */
  avatarUrl: string | null
}

const ORG = "FHI Global"

/**
 * Escape a vCard TEXT value: backslash, comma and semicolon are structural, and
 * a literal newline would end the property.
 */
function esc(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
}

/**
 * RFC 2426 line folding at 75 octets, continuation lines prefixed with a space.
 * Only really matters for the base64 photo, which is tens of thousands of
 * characters — some parsers reject a single line that long outright.
 */
function fold(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = [line.slice(0, 75)]
  for (let i = 75; i < line.length; i += 74) parts.push(" " + line.slice(i, i + 74))
  return parts.join("\r\n")
}

/**
 * "Mark Lawrince Sargado" → family "Sargado", given "Mark Lawrince".
 * Last token as the surname is the convention address books assume, and it is
 * what puts the name under S rather than under M.
 */
function splitName(fullname: string): { family: string; given: string } {
  const parts = fullname.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return { family: parts[0] ?? "", given: "" }
  return { family: parts[parts.length - 1], given: parts.slice(0, -1).join(" ") }
}

/**
 * Fetch the avatar and return it base64-encoded. Same-origin (it is proxied
 * through /api/image-proxy), so no CORS dance. Returns null on any failure —
 * a missing photo must never cost the user the rest of the card.
 */
async function loadPhoto(url: string): Promise<{ b64: string; type: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    // 8 MB of base64 in a .vcf is a contact no phone wants; skip the photo
    // rather than produce a file the address book chokes on.
    if (blob.size > 2 * 1024 * 1024) return null

    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error("read failed"))
      reader.readAsDataURL(blob)
    })
    const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1)
    if (!b64) return null

    // PNG/JPEG/GIF are the types vCard 3.0 names; anything else (webp, avif)
    // has no standard token, and Apple ignores the photo when it can't match
    // one — so those are dropped rather than mislabelled.
    const mime = blob.type.toLowerCase()
    const type = mime.includes("png") ? "PNG" : mime.includes("gif") ? "GIF"
      : mime.includes("jpeg") || mime.includes("jpg") ? "JPEG" : ""
    return type ? { b64, type } : null
  } catch {
    return null
  }
}

/** The .vcf text. Async only because of the photo fetch. */
export async function buildVCard(input: VCardInput): Promise<string> {
  const { family, given } = splitName(input.fullname)

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(family)};${esc(given)};;;`,
    `FN:${esc(input.fullname)}`,
    `ORG:${esc(ORG)}`,
  ]

  // Everything below is conditional — an empty TEL or EMAIL shows up in the
  // address book as a blank field the person then has to delete.
  if (input.title) lines.push(`TITLE:${esc(input.title)}`)
  if (input.phoneE164) lines.push(`TEL;TYPE=CELL,VOICE:${esc(input.phoneE164)}`)
  if (input.email) lines.push(`EMAIL;TYPE=INTERNET,PREF:${esc(input.email)}`)
  if (input.url) lines.push(`URL:${esc(input.url)}`)
  if (input.tagline) lines.push(`NOTE:${esc(input.tagline)}`)

  if (input.avatarUrl) {
    const photo = await loadPhoto(input.avatarUrl)
    if (photo) lines.push(`PHOTO;ENCODING=b;TYPE=${photo.type}:${photo.b64}`)
  }

  lines.push("END:VCARD")
  // CRLF is what the spec requires and what Windows/Outlook need to parse it.
  return lines.map(fold).join("\r\n") + "\r\n"
}

/** Trigger the download. `fullname` only names the file. */
export function downloadVCard(vcard: string, fullname: string) {
  const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" })
  const href = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = href
  a.download = `${fullname.replace(/\s+/g, "-") || "contact"}.vcf`
  a.click()
  // Revoked on the next tick — Safari cancels the download if the URL dies
  // while the click is still being handled.
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}
