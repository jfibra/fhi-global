"use client"

/**
 * Invite — the user's personal QR code and link to /register?ref=<their id>.
 * Registrations that arrive through it get metadata.invited_by set to the
 * inviter's profile id (see app/api/register/route.ts), so recruitment can be
 * tracked per agent.
 */

import { useEffect, useRef, useState } from "react"
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react"
import { Check, Copy, Download, MessageCircle, QrCode, ScanLine, UserPlus } from "lucide-react"
import { DashboardShell } from "@/components/dashboard/shell"
import { getRoleColor } from "@/components/dashboard/sidebar-config"
import { roleToLabel } from "@/lib/auth"

export function InviteClient({
  userId,
  userName,
  currentRole,
}: {
  userId: string
  userName: string
  currentRole: string
}) {
  const [origin, setOrigin] = useState("")
  const [copied, setCopied] = useState(false)
  const downloadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const inviteUrl = origin ? `${origin}/register?ref=${userId}` : ""

  const handleCopy = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (http / old browser) — select-and-copy fallback not needed here.
    }
  }

  const handleDownload = () => {
    const canvas = downloadRef.current?.querySelector("canvas")
    if (!canvas) return
    const a = document.createElement("a")
    a.href = canvas.toDataURL("image/png")
    a.download = "fhi-invite-qr.png"
    a.click()
  }

  const waText = encodeURIComponent(
    `Join me on FHI Global — Dubai's premier real estate portal. Create your account here: ${inviteUrl}`,
  )

  const roleValue = currentRole.toLowerCase().trim()

  return (
    <DashboardShell
      role={roleValue}
      roleLabel={roleToLabel(currentRole)}
      roleColor={getRoleColor(currentRole)}
      userName={userName}
    >
      <div className="w-full space-y-6">
        <div>
          <h1 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] flex items-center gap-2">
            <QrCode className="w-6 h-6 text-[#001f3f]" />
            Invite
          </h1>
          <p className="text-sm text-[#6b7280] mt-1">
            Your personal QR code. Anyone who scans it lands on the registration page, and their
            account is credited to you.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 items-start">
          {/* ── QR card ── */}
          <div className="bg-white rounded-2xl border border-[#e8eaed] p-8 flex flex-col items-center">
            <div className="rounded-2xl border-4 border-[#d6b357] p-5 bg-white">
              {inviteUrl ? (
                <QRCodeSVG value={inviteUrl} size={240} level="M" fgColor="#001f3f" />
              ) : (
                <div className="w-[240px] h-[240px] animate-pulse bg-[#f3f4f6] rounded-xl" />
              )}
            </div>
            <p className="mt-4 font-['Outfit'] font-bold text-[#001f3f] text-lg text-center">
              Scan to join FHI Global
            </p>
            <p className="text-xs text-[#9ca3af] text-center">Invited by {userName}</p>

            {/* Hidden high-resolution canvas used for the PNG download. */}
            <div ref={downloadRef} className="hidden" aria-hidden>
              {inviteUrl && (
                <QRCodeCanvas value={inviteUrl} size={1024} level="M" fgColor="#001f3f" marginSize={4} />
              )}
            </div>

            <div className="mt-5 w-full space-y-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={!inviteUrl}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#001f3f] text-white text-sm font-bold hover:bg-[#00356b] transition-colors disabled:opacity-40"
              >
                <Download className="w-4 h-4" />
                Download QR (print-ready PNG)
              </button>
              <a
                href={`https://wa.me/?text=${waText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#25d366] text-[#128c4b] text-sm font-bold hover:bg-[#25d366]/10 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Share on WhatsApp
              </a>
            </div>
          </div>

          {/* ── Link + how it works ── */}
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-[#e8eaed] p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-2">
                Your invite link
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={inviteUrl || "…"}
                  className="flex-1 px-4 py-3 rounded-xl border border-[#e5e5e5] bg-[#f9fafb] text-sm text-[#374151] truncate"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  disabled={!inviteUrl}
                  className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 ${
                    copied
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-[#001f3f] text-white hover:bg-[#00356b]"
                  }`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#e8eaed] p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-4">
                How it works
              </p>
              <div className="space-y-4">
                {[
                  {
                    icon: ScanLine,
                    title: "They scan your QR (or open your link)",
                    body: "Put it on your business card, flyers, reels, or send it in a chat.",
                  },
                  {
                    icon: UserPlus,
                    title: "They create an account",
                    body: "The registration form opens ready to go — nothing to type in for you.",
                  },
                  {
                    icon: Check,
                    title: "The signup is credited to you",
                    body: "Their profile records you as the inviter, and an admin activates the account.",
                  },
                ].map((s, i) => (
                  <div key={s.title} className="flex items-start gap-3">
                    <span className="w-9 h-9 rounded-xl bg-[#001f3f]/5 text-[#001f3f] flex items-center justify-center shrink-0">
                      <s.icon className="w-[18px] h-[18px]" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-[#111827]">
                        {i + 1}. {s.title}
                      </p>
                      <p className="text-sm text-[#6b7280]">{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
