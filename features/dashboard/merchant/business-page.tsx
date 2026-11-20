"use client"

import { useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { isMerchantRole } from "@/lib/app-roles"
import { MERCHANT_CATEGORIES } from "@/lib/merchant/rules"
import type { MerchantRecord } from "@/lib/merchant/types"
import { Card, ErrorNote, Loading, PageTitle, StatusPill, btnPrimary, inputCls, labelCls } from "./shared"
import { useMerchant } from "./use-merchant"

const EMIRATES = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"]

type Form = Pick<
  MerchantRecord,
  | "business_name"
  | "category"
  | "address"
  | "emirate"
  | "website"
  | "signatory_name"
  | "signatory_title"
  | "emirates_id_number"
  | "emirates_id_expires_on"
  | "trade_licence_number"
  | "trade_licence_authority"
  | "trade_licence_expires_on"
  | "voucher_offer"
>

const pick = (m: MerchantRecord): Form => ({
  business_name: m.business_name,
  category: m.category,
  address: m.address,
  emirate: m.emirate,
  website: m.website,
  signatory_name: m.signatory_name,
  signatory_title: m.signatory_title,
  emirates_id_number: m.emirates_id_number,
  emirates_id_expires_on: m.emirates_id_expires_on,
  trade_licence_number: m.trade_licence_number,
  trade_licence_authority: m.trade_licence_authority,
  trade_licence_expires_on: m.trade_licence_expires_on,
  voucher_offer: m.voucher_offer,
})

/**
 * The business details form — the merchant's own page, and reused by the
 * agent and admin screens with a merchant id. Mount it with
 * `key={merchant.updated_at}` so a fresh record resets the fields.
 */
export function BusinessForm({ merchant, merchantId, onSaved }: { merchant: MerchantRecord; merchantId: string | null; onSaved: () => void }) {
  const [form, setForm] = useState<Form>(() => pick(merchant))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = <K extends keyof Form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/merchant/me${merchantId ? `?merchant=${encodeURIComponent(merchantId)}` : ""}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? `Save failed (${res.status}).`)
      setMsg({ ok: true, text: "Saved." })
      onSaved()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't save." })
    } finally {
      setSaving(false)
    }
  }
  const field = (k: keyof Form, label: string, props: { placeholder?: string; type?: string } = {}) => (
    <div>
      <label className={labelCls} htmlFor={`biz-${k}`}>{label}</label>
      <input id={`biz-${k}`} type={props.type ?? "text"} className={inputCls} value={form[k] ?? ""} onChange={(e) => set(k, e.target.value)} placeholder={props.placeholder} />
    </div>
  )
  return (
    <div className="space-y-5">
      <Card title="The business">
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          {field("business_name", "Business name")}
          <div>
            <label className={labelCls} htmlFor="biz-category">Kind of business</label>
            <select id="biz-category" className={inputCls} value={form.category ?? ""} onChange={(e) => set("category", e.target.value)}>
              <option value="">Choose one</option>
              {MERCHANT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">{field("address", "Address", { placeholder: "Shop 4, Al Barsha Mall, Al Barsha 1" })}</div>
          <div>
            <label className={labelCls} htmlFor="biz-emirate">Emirate</label>
            <select id="biz-emirate" className={inputCls} value={form.emirate ?? ""} onChange={(e) => set("emirate", e.target.value)}>
              <option value="">Choose one</option>
              {EMIRATES.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          {field("website", "Website or Instagram", { placeholder: "https://…" })}
          <div className="sm:col-span-2">
            {field("voucher_offer", "The voucher your customers get", { placeholder: "15% off any meal for two" })}
            <p className="mt-1 text-[12px] text-[#6b7280]">Every customer who rents through your QR redeems it with you. FHI and MCG buy the vouchers at your maximum discount.</p>
          </div>
        </div>
      </Card>
      <Card title="Trade licence">
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          {field("trade_licence_number", "Licence number")}
          {field("trade_licence_authority", "Issuing authority", { placeholder: "DED, DMCC, …" })}
          {field("trade_licence_expires_on", "Expires on", { type: "date" })}
        </div>
      </Card>
      <Card title="Authorised signatory">
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          {field("signatory_name", "Full name")}
          {field("signatory_title", "Title", { placeholder: "Owner, General Manager…" })}
          {field("emirates_id_number", "Emirates ID number", { placeholder: "784-1985-1234567-1" })}
          {field("emirates_id_expires_on", "Emirates ID expires on", { type: "date" })}
        </div>
      </Card>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={saving} className={btnPrimary}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save
        </button>
        {msg && <span className={`text-[13px] ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</span>}
      </div>
    </div>
  )
}

/** /merchant/business — the merchant's own business profile. */
export default function MerchantBusinessPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isMerchantRole(role))
  const { data, error, loading, reload } = useMerchant()
  if (!allowed) return null
  if (loading) return <Loading />
  if (error || !data) return <ErrorNote text={error ?? "Couldn't load your record."} />
  return (
    <div className="space-y-6">
      <PageTitle title="Business profile" intro="What goes on your agreement, your flyer and your statements. The bank details are on the Documents page." aside={<StatusPill status={data.merchant.status} />} />
      <BusinessForm key={data.merchant.updated_at} merchant={data.merchant} merchantId={null} onSaved={() => void reload()} />
    </div>
  )
}
