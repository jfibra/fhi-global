import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getDashboardRouteByRole } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function DeveloperDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, fullname, status, is_deleted")
    .eq("id", user.id)
    .single<{ id: string; role: string | null; fullname: string | null; status: string | null; is_deleted: boolean | null }>()

  if (!profile) {
    redirect("/")
  }

  const role = String(profile.role ?? "").toLowerCase().trim()

  // Only developer role can access this section
  if (role !== "developer") {
    redirect(getDashboardRouteByRole(role))
  }

  return <>{children}</>
}
