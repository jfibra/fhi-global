import { redirectOldLink } from "@/lib/buyer-link-page"

// The old Sellers Link address (/s/<code>, before migration 063). Links
// already shared and QR codes already printed keep working: a permanent (308)
// redirect to the readable /sell-with/<name> page, minting that address if
// needed.

export const dynamic = "force-dynamic"

export default async function OldSellerLink({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { code } = await params
  return redirectOldLink(code, "seller", await searchParams)
}
