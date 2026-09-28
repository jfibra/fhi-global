import { redirectOldLink } from "@/lib/buyer-link-page"

// The old Buyers Link address (/b/<code>, before migration 063). Links already
// shared and QR codes already printed keep working: a permanent (308) redirect
// to the readable /buy-with/<name> page, minting that address if needed.

export const dynamic = "force-dynamic"

export default async function OldBuyerLink({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { code } = await params
  return redirectOldLink(code, "buyer", await searchParams)
}
