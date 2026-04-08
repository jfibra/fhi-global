"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import Image from "next/image"

/**
 * NavigationLoader
 *
 * Shows a full-screen branded loader whenever the user navigates between pages.
 * Detection strategy:
 *   START: intercept clicks on internal <a> tags that change the pathname
 *   END:   useEffect fires when usePathname() updates (route resolved)
 *
 * This works for every navigation in Next.js App Router (fast OR slow).
 */
export function NavigationLoader() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [fading, setFading] = useState(false)   // true = fading out
  const pathnameRef = useRef(pathname)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Intercept internal link clicks → show loader ──────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a")
      if (!anchor) return

      const href = anchor.getAttribute("href")
      if (!href) return
      // Skip external, hash-only, or javascript: links
      if (href.startsWith("http") || href.startsWith("//")) return
      if (href.startsWith("#") || href.startsWith("javascript")) return
      // Skip same-path navigations (hash changes on current page, etc.)
      try {
        const target = new URL(href, window.location.href)
        if (target.pathname === pathnameRef.current) return
      } catch {
        return
      }
      // Show the loader
      if (hideTimer.current) clearTimeout(hideTimer.current)
      setFading(false)
      setVisible(true)
    }

    document.addEventListener("click", handleClick, { capture: true })
    return () => document.removeEventListener("click", handleClick, { capture: true })
  }, [])

  // ── Pathname resolved → fade out and hide ────────────────────────────────
  useEffect(() => {
    pathnameRef.current = pathname
    if (!visible) return

    setFading(true)
    hideTimer.current = setTimeout(() => {
      setVisible(false)
      setFading(false)
    }, 380) // matches CSS fade-out duration

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (!visible) return null

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: "#001428",
        opacity: fading ? 0 : 1,
        transition: fading
          ? "opacity 0.35s cubic-bezier(0.4,0,0.2,1)"
          : "opacity 0.15s ease",
        willChange: "opacity",
      }}
    >
      {/* Radial background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(0,42,82,0.9) 0%, #001428 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Dot grid texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          pointerEvents: "none",
        }}
      />

      {/* Gold ambient glow blob */}
      <div
        style={{
          position: "absolute",
          width: 440,
          height: 440,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(214,179,87,0.15) 0%, transparent 70%)",
          animation: "fhi-blob-pulse 2.8s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      {/* Logo + shimmer line */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
          animation: "fhi-logo-float 3s ease-in-out infinite",
        }}
      >
        {/* Glow halo */}
        <div
          style={{
            position: "absolute",
            width: 240,
            height: 90,
            background:
              "radial-gradient(ellipse, rgba(214,179,87,0.28) 0%, transparent 70%)",
            filter: "blur(18px)",
            animation: "fhi-glow-pulse 2.8s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />

        {/* FHI Logo */}
        <div
          style={{
            animation: "fhi-logo-scale 2.8s ease-in-out infinite",
            filter: "drop-shadow(0 0 20px rgba(214,179,87,0.38))",
          }}
        >
          <Image
            src="/FHI_Branding_White.png"
            alt="FHI Global"
            width={180}
            height={60}
            priority
            style={{ width: 160, height: "auto", objectFit: "contain" }}
          />
        </div>

        {/* Gold shimmer progress bar */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            width: 160,
            height: 2,
            borderRadius: 9999,
            background: "rgba(214,179,87,0.14)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "0 0 0 0",
              background:
                "linear-gradient(90deg, transparent 0%, rgba(214,179,87,0.9) 40%, rgba(240,216,144,1) 50%, rgba(214,179,87,0.9) 60%, transparent 100%)",
              animation: "fhi-shimmer 1.5s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes fhi-blob-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.55; transform: scale(1.14); }
        }
        @keyframes fhi-logo-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-7px); }
        }
        @keyframes fhi-logo-scale {
          0%   { transform: scale(0.93); }
          45%  { transform: scale(1.00); }
          70%  { transform: scale(0.97); }
          100% { transform: scale(0.93); }
        }
        @keyframes fhi-glow-pulse {
          0%, 100% { opacity: 0.65; }
          50%       { opacity: 1; }
        }
        @keyframes fhi-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}
