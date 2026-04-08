/**
 * Previously applied a framer-motion fade on every navigation, which delayed
 * first paint and added client JS. Pages render immediately now.
 */
export function PageTransitionWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
