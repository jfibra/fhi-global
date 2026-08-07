"use client"

import { createContext, useContext } from "react"
import type { AppProfile, AppUser } from "@/lib/auth"

type AuthContextValue = {
  user: AppUser | null
  profile: AppProfile | null
  /** Effective role that drives the UI — the view-as override when an admin is
   *  previewing a role, otherwise the real role. Most consumers should use this. */
  role: string | null
  /** The account's actual role (never the view-as override). Use for real
   *  authority checks like showing the "Change Role" control. */
  realRole: string | null
  /** True while an admin is previewing another role. */
  isViewingAs: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({
  children,
  user,
  profile,
  viewAsRole = null,
}: {
  children: React.ReactNode
  user: AppUser | null
  profile: AppProfile | null
  /** Set only when a real admin-staff account is previewing another role. */
  viewAsRole?: string | null
}) {
  const realRole = profile?.role ?? null
  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: viewAsRole ?? realRole,
        realRole,
        isViewingAs: !!viewAsRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
