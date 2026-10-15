/**
 * Client-safe half of the public Forms catalogue (/forms). The shelf is a
 * client component (category tabs), so anything it imports ships to the
 * browser; the service-role read stays in lib/forms.ts (`server-only`).
 */

import { ogVersion } from "@/lib/og-url"

export type PublicForm = {
  id: string
  title: string
  category: string | null
  file_name: string
  file_size: number | null
  mime_type: string | null
  created_at: string
  /** Page 1 as an image (/forms/cover/<id>?v=…, lib/form-cover.ts), or null when the file is not a PDF. */
  cover: string | null
}

/** The same-origin address of a form: inline to open it in the browser, `download` for the Save button. */
export const formFileHref = (id: string, download = false) => `/api/forms/${id}${download ? "?download=1" : ""}`

/** Bump to re-render every cover under a new URL (size, quality or renderer change in lib/form-cover.ts). */
export const FORM_COVER_REV = "1"

export const isPdfFileName = (fileName: string) => /\.pdf$/i.test(fileName)

/** A cover's ?v= — changes with the file and with FORM_COVER_REV, so the cover's URL can be cached for a year. */
export const formCoverVersion = (fileUrl: string) => ogVersion(FORM_COVER_REV, fileUrl)

/**
 * Same-origin address of a document's cover — page 1 as an image, rendered
 * and cached on the server (/forms/cover/<id>, lib/form-cover.ts) — or null
 * when the file is not a PDF. Built here rather than on the server because
 * the dashboard's Documents shelf reads its rows in the browser; /forms gets
 * the same URL from lib/forms.ts.
 */
export function formCoverHref(doc: { id: string; file_url: string; file_name: string }): string | null {
  return isPdfFileName(doc.file_name) ? `/forms/cover/${doc.id}?v=${formCoverVersion(doc.file_url)}` : null
}
