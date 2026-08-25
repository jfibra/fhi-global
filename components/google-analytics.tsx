import Script from "next/script"

/**
 * Google Analytics 4 — renders nothing until NEXT_PUBLIC_GA_ID is set
 * (a "G-XXXXXXXXXX" measurement ID, locally and in Vercel). The CSP in
 * next.config.mjs already allows the GA hosts, so activation is just the
 * env var + redeploy.
 */
export function GoogleAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID?.trim()
  if (!id) return null
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');`}
      </Script>
    </>
  )
}
