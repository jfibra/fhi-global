/**
 * Per-event custom registration fields.
 *
 * Shared by the admin field builder, the public form and the register API, so
 * one definition of "what is a valid field" and "what is a valid answer"
 * covers all three. Pure — no server-only imports — because the browser needs
 * it too.
 */

export const FIELD_TYPES = [
  "text",
  "textarea",
  "email",
  "tel",
  "number",
  "date",
  "select",
  "checkbox",
] as const

export type FieldType = (typeof FIELD_TYPES)[number]

export type RegistrationField = {
  /** Stable identifier used as the answers-bag key. Never reused or renamed. */
  key: string
  label: string
  type: FieldType
  required: boolean
  placeholder?: string
  /** select only */
  options?: string[]
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Short text",
  textarea: "Long text",
  email: "Email",
  tel: "Phone",
  number: "Number",
  date: "Date",
  select: "Dropdown",
  checkbox: "Yes / no",
}

/** Hard caps — a registration form is not a data warehouse. */
export const MAX_FIELDS = 20
export const MAX_OPTIONS = 30
const MAX_LABEL = 80
const MAX_ANSWER = 500
const MAX_TEXTAREA_ANSWER = 2000

/** "Company name" → "company_name"; falls back to a stable index-based key. */
export function fieldKeyFromLabel(label: string, index: number): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
  return slug || `field_${index + 1}`
}

/**
 * Coerce unknown input (admin form payload, or a stored jsonb value) into a
 * clean field list. Anything malformed is dropped rather than throwing — a
 * single bad entry must not take down an event page.
 */
export function parseRegistrationFields(raw: unknown): RegistrationField[] {
  if (!Array.isArray(raw)) return []
  const out: RegistrationField[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const r = item as Record<string, unknown>
    const label = typeof r.label === "string" ? r.label.trim().slice(0, MAX_LABEL) : ""
    if (!label) continue
    const type = FIELD_TYPES.includes(r.type as FieldType) ? (r.type as FieldType) : "text"
    let key = typeof r.key === "string" && r.key.trim() ? r.key.trim().slice(0, 40) : fieldKeyFromLabel(label, out.length)
    // Keys address the answers bag, so they have to be unique within an event.
    if (seen.has(key)) {
      let n = 2
      while (seen.has(`${key}_${n}`)) n++
      key = `${key}_${n}`
    }
    seen.add(key)
    const options =
      type === "select" && Array.isArray(r.options)
        ? r.options
            .map((o) => (typeof o === "string" ? o.trim().slice(0, 80) : ""))
            .filter(Boolean)
            .slice(0, MAX_OPTIONS)
        : undefined
    // A dropdown with no options cannot be answered — degrade to short text.
    const safeType: FieldType = type === "select" && (!options || options.length === 0) ? "text" : type
    out.push({
      key,
      label,
      type: safeType,
      required: r.required === true,
      ...(typeof r.placeholder === "string" && r.placeholder.trim()
        ? { placeholder: r.placeholder.trim().slice(0, 120) }
        : {}),
      ...(safeType === "select" && options ? { options } : {}),
    })
    if (out.length >= MAX_FIELDS) break
  }
  return out
}

/**
 * What the event form's field builder must fix before saving, keyed by field
 * key. The server would quietly drop a nameless field and turn a dropdown with
 * no choices into a short text box — the builder says so instead.
 */
export function fieldProblems(fields: RegistrationField[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of fields) {
    if (!f.label.trim()) out[f.key] = "Give this field a name — or remove it"
    else if (f.type === "select" && !(f.options ?? []).some((o) => o.trim()))
      out[f.key] = "Add at least one choice — a dropdown with no choices can't be answered"
  }
  return out
}

/**
 * The builder's fields as they should be saved. A NEW field (key not in
 * `savedKeys`, the keys the event had when the form opened) gets its readable
 * key here, from its label — not while it is typed, which remounted the row on
 * the first letter. It is made unique against every other field, so an
 * existing field always keeps its key (and its collected answers) even when a
 * new field with the same name sits above it. Choices are trimmed, emptied
 * rows dropped, duplicates removed (ignoring case) and capped.
 */
export function prepareFieldsForSave(fields: RegistrationField[], savedKeys: ReadonlySet<string>): RegistrationField[] {
  const taken = new Set(fields.filter((f) => savedKeys.has(f.key)).map((f) => f.key))
  return fields.map((f, i) => {
    let key = f.key
    if (!savedKeys.has(f.key)) {
      const base = fieldKeyFromLabel(f.label, i)
      key = base
      for (let n = 2; taken.has(key); n++) key = `${base}_${n}`
      taken.add(key)
    }
    const { options, ...rest } = f
    const field = { ...rest, key, label: f.label.trim() }
    return f.type === "select" ? { ...field, options: uniqueChoices(options ?? []) } : field
  })
}

/** Trimmed, non-empty, first spelling of each (ignoring case), at most MAX_OPTIONS. */
export function uniqueChoices(choices: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of choices) {
    const c = raw.trim()
    if (!c || seen.has(c.toLowerCase())) continue
    seen.add(c.toLowerCase())
    out.push(c)
  }
  return out.slice(0, MAX_OPTIONS)
}

export type AnswerValue = string | number | boolean

/**
 * Validate a submitted answers bag against the event's CURRENT field list.
 * Unknown keys are discarded (a field removed mid-campaign must not let
 * arbitrary data through), and required fields are enforced here rather than
 * trusting the browser.
 */
export function validateAnswers(
  fields: RegistrationField[],
  raw: unknown,
): { ok: true; answers: Record<string, AnswerValue> } | { ok: false; error: string } {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const answers: Record<string, AnswerValue> = {}

  for (const f of fields) {
    const v = input[f.key]

    if (f.type === "checkbox") {
      const checked = v === true || v === "true" || v === "on"
      if (f.required && !checked) return { ok: false, error: `Please confirm “${f.label}”` }
      // Only store a checkbox when ticked — an unticked optional box is noise.
      if (checked) answers[f.key] = true
      continue
    }

    const s = typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : ""
    if (!s) {
      if (f.required) return { ok: false, error: `Please fill in “${f.label}”` }
      continue
    }

    if (f.type === "number") {
      const n = Number(s)
      if (!Number.isFinite(n)) return { ok: false, error: `“${f.label}” must be a number` }
      answers[f.key] = n
      continue
    }
    if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) {
      return { ok: false, error: `“${f.label}” must be a valid email address` }
    }
    if (f.type === "select" && f.options && !f.options.includes(s)) {
      return { ok: false, error: `Please choose a valid option for “${f.label}”` }
    }
    answers[f.key] = s.slice(0, f.type === "textarea" ? MAX_TEXTAREA_ANSWER : MAX_ANSWER)
  }

  return { ok: true, answers }
}

/** Human-readable answer for tables and CSV exports. */
export function formatAnswer(value: AnswerValue | undefined | null): string {
  if (value === true) return "Yes"
  if (value === false || value == null || value === "") return ""
  return String(value)
}
