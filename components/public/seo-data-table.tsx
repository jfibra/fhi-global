import type { SeoTable } from "@/lib/seo-pages"

/**
 * The one renderer for every fact table on the SEO pages — buyer-guide fee and eligibility tables,
 * an area guide's market data. Real table semantics (a caption, column headers, the first cell of
 * each row as its row header) so the figures are machine-readable as well as readable; wrapped so a
 * phone scrolls the table instead of the page. A table that quotes a source or a date says so
 * underneath.
 */
export function SeoDataTable({ table }: { table: SeoTable }) {
  return (
    <figure>
      <div className="overflow-x-auto border border-[#e8eaed] bg-white">
        <table className="w-full min-w-[420px] text-left text-sm">
          <caption className="border-b border-[#e8eaed] bg-[#f7f8fa] px-4 py-3 text-left font-['Outfit'] text-[15px] font-bold text-[#001f3f]">
            {table.caption}
          </caption>
          <thead>
            <tr className="border-b border-[#e8eaed] text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7280]">
              {table.columns.map((column) => (
                <th key={column} scope="col" className="px-4 py-2.5">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.join("|")} className="border-b border-[#eef0f3] last:border-b-0">
                {row.map((cell, i) =>
                  i === 0 ? (
                    <th key={`${cell}-${i}`} scope="row" className="px-4 py-3 font-semibold text-[#0d1117]">
                      {cell}
                    </th>
                  ) : (
                    <td key={`${cell}-${i}`} className="px-4 py-3 text-[#374151]">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(table.source || table.asOf) && (
        <figcaption className="mt-2 text-xs text-[#6b7280]">
          {table.source && (
            <>
              Source:{" "}
              <a href={table.source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[#001f3f]">
                {table.source.label}
              </a>
            </>
          )}
          {table.source && table.asOf ? " · " : ""}
          {table.asOf ? `As of ${table.asOf}` : ""}
        </figcaption>
      )}
    </figure>
  )
}
