// â”€â”€â”€ Shared types for user management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type UserRecord = {
  id: string
  email: string | null
  fname: string | null
  mname: string | null
  lname: string | null
  fullname: string | null
  birthday: string | null
  gender: string | null
  profile_url: string | null
  role: string | null
  status: string | null
  timezone: string | null
  metadata: Record<string, unknown> | null
  joined_at: string | null
  updated_at: string | null
  is_deleted: boolean | null
  deleted_at: string | null
}

export type UsersListResponse = {
  users: UserRecord[]
  total: number
  page: number
  perPage: number
}

export type CreateUserPayload = {
  email: string
  password: string
  fname: string
  mname?: string
  lname: string
  role: string
  developer_id?: string | null
  timezone: string
  status: string
}

export type UpdateUserPayload = {
  fname?: string
  mname?: string
  lname?: string
  birthday?: string | null
  gender?: string | null
  timezone?: string
  role?: string
  developer_id?: string | null
  status?: string
  phone_country_code?: string
  phone_number?: string
  whatsapp_country_code?: string
  whatsapp_number?: string
}

// â”€â”€â”€ Role configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type RoleKey =
  | "super_admin"
  | "admin"
  | "team_leader"
  | "unit_manager"
  | "agent"
  | "developer"
  | "secretary"
  | "team_secretary"
  | "member"

export const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "super_admin",    label: "Super Admin"    },
  { value: "admin",          label: "Admin"          },
  { value: "team_leader",    label: "Team Leader"    },
  { value: "unit_manager",   label: "Unit Manager"   },
  { value: "agent",          label: "Agent"          },
  { value: "developer",      label: "Developer"      },
  { value: "secretary",      label: "Secretary"      },
  { value: "team_secretary", label: "Team Secretary" },
  { value: "member",         label: "Member"         },
]

export const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "active",   label: "Active"   },
  { value: "inactive", label: "Inactive" },
  { value: "pending",  label: "Pending"  },
]

export const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  super_admin:    { bg: "bg-purple-50",  text: "text-purple-700",  border: "border-purple-200"  },
  admin:          { bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200"     },
  team_leader:    { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  unit_manager:   { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200"  },
  agent:          { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200"   },
  developer:      { bg: "bg-indigo-50",  text: "text-indigo-700",  border: "border-indigo-200"  },
  secretary:      { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200"    },
  team_secretary: { bg: "bg-teal-50",    text: "text-teal-700",    border: "border-teal-200"    },
  member:         { bg: "bg-slate-50",   text: "text-slate-600",   border: "border-slate-200"   },
}

export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  active:   { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200",  dot: "bg-green-500"  },
  inactive: { bg: "bg-gray-50",   text: "text-gray-600",   border: "border-gray-200",   dot: "bg-gray-400"   },
  pending:  { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  dot: "bg-amber-500"  },
  deleted:  { bg: "bg-rose-50",   text: "text-rose-700",   border: "border-rose-200",   dot: "bg-rose-500"   },
}

export const TIMEZONES = [
  { label: "UTC (UTC +00:00)",        value: "UTC"                },
  { label: "London (UTC +00:00)",     value: "Europe/London"      },
  { label: "Paris (UTC +01:00)",      value: "Europe/Paris"       },
  { label: "Cairo (UTC +02:00)",      value: "Africa/Cairo"       },
  { label: "Nairobi (UTC +03:00)",    value: "Africa/Nairobi"     },
  { label: "Dubai (UTC +04:00)",      value: "Asia/Dubai"         },
  { label: "Karachi (UTC +05:00)",    value: "Asia/Karachi"       },
  { label: "Colombo (UTC +05:30)",    value: "Asia/Colombo"       },
  { label: "Dhaka (UTC +06:00)",      value: "Asia/Dhaka"         },
  { label: "Bangkok (UTC +07:00)",    value: "Asia/Bangkok"       },
  { label: "Singapore (UTC +08:00)",  value: "Asia/Singapore"     },
  { label: "Manila (UTC +08:00)",     value: "Asia/Manila"        },
  { label: "Tokyo (UTC +09:00)",      value: "Asia/Tokyo"         },
  { label: "Sydney (UTC +10:00)",     value: "Australia/Sydney"   },
  { label: "New York (UTC -05:00)",   value: "America/New_York"   },
  { label: "Los Angeles (UTC -08:00)",value: "America/Los_Angeles"},
]

export const COUNTRY_CODES = [
  { label: "ðŸ‡¦ðŸ‡ª +971", value: "+971"   },
  { label: "ðŸ‡µðŸ‡­ +63",  value: "+63"    },
  { label: "ðŸ‡®ðŸ‡³ +91",  value: "+91"    },
  { label: "ðŸ‡µðŸ‡° +92",  value: "+92"    },
  { label: "ðŸ‡§ðŸ‡© +880", value: "+880"   },
  { label: "ðŸ‡±ðŸ‡° +94",  value: "+94"    },
  { label: "ðŸ‡¬ðŸ‡§ +44",  value: "+44"    },
  { label: "ðŸ‡ºðŸ‡¸ +1",   value: "+1"     },
  { label: "ðŸ‡¸ðŸ‡¬ +65",  value: "+65"    },
  { label: "ðŸ‡²ðŸ‡¾ +60",  value: "+60"    },
]

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function roleToLabel(role: string | null | undefined) {
  if (!role) return "Member"
  return role
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ")
}

export function getUserDisplayName(user: Pick<UserRecord, "fullname" | "fname" | "lname" | "email">) {
  return (
    user.fullname?.trim() ||
    [user.fname, user.lname].filter(Boolean).join(" ").trim() ||
    user.email ||
    "Unknown User"
  )
}
