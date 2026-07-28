import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/** The subset of the auth user the proxy actually uses. */
export type SessionUser = {
  id: string
  email: string | null
  user_metadata: Record<string, unknown>
}

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      supabase: null,
      response,
      user: null,
      missingEnv: true,
    }
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))

        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        })

        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"))

  // getClaims() over getUser(): with an asymmetric signing key (this project is
  // on ES256) it verifies the JWT locally against the JWKS, which auth-js caches
  // for 10 minutes — so a normal request makes NO network call to the auth
  // server. getUser() always did, costing a measured 0.15-0.8s on every matched
  // request including every <Link> prefetch. getSession() inside getClaims still
  // refreshes an expired token, so cookie refresh is unaffected.
  //
  // Trade-off: local verification trusts the token until it expires, so a
  // session revoked seconds ago stays valid until then (access tokens are
  // short-lived and configurable in Supabase). getUser() caught that instantly.
  //
  // If the project ever moves back to a symmetric (HS256) key, auth-js falls
  // back to a getUser() network check by itself — this stays correct either way.
  let user: SessionUser | null = null

  try {
    const { data } = await supabase.auth.getClaims()
    const claims = data?.claims
    if (claims?.sub) {
      user = {
        id: claims.sub,
        email: typeof claims.email === "string" ? claims.email : null,
        user_metadata: (claims.user_metadata ?? {}) as Record<string, unknown>,
      }
    }
  } catch {
    /* fall through: no verifiable claims means no user */
  }

  // If a session cookie exists but the token can't be verified — e.g. a legacy
  // HS256 token left over after the project moved to ES256 JWT signing keys
  // ("unrecognized JWT kid <nil> for algorithm ES256") — clear it locally so the
  // browser stops resending the bad token and the user gets a clean re-login.
  if (!user && hasAuthCookie) {
    await supabase.auth.signOut({ scope: "local" }).catch(() => {})
  }

  return {
    supabase,
    response,
    user,
    missingEnv: false,
  }
}
