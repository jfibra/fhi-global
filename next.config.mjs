/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === "production"

// ── External origins used by the app ────────────────────────────────────────
// Supabase projects (storage + API + realtime). The env-configured project is
// allowed alongside the legacy project, which still hosts uploaded media
// (hero background, logos, default OG image) referenced by hardcoded URLs.
const SUPABASE_LEGACY_HOST = "hefwmaoborpfuyhbguzv.supabase.co"
const SUPABASE_ENV_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  : SUPABASE_LEGACY_HOST
const SUPABASE_HOSTS = [...new Set([SUPABASE_ENV_HOST, SUPABASE_LEGACY_HOST])]
const SUPABASE_HTTPS = SUPABASE_HOSTS.map((h) => `https://${h}`).join(" ")
const SUPABASE_CONNECT = SUPABASE_HOSTS.map((h) => `https://${h} wss://${h}`).join(" ")
// Vercel Analytics
const VERCEL_SCRIPTS = "va.vercel-scripts.com"
const VERCEL_VITALS  = "vitals.vercel-insights.com"
// Cloudflare Web Analytics (beacon injected by the Cloudflare proxy in front of the site)
const CF_INSIGHTS_SCRIPT = "static.cloudflareinsights.com"
const CF_INSIGHTS_API    = "cloudflareinsights.com"
// Flag images (hero section)
const FLAGCDN        = "flagcdn.com"
// Google Maps JavaScript API (buy page map)
const MAPS_API       = "maps.googleapis.com"
const MAPS_GSTATIC   = "maps.gstatic.com"
// Ebook PDFs, framed by the dashboard reader (keep in sync with EBOOK_FRAME_HOSTS in lib/ebooks.ts)
const EBOOK_PDF_HOST = "https://leuteriorealty.com"
// S3 bucket holding uploaded files. Framed by the sale-attachments viewer so a
// PDF previews in the browser's native reader instead of forcing a download.
// The exact host is derived from S3_PUBLIC_URL rather than wildcarding
// *.amazonaws.com — this directive should reach one bucket, not all of AWS.
const S3_FRAME_HOST = process.env.S3_PUBLIC_URL
  ? `https://${new URL(process.env.S3_PUBLIC_URL).host}`
  : ""

// ── Content-Security-Policy ──────────────────────────────────────────────────
// next/font/google self-hosts fonts at build-time → no fonts.googleapis.com needed.
// Next.js App Router requires 'unsafe-inline' for its runtime chunk hydration scripts
// and 'unsafe-eval' for dev-mode source maps (remove in strict-prod if desired).
const CSP = [
  // Fallback for anything not matched below
  `default-src 'self'`,

  // JS: own scripts + Next.js inline chunks + Vercel Analytics + Google Maps
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://${MAPS_API} https://${MAPS_GSTATIC} ${VERCEL_SCRIPTS} https://${CF_INSIGHTS_SCRIPT}`,

  // CSS: Tailwind / Next.js injects inline styles
  `style-src 'self' 'unsafe-inline'`,

  // Images: own assets, data URIs, blob previews, Supabase, flag CDN, maps, Google avatars, S3/CloudFront (listing + project media)
  `img-src 'self' data: blob: ${SUPABASE_HTTPS} https://${FLAGCDN} https://${MAPS_API} https://${MAPS_GSTATIC} https://*.google.com https://*.googleapis.com https://*.gstatic.com https://*.ggpht.com https://*.googleusercontent.com https://*.amazonaws.com https://*.cloudfront.net`,

  // Fonts: self-hosted via next/font – no external font CDN required
  `font-src 'self' data:`,

  // XHR / fetch: Supabase REST + Auth + Realtime, Vercel Analytics, Google Maps
  `connect-src 'self' ${SUPABASE_CONNECT} https://${VERCEL_VITALS} https://${VERCEL_SCRIPTS} https://${MAPS_API} https://${MAPS_GSTATIC} https://*.googleapis.com https://${CF_INSIGHTS_API}`,

  // Camera / microphone captured media (face-verify & ID-capture steps)
  `media-src 'self' blob:`,

  // Web workers (Next.js may spawn them in dev)
  `worker-src 'self' blob:`,

  // No plugins / Flash / PDFs embedded via <object>/<embed>
  `object-src 'none'`,

  // Only the ebook host and the uploads bucket may be framed — the dashboard
  // reader embeds ebook PDFs (see lib/ebooks.ts) and the sale-attachments
  // viewer embeds uploaded ones, both in the browser's native viewer. Google
  // sign-in uses a full-page redirect, not a frame, so nothing else needs it.
  `frame-src ${EBOOK_PDF_HOST}${S3_FRAME_HOST ? ` ${S3_FRAME_HOST}` : ""} https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://www.facebook.com https://www.instagram.com https://www.tiktok.com`,
  // Prevent this app from being embedded in iframes elsewhere
  `frame-ancestors 'none'`,

  // Restrict <form> submissions to same origin
  `form-action 'self'`,

  // Lock <base> tag (prevents base-tag injection attacks)
  `base-uri 'self'`,

  // In dev over http://localhost, this upgrades RSC fetches to https:// and breaks navigation
  // ("TypeError: Failed to fetch"). Keep only for production behind HTTPS.
  ...(isProd ? [`upgrade-insecure-requests`] : []),
]
  .join("; ")

// ── Security headers applied to every route ──────────────────────────────────
const SECURITY_HEADERS = [
  // HSTS is for HTTPS production only; sending it during local HTTP dev can confuse browsers.
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),

  // === Content sniffing ===
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },

  // === Clickjacking (belt-and-suspenders with CSP frame-ancestors) ===
  {
    key: "X-Frame-Options",
    value: "DENY",
  },

  // === Cross-site scripting (legacy browsers) ===
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },

  // === Referrer policy ===
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },

  // === Permissions / feature policy ===
  {
    key: "Permissions-Policy",
    // Allow camera only (needed for ID / selfie capture). Deny everything else.
    value: [
      "camera=(self)",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "interest-cohort=()",   // disables FLoC
    ].join(", "),
  },

  // === Content Security Policy ===
  {
    key: "Content-Security-Policy",
    value: CSP,
  },

  // === Cross-Origin policies ===
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
  {
    key: "X-Robots-Tag",
    value: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
  },
]

const PRIVATE_NOINDEX_HEADERS = SECURITY_HEADERS.map((header) => {
  if (header.key === "X-Robots-Tag") {
    return { ...header, value: "noindex, nofollow, noarchive, nosnippet" }
  }
  return header
})

const nextConfig = {
  // Debug escape hatch: lets a second `next dev` run from this directory
  // without fighting the primary one over .next/dev/lock. Inert unless the
  // env var is set.
  ...(process.env.NEXT_DEBUG_DIST_DIR ? { distDir: process.env.NEXT_DEBUG_DIST_DIR } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  // Bots that get BLOCKING (non-streamed) metadata. Setting this REPLACES
  // Next's default list (node_modules/next/dist/shared/lib/router/utils/html-bots.js),
  // so the default pattern is reproduced below and extended. The additions matter
  // for status codes: with streaming, a notFound() thrown in generateMetadata can
  // only swap the UI after a 200 is already on the wire — blocking metadata is what
  // lets dead URLs answer crawlers with a real HTTP 404. Googlebot is deliberately
  // NOT in Next's default list (it can stream); we add it so soft-404s stay fixed
  // even if a loading boundary is ever reintroduced above the detail routes.
  htmlLimitedBots:
    /[\w-]+-Google|Google-[\w-]+|Googlebot|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|PetalBot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|OAI-SearchBot|ChatGPT-User|PerplexityBot|Perplexity-User|Claude-User|Claude-SearchBot/i,
  images: {
    unoptimized: false,
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 300,
    // Next.js 16: any <Image quality={n}> must be listed here or rendering can warn/fail
    qualities: [75, 80],
    deviceSizes: [400, 640, 750, 828, 1080, 1200, 1600, 1920],
    imageSizes: [32, 48, 64, 96, 128, 256, 384, 400, 800],
    remotePatterns: [
      ...SUPABASE_HOSTS.map((hostname) => ({
        protocol: "https",
        hostname,
      })),
      {
        protocol: "https",
        hostname: FLAGCDN,
      },
      // Ebook cover art, stored beside each PDF (see lib/ebooks.ts). Served
      // through our own optimizer, so those 1 MB PNGs reach the shelf as
      // thumbnail-sized AVIF/WebP.
      {
        protocol: "https",
        hostname: "leuteriorealty.com",
      },
      // Google account avatars (Google Sign-In users' profile photos)
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "filipinohomes123.s3.ap-southeast-1.amazonaws.com",
      },
      // Agent listing uploads + any other bucket host (virtual-hosted S3 URLs)
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.cloudfront.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "aquaproperties.com",
      },
    ],
  },
  async rewrites() {
    // Pretty sitemap-shard URLs (/sitemap-<section>-N.xml) → the paginated
    // route handlers under /api/sitemap. The sitemap INDEX must reference only
    // these rewritten URLs: robots.txt disallows /api, and Google honors
    // robots.txt when fetching sitemaps.
    return ["pages", "projects", "developers", "listings", "events", "news", "gallery"].map((section) => ({
      source: `/sitemap-${section}-:page(\\d+).xml`,
      destination: `/api/sitemap/${section}/:page`,
    }))
  },
  async redirects() {
    return [
      // www → apex, permanent. Host canonicalization belongs at the platform
      // layer (Vercel domain settings / Cloudflare), which currently answers
      // with a temporary 307 — this in-repo 308 is the fallback so any request
      // that reaches Next consolidates signals onto the apex host.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.fhiglobal.ae" }],
        destination: "https://fhiglobal.ae/:path*",
        permanent: true,
      },
      // Developer pages moved from /developers/<slug> to root-level /<slug>.
      // 301 keeps every shared link, bookmark, and indexed URL working; the
      // /developers index itself doesn't match (:slug requires a segment).
      {
        source: "/developers/:slug",
        destination: "/:slug",
        permanent: true,
      },
      // Staff sign-in moved from /login to /staff-login. Temporary redirect keeps
      // existing bookmarks/links working; the target is noindexed either way.
      {
        source: "/login",
        destination: "/staff-login",
        permanent: false,
      },
      // Developer sign-in renamed from /developer-login to /developers-login.
      // Temporary redirect keeps any existing bookmarks working; both are noindexed.
      {
        source: "/developer-login",
        destination: "/developers-login",
        permanent: false,
      },
    ]
  },
  async headers() {
    return [
      {
        // Base security headers for every route. This catch-all MUST stay first:
        // when several entries match a path, Next.js applies them in order and the
        // LAST matching value wins per header key — so the noindex overrides below
        // only take effect if this entry comes before them.
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
      // Role-prefixed dashboards (replaces the old `/dashboard/*`). `/developer/:path*`
      // matches `/developer` and `/developer/*` but NOT the public `/developers`.
      {
        source: "/dashboard",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        source: "/superadmin/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        source: "/admin/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        source: "/teamleader/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        source: "/unitmanager/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        source: "/agent/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        source: "/developer/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        source: "/secretary/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        source: "/teamsecretary/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        source: "/member/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        source: "/api/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        source: "/staff-login/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        source: "/developers-login/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        source: "/register/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        source: "/internal/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        // Public owner-document intake links must not be indexed.
        source: "/owner-documents/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        // Internal style guide — publicly reachable but not for search.
        source: "/template/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
    ]
  },
}

export default nextConfig
