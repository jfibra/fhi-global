import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { checkAuthorizeRequest, grantedScope, issueCode, mcpSignInAllowed } from "@/lib/oauth/server"

/**
 * The Allow / Cancel decision of the consent page (/oauth/authorize). The
 * signed-in person's cookie session says who they are; the request is
 * checked again here (client, redirect address, PKCE) — never trusted from
 * the page — and on Allow a one-time code is minted for that person. The
 * page then navigates to the address returned, so the CSP's form-action
 * rule is never involved.
 *
 * What the code may do is decided here: reading always, plus creating and
 * publishing events only when the page sent `events: true` (the ticked box)
 * AND the role manages events — never from the `scope` the app asked for.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Body = { decision?: unknown } & Record<string, unknown>

export async function POST(req: NextRequest) {
  // Same-origin only: the page's own fetch, never a form on another site.
  const site = req.headers.get("sec-fetch-site")
  if (site && site !== "same-origin") return NextResponse.json({ error: "Cross-site request refused." }, { status: 403 })
  const origin = req.headers.get("origin")
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.get("host")) return NextResponse.json({ error: "Cross-site request refused." }, { status: 403 })
    } catch {
      return NextResponse.json({ error: "Cross-site request refused." }, { status: 403 })
    }
  }

  const session = await requireActiveSession()
  if (!session.ok) return session.response
  const body = ((await req.json().catch(() => null)) ?? {}) as Body

  try {
    const check = await checkAuthorizeRequest(body)
    if (!check.ok) {
      if (check.fatal) return NextResponse.json({ error: check.message }, { status: 400 })
      return NextResponse.json({ redirect: check.redirect })
    }
    const { client, params } = check
    const back = new URL(params.redirect_uri)
    if (params.state) back.searchParams.set("state", params.state)

    const role = session.context.profile.role
    if (body.decision !== "allow" || !mcpSignInAllowed(role)) {
      back.searchParams.set("error", "access_denied")
      back.searchParams.set("error_description", body.decision !== "allow" ? "The person did not allow it." : "This account's role has no Claude tools.")
      return NextResponse.json({ redirect: back.toString() })
    }

    const code = await issueCode({
      clientId: client.client_id,
      userId: session.context.userId,
      redirectUri: params.redirect_uri,
      codeChallenge: params.code_challenge,
      resource: params.resource,
      scope: grantedScope(role, body.events === true),
    })
    back.searchParams.set("code", code)
    return NextResponse.json({ redirect: back.toString() }, { headers: { "cache-control": "no-store" } })
  } catch (e) {
    console.error("[oauth/authorize]", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "FHI could not finish the sign-in. Try again." }, { status: 500 })
  }
}
