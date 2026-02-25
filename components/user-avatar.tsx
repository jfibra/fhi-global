"use client"

import Image from "next/image"

export function UserAvatar({
  name,
  imageUrl,
  size = 36,
  className = "",
}: {
  name: string
  imageUrl?: string | null
  size?: number
  className?: string
}) {
  const initial = (name ?? "?").charAt(0).toUpperCase()

  if (imageUrl) {
    return (
      <div
        className={`relative rounded-full overflow-hidden flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <Image
          src={imageUrl}
          alt={name}
          fill
          className="object-cover"
          sizes={`${size}px`}
        />
      </div>
    )
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold select-none bg-gradient-to-br from-[#001f3f] to-[#d6b357] ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      aria-label={name}
    >
      {initial}
    </div>
  )
}
