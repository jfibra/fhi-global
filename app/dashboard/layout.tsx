import { DashboardAuthGate } from "@/components/dashboard/dashboard-auth-gate"

// No force-dynamic and no server-side session read here: proxy.ts already guards
// every /dashboard/* request (auth, inactive, role), so this layout stays static
// and the whole dashboard tree is prefetchable → instant client-side navigation.
// Session/profile is resolved in the browser by DashboardAuthGate, which renders
// the persistent shell (sidebar + header) once, around every page.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardAuthGate>{children}</DashboardAuthGate>
}
