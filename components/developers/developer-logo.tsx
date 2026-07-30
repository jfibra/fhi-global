import Image from "next/image"

// Shared developer logo/initials avatar. Used by the admin developers table and
// the invite developer selector so both render the same mark.
export function DeveloperLogo({
  url,
  name,
  size = 36,
}: {
  url: string | null
  name: string
  size?: number
}) {
  const dim = { width: size, height: size }
  if (url) {
    return (
      <div
        className="relative rounded-xl overflow-hidden border border-[#e5e5e5] bg-white flex-shrink-0"
        style={dim}
      >
        <Image src={url} alt={name} fill className="object-contain p-1" sizes={`${size}px`} />
      </div>
    )
  }
  const initials =
    name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  return (
    <div
      className="rounded-xl bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] flex items-center justify-center flex-shrink-0"
      style={dim}
    >
      <span className="text-white font-bold" style={{ fontSize: Math.max(11, Math.round(size * 0.36)) }}>{initials}</span>
    </div>
  )
}
