import { jsonLdScript } from "@/lib/seo"

/**
 * The one way to emit JSON-LD. Routes through jsonLdScript() so DB-driven
 * strings can never break out of the <script> tag with a literal "</script>"
 * (three call sites used to inline raw JSON.stringify and one shipped that
 * exact bug). Accepts a single node or an array — Google reads both.
 *
 * Emit at page level, never inside a Suspense boundary: streamed-in schema
 * arrives late (or never) for scrapers that don't execute the stream.
 */
export function JsonLd({ schema }: { schema: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(schema) }} />
}
