/**
 * Client-safe half of the public Forms catalogue (/forms). The shelf is a
 * client component (category tabs), so anything it imports ships to the
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
  /** Page 1 as an image (/forms/cover/<id>?v=…, lib/form-cover.ts), or null when the file is not a PDF. */
  cover: string | null
}

/** The same-origin address of a form: inline to open it in the browser, `download` for the Save button. */
export const formFileHref = (id: string, download = false) => `/api/forms/${id}${download ? "?download=1" : ""}`
