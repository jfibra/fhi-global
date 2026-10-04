"use client"

import { useActionState, useState } from "react"
import { Eye, EyeOff, Loader2, Lock, User } from "lucide-react"
import { signInJohndorf, type JohndorfLoginState } from "./actions"

const inputCls =
  "w-full rounded-md border border-[#e3dcd8] bg-white py-3 pl-10 pr-4 text-sm text-[#2a1d1b] placeholder:text-[#a89c98] transition-colors focus:border-[#b4241c] focus:outline-none focus:ring-4 focus:ring-[#b4241c]/10"

export function JohndorfLoginForm() {
  const [state, action, pending] = useActionState<JohndorfLoginState, FormData>(signInJohndorf, {})
  const [show, setShow] = useState(false)

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="jd-username" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#6b5a56]">
          Username
        </label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a89c98]" />
          <input id="jd-username" name="username" autoComplete="username" required autoFocus className={inputCls} />
        </div>
      </div>

      <div>
        <label htmlFor="jd-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#6b5a56]">
          Password
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a89c98]" />
          <input
            id="jd-password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            className={`${inputCls} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-[#a89c98] transition-colors hover:text-[#6b5a56]"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {state.error && (
        <p role="alert" className="rounded-md border border-[#f1c9c5] bg-[#fdf2f1] px-3.5 py-2.5 text-sm text-[#941414]">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-[#b4241c] py-3.5 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-[0_8px_20px_-8px_rgba(180,36,28,0.55)] transition-colors hover:bg-[#941414] disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  )
}
