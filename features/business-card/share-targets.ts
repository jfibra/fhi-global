import { Facebook, Instagram, LinkedIn, WhatsApp, X } from "./social-icons"

/**
 * Where a visitor can send this profile from the share dialog.
 *
 * How much each network will pre-fill is NOT up to us, and it differs:
 *
 *   • WhatsApp and X take the message as a parameter and show it verbatim.
 *   • LinkedIn takes a title and summary, and also crawls the URL for a preview
 *     card. The legacy `shareArticle` form is used over `share-offsite` because
 *     only the former accepts that text — offsite passes the URL alone.
 *   • Facebook accepts ONLY `u`. It has ignored caption parameters since 2017,
 *     when pre-filling a user's message became a platform-policy violation, so
 *     the post body is built entirely from the crawled page's OG tags.
 *   • Instagram has no web share intent whatsoever — it treats links as a bio
 *     and story-sticker feature, not a post one.
 *
 * The last two therefore copy the link to the clipboard on the way out, so
 * pasting is one step. `copyFirst` marks them.
 *
 * All of this depends on the shared URL being publicly reachable: Facebook and
 * LinkedIn fetch it to build the preview, and a localhost or preview-deploy
 * origin gives them nothing. See profileUrl() in public-profile.tsx.
 */

export type ShareTarget = {
  id: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
  /** Built per-share so the URL and the message travel together. */
  href: (url: string, text: string) => string
  /**
   * Put the link on the clipboard before opening. Only for networks that accept
   * no link parameter, where pasting is the actual mechanism.
   */
  copyFirst?: boolean
}

export const SHARE_TARGETS: readonly ShareTarget[] = [
  {
    id: "whatsapp",
    label: "Share on WhatsApp",
    Icon: WhatsApp,
    // No number: wa.me with only `text` opens the contact picker, which is what
    // sharing means here — as opposed to the profile's own WhatsApp icon, which
    // dials the agent.
    href: (url, text) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    id: "facebook",
    label: "Copy the message and share on Facebook",
    Icon: Facebook,
    href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    // Facebook renders the link preview but never a caption — the clipboard is
    // the only way the message gets into the post.
    copyFirst: true,
  },
  {
    id: "instagram",
    label: "Copy the link and open Instagram",
    Icon: Instagram,
    href: () => "https://www.instagram.com/",
    copyFirst: true,
  },
  {
    id: "x",
    label: "Share on X",
    Icon: X,
    href: (url, text) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: "linkedin",
    label: "Share on LinkedIn",
    Icon: LinkedIn,
    href: (url, text) =>
      `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}` +
      `&title=${encodeURIComponent(text)}&summary=${encodeURIComponent(text)}`,
  },
]
