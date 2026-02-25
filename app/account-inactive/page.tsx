export default function AccountInactivePage() {
  return (
    <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#e8eaed] bg-white p-8 shadow-[0_8px_32px_-12px_rgba(0,31,63,0.25)]">
        <h1 className="text-2xl font-bold text-[#0d1117]">Account Inactive</h1>
        <p className="mt-3 text-sm text-[#4b5563] leading-relaxed">
          Your account appears to be inactive.
        </p>
        <p className="mt-1 text-sm text-[#4b5563] leading-relaxed">
          Please contact the system administrator to restore access.
        </p>

        <form action="/logout" method="post" className="mt-6">
          <button
            type="submit"
            className="rounded-lg bg-[#001f3f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#002a52]"
          >
            Logout
          </button>
        </form>
      </div>
    </div>
  )
}
