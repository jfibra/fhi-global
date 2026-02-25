import { ROLE_COLORS, roleToLabel } from "@/lib/user-service"

export function RoleBadge({ role }: { role: string | null | undefined }) {
  const label = roleToLabel(role)
  const colors = ROLE_COLORS[role ?? ""] ?? ROLE_COLORS.member

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {label}
    </span>
  )
}
