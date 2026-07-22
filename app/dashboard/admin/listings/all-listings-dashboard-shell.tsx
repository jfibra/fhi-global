"use client"

import { AllListingsClient } from "./all-listings-client"

export function AllListingsDashboardShell({}: {
  role: string
  userName: string
  userId: string
}) {
  // The dashboard shell (sidebar + header) is rendered once by
  // app/dashboard/layout.tsx — this page renders only its content.
  return <AllListingsClient />
}
