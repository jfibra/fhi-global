type DevelopersPlaceholderProps = {
  roleName: string
}

export function DevelopersPlaceholder({ roleName }: DevelopersPlaceholderProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <p className="text-2xl font-semibold text-slate-900 mb-2">Developers area coming soon</p>
        <p className="text-sm text-slate-500">We are still shaping the dashboard for {roleName}.</p>
      </div>
    </div>
  )
}
