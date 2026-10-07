import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"

/**
 * Crawlable numbered pagination, shared by /projects, /buy and /rent: Previous, the page numbers
 * windowed around the current one (first, last, current ± 2, with ellipses over the gaps) and Next —
 * every entry but the current page a real <a href>, so each page of results is in the link graph.
 * `hrefFor` builds the URL for page n (and decides what a filter keeps or drops). Renders nothing for
 * a single page.
 */
export function Pager({
  page,
  totalPages,
  hrefFor,
  summary,
  className = "",
}: {
  page: number
  totalPages: number
  hrefFor: (n: number) => string
  /** A small line above the numbers, e.g. "Showing 25–48 of 89". */
  summary?: string
  className?: string
}) {
  if (totalPages <= 1) return null
  const numbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === totalPages || Math.abs(n - page) <= 2,
  )
  return (
    <div className={className}>
      {summary && <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-[#6b7280]">{summary}</p>}
      <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-2">
        {page > 1 && (
          <Link
            href={hrefFor(page - 1)}
            className="group inline-flex items-center gap-2 border border-[#e5e8ec] bg-white px-4 py-2.5 text-sm font-semibold text-[#001f3f] transition-colors hover:border-[#d6b357]"
          >
            <ArrowLeft className="h-4 w-4 text-[#b8913f] transition-transform group-hover:-translate-x-0.5" /> Previous
          </Link>
        )}
        {numbers.map((n, idx) => (
          <span key={n} className="flex items-center gap-2">
            {idx > 0 && numbers[idx - 1] !== n - 1 && <span className="text-[#9ca3af]">…</span>}
            {n === page ? (
              <span aria-current="page" className="inline-flex h-10 min-w-10 items-center justify-center bg-[#0d1117] px-3 text-sm font-bold text-white">
                {n}
              </span>
            ) : (
              <Link
                href={hrefFor(n)}
                className="inline-flex h-10 min-w-10 items-center justify-center border border-[#e5e8ec] bg-white px-3 text-sm font-semibold text-[#001f3f] transition-colors hover:border-[#d6b357] hover:text-[#b8913f]"
              >
                {n}
              </Link>
            )}
          </span>
        ))}
        {page < totalPages && (
          <Link
            href={hrefFor(page + 1)}
            className="group inline-flex items-center gap-2 bg-[#d6b357] px-4 py-2.5 text-sm font-bold text-[#001f3f] transition-colors hover:bg-[#e2c26a]"
          >
            Next <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </nav>
    </div>
  )
}
