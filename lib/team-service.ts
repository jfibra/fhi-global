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

export async function fetchTeamMembers(params: {
  teamId: string
  page?: number
  perPage?: number
  search?: string
  activeOnly?: boolean
  sortField?: "fullname" | "joined_at" | "role_in_team"
  sortDir?: "asc" | "desc"
}): Promise<{ data: TeamMemberProfile[] | null; total: number | null; error: string | null }> {
  const supabase = createClient()
  const page      = params.page    ?? 1
  const perPage   = params.perPage ?? 10
  const from      = (page - 1) * perPage
  const to        = from + perPage - 1

  let query = supabase
    .from("team_memberships")
    .select(
      `id, user_id, team_id, role_in_team, joined_at, left_at, is_active, transfer_reason,
       profiles!inner(id, fullname, fname, lname, profile_url, role, status, metadata)`,
      { count: "exact" },
    )
    .eq("team_id", params.teamId)

  if (params.activeOnly !== false) {
    query = query.eq("is_active", true)
  }

  if (params.search) {
    const q = `%${params.search}%`
    query = query.or(
      `role_in_team.ilike.${q},profiles.fullname.ilike.${q}`,
    )
  }

  // Sort
  const sortField = params.sortField ?? "joined_at"
  const ascending = params.sortDir === "asc"
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

  if (query.trim()) {
    const term = `%${query.trim()}%`
    q = q.or(`fullname.ilike.${term},fname.ilike.${term},lname.ilike.${term}`)
  }

  q = q.order("fullname", { ascending: true })

  const { data, error } = await q
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as ProfileSearchResult[], error: null }
}
