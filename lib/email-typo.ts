// Guards against common email-domain typos (e.g. gmail.con → gmail.com) at the
// points where an email is TYPED and an account gets created — OTP register, the
// "continue with email" login, and admin create. Google sign-in is unaffected
// (its email comes verified from Google, never typed). Deliberately conservative:
// only flags a domain that's a SINGLE edit away from a well-known provider, so
// legitimate domains are never blocked.

// Real consumer domains — a typed value matching one of these is left alone, and
// they also short-circuit false positives for domains that sit one edit from
// another known domain (e.g. ymail.com vs gmail.com).
const KNOWN_DOMAINS = new Set<string>([
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.co.uk", "ymail.com", "rocketmail.com",
  "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com",
  "aol.com", "mail.com", "email.com", "gmx.com",
  "proton.me", "protonmail.com", "zoho.com", "yandex.com",
  "fastmail.com", "hey.com", "pm.me",
])

// Optimal string alignment (Damerau-Levenshtein restricted to adjacent
// transpositions) — so gmial.com→gmail.com counts as a single edit.
function osaDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1)
      }
    }
  }
  return dp[m][n]
}

/**
 * Returns a corrected email suggestion when the domain looks like a single-typo
 * misspelling of a well-known provider (e.g. "a@gmail.con" → "a@gmail.com"), or
 * null when the address looks fine. The local part is preserved.
 */
export function suggestEmailFix(email: string): string | null {
  const clean = email.trim().toLowerCase()
  const at = clean.lastIndexOf("@")
  if (at <= 0) return null
  const local = clean.slice(0, at)
  const domain = clean.slice(at + 1)
  if (!domain || KNOWN_DOMAINS.has(domain)) return null

  let best: string | null = null
  let bestDist = Number.POSITIVE_INFINITY
  for (const known of KNOWN_DOMAINS) {
    const dist = osaDistance(domain, known)
    if (dist < bestDist) {
      bestDist = dist
      best = known
    }
  }
  // Only a clear single-typo miss is flagged.
  return best && bestDist === 1 ? `${local}@${best}` : null
}

/** Convenience: the standard user-facing message for a detected typo. */
export function emailTypoMessage(email: string): string | null {
  const fix = suggestEmailFix(email)
  return fix ? `Did you mean ${fix}? Please check your email address.` : null
}
