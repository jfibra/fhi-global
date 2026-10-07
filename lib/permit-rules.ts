/**
 * Dubai advertising-permit (Trakheesi) rules shared by the admin screens.
 *
 * Pure and dependency-free — safe in the browser. The Dubai Land Department publishes no format for the
 * number that we can cite, so this checks only for the SHAPE of a real one (a run of digits, optionally
 * spaced or slashed) and rejects the obvious non-numbers. It is a hint to the editor, never a block: 303
 * live projects have no permit number today and a wrong guess here must not stop a save.
 */

/** Projects in Dubai need a DLD Trakheesi permit to be advertised; elsewhere another regulator applies. */
export function isDubaiCity(city: string | null | undefined): boolean {
  return /dubai/i.test(city ?? "")
}

/** 5–32 characters of letters, digits, slash, space and hyphen, starting and ending on a letter or digit. */
export const PERMIT_NUMBER_RE = /^[A-Za-z0-9][A-Za-z0-9/ -]{3,30}[A-Za-z0-9]$/

const clean = (value: unknown): string => (typeof value === "string" ? value.trim() : "")

/** "123456789", "98765432": a straight run up or down is a typed-in placeholder. */
function isStraightRun(digits: string): boolean {
  let up = true
  let down = true
  for (let i = 1; i < digits.length; i++) {
    const step = (Number(digits[i]) - Number(digits[i - 1]) + 10) % 10
    if (step !== 1) up = false
    if (step !== 9) down = false
  }
  return up || down
}

export function isPlausiblePermitNumber(value: unknown): boolean {
  return permitNumberProblem(value) === null && clean(value) !== ""
}

/**
 * Why a permit number looks wrong, or null when it looks right (or is empty — an empty field is "not entered
 * yet", reported by the Data Health check, not a problem with the entry).
 */
export function permitNumberProblem(value: unknown): string | null {
  const v = clean(value)
  if (!v) return null
  const digits = v.replace(/\D/g, "")
  if (!PERMIT_NUMBER_RE.test(v) || digits.length < 4) {
    return "That does not look like a permit number — copy it exactly as it is printed on the permit."
  }
  if (/^(\d)\1+$/.test(digits) || isStraightRun(digits)) {
    return "That looks like a placeholder, not a real permit number."
  }
  return null
}
