export default function BuyLoading() {
  return (
    <div className="relative min-h-screen bg-[#fafafa] font-sans overflow-x-hidden">
      <div className="h-9 bg-[#001f3f]/90 animate-pulse" aria-hidden />
      <div className="h-16 bg-white border-b border-[#e8eaed] animate-pulse" aria-hidden />
      <div className="bg-white border-b border-[#e8eaed] h-[72px] animate-pulse" aria-hidden />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
        <div className="h-4 w-56 bg-[#e2e8f0] rounded animate-pulse mb-6" />
        <div className="h-10 w-full max-w-xl bg-[#e2e8f0] rounded animate-pulse mb-2" />
        <div className="h-4 w-2/3 max-w-lg bg-[#e2e8f0] rounded animate-pulse mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          <div className="lg:col-span-8 space-y-5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-[#e8eaed] overflow-hidden flex flex-col md:flex-row animate-pulse"
              >
                <div className="w-full md:w-[380px] aspect-[4/3] md:min-h-[240px] bg-[#e2e8f0]" />
                <div className="flex-1 p-6 space-y-3">
                  <div className="h-8 w-48 bg-[#e2e8f0] rounded" />
                  <div className="h-4 w-full bg-[#e2e8f0] rounded" />
                  <div className="h-4 w-3/4 bg-[#e2e8f0] rounded" />
                  <div className="h-10 w-full max-w-sm bg-[#e2e8f0] rounded-lg mt-4" />
                </div>
              </div>
            ))}
          </div>
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-2xl bg-[#e2e8f0] min-h-[200px] animate-pulse" />
            <div className="rounded-2xl bg-[#e2e8f0] h-14 animate-pulse" />
            <div className="rounded-2xl bg-[#e2e8f0] min-h-[220px] animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
