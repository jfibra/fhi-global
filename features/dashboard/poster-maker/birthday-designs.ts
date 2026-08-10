// Birthday poster designs.
//
// Every design ships as a "-blank" artwork: the supplied file with its
// "YOUR NAME HERE" placeholder painted out, so the real name is drawn onto
// clean background instead of over a ghost of the original lettering. The
// originals are left untouched in /images.
//
// `well` is the photo opening, measured from each artwork, and `wellTest`
// says how to recognise its painted area — the openings sit on very different
// grounds (deep navy, warm marble, cream), so one brightness rule can't serve
// them all. The mask is derived from those pixels at runtime rather than being
// a circle we assume: the openings aren't perfectly round, and one of them is
// clipped by a ribbon.

export type WellTest = "light" | "warmGrey" | "neutralGrey"
/**
 * How to turn detected pixels into the final opening.
 *  - "ellipse": fit to the detected extent. Gives a perfectly smooth curve,
 *    which matters because a sparkle painted on the ring makes a few boundary
 *    pixels fail the colour test and would otherwise flatten the edge.
 *  - "hull": convex hull. For an opening genuinely cropped by artwork (a
 *    ribbon crossing it), where a straight edge is correct.
 */
export type WellShape = "ellipse" | "hull"
export type NameStyle = "gold" | "ink" | "bronze"

export type BirthdayDesign = {
  id: string
  label: string
  hint: string
  src: string
  /** Photo opening in template pixels. */
  well: { x0: number; y0: number; x1: number; y1: number }
  wellTest: WellTest
  wellShape: WellShape
  name: {
    cx: number
    /** Text baseline, in template pixels. */
    baseline: number
    maxWidth: number
    size: number
    style: NameStyle
    /** Extra tracking, in px at the base size — matches the artwork's lettering. */
    tracking?: number
  }
}

export const TEMPLATE_W = 1024
export const TEMPLATE_H = 1536

export const BIRTHDAY_DESIGNS: BirthdayDesign[] = [
  {
    id: "navy",
    label: "Navy Balloons",
    hint: "Deep navy, gold balloons and gifts",
    src: "/images/birthday-blank.png",
    well: { x0: 259, y0: 630, x1: 761, y1: 1068 },
    wellTest: "light",
    // Cropped by the ribbon that crosses its lower edge.
    wellShape: "hull",
    name: { cx: 514, baseline: 1176, maxWidth: 560, size: 62, style: "gold" },
  },
  {
    id: "marble",
    label: "Marble & Gold",
    hint: "Bright marble with gold ribbons",
    src: "/images/birthday1-blank.png",
    well: { x0: 109, y0: 593, x1: 598, y1: 1071 },
    wellTest: "warmGrey",
    wellShape: "ellipse",
    name: { cx: 416, baseline: 1396, maxWidth: 470, size: 54, style: "ink" },
  },
  {
    id: "midnight",
    label: "Midnight Skyline",
    hint: "Dubai skyline at dusk",
    src: "/images/birthday2-blank.png",
    well: { x0: 265, y0: 548, x1: 787, y1: 1066 },
    wellTest: "light",
    wellShape: "ellipse",
    name: { cx: 519, baseline: 1152, maxWidth: 520, size: 58, style: "gold" },
  },
  {
    id: "cream",
    label: "Cream Minimal",
    hint: "Soft cream, botanical and calm",
    src: "/images/birthday3-blank.png",
    well: { x0: 237, y0: 508, x1: 786, y1: 1060 },
    wellTest: "neutralGrey",
    wellShape: "ellipse",
    name: { cx: 512, baseline: 1186, maxWidth: 570, size: 54, style: "bronze", tracking: 6 },
  },
]

/** Does this pixel belong to the design's photo opening? */
export function isWellPixel(test: WellTest, r: number, g: number, b: number): boolean {
  switch (test) {
    // Pale opening on a dark ground — brightness alone separates it.
    case "light":
      return r > 170 && g > 170 && b > 170 && Math.max(r, g, b) - Math.min(r, g, b) < 26
    // Opening is mid-grey with a warm highlight; the marble around it is
    // brighter, and the gold ring far warmer.
    case "warmGrey":
      return r >= 185 && r <= 234 && r - b <= 20 && g - b <= 14
    // Opening is truly neutral; the cream ground is warm.
    case "neutralGrey":
      return r > 150 && r < 236 && Math.abs(r - b) <= 8 && Math.abs(g - b) <= 8 && Math.abs(r - g) <= 8
  }
}

export const NAME_FILL: Record<NameStyle, { from: string; mid: string; to: string }> = {
  gold:   { from: "#f7e6a8", mid: "#e3c169", to: "#c79a3c" },
  ink:    { from: "#2a2a3d", mid: "#1c1c2e", to: "#101021" },
  bronze: { from: "#c2a06a", mid: "#a8834c", to: "#8d6a38" },
}
