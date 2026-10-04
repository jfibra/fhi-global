import { CLUSTERS, type ClusterId } from "@/lib/johndorf/montierra"

/**
 * A clean flat-style elevation per cluster, drawn when a house model has no
 * photos yet: townhouse (green), single-attached (yellow), single-detached
 * (orange). Tinted with the cluster colour so the card still reads as that
 * cluster at a glance.
 */
export function HouseIllustration({ cluster, className }: { cluster: ClusterId; className?: string }) {
  const c = CLUSTERS[cluster]
  const roof = "#5b2a22"
  const wall = "#fffaf5"
  const glass = "#cfe3ef"
  const door = c.color
  const ground = c.soft

  return (
    <svg viewBox="0 0 400 220" className={className} role="img" aria-label={`${c.label} house illustration`}>
      <defs>
        <linearGradient id={`sky-${cluster}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7f2ee" />
          <stop offset="1" stopColor="#efe6e0" />
        </linearGradient>
      </defs>
      <rect width="400" height="220" fill={`url(#sky-${cluster})`} />
      {/* ground */}
      <rect x="0" y="178" width="400" height="42" fill={ground} />
      <rect x="0" y="176" width="400" height="3" fill={c.color} opacity="0.55" />

      {cluster === "green" && (
        <g>
          {/* two attached townhouse units */}
          <rect x="88" y="78" width="224" height="100" fill={wall} stroke="#e4d6cc" />
          <line x1="200" y1="78" x2="200" y2="178" stroke="#e4d6cc" />
          <polygon points="80,80 200,38 320,80" fill={roof} />
          <rect x="80" y="76" width="240" height="6" fill="#3f1b15" />
          {[110, 150, 222, 262].map((x) => (
            <rect key={x} x={x} y="92" width="24" height="26" rx="2" fill={glass} stroke="#b9cbd6" />
          ))}
          {[110, 262].map((x) => (
            <rect key={x} x={x} y="134" width="24" height="24" rx="2" fill={glass} stroke="#b9cbd6" />
          ))}
          <rect x="156" y="136" width="20" height="42" rx="2" fill={door} />
          <rect x="224" y="136" width="20" height="42" rx="2" fill={door} />
        </g>
      )}

      {cluster === "yellow" && (
        <g>
          {/* single-attached: house + carport on the side */}
          <rect x="96" y="72" width="170" height="106" fill={wall} stroke="#e4d6cc" />
          <polygon points="88,74 181,32 274,74" fill={roof} />
          <rect x="88" y="70" width="186" height="6" fill="#3f1b15" />
          <rect x="118" y="88" width="30" height="28" rx="2" fill={glass} stroke="#b9cbd6" />
          <rect x="214" y="88" width="30" height="28" rx="2" fill={glass} stroke="#b9cbd6" />
          <rect x="118" y="134" width="30" height="26" rx="2" fill={glass} stroke="#b9cbd6" />
          <rect x="196" y="132" width="26" height="46" rx="2" fill={door} />
          {/* carport */}
          <rect x="266" y="112" width="70" height="6" fill="#3f1b15" />
          <line x1="272" y1="118" x2="272" y2="178" stroke="#8c7a70" strokeWidth="4" />
          <line x1="330" y1="118" x2="330" y2="178" stroke="#8c7a70" strokeWidth="4" />
          <rect x="280" y="150" width="44" height="22" rx="6" fill="#d8cfc9" />
          <circle cx="291" cy="174" r="5" fill="#5b2a22" />
          <circle cx="313" cy="174" r="5" fill="#5b2a22" />
        </g>
      )}

      {cluster === "orange" && (
        <g>
          {/* single-detached: wide house, porch, two-car frontage */}
          <rect x="66" y="80" width="232" height="98" fill={wall} stroke="#e4d6cc" />
          <polygon points="56,82 182,30 308,82" fill={roof} />
          <rect x="56" y="78" width="252" height="6" fill="#3f1b15" />
          <rect x="88" y="96" width="34" height="28" rx="2" fill={glass} stroke="#b9cbd6" />
          <rect x="242" y="96" width="34" height="28" rx="2" fill={glass} stroke="#b9cbd6" />
          <rect x="88" y="138" width="34" height="26" rx="2" fill={glass} stroke="#b9cbd6" />
          <rect x="242" y="138" width="34" height="26" rx="2" fill={glass} stroke="#b9cbd6" />
          {/* porch */}
          <rect x="150" y="126" width="64" height="6" fill="#3f1b15" />
          <line x1="156" y1="132" x2="156" y2="178" stroke="#8c7a70" strokeWidth="3" />
          <line x1="208" y1="132" x2="208" y2="178" stroke="#8c7a70" strokeWidth="3" />
          <rect x="170" y="136" width="24" height="42" rx="2" fill={door} />
          {/* carport */}
          <rect x="300" y="118" width="80" height="6" fill="#3f1b15" />
          <line x1="306" y1="124" x2="306" y2="178" stroke="#8c7a70" strokeWidth="4" />
          <line x1="374" y1="124" x2="374" y2="178" stroke="#8c7a70" strokeWidth="4" />
        </g>
      )}

      {/* a tree for scale */}
      <rect x="36" y="150" width="6" height="28" fill="#7a5a4a" />
      <circle cx="39" cy="142" r="18" fill="#9bb86b" />
      <circle cx="30" cy="150" r="12" fill="#86a65a" />
    </svg>
  )
}
