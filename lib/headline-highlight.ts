/**
 * The agent-site hero title with highlighted words (boss, 2026-11-09): the
 * agent types the whole title once and clicks the words to highlight. The
 * highlight is stored inside `hero.headline` as **double asterisks**
 * ("Looking for **dream homes?**"), so it can sit anywhere in the title.
 *
 * Sites saved before keep their old shape — a plain headline plus a separate
 * `headlineAccent` drawn after it — and every helper here reads both: the
 * accent is simply a highlighted part at the end. The builder converts a site
 * to the new shape the first time its title is edited.
 */

export type HeadlineSegment = { text: string; highlight: boolean }

const MARK = /\*\*([\s\S]+?)\*\*/g

/** The title as plain and highlighted runs, in order (line breaks kept inside the text). */
export function headlineSegments(headline: string, accent = ""): HeadlineSegment[] {
  const out: HeadlineSegment[] = []
  let last = 0
  for (const m of headline.matchAll(MARK)) {
    const at = m.index ?? 0
    if (at > last) out.push({ text: headline.slice(last, at), highlight: false })
    out.push({ text: m[1], highlight: true })
    last = at + m[0].length
  }
  if (last < headline.length) out.push({ text: headline.slice(last), highlight: false })
  const a = accent.trim()
  if (a) {
    if (out.length) out.push({ text: " ", highlight: false })
    out.push({ text: a, highlight: true })
  }
  return out.filter((s) => s.text !== "")
}

/** The title's text without any highlight markers. */
export const plainHeadline = (headline: string, accent = "") =>
  headlineSegments(headline, accent).map((s) => s.text).join("")

/** Line by line, word by word — for layouts that place each word (the share card). */
export function headlineWordLines(headline: string, accent = ""): { word: string; highlight: boolean }[][] {
  const lines: { word: string; highlight: boolean }[][] = [[]]
  for (const seg of headlineSegments(headline, accent)) {
    seg.text.split("\n").forEach((part, i) => {
      if (i > 0) lines.push([])
      for (const word of part.split(/\s+/).filter(Boolean)) lines[lines.length - 1].push({ word, highlight: seg.highlight })
    })
  }
  return lines.filter((l) => l.length > 0)
}

/**
 * The hero description in title case (boss, 2026-11-09): each word starts with
 * a capital; the rest of the word is left as typed, so "UAE" / "AED" stay
 * capitals. The page does the same with CSS `capitalize`; the share card
 * (Satori) uses this.
 */
export const capitalizeWords = (s: string) => s.replace(/(^|\s)(\p{Ll})/gu, (_, sp: string, ch: string) => sp + ch.toUpperCase())

// ─── Builder: plain text + which words are highlighted ──────────────────────

/** The title's words (whitespace kept between them) and which are highlighted. */
export function decodeHeadline(headline: string, accent = ""): { tokens: string[]; highlighted: Set<number> } {
  const tokens: string[] = []
  const highlighted = new Set<number>()
  for (const seg of headlineSegments(headline, accent)) {
    for (const tok of seg.text.split(/(\s+)/)) {
      if (tok === "") continue
      if (/^\s+$/.test(tok)) {
        // Whitespace across a segment boundary joins the previous whitespace token.
        if (tokens.length && /^\s+$/.test(tokens[tokens.length - 1])) tokens[tokens.length - 1] += tok
        else tokens.push(tok)
      } else {
        if (seg.highlight) highlighted.add(tokens.length)
        tokens.push(tok)
      }
    }
  }
  return { tokens, highlighted }
}

/** Plain text + highlighted token indexes → the stored headline (runs of highlighted words share one marker). */
export function encodeHeadline(tokens: string[], highlighted: Set<number>): string {
  return tokens
    .map((t, i) => (highlighted.has(i) && !/^\s+$/.test(t) ? `**${t.replace(/\*/g, "")}**` : t.replace(/\*\*/g, "")))
    .join("")
    .replace(/\*\*(\s+)\*\*/g, "$1")
}

/** Split typed text into tokens the same way decodeHeadline does. */
export const tokenizeHeadline = (text: string) => text.split(/(\s+)/).filter((t) => t !== "")
