/**
 * Client-safe half of the public Forms catalogue (/forms). The card is a
 * client component (pdf.js thumbnails), so anything it imports ships to the
 * browser; the service-role read stays in lib/forms.ts (`server-only`).
 */

export type PublicForm = {
  id: string
  title: string
  category: string | null
  file_name: string
  file_size: number | null
  mime_type: string | null
  created_at: string
}

/** The same-origin address of a form: inline for the thumbnail, `download` for the Save button. */
export const formFileHref = (id: string, download = false) => `/api/forms/${id}${download ? "?download=1" : ""}`
