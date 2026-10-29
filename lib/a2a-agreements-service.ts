// Saved A2A agreements (migration 082) — the page's data service.
//
// Reads run with the browser client under RLS: the creator sees their own
// agreements (drafts included), admin staff also see everyone's SUBMITTED
// ones. Writes are calls to the service-role routes in app/api/a2a-agreements,
// which validate, check ownership and log — the tables have no write policies.

import { createClient } from "@/lib/supabase/client"
import type { A2AInput } from "@/lib/a2a-agreement"
import {
  normalizeA2AInput,
  type A2ADocType,
  type A2APartyKey,
  type A2ARequiredField,
} from "@/lib/a2a-agreements/shared"

export type A2AAgreementStatus = "draft" | "submitted"

/** An agreement without its form data — what every write route returns. */
export type A2AAgreementMeta = {
  id: string
  created_by: string
  status: A2AAgreementStatus
  party_names: string
  submitted_at: string | null
  created_at: string
  updated_at: string
}

/** A list row: the meta, how many documents it carries and, on the admin list, who made it. */
export type A2AAgreementSummary = A2AAgreementMeta & {
  file_count: number
  creator_name: string | null
  creator_avatar: string | null
}

export type A2AAgreementFile = {
  id: string
  agreement_id: string
  party: A2APartyKey | null
  doc_type: A2ADocType
  file_name: string
  file_url: string
  file_type: string | null
  file_size: number | null
  uploaded_at: string
}

export type A2AWriteResult = {
  data: A2AAgreementMeta | null
  error: string | null
  /** 422 — the fields Submit still needs. */
  missing?: A2ARequiredField[]
  /** 409 — the status the agreement actually has now. */
  status?: A2AAgreementStatus
}

const META_COLUMNS = "id, created_by, status, party_names, submitted_at, created_at, updated_at"
const LIST_COLUMNS = `${META_COLUMNS}, files:a2a_agreement_files(count)`
const FILE_COLUMNS = "id, agreement_id, party, doc_type, file_name, file_url, file_type, file_size, uploaded_at"

type Creator = { fullname: string | null; profile_url: string | null }
type ListRow = A2AAgreementMeta & {
  files?: Array<{ count: number }> | null
  creator?: Creator | Creator[] | null
}

function toSummary(row: ListRow): A2AAgreementSummary {
  const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator
  return {
    id: row.id,
    created_by: row.created_by,
    status: row.status,
    party_names: row.party_names,
    submitted_at: row.submitted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    file_count: row.files?.[0]?.count ?? 0,
    creator_name: creator?.fullname ?? null,
    creator_avatar: creator?.profile_url ?? null,
  }
}

/**
 * The signed-in user's own agreements, newest first. Filtered by creator on
 * purpose: for admin staff RLS also returns every completed (status
 * 'submitted') agreement, which belongs on the "All agents' completed" list,
 * not under "My agreements".
 */
export async function fetchMyA2AAgreements(
  userId: string,
): Promise<{ data: A2AAgreementSummary[]; error: string | null }> {
  try {
    const { data, error } = await createClient()
      .from("a2a_agreements")
      .select(LIST_COLUMNS)
      .eq("created_by", userId)
      .order("updated_at", { ascending: false })
    if (error) return { data: [], error: error.message }
    return { data: ((data ?? []) as ListRow[]).map(toSummary), error: null }
  } catch {
    return { data: [], error: "Failed to load your agreements." }
  }
}

/** Admin staff: every completed (status 'submitted') agreement with its creator, newest first. */
export async function fetchSubmittedA2AAgreements(): Promise<{ data: A2AAgreementSummary[]; error: string | null }> {
  try {
    const { data, error } = await createClient()
      .from("a2a_agreements")
      .select(`${LIST_COLUMNS}, creator:created_by(fullname, profile_url)`)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false })
    if (error) return { data: [], error: error.message }
    return { data: ((data ?? []) as ListRow[]).map(toSummary), error: null }
  } catch {
    return { data: [], error: "Failed to load the completed agreements." }
  }
}

/** One agreement (form data normalized) and its documents. */
export async function fetchA2AAgreement(id: string): Promise<{
  data: { agreement: A2AAgreementMeta & { data: A2AInput }; files: A2AAgreementFile[] } | null
  error: string | null
}> {
  try {
    const supabase = createClient()
    const [agreementRes, filesRes] = await Promise.all([
      supabase.from("a2a_agreements").select(`${META_COLUMNS}, data`).eq("id", id).maybeSingle(),
      supabase.from("a2a_agreement_files").select(FILE_COLUMNS).eq("agreement_id", id).order("uploaded_at", { ascending: true }),
    ])
    if (agreementRes.error || filesRes.error) return { data: null, error: "Could not load the agreement." }
    const row = agreementRes.data as (A2AAgreementMeta & { data: unknown }) | null
    if (!row) return { data: null, error: "That agreement isn't available." }
    return {
      data: {
        agreement: { ...row, data: normalizeA2AInput(row.data) },
        files: (filesRes.data ?? []) as A2AAgreementFile[],
      },
      error: null,
    }
  } catch {
    return { data: null, error: "Could not load the agreement." }
  }
}

async function write(url: string, method: "POST" | "PATCH", body: unknown): Promise<A2AWriteResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = (await res.json().catch(() => ({}))) as {
      agreement?: A2AAgreementMeta
      error?: string
      missing?: A2ARequiredField[]
      status?: A2AAgreementStatus
    }
    if (!res.ok || !json.agreement) {
      return {
        data: null,
        error: json.error ?? "Could not save the agreement. Please try again.",
        missing: json.missing,
        status: json.status,
      }
    }
    return { data: json.agreement, error: null }
  } catch {
    return { data: null, error: "Could not reach the server — check your connection and try again." }
  }
}

/** First save of an agreement — a draft, or straight to Completed (Save & Download). */
export function createA2AAgreement(data: A2AInput, submit: boolean): Promise<A2AWriteResult> {
  return write("/api/a2a-agreements", "POST", { data, submit })
}

/** Replace a draft's form data. Never sends a status, so it can't un-submit anything. */
export function saveA2AAgreement(id: string, data: A2AInput): Promise<A2AWriteResult> {
  return write(`/api/a2a-agreements/${id}`, "PATCH", { action: "save", data })
}

/** Save & Download Agreement PDF on a saved draft: its final data, as Completed. */
export function submitA2AAgreement(id: string, data: A2AInput): Promise<A2AWriteResult> {
  return write(`/api/a2a-agreements/${id}`, "PATCH", { action: "submit", data })
}

/** "Edit again": a completed agreement back to a draft. */
export function withdrawA2AAgreement(id: string): Promise<A2AWriteResult> {
  return write(`/api/a2a-agreements/${id}`, "PATCH", { action: "withdraw" })
}

async function remove(url: string, fallback: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch(url, { method: "DELETE" })
    if (res.ok) return { error: null }
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    return { error: json.error ?? fallback }
  } catch {
    return { error: fallback }
  }
}

/** The creator's draft, or (admin staff) a completed agreement — with its files. */
export function deleteA2AAgreement(id: string): Promise<{ error: string | null }> {
  return remove(`/api/a2a-agreements/${id}`, "Could not delete the agreement.")
}

export function deleteA2ADocument(agreementId: string, fileId: string): Promise<{ error: string | null }> {
  return remove(`/api/a2a-agreements/${agreementId}/files/${fileId}`, "Could not remove the document.")
}

/** Every document of one party — Remove Party C on a draft. */
export function deleteA2APartyDocuments(agreementId: string, party: A2APartyKey): Promise<{ error: string | null }> {
  return remove(`/api/a2a-agreements/${agreementId}/files?party=${party}`, "Could not remove the documents.")
}
