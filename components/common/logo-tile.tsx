/**
 * A brand logo — a team's, a developer's — shown whole: on white, with room
 * around it, scaled to fit and never cropped or stretched. Logos come in
 * every shape (CMG Properties' is about twice as wide as it is tall), and the
 * square `object-cover` boxes this replaces cut them down to a corner. The
 * developer tiles on the home page are the model; size, rounding, border and
 * padding come from `className`.
 */
export function LogoTile({
  src,
  alt,
  className = "",
  title,
}: {
  src: string
  alt: string
  /** Size, rounding, border and padding of the white tile, e.g. "h-9 w-14 rounded-lg border p-1". */
  className?: string
  title?: string
}) {
  return (
    <span title={title} className={`flex shrink-0 items-center justify-center overflow-hidden bg-white ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- any uploaded host; next/image would need each in remotePatterns */}
      <img src={src} alt={alt} loading="lazy" className="h-full w-full object-contain" />
    </span>
  )
}
