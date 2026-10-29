import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { ROLES_ADMIN_STAFF, ROLES_SALES_PIPELINE, isAdminStaffRole } from "@/lib/app-roles"
import { A2A_DOC_TYPES, A2A_MAX_FILE_BYTES, type A2ADocType, type A2APartyKey } from "./shared"

export { A2A_DOCS_BUCKET } from "./shared"

// Server-only pieces for the A2A agreement routes (app/api/a2a-agreements).
// Every write runs on the service-role client, which bypasses RLS — so the
// ownership check and the path scoping here ARE the authorization.

/** Who may use saved agreements: the A2A page's audience (SUB_PATH_ROLES["a2a-agreement"]). */
export const A2A_ROLES = [...ROLES_SALES_PIPELINE, ...ROLES_ADMIN_STAFF]

export const A2A_S3_PREFIX = "fhi_global/a2a-agreements"

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** What the routes send back for an agreement — everything but `data`. */
export const AGREEMENT_META_COLUMNS = "id, created_by, status, party_names, submitted_at, created_at, updated_at"
export const FILE_COLUMNS = "id, agreement_id, party, doc_type, file_name, file_url, file_type, file_size, uploaded_at"

export type AgreementAccessRow = {
  id: string
  created_by: string
  status: "draft" | "submitted"
  party_names: string
}

/** The agreement plus what the caller may do with it, or null when it doesn't exist. */
export async function loadAgreementAccess(
  admin: SupabaseClient,
  id: string,
  userId: string,
  role: string | null,
): Promise<{ agreement: AgreementAccessRow; isOwner: boolean; isStaff: boolean } | null> {
  if (!UUID_RE.test(id)) return null
  const { data } = await admin
    .from("a2a_agreements")
    .select("id, created_by, status, party_names")
    .eq("id", id)
    .maybeSingle<AgreementAccessRow>()
  if (!data) return null
  return { agreement: data, isOwner: data.created_by === userId, isStaff: isAdminStaffRole(role) }
}

export type A2AFileExt = "pdf" | "jpg" | "png"

const EXT_BY_MIME: Record<string, A2AFileExt> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
}

export function extForMime(mime: string): A2AFileExt | null {
  return EXT_BY_MIME[mime] ?? null
}

/**
 * The transit path for one upload: `<agreementId>/<A|B|C|x>-<docType>-<uuid>.<ext>`
 * (x = the agreement-level signed copy). The server always chooses it, and the
 * register route reads party, document type and extension back from it — never
 * from the request body — so an upload can't land in another slot or agreement.
 */
export function a2aTransitPath(agreementId: string, party: A2APartyKey | null, docType: A2ADocType, ext: A2AFileExt): string {
  return `${agreementId}/${party ?? "x"}-${docType}-${crypto.randomUUID()}.${ext}`
}

const PATH_RE = new RegExp(
  `^([0-9a-f-]{36})/([ABCx])-(${A2A_DOC_TYPES.join("|")})-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\.(pdf|jpg|png)$`,
)

export function parseA2ATransitPath(
  path: string,
  agreementId: string,
): { party: A2APartyKey | null; docType: A2ADocType; ext: A2AFileExt } | null {
  const m = PATH_RE.exec(path)
  if (!m || m[1] !== agreementId) return null
  const party = m[2] === "x" ? null : (m[2] as A2APartyKey)
  const docType = m[3] as A2ADocType
  // The signed copy has no party; every other document has one.
  if ((docType === "signed_copy") !== (party === null)) return null
  return { party, docType, ext: m[5] as A2AFileExt }
}

/** Where a transit path ends up on S3 — also the row's unique file_url. */
export function a2aFileUrl(path: string): string {
  return `${process.env.S3_PUBLIC_URL}/${A2A_S3_PREFIX}/${path}`
}

/** True when the bytes are within the size limit and really are the declared type. */
export function isAcceptableA2AFile(bytes: Buffer, ext: A2AFileExt): boolean {
  if (bytes.length === 0 || bytes.length > A2A_MAX_FILE_BYTES) return false
  if (ext === "png") {
    return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  }
  if (ext === "jpg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  // PDFs may carry a little junk before the header; readers look in the first 1 KB.
  return bytes.subarray(0, 1024).includes("%PDF")
}
