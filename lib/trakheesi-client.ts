/**
 * Browser side of the Trakheesi permit: ask the server to read the DLD link
 * out of an uploaded QR image. Returns null when the image holds no link on
 * dubailand.gov.ae (the QR still shows publicly and can be scanned).
 */
export async function resolvePermitLink(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch("/api/admin/projects/permit-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { link?: string | null }
    return json.link ?? null
  } catch {
    return null
  }
}

/** "trakheesi.dubailand.gov.ae" for display, or null. */
export function permitHost(link: string | null | undefined): string | null {
  if (!link) return null
  try {
    return new URL(link).hostname
  } catch {
    return null
  }
}
