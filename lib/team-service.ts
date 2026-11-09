import { createClient } from "@/lib/supabase/client"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type Team = {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  parent_id: string | null
  team_type: string | null
  is_active: boolean
  /** The team's leader may edit its members' sales (migration 084; admin-only switch). */
  leader_can_edit_sales?: boolean
  /** The team's leader confirms its members' sales — a second check beside the admin's validation, either order. */
  leader_confirms_sales?: boolean
  created_at: string
  updated_at: string
}

export type TeamMembership = {
  id: string
  user_id: string
  team_id: string
  role_in_team: string | null
  joined_at: string
  left_at: string | null
  is_active: boolean
  transfer_reason: string | null
}

export type TeamMemberProfile = TeamMembership & {
  profiles: {
    id: string
    fullname: string | null
    fname: string | null
    lname: string | null
    profile_url: string | null
    role: string | null
    status: string | null
    metadata: Record<string, unknown> | null
  }
}

export type TeamFormData = {
  name: string
  slug: string
  description: string
  team_type: string
  parent_id: string | null
  is_active: boolean
}

export type MemberFormData = {
  user_id: string
  role_in_team: string
}

export type ProfileSearchResult = {
  id: string
  fullname: string | null
  fname: string | null
  lname: string | null
  profile_url: string | null
  role: string | null
}

// ─── Slug generator ────────────────────────────────────────────────────────────

export function generateTeamSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

// ─── Teams ─────────────────────────────────────────────────────────────────────

export async function fetchTeams(): Promise<{ data: Team[] | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .order("created_at", { ascending: true })

  if (error) return { data: null, error: error.message }
  return { data: data as Team[], error: null }
}

export async function createTeam(
  formData: TeamFormData,
): Promise<{ data: Team | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("teams")
    .insert({
      name:        formData.name.trim(),
      slug:        formData.slug.trim(),
      description: formData.description.trim() || null,
      team_type:   formData.team_type.trim() || null,
      parent_id:   formData.parent_id || null,
      is_active:   formData.is_active,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Team, error: null }
}

export async function updateTeam(
  id: string,
  formData: Partial<TeamFormData>,
): Promise<{ data: Team | null; error: string | null }> {
  const supabase = createClient()
  const payload: Record<string, unknown> = {}
  if (formData.name        !== undefined) payload.name        = formData.name.trim()
  if (formData.slug        !== undefined) payload.slug        = formData.slug.trim()
  if (formData.description !== undefined) payload.description = formData.description.trim() || null
  if (formData.team_type   !== undefined) payload.team_type   = formData.team_type.trim() || null
  if (formData.parent_id   !== undefined) payload.parent_id   = formData.parent_id || null
  if (formData.is_active   !== undefined) payload.is_active   = formData.is_active
  payload.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from("teams")
    .update(payload)
    .eq("id", id)
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Team, error: null }
}

export async function toggleTeamActive(
  team: Team,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("teams")
    .update({ is_active: !team.is_active, updated_at: new Date().toISOString() })
    .eq("id", team.id)

  return { error: error?.message ?? null }
}

/**
 * Turn a team's team-leader switches on or off. Admin staff only — a guard
 * trigger on teams (migration 084) refuses anyone else, because teams has no
 * row level security.
 */
export async function updateTeamLeaderSwitches(
  id: string,
  patch: { leader_can_edit_sales?: boolean; leader_confirms_sales?: boolean },
): Promise<{ data: Team | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("teams")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Team, error: null }
}

export async function deleteTeam(
  id: string,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("teams")
    .delete()
    .eq("id", id)

  return { error: error?.message ?? null }
}

export async function updateTeamLogoUrl(
  id: string,
  logoUrl: string,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("teams")
    .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq("id", id)

  return { error: error?.message ?? null }
}

// ─── Members ───────────────────────────────────────────────────────────────────

const MEMBER_SELECT =
  `id, user_id, team_id, role_in_team, joined_at, left_at, is_active, transfer_reason,
   profiles!inner(id, fullname, fname, lname, profile_url, role, status, metadata)`

// PostgREST's own row ceiling — a search this wide is not a search any more.
const MEMBER_SEARCH_CEILING = 1000

// Commas, brackets and quotes are .or() grammar and % / * are ilike wildcards:
// typing one in the search box must narrow the list, never break the request.
function sanitizeMemberSearch(raw: string): string {
  return raw.replace(/[,()"%*\\]/g, " ").replace(/\s+/g, " ").trim()
}

// The rows each half of a member search brings back: just enough to merge, sort
// and page the matches before the page itself is fetched in full.
type MemberSearchKey = {
  id: string
  joined_at: string
  role_in_team: string | null
  profiles: { fullname: string | null } | { fullname: string | null }[] | null
}

function memberSearchName(row: MemberSearchKey): string | null {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
  return profile?.fullname ?? null
}

// Mirrors how Postgres would have ordered the same rows — nulls last ascending,
// first descending, ties broken by id so paging never repeats or skips a member.
function compareMembers(
  a: MemberSearchKey,
  b: MemberSearchKey,
  field: "fullname" | "joined_at" | "role_in_team",
  ascending: boolean,
): number {
  const valueOf = (row: MemberSearchKey) =>
    field === "fullname"       ? memberSearchName(row)
    : field === "role_in_team" ? row.role_in_team
    : row.joined_at
  const av = valueOf(a)
  const bv = valueOf(b)

  if (av === null || bv === null) {
    if (av === bv) return a.id.localeCompare(b.id)
    return (av === null ? 1 : -1) * (ascending ? 1 : -1)
  }

  const cmp = field === "joined_at"
    ? (av < bv ? -1 : av > bv ? 1 : 0)
    : av.localeCompare(bv, "en", { sensitivity: "base" })
  return cmp !== 0 ? (ascending ? cmp : -cmp) : a.id.localeCompare(b.id)
}

// A member search spans two tables: the role typed on the membership row and
// the person's name on the joined profile. PostgREST's .or() only knows the
// columns of the row it runs on, so asking for both at once
// (`role_in_team.ilike.%x%,profiles.fullname.ilike.%x%`) is answered with
// "failed to parse logic tree" — which is what the Members box threw at every
// keystroke. So the search runs as two halves, one per table, merged, sorted
// and paged here. Each half asks only for the sort keys, so the payload follows
// the number of matches rather than the size of the team, and the full rows are
// fetched for the single page being shown.
async function fetchTeamMembersBySearch(params: {
  supabase:   ReturnType<typeof createClient>
  teamId:     string
  term:       string
  activeOnly: boolean
  sortField:  "fullname" | "joined_at" | "role_in_team"
  ascending:  boolean
  from:       number
  to:         number
}): Promise<{ data: TeamMemberProfile[] | null; total: number | null; error: string | null }> {
  const { supabase, teamId, term, activeOnly, sortField, ascending, from, to } = params
  const like = `%${term}%`

  const half = () => {
    let q = supabase
      .from("team_memberships")
      .select("id, joined_at, role_in_team, profiles!inner(fullname, fname, lname)")
      .eq("team_id", teamId)
    if (activeOnly) q = q.eq("is_active", true)
    return q
  }

  const [byRole, byName] = await Promise.all([
    half().ilike("role_in_team", like).limit(MEMBER_SEARCH_CEILING),
    half()
      .or(`fullname.ilike.${like},fname.ilike.${like},lname.ilike.${like}`, { referencedTable: "profiles" })
      .limit(MEMBER_SEARCH_CEILING),
  ])
  const failed = byRole.error ?? byName.error
  if (failed) return { data: null, total: null, error: failed.message }

  const matches = new Map<string, MemberSearchKey>()
  for (const row of [...(byRole.data ?? []), ...(byName.data ?? [])] as unknown as MemberSearchKey[]) {
    matches.set(row.id, row)
  }

  const ordered = [...matches.values()].sort((a, b) => compareMembers(a, b, sortField, ascending))
  const total   = ordered.length
  const pageIds = ordered.slice(from, to + 1).map(row => row.id)
  if (!pageIds.length) return { data: [], total, error: null }

  const { data, error } = await supabase
    .from("team_memberships")
    .select(MEMBER_SELECT)
    .in("id", pageIds)
  if (error) return { data: null, total: null, error: error.message }

  // `in` carries no order of its own — put the page back the way it was paged.
  const fetched = (data ?? []) as unknown as TeamMemberProfile[]
  const rows = new Map(fetched.map(row => [row.id, row]))
  return {
    data:  pageIds.map(id => rows.get(id)).filter(Boolean) as TeamMemberProfile[],
    total,
    error: null,
  }
}

export async function fetchTeamMembers(params: {
  teamId: string
  page?: number
  perPage?: number
  search?: string
  activeOnly?: boolean
  sortField?: "fullname" | "joined_at" | "role_in_team"
  sortDir?: "asc" | "desc"
}): Promise<{ data: TeamMemberProfile[] | null; total: number | null; error: string | null }> {
  const supabase   = createClient()
  const page       = params.page    ?? 1
  const perPage    = params.perPage ?? 10
  const from       = (page - 1) * perPage
  const to         = from + perPage - 1
  const activeOnly = params.activeOnly !== false
  const sortField  = params.sortField ?? "joined_at"
  const ascending  = params.sortDir === "asc"
  const term       = sanitizeMemberSearch(params.search ?? "")

  if (term) {
    return fetchTeamMembersBySearch({ supabase, teamId: params.teamId, term, activeOnly, sortField, ascending, from, to })
  }

  let query = supabase
    .from("team_memberships")
    .select(MEMBER_SELECT, { count: "exact" })
    .eq("team_id", params.teamId)

  if (activeOnly) {
    query = query.eq("is_active", true)
  }

  // Sort
  if (sortField === "fullname") {
    query = query.order("profiles(fullname)", { ascending })
  } else {
    query = query.order(sortField, { ascending })
  }

  query = query.range(from, to)

  const { data, count, error } = await query
  if (error) return { data: null, total: null, error: error.message }
  return {
    data:  (data ?? []) as unknown as TeamMemberProfile[],
    total: count ?? 0,
    error: null,
  }
}

export async function fetchTeamMemberCounts(): Promise<{
  data: Record<string, number> | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("team_memberships")
    .select("team_id")
    .eq("is_active", true)

  if (error) return { data: null, error: error.message }

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const id = (row as { team_id: string }).team_id
    counts[id] = (counts[id] ?? 0) + 1
  }
  return { data: counts, error: null }
}

export async function addTeamMember(
  teamId: string,
  memberData: MemberFormData,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("team_memberships")
    .insert({
      team_id:      teamId,
      user_id:      memberData.user_id,
      role_in_team: memberData.role_in_team.trim() || null,
      joined_at:    new Date().toISOString(),
    })

  return { error: error?.message ?? null }
}

export async function updateMemberRole(
  membershipId: string,
  roleInTeam: string,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("team_memberships")
    .update({ role_in_team: roleInTeam.trim() || null })
    .eq("id", membershipId)

  return { error: error?.message ?? null }
}

export async function deactivateMembership(
  membershipId: string,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("team_memberships")
    .update({ left_at: new Date().toISOString() })
    .eq("id", membershipId)

  return { error: error?.message ?? null }
}

export async function removeMembership(
  membershipId: string,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("team_memberships")
    .delete()
    .eq("id", membershipId)

  return { error: error?.message ?? null }
}

export async function transferMember(params: {
  membershipId: string
  userId: string
  fromTeamId: string
  toTeamId: string
  roleInTeam: string
}): Promise<{ error: string | null }> {
  const supabase = createClient()

  // Step 1 — close current membership (trigger handle_team_transfer will fire)
  const { error: closeErr } = await supabase
    .from("team_memberships")
    .update({
      left_at:          new Date().toISOString(),
      transfer_reason:  `Transferred to new team`,
    })
    .eq("id", params.membershipId)

  if (closeErr) return { error: closeErr.message }

  // Step 2 — create new membership (only if trigger hasn't done it already)
  const { error: insertErr } = await supabase
    .from("team_memberships")
    .insert({
      team_id:      params.toTeamId,
      user_id:      params.userId,
      role_in_team: params.roleInTeam || null,
      joined_at:    new Date().toISOString(),
    })

  return { error: insertErr?.message ?? null }
}

// ─── Profile search (for Add Member dialog) ────────────────────────────────────

export async function searchProfiles(
  query: string,
  limit = 20,
): Promise<{ data: ProfileSearchResult[]; error: string | null }> {
  const supabase = createClient()
  let q = supabase
    .from("profiles")
    .select("id, fullname, fname, lname, profile_url, role")
    .ilike("status", "active")
    .not("is_deleted", "is", true)
    .limit(limit)

  // Sanitized for the same reason as the member search: a comma or a bracket
  // typed into the box is .or() grammar, and PostgREST answers it with "failed
  // to parse logic tree" instead of a list of people.
  const typed = sanitizeMemberSearch(query)
  if (typed) {
    const term = `%${typed}%`
    q = q.or(`fullname.ilike.${term},fname.ilike.${term},lname.ilike.${term}`)
  }

  q = q.order("fullname", { ascending: true })

  const { data, error } = await q
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as ProfileSearchResult[], error: null }
}
