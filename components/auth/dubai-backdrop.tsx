import Image from "next/image"

/**
 * Cinematic Dubai photo backdrop shared by the auth pages (/login, /register).
 * Fills its nearest positioned ancestor — wrap in `absolute inset-0` (hero
 * sections) or `fixed inset-0 -z-10` (scrolling pages).
 */
export function DubaiBackdrop() {
  return (
    <>
      <Image
        src="/background/dubai.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      {/* Navy wash: stronger on the left so large light text reads clearly, photo stays visible on the right */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#001428]/72 via-[#001f3f]/35 to-transparent" />
      {/* Soft bottom fade for footer-adjacent text */}
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#000d1c]/50 to-transparent" />
      {/* Gold top rule */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#d6b357]/70 to-transparent" />
    </>
  )
}
