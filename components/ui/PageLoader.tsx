import Image from "next/image"

/**
 * PageLoader
 * Full-viewport premium loading overlay.
 * Uses pure CSS animations (no JS, GPU-accelerated via transform/opacity).
 * Rendered by app/loading.tsx on every route suspension.
 */
export function PageLoader() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#001428]">

      {/* ── Radial background gradient ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(0,42,82,0.8) 0%, #001428 70%)",
        }}
      />

      {/* ── Subtle dot grid ── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* ── Gold ambient glow blob (pulsing) ── */}
      <div
        className="absolute"
        style={{
          width: 420,
          height: 420,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(214,179,87,0.18) 0%, transparent 70%)",
          animation: "fhi-blob-pulse 2.8s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      {/* ── Logo container ── */}
      <div
        className="relative flex flex-col items-center gap-8"
        style={{
          animation: "fhi-logo-float 3s ease-in-out infinite",
        }}
      >
        {/* Glow halo behind logo */}
        <div
          className="absolute"
          style={{
            width: 220,
            height: 80,
            background:
              "radial-gradient(ellipse, rgba(214,179,87,0.30) 0%, transparent 70%)",
            filter: "blur(16px)",
            animation: "fhi-glow-pulse 2.8s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />

        {/* Logo */}
        <div
          style={{
            animation: "fhi-logo-scale 2.8s ease-in-out infinite",
            filter: "drop-shadow(0 0 18px rgba(214,179,87,0.35))",
          }}
        >
          <Image
            src="/FHI_Branding_White.png"
            alt="FHI Global"
            width={180}
            height={60}
            priority
            className="object-contain"
            style={{ width: 160, height: "auto" }}
          />
        </div>

        {/* ── Gold shimmer progress line ── */}
        <div
          className="relative overflow-hidden rounded-full"
          style={{ width: 160, height: 2, background: "rgba(214,179,87,0.15)" }}
        >
          <div
            className="absolute inset-y-0 w-full"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(214,179,87,0.9) 40%, rgba(240,216,144,1) 50%, rgba(214,179,87,0.9) 60%, transparent 100%)",
              animation: "fhi-shimmer 1.6s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      {/* ── Keyframes injected via a style tag ── */}
      <style>{`
        @keyframes fhi-blob-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(1.12); }
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
          0%, 100% { opacity: 0.7; }
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
