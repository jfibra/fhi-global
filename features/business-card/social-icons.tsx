/**
 * Brand glyphs for the four platforms in lib/social-links.ts.
 *
 * Inline SVG rather than an icon package: these are trademarked marks with
 * fixed geometry, and lucide (the app's icon set) deliberately doesn't ship
 * brand logos.
 */

import type { SocialPlatform } from "@/lib/public-profile"

type IconProps = { className?: string }

function Facebook({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.08 5.66 21.25 10.44 22v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.91h-2.34V22C18.34 21.25 22 17.08 22 12.06z" />
    </svg>
  )
}

function Instagram({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.96.24 2.65.51.71.27 1.31.65 1.9 1.24.59.59.97 1.19 1.24 1.9.27.69.46 1.48.51 2.65.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.24 1.96-.51 2.65-.27.71-.65 1.31-1.24 1.9-.59.59-1.19.97-1.9 1.24-.69.27-1.48.46-2.65.51-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.96-.24-2.65-.51-.71-.27-1.31-.65-1.9-1.24-.59-.59-.97-1.19-1.24-1.9-.27-.69-.46-1.48-.51-2.65C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.24-1.96.51-2.65.27-.71.65-1.31 1.24-1.9.59-.59 1.19-.97 1.9-1.24.69-.27 1.48-.46 2.65-.51C8.42 2.17 8.8 2.16 12 2.16zm0 1.98c-3.15 0-3.5.01-4.73.07-.94.04-1.5.2-1.85.34-.47.18-.8.4-1.15.75-.35.35-.57.68-.75 1.15-.14.35-.3.91-.34 1.85-.06 1.23-.07 1.58-.07 4.73s.01 3.5.07 4.73c.4.94.2 1.5.34 1.85.18.47.4.8.75 1.15.35.35.68.57 1.15.75.35.14.91.3 1.85.34 1.23.06 1.58.07 4.73.07s3.5-.01 4.73-.07c.94-.04 1.5-.2 1.85-.34.47-.18.8-.4 1.15-.75.35-.35.57-.68.75-1.15.14-.35.3-.91.34-1.85.06-1.23.07-1.58.07-4.73s-.01-3.5-.07-4.73c-.04-.94-.2-1.5-.34-1.85a3.1 3.1 0 00-.75-1.15 3.1 3.1 0 00-1.15-.75c-.35-.14-.91-.3-1.85-.34-1.23-.06-1.58-.07-4.73-.07zm0 3.37a4.49 4.49 0 110 8.98 4.49 4.49 0 010-8.98zm0 7.4a2.91 2.91 0 100-5.82 2.91 2.91 0 000 5.82zm5.72-7.6a1.05 1.05 0 11-2.1 0 1.05 1.05 0 012.1 0z" />
    </svg>
  )
}

function LinkedIn({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4.98 3.5a2.5 2.5 0 11-.02 5 2.5 2.5 0 01.02-5zM3 8.98h4V21H3V8.98zM9.5 8.98h3.83v1.64h.05c.53-1 1.84-2.06 3.78-2.06 4.04 0 4.79 2.66 4.79 6.12V21h-4v-5.5c0-1.31-.02-3-1.83-3-1.83 0-2.11 1.43-2.11 2.9V21h-4V8.98z" />
    </svg>
  )
}

function TikTok({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.6 5.82A4.28 4.28 0 0015.54 3h-3.1v12.4a2.59 2.59 0 11-1.84-2.48V9.75a5.71 5.71 0 105.71 5.71V9.4a7.06 7.06 0 004.13 1.32V7.62a4.24 4.24 0 01-3.84-1.8z" />
    </svg>
  )
}



export const SOCIAL_ICONS: Record<SocialPlatform, React.ComponentType<IconProps>> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: LinkedIn,
  tiktok: TikTok,
}
