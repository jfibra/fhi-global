"use client"

import Link from "next/link"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-3xl border border-[#e8eaed] bg-white shadow-[0_12px_40px_-12px_rgba(0,31,63,0.18)] p-8 text-center">
          <p className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest bg-[#95292a]/10 text-[#95292a] border border-[#95292a]/20">
            Error 500
          </p>
          <h1 className="mt-4 font-['Outfit'] text-3xl font-bold text-[#0d1117]">Something went wrong</h1>
          <p className="mt-3 text-sm text-[#6b7280] leading-relaxed">
            We hit an unexpected server error. Please try again or return to the homepage.
          </p>

          {error?.digest ? (
            <p className="mt-4 text-xs text-[#9ca3af]">Reference: {error.digest}</p>
          ) : null}

          <div className="mt-7 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="px-5 py-2.5 rounded-xl bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#002952] transition-colors"
            >
              Try again
            </button>
            <Link
              href="/"
              className="px-5 py-2.5 rounded-xl border border-[#d1d5db] text-sm font-semibold text-[#374151] hover:bg-[#f9fafb] transition-colors"
            >
              Go home
            </Link>
          </div>
        </div>
      </body>
    </html>
  )
}
