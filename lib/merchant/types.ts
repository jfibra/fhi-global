/**
 * What the merchant routes hand the pages (browser-safe shapes). Built on
 * the server by lib/merchant/service.ts from the three tables of migration
 * 092 plus the rental sales tagged with a merchant.
 */

import type { MerchantDocumentKind, MerchantStatus } from "@/lib/merchant/rules"

export type MerchantDocumentRow = {
  id: string
  kind: MerchantDocumentKind
  file_name: string
  file_url: string
  file_type: string | null
  uploaded_by: string | null
  uploaded_by_name: string | null
  uploaded_role: string | null
  note: string | null
  verified_at: string | null
  created_at: string
}

/** One rental that came through the merchant's QR, as the pages list it. */
export type MerchantDeal = {
  id: string
  /** Reservation date, else the day it was recorded (Dubai). */
  date: string
  recorded_at: string
  unit: string
  validation_status: string
  contract_price: number
  /** The agent who recorded the rental (may differ from the one who signed the merchant). */
  agent: { id: string; name: string | null }
  /** AED 100 when validated, else 0. */
  merchant_incentive: number
  agent_incentive: number
}

export type MerchantPeriodFigures = {
  validated: number
  pending: number
  invalid: number
  merchant_incentive: number
  agent_incentive: number
}

export type MerchantFigures = {
  /** YYYY-MM of the current Dubai month. */
  month_key: string
  scans: { month: number; week: number; total: number }
  month: MerchantPeriodFigures
  last_month: MerchantPeriodFigures
  all_time: MerchantPeriodFigures
  /** The newest rentals first, up to 25. */
  recent: MerchantDeal[]
  statement: {
    month_key: string
    label: string
    validated: number
    merchant_amount: number
    agent_amount: number
    merchant_pay_date: string
    agent_pay_date: string
  }
}

/** The merchant record as the merchant and the admins see it (the IBAN never leaves the server in clear here). */
export type MerchantRecord = {
  id: string
  profile_id: string
  agent_id: string | null
  business_name: string
  category: string | null
  address: string | null
  emirate: string | null
  website: string | null
  signatory_name: string | null
  signatory_title: string | null
  emirates_id_number: string | null
  emirates_id_expires_on: string | null
  trade_licence_number: string | null
  trade_licence_authority: string | null
  trade_licence_expires_on: string | null
  bank_account_name: string | null
  bank_name: string | null
  /** "AE·· 4421" when an IBAN is saved, else null. */
  iban_masked: string | null
  voucher_offer: string | null
  code: string | null
  status: MerchantStatus
  submitted_at: string | null
  accepted_at: string | null
  declined_at: string | null
  decline_reason: string | null
  agreement_starts_on: string | null
  agreement_ends_on: string | null
  ended_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type MerchantPerson = {
  id: string
  name: string | null
  role: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  avatar_url: string | null
}

/** The checklist: which of the four requirements are in, and which are verified. */
export type MerchantChecklist = Record<MerchantDocumentKind, { present: boolean; verified: boolean; document: MerchantDocumentRow | null }>

export type MerchantQr = {
  /** The address inside the QR: https://fhiglobal.ae/m/<code>. Null until accepted. */
  url: string | null
  /** Where a scan is forwarded. */
  landing: string | null
}

/** GET /api/merchant/me */
export type MerchantMePayload = {
  merchant: MerchantRecord
  account: MerchantPerson
  agent: MerchantPerson | null
  documents: MerchantDocumentRow[]
  checklist: MerchantChecklist
  figures: MerchantFigures
  qr: MerchantQr
}

/** One row of an agent's "My merchants" or the admin list. */
export type MerchantListRow = {
  merchant: MerchantRecord
  account: MerchantPerson
  agent: MerchantPerson | null
  checklist: MerchantChecklist
  scans_month: number
  scans_total: number
  deals_month: number
  deals_total: number
  /** This month's validated deals × the rate, for the side the list is for. */
  merchant_incentive_month: number
  agent_incentive_month: number
}
