import "server-only"

import sanitizeHtml from "sanitize-html"

/**
 * XSS gate for article HTML from the HomesPH News API. The upstream stores
 * rich-text blocks as raw, UNSANITIZED HTML (the integration guide calls this
 * out explicitly), so everything must pass through here before
 * dangerouslySetInnerHTML. Server-only: sanitize-html is a heavy CJS dep that
 * must never reach a client bundle — callers must be Server Components.
 */
export function sanitizeNewsHtml(html: string): string {
  if (!html) return ""
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "hr", "a", "strong", "em", "b", "i", "u", "s",
      "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "span",
      "figure", "figcaption", "img",
      "table", "thead", "tbody", "tr", "th", "td",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    // Force safe link behavior regardless of what the editor authored.
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
  })
}
