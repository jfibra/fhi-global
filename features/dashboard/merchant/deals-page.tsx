"use client"

import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { isMerchantRole } from "@/lib/app-roles"
import { MERCHANT_CLAWBACK_DAYS, MERCHANT_INCENTIVE_AED, fmtAed } from "@/lib/merchant/rules"
import { Card, ErrorNote, Loading, PageTitle, Tile, ValidationPill, fmtDate } from "./shared"
import { useMerchant } from "./use-merchant"

/** /merchant/deals — every rental that came through the QR, and the statements. */
export default function MerchantDealsPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isMerchantRole(role))
  const { data, error, loading } = useMerchant()
  if (!allowed) return null
  if (loading) return <Loading />
  if (error || !data) return <ErrorNote text={error ?? "Couldn't load your record."} />
  const f = data.figures

  return (
    <div className="space-y-6">
      <PageTitle title="Closed deals" intro={`A closed deal is a rental on rentsouq.ae that came through your QR, validated by FHI. Each one pays you AED ${MERCHANT_INCENTIVE_AED} on the 15th of the next month. A rental cancelled within ${MERCHANT_CLAWBACK_DAYS} days is taken back.`} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile dark label={`${f.statement.label}`} value={fmtAed(f.month.merchant_incentive)} hint={`${f.month.validated} validated · ${f.month.pending} waiting · paid on ${f.statement.merchant_pay_date}`} />
        <Tile label="Last month" value={fmtAed(f.last_month.merchant_incentive)} hint={`${f.last_month.validated} validated deal${f.last_month.validated === 1 ? "" : "s"}`} />
        <Tile label="All time" value={fmtAed(f.all_time.merchant_incentive)} hint={`${f.all_time.validated} validated · ${f.all_time.pending} waiting · ${f.all_time.invalid} invalid`} />
      </div>

      <Card title="Every rental through your QR">
        {f.recent.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[#6b7280]">Nothing yet. When a customer scans your QR and rents, FHI records the rental and it appears here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="bg-[#f8fafc] text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#6b7280]">
                  <th className="px-5 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Unit rented</th>
                  <th className="px-3 py-2.5">Recorded by</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-5 py-2.5 text-right">Your incentive</th>
                </tr>
              </thead>
              <tbody>
                {f.recent.map((d) => (
                  <tr key={d.id} className="border-t border-[#f0f2f5]">
                    <td className="whitespace-nowrap px-5 py-2.5 text-[#374151]">{fmtDate(d.date)}</td>
                    <td className="px-3 py-2.5 text-[#0d1117]">{d.unit}</td>
                    <td className="px-3 py-2.5 text-[#374151]">{d.agent.name ?? "FHI"}</td>
                    <td className="px-3 py-2.5"><ValidationPill status={d.validation_status} /></td>
                    <td className={`px-5 py-2.5 text-right tabular-nums ${d.merchant_incentive ? "font-semibold text-[#0d1117]" : "text-[#6b7280]"}`}>{d.merchant_incentive ? fmtAed(d.merchant_incentive) : d.validation_status === "invalid" ? "—" : `${fmtAed(MERCHANT_INCENTIVE_AED)} once validated`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-[#e8eaed] px-5 py-3 text-[12px] text-[#6b7280]">The newest 25. Your closed deal report and incentive for each month are what the statement pays; question an entry within 15 days of the statement.</p>
      </Card>
    </div>
  )
}
