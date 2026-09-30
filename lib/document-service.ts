import { createClient } from "@/lib/supabase/client"

/**
 * Document template library (admin Library → Documents). Reads and writes
 * run through the browser client, gated by the RLS policies in migration 069
 * (admin-staff only, both directions) — the same pattern lib/purchase-service.ts
 * uses. The file itself goes to S3 through app/api/upload/document first;
 * these functions only touch the catalog row.
 */

export type DocumentRow = {
  id: string
  title: string
  category: string | null
  file_url: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  uploaded_by: string | null
  created_at: string
  profiles: { fullname: string | null } | null
}

export async function listDocuments(): Promise<{ data: DocumentRow[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, category, file_url, file_name, file_size, mime_type, uploaded_by, created_at, profiles(fullname)")
    .order("created_at", { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as unknown as DocumentRow[], error: null }
}

export async function createDocument(input: {
  title: string
  category: string | null
  file_url: string
  file_name: string
  file_size: number
  mime_type: string
}): Promise<{ error: string | null }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from("documents").insert({ ...input, uploaded_by: user?.id ?? null })
  return { error: error?.message ?? null }
}

/**
 * Removes the catalog row only — the S3 object is left in place. Storage
 * cleanup is a lower priority than the catalog staying correct, and nothing
 * else references the object once its row is gone.
 */
export async function deleteDocument(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from("documents").delete().eq("id", id)
  return { error: error?.message ?? null }
}
