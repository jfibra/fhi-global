/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === "production"

// ── External origins used by the app ────────────────────────────────────────
// Supabase project (storage + API + realtime). Derived from the env so local dev
// and production can point at different Supabase projects without editing the CSP.
const SUPABASE_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  : "hefwmaoborpfuyhbguzv.supabase.co"
// Vercel Analytics
const VERCEL_SCRIPTS = "va.vercel-scripts.com"
const VERCEL_VITALS  = "vitals.vercel-insights.com"
// Flag images (hero section)
const FLAGCDN        = "flagcdn.com"
// Google Maps JavaScript API (buy page map)
const MAPS_API       = "maps.googleapis.com"
const MAPS_GSTATIC   = "maps.gstatic.com"

// ── Content-Security-Policy ──────────────────────────────────────────────────
// next/font/google self-hosts fonts at build-time → no fonts.googleapis.com needed.
// Next.js App Router requires 'unsafe-inline' for its runtime chunk hydration scripts
// and 'unsafe-eval' for dev-mode source maps (remove in strict-prod if desired).
const CSP = [
  // Fallback for anything not matched below
  `default-src 'self'`,

  // JS: own scripts + Next.js inline chunks + Vercel Analytics + Google Maps
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://${MAPS_API} https://${MAPS_GSTATIC} ${VERCEL_SCRIPTS}`,

  // CSS: Tailwind / Next.js injects inline styles
  `style-src 'self' 'unsafe-inline'`,

  // Images: own assets, data URIs, blob previews, Supabase, flag CDN, maps, S3/CloudFront (listing + project media)
  `img-src 'self' data: blob: https://${SUPABASE_HOST} https://${FLAGCDN} https://${MAPS_API} https://${MAPS_GSTATIC} https://*.google.com https://*.googleapis.com https://*.gstatic.com https://*.ggpht.com https://*.amazonaws.com https://*.cloudfront.net`,

  // Fonts: self-hosted via next/font – no external font CDN required
  `font-src 'self' data:`,

  // XHR / fetch: Supabase REST + Auth + Realtime, Vercel Analytics, Google Maps
  `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST} https://${VERCEL_VITALS} https://${VERCEL_SCRIPTS} https://${MAPS_API} https://${MAPS_GSTATIC} https://*.googleapis.com`,

  // Camera / microphone captured media (face-verify & ID-capture steps)
  `media-src 'self' blob:`,

  // Web workers (Next.js may spawn them in dev)
  `worker-src 'self' blob:`,

  // No plugins / Flash / PDFs embedded via <object>/<embed>
  `object-src 'none'`,

  // Prevent this app from being embedded in iframes elsewhere
  `frame-src 'none'`,
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
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 300,
    // Next.js 16: any <Image quality={n}> must be listed here or rendering can warn/fail
    qualities: [75, 80],
    deviceSizes: [400, 640, 750, 828, 1080, 1200, 1600, 1920],
    imageSizes: [32, 48, 64, 96, 128, 256, 384, 400, 800],
    remotePatterns: [
      {
        protocol: "https",
        hostname: SUPABASE_HOST,
      },
      {
        protocol: "https",
        hostname: FLAGCDN,
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
      {
        source: "/dashboard/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        source: "/api/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        source: "/login/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        source: "/register/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        source: "/profile/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        source: "/admin/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
      {
        source: "/internal/:path*",
        headers: PRIVATE_NOINDEX_HEADERS,
      },
    ]
  },
}

export default nextConfig
