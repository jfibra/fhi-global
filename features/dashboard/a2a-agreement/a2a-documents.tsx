"use client"

// The A2A page's document boxes (migration 082): each party's agency papers,
// the agreement's signed-on-paper copy, and any file left behind by a party
// that's no longer on the form. Presentational — the page owns the files, the
// uploads in flight and what happens on pick / remove.

import { AlertCircle, FileText, ImageIcon, Loader2, Paperclip, Plus, X } from "lucide-react"
import type { A2AAgreementFile } from "@/lib/a2a-agreements-service"
import {
  A2A_ACCEPT,
  A2A_DOC_LABELS,
  A2A_MAX_FILES_PER_SLOT,
  A2A_MAX_FILE_MB,
  A2A_PARTY_DOC_TYPES,
  type A2ADocType,
  type A2APartyKey,
} from "@/lib/a2a-agreements/shared"

/** One file on its way up: progress while uploading, the reason when it failed. */
export type A2AUpload = {
  key: string
  party: A2APartyKey | null
  docType: A2ADocType
  fileName: string
  progress: number
  error: string | null
}

type SlotHandlers = {
  canEdit: boolean
  onPick: (party: A2APartyKey | null, docType: A2ADocType, files: File[]) => void
  onRemove: (file: A2AAgreementFile) => void
  onDismiss: (key: string) => void
}

function fmtSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileRow({ file, canEdit, onRemove }: { file: A2AAgreementFile; canEdit: boolean; onRemove: (file: A2AAgreementFile) => void }) {
  return (
    <li className="flex items-center gap-2 border border-[#eef0f2] bg-white px-2.5 py-1.5">
      {file.file_type === "pdf" ? (
        <FileText className="h-3.5 w-3.5 shrink-0 text-rose-500" />
      ) : (
        <ImageIcon className="h-3.5 w-3.5 shrink-0 text-sky-600" />
      )}
      <a
        href={file.file_url}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open ${file.file_name}`}
        className="min-w-0 flex-1 truncate text-xs font-medium text-[#0d1117] hover:text-[#001f3f] hover:underline"
      >
        {file.file_name}
      </a>
      {file.file_size ? <span className="shrink-0 text-[10px] text-[#9ca3af]">{fmtSize(file.file_size)}</span> : null}
      {canEdit && (
        <button
          type="button"
          onClick={() => onRemove(file)}
          aria-label={`Remove ${file.file_name}`}
          className="shrink-0 text-[#9ca3af] hover:text-rose-500"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  )
}

function UploadRow({ upload, onDismiss }: { upload: A2AUpload; onDismiss: (key: string) => void }) {
  return (
    <li className="border border-[#eef0f2] bg-white px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        {upload.error ? (
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#001f3f]" />
        )}
        <span className="min-w-0 flex-1 truncate text-xs text-[#374151]">{upload.fileName}</span>
        {upload.error && (
          <button type="button" onClick={() => onDismiss(upload.key)} aria-label="Dismiss" className="shrink-0 text-[#9ca3af] hover:text-[#374151]">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {upload.error ? (
        <p className="mt-0.5 text-[11px] leading-snug text-rose-600">{upload.error}</p>
      ) : (
        <div className="mt-1 h-1 w-full overflow-hidden bg-[#e5e7eb]">
          <div className="h-full bg-[#001f3f] transition-all" style={{ width: `${upload.progress}%` }} />
        </div>
      )}
    </li>
  )
}

/** One box: its label, the files in it, uploads on their way, and Attach while there's room. */
function DocumentSlot({
  party,
  docType,
  files,
  uploads,
  canEdit,
  onPick,
  onRemove,
  onDismiss,
}: SlotHandlers & {
  party: A2APartyKey | null
  docType: A2ADocType
  files: A2AAgreementFile[]
  uploads: A2AUpload[]
}) {
  const { label, hint } = A2A_DOC_LABELS[docType]
  const room = A2A_MAX_FILES_PER_SLOT - files.length - uploads.filter((u) => !u.error).length
  return (
    <div className={`border p-3.5 ${files.length > 0 ? "border-emerald-200 bg-emerald-50/30" : "border-[#e8eaed] bg-[#fafbfc]"}`}>
      <p className="text-[13px] font-bold text-[#0d1117]">{label}</p>
      <p className="text-[11px] leading-snug text-[#6b7280]">{hint}</p>

      {(files.length > 0 || uploads.length > 0) && (
        <ul className="mt-2.5 space-y-1.5">
          {files.map((f) => (
            <FileRow key={f.id} file={f} canEdit={canEdit} onRemove={onRemove} />
          ))}
          {uploads.map((u) => (
            <UploadRow key={u.key} upload={u} onDismiss={onDismiss} />
          ))}
        </ul>
      )}

      {canEdit
        ? room > 0 && (
            <label className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 border border-dashed border-[#c4c9cf] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]">
              {files.length > 0 ? <Plus className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
              {files.length > 0 ? "Add another" : "Attach"}
              <input
                type="file"
                multiple
                accept={A2A_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? [])
                  e.target.value = ""
                  if (picked.length > 0) onPick(party, docType, picked)
                }}
              />
            </label>
          )
        : files.length === 0 && <p className="mt-2.5 text-[11px] text-[#9ca3af]">Not attached</p>}
    </div>
  )
}

/** "Agency documents (optional)" — the six boxes at the end of a party's section. */
export function A2APartyDocuments({
  party,
  files,
  uploads,
  ...handlers
}: SlotHandlers & { party: A2APartyKey; files: A2AAgreementFile[]; uploads: A2AUpload[] }) {
  const mine = files.filter((f) => f.party === party)
  return (
    <div className="mt-6 border-t border-[#f0f2f5] pt-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#374151]">
          Agency documents <span className="font-semibold normal-case tracking-normal text-[#9ca3af]">(optional)</span>
        </h3>
        {handlers.canEdit && (
          <p className="text-[11px] text-[#9ca3af]">JPG, PNG or PDF · up to {A2A_MAX_FILE_MB} MB each</p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {A2A_PARTY_DOC_TYPES.map((docType) => (
          <DocumentSlot
            key={docType}
            party={party}
            docType={docType}
            files={mine.filter((f) => f.doc_type === docType)}
            uploads={uploads.filter((u) => u.party === party && u.docType === docType)}
            {...handlers}
          />
        ))}
      </div>
    </div>
  )
}

/** Under the signatures: the agreement signed on paper. Hidden on a read-only view without one. */
export function A2ASignedCopy({
  files,
  uploads,
  ...handlers
}: SlotHandlers & { files: A2AAgreementFile[]; uploads: A2AUpload[] }) {
  const copies = files.filter((f) => f.doc_type === "signed_copy")
  if (!handlers.canEdit && copies.length === 0) return null
  return (
    <div className="mt-6 border-t border-[#f0f2f5] pt-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[#374151]">Signed on paper?</h3>
      <p className="mb-3 mt-1 text-xs text-[#6b7280]">
        Download the PDF, sign it by hand, then attach a scan or photo here so it stays with this agreement.
      </p>
      <div className="max-w-sm">
        <DocumentSlot
          party={null}
          docType="signed_copy"
          files={copies}
          uploads={uploads.filter((u) => u.docType === "signed_copy")}
          {...handlers}
        />
      </div>
    </div>
  )
}

/** Files saved for a party that's no longer on the form (e.g. Party C removed in another tab). */
export function A2AOrphanDocuments({
  files,
  canEdit,
  onRemove,
}: {
  files: A2AAgreementFile[]
  canEdit: boolean
  onRemove: (file: A2AAgreementFile) => void
}) {
  if (files.length === 0) return null
  return (
    <section className="border border-amber-200 bg-amber-50/50 p-4 sm:p-6">
      <h2 className="font-['Outfit'] text-base font-bold text-[#001f3f]">Other documents</h2>
      <p className="mb-4 mt-1 text-xs text-[#6b7280]">
        These were attached for a party who is no longer on this agreement.
      </p>
      <ul className="max-w-lg space-y-1.5">
        {files.map((f) => (
          <FileRow key={f.id} file={f} canEdit={canEdit} onRemove={onRemove} />
        ))}
      </ul>
    </section>
  )
}
