import { OAuth2Client } from "google-auth-library"

// Verifies a Google Identity Services credential (ID-token JWT) server-side:
// checks the signature, expiry, and that the audience is our client ID. Used by
// /api/lr/lookup so the LR lookup is tied to a real Google credential for that
// same email (no open LR-scraping endpoint).

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

let client: OAuth2Client | null = null
function getClient() {
  if (!client) client = new OAuth2Client(CLIENT_ID)
  return client
}

export type GoogleIdentity = {
  email: string
  emailVerified: boolean
  name: string | null
  picture: string | null
  givenName: string | null
  familyName: string | null
}

export async function verifyGoogleCredential(credential: string): Promise<GoogleIdentity | null> {
  if (!CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured")
  }
  try {
    const ticket = await getClient().verifyIdToken({ idToken: credential, audience: CLIENT_ID })
    const payload = ticket.getPayload()
    if (!payload?.email) return null
    return {
      email: payload.email.toLowerCase(),
      emailVerified: payload.email_verified === true,
      name: payload.name ?? null,
      picture: payload.picture ?? null,
      givenName: payload.given_name ?? null,
      familyName: payload.family_name ?? null,
    }
  } catch {
    return null
  }
}
