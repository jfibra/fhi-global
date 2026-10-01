import { NextRequest } from "next/server"
import { handlePeriodicReport } from "@/lib/periodic-report-route"

/** The weekly boss report — see lib/periodic-report-route.ts; scheduled in vercel.json. */
export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  return handlePeriodicReport(req, "weekly")
}
