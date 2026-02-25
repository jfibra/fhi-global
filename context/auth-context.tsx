"use client"

import { createContext, useContext } from "react"
import type { AppProfile, AppUser } from "@/lib/auth"

type AuthContextValue = {
  user: AppUser | null
  profile: AppProfile | null
  role: string | null
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({
  children,
  user,
  profile,
}: {
  children: React.ReactNode
  user: AppUser | null
  profile: AppProfile | null
}) {
  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role ?? null,
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
