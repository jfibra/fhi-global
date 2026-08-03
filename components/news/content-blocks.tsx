import Image from "next/image"
import type { NewsContentBlock } from "@/lib/news-service"
import { sanitizeNewsHtml } from "@/lib/news-sanitize"

/**
 * Renders a HomesPH News `content_blocks` article body (Server Component).
 * Block types follow the integration guide; unknown types are skipped, and
 * legacy articles (empty blocks, body in a plain HTML `content` field) fall
 * back to a sanitized prose render. Every piece of upstream HTML passes
 * through sanitizeNewsHtml — the source is explicitly unsanitized.
 */

const PROSE_CLS =
  "prose prose-sm sm:prose max-w-none prose-headings:text-[#001428] prose-headings:font-black prose-a:text-[#d6b357] prose-a:no-underline hover:prose-a:underline prose-img:rounded"

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value)
}

function blockText(content: unknown): string {
  if (typeof content === "string") return content
  if (content && typeof content === "object") {
    const c = content as Record<string, unknown>
    if (typeof c.text === "string") return c.text
    if (typeof c.html === "string") return c.html
  }
  return ""
}

function blockImageSrc(block: NewsContentBlock): string | null {
  const c = (block.content ?? {}) as Record<string, unknown>
  const raw = (block as Record<string, unknown>).image
  for (const candidate of [c.src, c.image, raw]) {
    if (isHttpUrl(candidate)) return candidate
  }
  return null
}

function blockCaption(block: NewsContentBlock): string {
  const c = (block.content ?? {}) as Record<string, unknown>
  return typeof c.caption === "string" ? c.caption : ""
}

function blockImages(block: NewsContentBlock): string[] {
  const c = (block.content ?? {}) as Record<string, unknown>
  return Array.isArray(c.images) ? c.images.filter(isHttpUrl) : []
}

function Figure({ src, caption, alt, narrow }: { src: string; caption?: string; alt: string; narrow?: boolean }) {
  return (
    <figure className={`my-6 ${narrow ? "mx-auto max-w-xl" : ""}`}>
      <div className="relative aspect-video overflow-hidden bg-gray-100">
        <Image src={src} alt={alt} fill unoptimized sizes="(max-width: 1024px) 100vw, 66vw" className="object-cover" />
      </div>
      {caption && <figcaption className="mt-2 text-center text-xs text-gray-400">{caption}</figcaption>}
    </figure>
  )
}

function TextHtml({ html }: { html: string }) {
  const clean = sanitizeNewsHtml(html)
  if (!clean) return null
  return <div className={PROSE_CLS} dangerouslySetInnerHTML={{ __html: clean }} />
}

function renderBlock(block: NewsContentBlock, index: number, heroSrc?: string) {
  const key = block.id ?? index
  switch (block.type) {
    case "text":
    case "paragraph":
    case "heading": {
      const html = blockText(block.content)
      return html ? <TextHtml key={key} html={html} /> : null
    }

    case "image":
    case "centered-image": {
      const src = blockImageSrc(block)
      if (!src || src === heroSrc) return null // don't duplicate the hero
      return <Figure key={key} src={src} caption={blockCaption(block)} alt={blockCaption(block) || "Article image"} narrow={block.type === "centered-image"} />
    }

    case "left-image":
    case "right-image":
    case "split-left":
    case "split-right": {
      const src = blockImageSrc(block)
      const html = blockText(block.content)
      if (!src && !html) return null
      const imageFirst = block.type === "left-image" || block.type === "split-left"
      return (
        <div key={key} className="my-6 grid grid-cols-1 gap-4 md:grid-cols-2 md:items-center">
          {src && (
            <div className={`relative aspect-[4/3] overflow-hidden bg-gray-100 ${imageFirst ? "" : "md:order-2"}`}>
              <Image src={src} alt="Article image" fill unoptimized sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
            </div>
          )}
          {html && (
            <div className={imageFirst ? "" : "md:order-1"}>
              <TextHtml html={html} />
            </div>
          )}
        </div>
      )
    }

    case "grid":
    case "dynamic-images": {
      const images = blockImages(block)
      if (images.length === 0) return null
      const cols = images.length === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"
      return (
        <div key={key} className={`my-6 grid ${cols} gap-3`}>
          {images.map((src, i) => (
            <div key={`${key}-${i}`} className="relative aspect-square overflow-hidden bg-gray-100">
              <Image src={src} alt={`Article image ${i + 1}`} fill unoptimized sizes="(max-width: 640px) 50vw, 33vw" className="object-cover" />
            </div>
          ))}
        </div>
      )
    }

    default:
      // Unknown block types are not a stable contract — skip, never throw.
      return null
  }
}

export function ContentBlocks({
  blocks,
  heroSrc,
  legacyHtml,
}: {
  blocks: NewsContentBlock[]
  heroSrc?: string
  legacyHtml?: string
}) {
  if (blocks.length > 0) {
    const rendered = blocks.map((b, i) => renderBlock(b, i, heroSrc)).filter(Boolean)
    if (rendered.length > 0) return <>{rendered}</>
  }

  if (legacyHtml?.trim()) {
    return <TextHtml html={legacyHtml} />
  }

  return <p className="text-gray-400 italic text-sm">No content available.</p>
}
