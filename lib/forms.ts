import "server-only"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { formCoverHref, type PublicForm } from "@/lib/forms-shared"

export type { PublicForm } from "@/lib/forms-shared"

/**
 * The public Forms page (/forms): the same catalogue admins manage under
 * Library → Documents, read with the service-role client because the
 * `documents` table's RLS only opens it to signed-in staff. Only the columns
 * the page shows leave the server — the S3 URL stays behind the download
 * route (app/api/forms/[id]), which is download-only: visitors save a copy,
 * they never open the fillable viewer the dashboard has.
 */

/** Newest first. Throws on a failed read so an outage is a 5xx the crawler
 *  retries, never an empty page cached as the real thing. `file_url` is read
 *  only to address the cover (a hash of it is the ?v=) and is not returned. */
export async function listPublicForms(): Promise<PublicForm[]> {
  const { data, error } = await createAdminSupabase()
    .from("documents")
    .select("id, title, category, file_name, file_size, mime_type, created_at, file_url")
    .order("created_at", { ascending: false })
  if (error) throw new Error(`forms: ${error.message}`)
  const rows = (data ?? []) as (Omit<PublicForm, "cover"> & { file_url: string })[]
  return rows.map(({ file_url, ...form }) => ({ ...form, cover: formCoverHref({ ...form, file_url }) }))
}
