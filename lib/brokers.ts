import type { DldRow } from "@/lib/dld-open-data"

/** A row of the `brokers` table (migration 085) — one RERA broker from the DLD register. */
export interface Broker {
  broker_number: number
  broker_en: string | null
  broker_ar: string | null
  gender_en: string | null
  /** ISO yyyy-mm-dd. */
  license_start_date: string | null
  license_end_date: string | null
  real_estate_number: string | null
  real_estate_en: string | null
  real_estate_ar: string | null
  phone: string | null
  fax: string | null
  webpage: string | null
  /** The full DLD row as returned. */
  data: DldRow
  fetched_at: string
}

export interface BrokerLookupResponse {
  broker: Broker
  /** saved = from the table; dld = just pulled; stale = DLD failed, old saved copy. */
  source: "saved" | "dld" | "stale"
}

function text(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s ? s : null
}

/** DLD dates arrive as ISO-ish strings; keep the calendar date only. */
function isoDate(v: unknown): string | null {
  const s = text(v)
  if (!s) return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  if (m) return m[1]
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

/** DLD register row → `brokers` columns (fetched_at is the caller's). */
export function toBroker(row: DldRow): Omit<Broker, "fetched_at"> {
  return {
    broker_number: Number(row.BROKER_NUMBER),
    broker_en: text(row.BROKER_EN),
    broker_ar: text(row.BROKER_AR),
    gender_en: text(row.GENDER_EN),
    license_start_date: isoDate(row.LICENSE_START_DATE),
    license_end_date: isoDate(row.LICENSE_END_DATE),
    real_estate_number: text(row.REAL_ESTATE_NUMBER),
    real_estate_en: text(row.REAL_ESTATE_EN),
    real_estate_ar: text(row.REAL_ESTATE_AR),
    phone: text(row.PHONE),
    fax: text(row.FAX),
    webpage: text(row.WEBPAGE),
    data: row,
  }
}
