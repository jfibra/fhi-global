"use client"

import { useState, type ClipboardEvent, type KeyboardEvent } from "react"
import { AlertCircle, ChevronDown, ChevronUp, Eye, Plus, Trash2, X } from "lucide-react"
import {
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  MAX_FIELDS,
  MAX_OPTIONS,
  type FieldType,
  type RegistrationField,
} from "@/lib/events/fields"

/**
 * The event form's "Extra fields" builder — the questions an event's
 * registration form asks after name, email and WhatsApp.
 *
 * A field keeps the key it was created with while it is edited (a new one is
 * `field_<time>` until prepareFieldsForSave names it), so typing its name never
 * remounts the row — renaming the key on the first letter used to drop the
 * cursor after one character. Dropdown choices are one input per choice: the
 * old single comma-separated box was re-formatted on every key press, which ate
 * a typed comma and threw the cursor to the end (owner, 2026-11-13).
 */

const inputCls =
  "w-full px-3.5 py-2.5 border border-[#e5e5e5] bg-white text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] transition-colors"
const iconBtn = "p-1.5 text-[#6b7280] hover:bg-white hover:text-[#001f3f] disabled:opacity-30 disabled:hover:bg-transparent"

export function RegistrationFieldsEditor({
  fields,
  onChange,
  problems,
  onPreview,
}: {
  fields: RegistrationField[]
  onChange: (fields: RegistrationField[]) => void
  /** Message per field key — shown once a save has been tried (fieldProblems). */
  problems: Record<string, string>
  onPreview: () => void
}) {
  // The field (or its choices box) to focus once it renders.
  const [focusKey, setFocusKey] = useState<string | null>(null)

  const addField = () => {
    if (fields.length >= MAX_FIELDS) return
    const key = `field_${Date.now().toString(36)}`
    onChange([...fields, { key, label: "", type: "text", required: false }])
    setFocusKey(key)
  }
  const updateField = (index: number, patch: Partial<RegistrationField>) =>
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  const changeType = (index: number, type: FieldType) => {
    const f = fields[index]
    updateField(index, type === "select" ? { type, options: f.options ?? [] } : { type })
    if (type === "select") setFocusKey(`${f.key}:choices`)
  }
  const removeField = (index: number) => onChange(fields.filter((_, i) => i !== index))
  const moveField = (index: number, dir: -1 | 1) => {
    const to = index + dir
    if (to < 0 || to >= fields.length) return
    const next = [...fields]
    ;[next[index], next[to]] = [next[to], next[index]]
    onChange(next)
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="block text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-1.5">Extra fields</p>
          <p className="text-[11px] leading-relaxed text-[#9ca3af]">
            Shown on the registration form after name, email and WhatsApp. Safe to edit once the event is live —
            answers already collected are kept.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#e5e5e5] text-xs font-bold text-[#001f3f] hover:border-[#001f3f] transition-colors"
          >
            <Eye className="w-3.5 h-3.5" /> Preview form
          </button>
          <button
            type="button"
            onClick={addField}
            disabled={fields.length >= MAX_FIELDS}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#e5e5e5] text-xs font-bold text-[#374151] hover:border-[#001f3f] transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" /> Add field
          </button>
        </div>
      </div>

      {fields.length === 0 ? (
        <p className="text-[12px] text-[#9ca3af] border border-dashed border-[#e5e5e5] px-4 py-5 text-center">
          No extra fields. The form asks for name, email, WhatsApp and “Invited by”.
        </p>
      ) : (
        <div className="space-y-2.5">
          {fields.map((fl, i) => {
            const problem = problems[fl.key]
            return (
              <div
                key={fl.key}
                data-field-problem={problem ? "" : undefined}
                className={`border p-3 ${problem ? "border-rose-300 bg-rose-50/40" : "border-[#e5e5e5] bg-[#fafafa]"}`}
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={fl.label}
                    onChange={(e) => updateField(i, { label: e.target.value })}
                    placeholder="Field name (e.g. Company)"
                    aria-label={`Field ${i + 1} name`}
                    maxLength={80}
                    autoFocus={focusKey === fl.key}
                    className={`${inputCls} sm:flex-1`}
                  />
                  <select
                    value={fl.type}
                    onChange={(e) => changeType(i, e.target.value as FieldType)}
                    aria-label={`Field ${i + 1} type`}
                    className={`${inputCls} sm:w-44`}
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#374151] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={fl.required}
                      onChange={(e) => updateField(i, { required: e.target.checked })}
                      className="h-3.5 w-3.5"
                    />
                    Required
                  </label>
                  <div className="ml-auto flex items-center gap-0.5">
                    <button type="button" onClick={() => moveField(i, -1)} disabled={i === 0} className={iconBtn} aria-label="Move field up" title="Move up">
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => moveField(i, 1)} disabled={i === fields.length - 1} className={iconBtn} aria-label="Move field down" title="Move down">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => removeField(i)} className="p-1.5 text-rose-600 hover:bg-rose-50" aria-label="Remove field" title="Remove field">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {fl.type === "select" && (
                  <ChoicesEditor
                    choices={fl.options ?? []}
                    onChange={(options) => updateField(i, { options })}
                    autoFocus={focusKey === `${fl.key}:choices`}
                  />
                )}

                {problem && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-rose-700">
                    <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                    {problem}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * A dropdown's choices, one box each, plus an "Add a choice" box: Enter, the +
 * button, a typed comma or leaving the box adds what was typed; a pasted list
 * (commas or one per line) adds every item at once.
 */
function ChoicesEditor({
  choices,
  onChange,
  autoFocus,
}: {
  choices: string[]
  onChange: (choices: string[]) => void
  autoFocus: boolean
}) {
  const [draft, setDraft] = useState("")
  const [note, setNote] = useState<string | null>(null)
  const full = choices.length >= MAX_OPTIONS

  /** Append each new, non-empty choice; skip ones already listed (ignoring case). */
  const addChoices = (parts: string[]) => {
    const seen = new Set(choices.map((c) => c.trim().toLowerCase()))
    const next = [...choices]
    let skipped: string | null = null
    for (const raw of parts) {
      const c = raw.trim().slice(0, 80)
      if (!c) continue
      if (seen.has(c.toLowerCase())) {
        skipped = c
        continue
      }
      if (next.length >= MAX_OPTIONS) break
      seen.add(c.toLowerCase())
      next.push(c)
    }
    if (next.length !== choices.length) onChange(next)
    setNote(
      skipped
        ? `“${skipped}” is already in the list`
        : next.length >= MAX_OPTIONS
          ? `That's the most a dropdown can hold (${MAX_OPTIONS})`
          : null,
    )
  }

  const commitDraft = () => {
    if (!draft.trim()) return
    addChoices([draft])
    setDraft("")
  }

  const onDraftChange = (value: string) => {
    // A typed comma (or a new line) ends a choice; the rest keeps being typed.
    if (/[,\n]/.test(value)) {
      const parts = value.split(/[,\n]/)
      const rest = parts.pop() ?? ""
      addChoices(parts)
      setDraft(rest.trimStart())
      return
    }
    setNote(null)
    setDraft(value)
  }

  const onDraftPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text")
    if (!/[,\r\n]/.test(text)) return
    e.preventDefault()
    addChoices(`${draft},${text}`.split(/[,\r\n]+/))
    setDraft("")
  }

  const onDraftKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return
    e.preventDefault()
    commitDraft()
  }

  const editChoice = (index: number, value: string) => onChange(choices.map((c, i) => (i === index ? value : c)))
  const removeChoice = (index: number) => {
    setNote(null)
    onChange(choices.filter((_, i) => i !== index))
  }
  const moveChoice = (index: number, dir: -1 | 1) => {
    const to = index + dir
    if (to < 0 || to >= choices.length) return
    const next = [...choices]
    ;[next[index], next[to]] = [next[to], next[index]]
    onChange(next)
  }

  return (
    <div className="mt-3 border-t border-[#eceef1] pt-3">
      <p className="mb-2 text-xs font-semibold text-[#374151]">
        Choices <span className="font-normal text-[#9ca3af]">· {choices.length} of {MAX_OPTIONS}</span>
      </p>

      {choices.length > 0 && (
        <ol className="mb-2 space-y-1.5">
          {choices.map((c, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="w-5 shrink-0 text-right text-[11px] font-semibold text-[#9ca3af]">{i + 1}.</span>
              <input
                value={c}
                onChange={(e) => editChoice(i, e.target.value)}
                aria-label={`Choice ${i + 1}`}
                maxLength={80}
                className={`${inputCls} py-2`}
              />
              <button type="button" onClick={() => moveChoice(i, -1)} disabled={i === 0} className={iconBtn} aria-label={`Move “${c}” up`} title="Move up">
                <ChevronUp className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => moveChoice(i, 1)} disabled={i === choices.length - 1} className={iconBtn} aria-label={`Move “${c}” down`} title="Move down">
                <ChevronDown className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => removeChoice(i)} className="p-1.5 text-[#9ca3af] hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove “${c}”`} title="Remove choice">
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onPaste={onDraftPaste}
          onKeyDown={onDraftKeyDown}
          onBlur={commitDraft}
          disabled={full}
          autoFocus={autoFocus}
          placeholder={full ? "No more choices can be added" : choices.length ? "Add another choice…" : "Type a choice, then press Enter"}
          aria-label="Add a choice"
          maxLength={200}
          className={`${inputCls} py-2 disabled:bg-[#f5f5f5]`}
        />
        <button
          type="button"
          // Keep the box's focus so the next choice can be typed straight away.
          onMouseDown={(e) => e.preventDefault()}
          onClick={commitDraft}
          disabled={full || !draft.trim()}
          className="inline-flex shrink-0 items-center gap-1 border border-[#001f3f] bg-[#001f3f] px-3 text-xs font-bold text-white hover:bg-[#00356b] disabled:border-[#e5e5e5] disabled:bg-[#f5f5f5] disabled:text-[#9ca3af]"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      <p className={`mt-1.5 text-[11px] ${note ? "font-semibold text-amber-700" : "text-[#9ca3af]"}`}>
        {note ?? "Tip: paste a list — separated by commas or one per line — to add them all at once."}
      </p>
    </div>
  )
}
