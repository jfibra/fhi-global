import { STATUS_COLORS } from "@/lib/user-service"

export function StatusBadge({
  status,
  isDeleted,
}: {
  status: string | null | undefined
  isDeleted?: boolean | null
}) {
  const key = isDeleted ? "deleted" : (status ?? "inactive")
  const label = isDeleted ? "Deleted" : (status ? status.charAt(0).toUpperCase() + status.slice(1) : "Inactive")
  const colors = STATUS_COLORS[key] ?? STATUS_COLORS.inactive

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {label}
    </span>
  )
}
