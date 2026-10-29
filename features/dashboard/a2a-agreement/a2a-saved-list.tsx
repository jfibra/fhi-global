"use client"

// "My saved agreements" on the A2A page (migration 082). Built for clarity
// over density: drafts ("not finished yet") are listed apart from completed
// agreements (finished with Save & Download Agreement PDF — status
// 'submitted'), so what's left to finish is obvious; every action is a
// labelled button; "How it works" explains the list in plain words. Admin
// staff can switch to every agent's completed agreements.

import { useState } from "react"
import { CheckCircle2, Clock, Eye, FolderOpen, HelpCircle, Loader2, Paperclip, PencilLine, Plus, Trash2 } from "lucide-react"
import type { A2AAgreementSummary } from "@/lib/a2a-agreements-service"
import { readablePartyNames } from "@/lib/a2a-agreements/shared"
import { A2AHelpDialog } from "./a2a-dialogs"

export type A2AListScope = "mine" | "everyone"

/** Rows shown per group before "Show all". */
const PAGE = 5

const fmtWhen = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
    : ""

const docsLabel = (n: number) => (n === 0 ? "No documents attached" : `${n} document${n === 1 ? "" : "s"} attached`)

function CreatorChip({ name, avatar }: { name: string; avatar: string | null }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#f3f4f6] py-0.5 pl-0.5 pr-2.5 text-xs font-medium text-[#4b5563]">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar host varies (Google/S3/legacy)
        <img src={avatar} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#001f3f] text-[9px] font-bold text-white">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="truncate">By {name}</span>
    </span>
  )
}

type RowProps = {
  userId: string
  isStaff: boolean
  showCreator: boolean
  currentId: string | null
  disabled: boolean
  onOpen: (row: A2AAgreementSummary) => void
  onDelete: (row: A2AAgreementSummary) => void
}

function AgreementRow({ row, userId, isStaff, showCreator, currentId, disabled, onOpen, onDelete }: RowProps & { row: A2AAgreementSummary }) {
  const own = row.created_by === userId
  const draft = row.status === "draft"
  const isCurrent = row.id === currentId
  const canDelete = (own && draft) || (isStaff && !draft)
  const title = readablePartyNames(row.party_names) || "Untitled draft (no names yet)"

  return (
    <li
      className={`flex flex-wrap items-center gap-x-5 gap-y-3 border bg-white p-4 ${
        isCurrent ? "border-[#001f3f] border-l-4 bg-[#f7f9fc]" : "border-[#e8eaed]"
      }`}
    >
      <div className="min-w-0 flex-1 basis-64">
        <p className="break-words font-['Outfit'] text-base font-bold text-[#0d1117]">{title}</p>
        <p className="mt-1 text-sm text-[#4b5563]">
          {draft ? `Last saved ${fmtWhen(row.updated_at)}` : `Completed ${fmtWhen(row.submitted_at)}`}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-[#6b7280]">
          <span className="inline-flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5" /> {docsLabel(row.file_count)}
          </span>
          {showCreator && row.creator_name && <CreatorChip name={row.creator_name} avatar={row.creator_avatar} />}
        </div>
      </div>

      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        {isCurrent ? (
          <span className="inline-flex flex-1 items-center justify-center gap-1.5 bg-[#001f3f] px-4 py-2.5 text-sm font-semibold text-white sm:flex-none">
            Open now
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onOpen(row)}
            disabled={disabled}
            className={`inline-flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-50 sm:flex-none ${
              own && draft
                ? "bg-[#001f3f] text-white hover:bg-[#0a3d6b]"
                : "border border-[#001f3f] bg-white text-[#001f3f] hover:bg-[#f7f9fc]"
            }`}
          >
            {own && draft ? <PencilLine className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {own && draft ? "Continue editing" : "View"}
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(row)}
            disabled={disabled}
            className="inline-flex items-center justify-center gap-1.5 border border-[#dfe3e8] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#6b7280] transition-colors hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        )}
      </div>
    </li>
  )
}

/** One status group — its heading says in words what the agreements in it are. */
function Group({
  kind,
  rows,
  ...rowProps
}: RowProps & { kind: "draft" | "submitted" | "everyone"; rows: A2AAgreementSummary[] }) {
  const [showAll, setShowAll] = useState(false)
  if (rows.length === 0) return null
  const visible = showAll ? rows : rows.slice(0, PAGE)
  const heading =
    kind === "draft"
      ? { icon: Clock, text: "Drafts — not finished yet", cls: "text-amber-700" }
      : kind === "submitted"
        ? { icon: CheckCircle2, text: "Completed", cls: "text-emerald-700" }
        : { icon: CheckCircle2, text: "Completed by agents", cls: "text-emerald-700" }
  const Icon = heading.icon

  return (
    <div>
      <p className={`mb-2 flex items-center gap-1.5 text-sm font-bold ${heading.cls}`}>
        <Icon className="h-4 w-4" /> {heading.text} ({rows.length})
      </p>
      <ul className="space-y-2">
        {visible.map((row) => (
          <AgreementRow key={row.id} row={row} {...rowProps} />
        ))}
      </ul>
      {rows.length > PAGE && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 text-sm font-semibold text-[#001f3f] hover:underline"
        >
          {showAll ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  )
}

export function A2ASavedList({
  rows,
  scope,
  onScope,
  isStaff,
  userId,
  currentId,
  disabled,
  onOpen,
  onDelete,
  onNew,
}: {
  /** The rows for the current scope; null while the first load runs. */
  rows: A2AAgreementSummary[] | null
  scope: A2AListScope
  onScope: (scope: A2AListScope) => void
  isStaff: boolean
  userId: string
  /** The agreement open in the form below, if it's saved. */
  currentId: string | null
  /** True while an upload or save runs — switching agreements would strand it. */
  disabled: boolean
  onOpen: (row: A2AAgreementSummary) => void
  onDelete: (row: A2AAgreementSummary) => void
  onNew: () => void
}) {
  const [helpOpen, setHelpOpen] = useState(false)
  const list = rows ?? []
  const rowProps: RowProps = { userId, isStaff, showCreator: scope === "everyone", currentId, disabled, onOpen, onDelete }

  return (
    <section className="bg-white border border-[#e8eaed] p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 basis-full sm:basis-auto">
          <h2 className="flex items-center gap-2 font-['Outfit'] text-lg font-bold text-[#001f3f]">
            <FolderOpen className="h-5 w-5 text-[#d6b357]" />
            {scope === "everyone" ? "All agents' completed agreements" : "My saved agreements"}
          </h2>
          <p className="mt-1 text-sm text-[#6b7280]">
            {scope === "everyone"
              ? "Every agreement an agent has completed, newest first."
              : "Drafts wait here until you finish them — come back anytime and press Continue editing."}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 border border-[#dfe3e8] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] sm:flex-none"
          >
            <HelpCircle className="h-4 w-4 text-[#d6b357]" /> How it works
          </button>
          <button
            type="button"
            onClick={onNew}
            disabled={disabled}
            className="inline-flex flex-1 items-center justify-center gap-1.5 bg-[#001f3f] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0a3d6b] disabled:opacity-50 sm:flex-none"
          >
            <Plus className="h-4 w-4 text-[#d6b357]" /> Start a new agreement
          </button>
        </div>
      </div>

      {isStaff && (
        <div className="mt-4 flex w-full border border-[#dfe3e8] bg-white p-0.5 sm:inline-flex sm:w-auto">
          {(["mine", "everyone"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onScope(s)}
              className={`flex-1 px-3 py-2 text-sm font-semibold leading-tight transition-colors sm:flex-none sm:px-4 ${
                scope === s ? "bg-[#001f3f] text-white" : "text-[#6b7280] hover:text-[#001f3f]"
              }`}
            >
              {s === "mine" ? "My agreements" : "All agents' completed"}
            </button>
          ))}
        </div>
      )}

      <span className="mb-4 mt-4 block h-px w-full bg-[#d6b357]" aria-hidden="true" />

      {rows === null ? (
        <div className="flex items-center gap-2 py-4 text-sm text-[#6b7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your agreements…
        </div>
      ) : list.length === 0 ? (
        <p className="py-2 text-[15px] leading-relaxed text-[#4b5563]">
          {scope === "everyone"
            ? "No agent has completed an agreement yet."
            : "Nothing saved yet. Fill in the form below, then press Save as draft — or Save & Download Agreement PDF when it's done. Your agreement will appear here."}
        </p>
      ) : scope === "everyone" ? (
        <Group kind="everyone" rows={list} {...rowProps} />
      ) : (
        <div className="space-y-6">
          <Group kind="draft" rows={list.filter((r) => r.status === "draft")} {...rowProps} />
          <Group kind="submitted" rows={list.filter((r) => r.status === "submitted")} {...rowProps} />
        </div>
      )}

      {helpOpen && <A2AHelpDialog isStaff={isStaff} onClose={() => setHelpOpen(false)} />}
    </section>
  )
}
