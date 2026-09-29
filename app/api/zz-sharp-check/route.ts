import { NextResponse } from "next/server"

// TEMPORARY diagnostic (2026-09-29): why does `import "sharp"` fail on Vercel?
// Reports the load error and the runtime; no data, no auth needed. Remove
// right after reading it.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  let sharp: { ok: boolean; message?: string; versions?: unknown } = { ok: false }
  try {
    const mod = await import("sharp")
    sharp = { ok: true, versions: mod.default.versions }
  } catch (e) {
    sharp = { ok: false, message: (e as Error).message?.slice(0, 1200) }
  }
  return NextResponse.json({ node: process.version, platform: process.platform, arch: process.arch, sharp })
}
