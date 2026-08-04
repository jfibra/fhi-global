/** Split a single full-name string into first/middle/last (same rule the old
 *  PHP used). Used to seed profile names from a Google display name. */
export function parseName(fullName: string | null | undefined): {
  first: string
  middle: string
  last: string
} {
  const parts = String(fullName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return { first: "", middle: "", last: "" }
  if (parts.length === 1) return { first: parts[0], middle: "", last: "" }
  if (parts.length === 2) return { first: parts[0], middle: "", last: parts[1] }
  return { first: parts[0], middle: parts.slice(1, -1).join(" "), last: parts[parts.length - 1] }
}
