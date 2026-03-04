"use client"

import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"

/**
 * PageTransitionWrapper
 * Wraps page content with a subtle fade transition on every route change.
 * Must be client-side (uses usePathname and framer-motion).
 */
export function PageTransitionWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        style={{ willChange: "opacity" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
