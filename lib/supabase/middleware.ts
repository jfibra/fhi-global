import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

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

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  // If a session cookie exists but the token can't be verified — e.g. a legacy
  // HS256 token left over after the project moved to ES256 JWT signing keys
  // ("unrecognized JWT kid <nil> for algorithm ES256") — clear it locally so the
  // browser stops resending the bad token and the user gets a clean re-login.
  if (error && !user && hasAuthCookie) {
    await supabase.auth.signOut({ scope: "local" }).catch(() => {})
  }

  return {
    supabase,
    response,
    user,
    missingEnv: false,
  }
}
