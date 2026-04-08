"use client"

import Link from "next/link"
import { ArrowLeft, Mail } from "lucide-react"

export default function NotFound() {
  return (
    <div className="relative min-h-screen bg-[#fafafa] text-[#111] overflow-hidden font-sans flex flex-col items-center justify-center px-4">
      {/* Ambient blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-40 blur-[100px] -z-10 bg-[radial-gradient(circle,rgb(200,245,255)_0%,rgba(255,255,255,0)_70%)]" />
      <div className="fixed bottom-0 right-[-10%] w-[600px] h-[600px] rounded-full opacity-40 blur-[100px] -z-10 bg-[radial-gradient(circle,rgb(250,240,210)_0%,rgba(255,255,255,0)_70%)]" />

      {/* Card */}
      <div className="bg-white/60 backdrop-blur-2xl rounded-[32px] border border-white/60 shadow-xl shadow-black/5 px-10 py-14 max-w-lg w-full text-center">
        {/* Badge */}
        <div className="inline-flex items-center px-3 py-1.5 bg-white border border-[#e5e5e5] rounded-full text-xs font-semibold uppercase tracking-wider mb-8 shadow-sm">
          <span className="w-2 h-2 bg-[#95292a] rounded-full mr-2 animate-pulse" />
          Error 404
        </div>

        {/* Large 404 */}
        <h1 className="font-['Outfit'] text-[120px] leading-none font-bold tracking-tight bg-gradient-to-r from-[#001f3f] to-[#d6b357] bg-clip-text text-transparent select-none">
          404
        </h1>

        {/* Heading */}
        <h2 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] mt-4 mb-3">
          Page Not Found
        </h2>

        {/* Description */}
        <p className="text-[#6b7280] text-sm leading-relaxed max-w-sm mx-auto mb-2">
          The page you&apos;re looking for doesn&apos;t exist or has been moved. If you believe this is a mistake, please contact your system administrator.
        </p>

        {/* Contact hint */}
        <div className="mt-5 mb-8 inline-flex items-center gap-2 bg-[#f8fafc] border border-[#e5e5e5] rounded-2xl px-4 py-3 text-sm text-[#4b5563]">
          <div className="w-7 h-7 rounded-xl bg-white shadow-sm border border-[#f0f0f0] flex items-center justify-center flex-shrink-0">
            <Mail className="w-3.5 h-3.5 text-[#001f3f]" />
          </div>
          <span>
            Contact{" "}
            <a
              href="mailto:admin@fhiglobal.com"
              className="font-semibold text-[#001f3f] hover:underline"
            >
              admin@fhiglobal.com
            </a>{" "}
            for assistance
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-7 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md w-full sm:w-auto text-center"
          >
            Back to Home
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 px-7 py-3 rounded-full font-semibold text-sm bg-white/50 border border-[#e5e5e5] transition-all hover:bg-white hover:border-[#001f3f] w-full sm:w-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>

      {/* Footer note */}
      <p className="mt-8 text-xs text-[#9ca3af]">FHI Global — Dubai Real Estate CRM</p>
    </div>
  )
}
