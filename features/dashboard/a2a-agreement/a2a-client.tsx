"use client"

// Agent-to-Agent (A2A) Collaboration Agreement — fill the form, sign on screen,
// attach each agency's documents. Two actions, as plain as the old page's one:
//   · Save as draft — not finished, keep it for later;
//   · Save & Download Agreement PDF — done: saves it as Completed (status
//     'submitted'; admin staff can see it) and downloads the branded PDF.
// Both sit side by side in the bar pinned to the bottom of the screen; a
// completed agreement's bar offers Edit again and Download Agreement PDF.
// Saved agreements live in a2a_agreements (migration 082): drafts are private
// to their creator. Every write goes through app/api/a2a-agreements (the
// tables have no write policies). The PDF is still built in the browser from
// the form. The form itself lives in ./a2a-form, which Record Your Sale embeds.
//
// Saving rules that keep a draft from splitting or going stale:
//   · one create at a time — the first attachment, Save and Save & Download all share
//     the in-flight create (createRef), so a fast double action can't make two;
//   · a save response never overwrites the form, so typing during it survives;
//   · unsaved = rev !== savedRev, where each save records the rev it started from;
//   · formKey changes only when another agreement is loaded (or Edit again), so
//     the signature fields remount and show saved signatures, not blank pads.

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole } from "@/lib/app-roles"
import { type A2AInput, type A2AParty, buildA2APdfBlob, downloadBlob } from "@/lib/a2a-agreement"
import {
  A2A_MAX_FILES_PER_SLOT,
  missingForSubmit,
  partyNames,
  readablePartyNames,
  type A2ADocType,
  type A2APartyKey,
  type A2ARequiredField,
} from "@/lib/a2a-agreements/shared"
import {
  createA2AAgreement,
  deleteA2AAgreement,
  deleteA2ADocument,
  deleteA2APartyDocuments,
  fetchA2AAgreement,
  fetchMyA2AAgreements,
  fetchSubmittedA2AAgreements,
  saveA2AAgreement,
  submitA2AAgreement,
  withdrawA2AAgreement,
  type A2AAgreementFile,
  type A2AAgreementMeta,
  type A2AAgreementStatus,
  type A2AAgreementSummary,
  type A2AWriteResult,
} from "@/lib/a2a-agreements-service"
import { a2aFileProblem, uploadA2ADocument } from "@/lib/a2a-agreements/upload-client"
import { SaleConfirmDialog } from "@/features/dashboard/sales/sale-confirm-dialog"
import { A2AFormFields, todayLocal } from "./a2a-form"
import { A2AOrphanDocuments, A2APartyDocuments, A2ASignedCopy, type A2AUpload } from "./a2a-documents"
import { A2ASavedDialog } from "./a2a-dialogs"
import { A2ASavedList, type A2AListScope } from "./a2a-saved-list"
import { A2ASaveBar, A2AStatusStrip, type A2ABusy, type A2AFormState } from "./a2a-status"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Headroom under the database's 1.5 MB cap on the stored agreement. */
const MAX_PAYLOAD_CHARS = 1_400_000

const emptyParty = (): A2AParty => ({
  fullName: "", agency: "", brn: "", orn: "", phone: "", email: "",
  signatureDataUrl: undefined, signedName: "", signedDate: "",
})

const emptyAgreement = (): A2AInput => ({
  date: todayLocal(),
  partyA: emptyParty(),
  partyB: emptyParty(),
  scope: "",
  propertyRef: "",
  clientName: "",
  splitA: "50",
  splitB: "50",
  noticePeriodDays: "30",
  validUntil: "",
})

/** The agreement in the form: unsaved (id null), a draft, or completed (status 'submitted'). */
type Current = {
  id: string | null
  status: A2AAgreementStatus
  createdBy: string | null
  savedAt: string | null
  submittedAt: string | null
}
const NEW_AGREEMENT: Current = { id: null, status: "draft", createdBy: null, savedAt: null, submittedAt: null }

const toCurrent = (meta: A2AAgreementMeta): Current => ({
  id: meta.id,
  status: meta.status,
  createdBy: meta.created_by,
  savedAt: meta.updated_at,
  submittedAt: meta.submitted_at,
})

function readIdFromUrl(): string | null {
  if (typeof window === "undefined") return null
  const id = new URLSearchParams(window.location.search).get("id")
  return id && UUID_RE.test(id) ? id : null
}

/** Keep ?id= in step with the open agreement, so a reload or a shared link reopens it. */
function syncUrl(id: string | null) {
  const params = new URLSearchParams(window.location.search)
  if (id) params.set("id", id)
  else params.delete("id")
  const qs = params.toString()
  window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
}

export function A2AClient() {
  const { user, role } = useAuth()
  const userId = user?.id ?? ""
  const isStaff = isAdminStaffRole(role)

  const [initialId] = useState(readIdFromUrl)
  const [current, setCurrent] = useState<Current>(NEW_AGREEMENT)
  const [value, setValue] = useState<A2AInput>(emptyAgreement)
  const [files, setFiles] = useState<A2AAgreementFile[]>([])
  const [uploads, setUploads] = useState<A2AUpload[]>([])
  const [formKey, setFormKey] = useState(0)
  const [rev, setRev] = useState(0)
  const [savedRev, setSavedRev] = useState(0)
  const [busy, setBusy] = useState<A2ABusy>(null)
  const [opening, setOpening] = useState(Boolean(initialId))
  const [error, setError] = useState<string | null>(null)
  // Save feedback where the button is: the bar's status line flashes "Draft
  // saved", a failed save says why, and the first save / a submit confirms in
  // a pop-up so nobody wonders where their work went.
  const [justSaved, setJustSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedDialog, setSavedDialog] = useState<"draft" | "completed" | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Set<A2ARequiredField>>(() => new Set())
  const [mine, setMine] = useState<A2AAgreementSummary[] | null>(null)
  const [everyone, setEveryone] = useState<A2AAgreementSummary[] | null>(null)
  const [scope, setScope] = useState<A2AListScope>("mine")
  const [pendingDelete, setPendingDelete] = useState<A2AAgreementSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  // The form's source of truth for async work: saves read the latest value and
  // rev from here, not from a render that may be a keystroke behind.
  const valueRef = useRef(value)
  const revRef = useRef(0)
  const currentIdRef = useRef<string | null>(null)
  const createRef = useRef<Promise<string | null> | null>(null)

  // Scroll targets for the required fields, so a failed download or submit
  // jumps the user straight to the first thing that needs filling in.
  const partyANameRef = useRef<HTMLInputElement>(null)
  const partyBNameRef = useRef<HTMLInputElement>(null)
  const partyCNameRef = useRef<HTMLInputElement>(null)
  const scopeRef = useRef<HTMLDivElement>(null)
  const formTopRef = useRef<HTMLDivElement>(null)

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current)
    },
    [],
  )
  /** "Draft saved" lights up in the bar (and on the Save button) for a few seconds. */
  const flashSaved = () => {
    setJustSaved(true)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setJustSaved(false), 3000)
  }

  const dirty = rev !== savedRev
  const isMine = current.id === null || current.createdBy === userId
  const formEditable = isMine && current.status === "draft"
  const docsEditable = isMine
  const uploading = uploads.some((u) => !u.error)
  /** Switching agreements now would strand an upload or a save. */
  const locked = uploading || busy !== null || opening

  /** Every edit goes through here: it moves the form forward one revision. */
  const edit = useCallback((fn: (v: A2AInput) => A2AInput) => {
    const next = fn(valueRef.current)
    valueRef.current = next
    setValue(next)
    revRef.current += 1
    setRev(revRef.current)
  }, [])

  /** Put an agreement (or a blank form) in the form — a load, not an edit. */
  const show = useCallback((next: Current, data: A2AInput, nextFiles: A2AAgreementFile[]) => {
    currentIdRef.current = next.id
    setCurrent(next)
    valueRef.current = data
    setValue(data)
    setSavedRev(revRef.current)
    setRev(revRef.current)
    setFiles(nextFiles)
    setUploads([])
    setError(null)
    setSaveError(null)
    setJustSaved(false)
    setFieldErrors(new Set())
    setFormKey((k) => k + 1)
    syncUrl(next.id)
  }, [])

  const loadLists = useCallback(
    () =>
      Promise.all([
        fetchMyA2AAgreements(userId),
        isStaff ? fetchSubmittedA2AAgreements() : Promise.resolve(null),
      ]),
    [userId, isStaff],
  )
  const applyLists = useCallback(([own, submitted]: Awaited<ReturnType<typeof loadLists>>) => {
    if (own.error) toast.error(own.error)
    setMine(own.data)
    if (submitted) setEveryone(submitted.data)
  }, [])
  const refreshLists = useCallback(() => {
    if (userId) void loadLists().then(applyLists)
  }, [userId, loadLists, applyLists])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void loadLists().then((lists) => {
      if (!cancelled) applyLists(lists)
    })
    return () => {
      cancelled = true
    }
  }, [userId, loadLists, applyLists])

  // ?id= on arrival: open that agreement (a reload, or a link to it).
  useEffect(() => {
    if (!initialId) return
    let cancelled = false
    void fetchA2AAgreement(initialId).then((res) => {
      if (cancelled) return
      if (res.data) show(toCurrent(res.data.agreement), res.data.agreement.data, res.data.files)
      else {
        toast.error(res.error ?? "That agreement isn't available.")
        syncUrl(null)
      }
      setOpening(false)
    })
    return () => {
      cancelled = true
    }
  }, [initialId, show])

  // Closing the tab with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [dirty])

  // Leaving through the sidebar or a breadcrumb is an in-app link, which
  // beforeunload never sees — ask before unsaved work is dropped. Captured on
  // the document, so it runs ahead of the link's own navigation.
  useEffect(() => {
    if (!dirty) return
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const link = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return
      const url = new URL(link.href, window.location.href)
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return
      if (!window.confirm("You have unsaved changes on this agreement. Leave without saving?")) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [dirty])

  const clearFieldError = (key: A2ARequiredField) => {
    setFieldErrors((prev) => {
      if (!prev.has(key)) return prev
      const next = new Set(prev)
      next.delete(key)
      return next
    })
    setError(null)
  }

  /** Highlight what's missing, say so, and jump to the first one. */
  const showMissing = (missing: A2ARequiredField[]) => {
    const invalid = new Set(missing)
    setFieldErrors(invalid)
    const needs: string[] = []
    if (invalid.has("partyA.fullName") || invalid.has("partyB.fullName") || invalid.has("partyC.fullName")) {
      needs.push(`a full name for ${valueRef.current.partyC ? "every party" : "both parties"}`)
    }
    if (invalid.has("scope")) needs.push("a scope of collaboration")
    setError(`Please add ${needs.join(" and ")} before downloading.`)

    const first = invalid.has("partyA.fullName")
      ? partyANameRef.current
      : invalid.has("partyB.fullName")
        ? partyBNameRef.current
        : invalid.has("partyC.fullName")
          ? partyCNameRef.current
          : scopeRef.current
    if (first) {
      first.scrollIntoView({ behavior: "smooth", block: "center" })
      const focusTarget = first instanceof HTMLInputElement ? first : first.querySelector<HTMLElement>("button")
      focusTarget?.focus({ preventScroll: true })
    }
  }

  const applySaved = (meta: A2AAgreementMeta, startRev: number) => {
    currentIdRef.current = meta.id
    setCurrent(toCurrent(meta))
    setSavedRev(startRev)
    syncUrl(meta.id)
  }

  /** Reload the open agreement from the server (after a conflict) — local edits can't be saved anyway. */
  const reopen = async (id: string) => {
    const res = await fetchA2AAgreement(id)
    if (res.data) show(toCurrent(res.data.agreement), res.data.agreement.data, res.data.files)
  }

  const reportWriteError = (res: A2AWriteResult) => {
    if (res.missing?.length) {
      showMissing(res.missing)
      return
    }
    // Said in the save bar, beside the button that was pressed.
    const message = res.error ?? "Couldn't save — check your internet connection and try again."
    // 409: the agreement moved on (another tab) — show it as it really is,
    // then the reason (reloading clears the bar, so it goes in after).
    if (res.status && currentIdRef.current) {
      void reopen(currentIdRef.current).then(() => setSaveError(message))
      return
    }
    setSaveError(message)
  }

  /** Create the record once; concurrent callers (attachments, Save, Save & Download) share one request. */
  const createOnce = (snapshot: A2AInput, startRev: number, submit: boolean): Promise<string | null> => {
    if (!createRef.current) {
      createRef.current = (async () => {
        const res = await createA2AAgreement(snapshot, submit)
        if (!res.data) {
          reportWriteError(res)
          return null
        }
        applySaved(res.data, startRev)
        return res.data.id
      })().finally(() => {
        createRef.current = null
      })
    }
    return createRef.current
  }

  const tooLarge = (v: A2AInput) => {
    if (JSON.stringify(v).length <= MAX_PAYLOAD_CHARS) return false
    setSaveError("This agreement is too large to save — clear a signature and sign it again.")
    return true
  }

  /** Save or submit what's in the form now: a create the first time, an update after. */
  const persist = async (mode: "save" | "submit"): Promise<boolean> => {
    const startRev = revRef.current
    const snapshot = valueRef.current
    if (tooLarge(snapshot)) return false
    if (!currentIdRef.current) {
      const joining = Boolean(createRef.current)
      const id = await createOnce(snapshot, startRev, mode === "submit")
      if (!id) return false
      // Our own create carried this snapshot (and the submit); a joined one didn't.
      if (!joining) return true
    }
    const id = currentIdRef.current
    if (!id) return false
    const res = mode === "submit" ? await submitA2AAgreement(id, snapshot) : await saveA2AAgreement(id, snapshot)
    if (!res.data) {
      reportWriteError(res)
      return false
    }
    applySaved(res.data, startRev)
    return true
  }

  /** The record an attachment belongs to — saving the agreement as a draft first if it's new. */
  const ensureSaved = async (): Promise<string | null> => {
    if (currentIdRef.current) return currentIdRef.current
    if (tooLarge(valueRef.current)) return null
    const joining = Boolean(createRef.current)
    const id = await createOnce(valueRef.current, revRef.current, false)
    if (id && !joining) {
      // The bar says "Draft saved" — the documents now have a record to belong to.
      flashSaved()
      void refreshLists()
    }
    return id
  }

  const saveDraft = async () => {
    if (!formEditable || busy) return
    setError(null)
    setSaveError(null)
    const firstSave = !currentIdRef.current
    setBusy("save")
    const ok = await persist("save")
    setBusy(null)
    if (ok) {
      flashSaved()
      // The first time only: say plainly where the draft lives now.
      if (firstSave) setSavedDialog("draft")
      void refreshLists()
    }
  }

  /** The PDF as the page always built it: the agreement date stamped on every unsigned date. */
  const pdfFor = (v: A2AInput) => {
    const stamp = v.date || todayLocal()
    return {
      input: {
        ...v,
        date: stamp,
        partyA: { ...v.partyA, signedDate: v.partyA.signedDate || stamp },
        partyB: { ...v.partyB, signedDate: v.partyB.signedDate || stamp },
        ...(v.partyC ? { partyC: { ...v.partyC, signedDate: v.partyC.signedDate || stamp } } : {}),
      },
      filename: `A2A-Agreement-${[v.partyA.fullName || "party-a", v.partyB.fullName || "party-b", ...(v.partyC ? [v.partyC.fullName || "party-c"] : [])].map((n) => n.replace(/\s+/g, "-")).join("-")}.pdf`,
    }
  }

  /**
   * "Save & Download Agreement PDF" — the agreement is finished: build the PDF,
   * save the agreement as Completed (admin staff see completed agreements),
   * then hand over the file. The PDF downloads even if saving fails, as it
   * always did; the bar then says it wasn't saved, so they can press again.
   */
  const finish = async () => {
    if (!formEditable || busy) return
    const v = valueRef.current
    const missing = missingForSubmit(v)
    if (missing.length > 0) {
      showMissing(missing)
      return
    }
    setError(null)
    setSaveError(null)
    setFieldErrors(new Set())
    setBusy("complete")
    try {
      const { input, filename } = pdfFor(v)
      let blob: Blob
      try {
        blob = await buildA2APdfBlob(input)
      } catch (err) {
        setError((err as Error).message || "Could not build the PDF.")
        return
      }
      const saved = await persist("submit")
      downloadBlob(blob, filename)
      if (saved) {
        setSavedDialog("completed")
        void refreshLists()
      } else {
        setSaveError(
          (reason) =>
            `The PDF downloaded, but the agreement wasn't saved. ${reason ?? "Check your internet connection, then press Save & Download Agreement PDF again."}`,
        )
      }
    } finally {
      setBusy(null)
    }
  }

  const editAgain = async () => {
    const id = currentIdRef.current
    if (!id || busy || uploading) return
    if (!window.confirm("Change this completed agreement? It becomes a draft again until you press Save & Download Agreement PDF.")) return
    setSaveError(null)
    setBusy("withdraw")
    const res = await withdrawA2AAgreement(id)
    setBusy(null)
    if (!res.data) {
      reportWriteError(res)
      return
    }
    applySaved(res.data, revRef.current)
    // Remount so the signature fields show the saved signatures, not empty pads.
    setFormKey((k) => k + 1)
    void refreshLists()
  }

  /** A completed agreement (or someone else's): just the PDF again — nothing to save. */
  const download = async () => {
    if (busy) return
    setError(null)
    setBusy("download")
    try {
      const { input, filename } = pdfFor(valueRef.current)
      downloadBlob(await buildA2APdfBlob(input), filename)
    } catch (err) {
      setError((err as Error).message || "Could not build the PDF.")
    } finally {
      setBusy(null)
    }
  }

  const confirmDiscard = () => !dirty || window.confirm("Discard the changes you haven't saved?")

  const openAgreement = async (row: A2AAgreementSummary) => {
    if (locked || row.id === current.id || !confirmDiscard()) return
    setOpening(true)
    const res = await fetchA2AAgreement(row.id)
    setOpening(false)
    if (!res.data) {
      toast.error(res.error ?? "That agreement isn't available.")
      return
    }
    show(toCurrent(res.data.agreement), res.data.agreement.data, res.data.files)
    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const startNew = () => {
    if (locked || !confirmDiscard()) return
    show(NEW_AGREEMENT, emptyAgreement(), [])
  }

  const runDelete = async () => {
    const row = pendingDelete
    if (!row) return
    setDeleting(true)
    const res = await deleteA2AAgreement(row.id)
    setDeleting(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    setPendingDelete(null)
    toast.success("Agreement deleted.")
    if (row.id === currentIdRef.current) show(NEW_AGREEMENT, emptyAgreement(), [])
    void refreshLists()
  }

  const attach = async (party: A2APartyKey | null, docType: A2ADocType, picked: File[]) => {
    if (!docsEditable) return
    const valid: File[] = []
    for (const file of picked) {
      const problem = a2aFileProblem(file)
      if (problem) toast.error(problem)
      else valid.push(file)
    }
    if (valid.length === 0) return
    const used =
      files.filter((f) => f.party === party && f.doc_type === docType).length +
      uploads.filter((u) => !u.error && u.party === party && u.docType === docType).length
    const room = A2A_MAX_FILES_PER_SLOT - used
    if (room <= 0) {
      toast.error(`This box already has ${A2A_MAX_FILES_PER_SLOT} files.`)
      return
    }
    if (valid.length > room) toast(`Only ${room} more file${room === 1 ? "" : "s"} fit in this box — the rest were left out.`)

    // Show the rows straight away (they also lock Party C / Delete / switching).
    const batch = valid.slice(0, room).map((file) => ({
      file,
      key: crypto.randomUUID(),
    }))
    setUploads((u) => [
      ...u,
      ...batch.map(({ file, key }) => ({ key, party, docType, fileName: file.name, progress: 0, error: null })),
    ])
    const id = await ensureSaved()
    if (!id) {
      setUploads((u) => u.filter((x) => !batch.some((b) => b.key === x.key)))
      return
    }
    // One at a time per box, so the server's per-box cap sees each file.
    for (const { file, key } of batch) {
      const res = await uploadA2ADocument(id, party, docType, file, (pct) =>
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress: pct } : x))),
      )
      if (res.data) {
        const added = res.data
        // Saved with the agreement it was picked for, even if another is open now.
        if (currentIdRef.current === id) setFiles((f) => [...f, added])
        setUploads((u) => u.filter((x) => x.key !== key))
      } else {
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: res.error ?? "Upload failed." } : x)))
      }
    }
    void refreshLists()
  }

  const removeFile = async (file: A2AAgreementFile) => {
    if (!window.confirm(`Remove "${file.file_name}"?`)) return
    const res = await deleteA2ADocument(file.agreement_id, file.id)
    if (res.error) {
      toast.error(res.error)
      return
    }
    setFiles((f) => f.filter((x) => x.id !== file.id))
    void refreshLists()
  }

  const dismissUpload = (key: string) => setUploads((u) => u.filter((x) => x.key !== key))

  // A third agent on the deal. Adding one re-splits an untouched 50/50 three
  // ways; removing one puts it back. Typed splits are left alone.
  const addPartyC = () =>
    edit((v) => ({
      ...v,
      partyC: emptyParty(),
      ...(v.splitA === "50" && v.splitB === "50" ? { splitA: "34", splitB: "33", splitC: "33" } : { splitC: v.splitC ?? "0" }),
    }))

  const removePartyC = async () => {
    if (locked) return
    const id = currentIdRef.current
    const cFiles = files.filter((f) => f.party === "C")
    if (id && cFiles.length > 0) {
      if (!window.confirm(`Remove Party C and their ${cFiles.length} document${cFiles.length === 1 ? "" : "s"}?`)) return
      setBusy("party")
      const res = await deleteA2APartyDocuments(id, "C")
      setBusy(null)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setFiles((f) => f.filter((x) => x.party !== "C"))
      void refreshLists()
    }
    edit((v) => {
      const { partyC: _dropped, splitC, ...rest } = v
      void _dropped
      const untouched = v.splitA === "34" && v.splitB === "33" && splitC === "33"
      return { ...rest, ...(untouched ? { splitA: "50", splitB: "50" } : {}) }
    })
  }

  const handlers = { canEdit: docsEditable, onPick: attach, onRemove: removeFile, onDismiss: dismissUpload }
  const orphans = files.filter((f) => f.party === "C" && !value.partyC)
  const listRows = scope === "everyone" ? everyone : mine
  const creatorName = !isMine ? everyone?.find((r) => r.id === current.id)?.creator_name : null
  const title = readablePartyNames(partyNames(value))
  const formState: A2AFormState =
    current.status === "submitted"
      ? { kind: "submitted", submittedAt: current.submittedAt, mine: isMine, by: creatorName }
      : current.id
        ? { kind: "draft", savedAt: current.savedAt }
        : { kind: "new" }
  const deleteOpenAgreement = () => {
    const row = everyone?.find((r) => r.id === current.id)
    if (row) setPendingDelete(row)
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="bg-[#001f3f] p-5 sm:p-8">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357]">Agent Resource</p>
        <h1 className="font-['Outfit'] text-xl font-bold tracking-tight text-white sm:text-2xl">
          Agent-to-Agent (A2A) Collaboration Agreement
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
          Fill in the agreement, attach each agency&apos;s documents and sign on screen. Not finished? Press Save as draft
          and come back later. Done? Press Save &amp; Download Agreement PDF — the agreement is kept, and the FHI admin team
          can see it.
        </p>
      </div>

      <A2ASavedList
        rows={listRows}
        scope={scope}
        onScope={setScope}
        isStaff={isStaff}
        userId={userId}
        currentId={current.id}
        disabled={locked}
        onOpen={(row) => void openAgreement(row)}
        onDelete={setPendingDelete}
        onNew={startNew}
      />

      {/* Which agreement the form below holds, and its state. */}
      <div ref={formTopRef} className="scroll-mt-6">
        {!opening && <A2AStatusStrip state={formState} title={title} />}
      </div>

      {error && (
        <p className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      {opening ? (
        <div className="flex items-center gap-2 border border-[#e8eaed] bg-white px-6 py-10 text-sm text-[#6b7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening the agreement…
        </div>
      ) : (
        <>
          <A2AFormFields
            key={formKey}
            value={value}
            readOnly={!formEditable}
            onChange={(patch) => edit((v) => ({ ...v, ...patch }))}
            onPartyChange={(which: A2APartyKey, patch) =>
              edit((v) =>
                which === "A"
                  ? { ...v, partyA: { ...v.partyA, ...patch } }
                  : which === "B"
                    ? { ...v, partyB: { ...v.partyB, ...patch } }
                    : { ...v, partyC: { ...(v.partyC ?? emptyParty()), ...patch } },
              )
            }
            onAddPartyC={addPartyC}
            onRemovePartyC={() => void removePartyC()}
            partyCLocked={locked}
            fieldErrors={fieldErrors}
            onClearFieldError={clearFieldError}
            refs={{ partyAName: partyANameRef, partyBName: partyBNameRef, partyCName: partyCNameRef, scope: scopeRef }}
            partyExtras={(party) => <A2APartyDocuments party={party} files={files} uploads={uploads} {...handlers} />}
            signatureExtras={<A2ASignedCopy files={files} uploads={uploads} {...handlers} />}
          />
          <A2AOrphanDocuments files={orphans} canEdit={docsEditable} onRemove={(f) => void removeFile(f)} />

          {/* Save status + the actions — Save as draft and Save & Download Agreement PDF
              (or Edit again / Download / Delete once completed) — pinned to the
              bottom of the screen while the form scrolls. */}
          <A2ASaveBar
            state={formState}
            dirty={dirty}
            busy={busy}
            justSaved={justSaved}
            error={saveError}
            canEdit={formEditable}
            canEditAgain={current.status === "submitted" && isMine}
            canDelete={!isMine && isStaff && current.status === "submitted" && Boolean(current.id)}
            onSave={() => void saveDraft()}
            onFinish={() => void finish()}
            onDownload={() => void download()}
            onEditAgain={() => void editAgain()}
            onDelete={deleteOpenAgreement}
          />
        </>
      )}

      {pendingDelete && (
        <SaleConfirmDialog
          title="Delete agreement"
          message={`This permanently removes "${readablePartyNames(pendingDelete.party_names) || "Untitled draft"}" and its ${pendingDelete.file_count} document${pendingDelete.file_count === 1 ? "" : "s"}. This cannot be undone.`}
          confirmLabel="Hold to delete"
          tone="danger"
          hold
          busy={deleting}
          onConfirm={() => void runDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {savedDialog && (
        <A2ASavedDialog
          kind={savedDialog}
          onClose={() => setSavedDialog(null)}
          onDownload={
            savedDialog === "completed"
              ? () => {
                  setSavedDialog(null)
                  void download()
                }
              : undefined
          }
        />
      )}
    </div>
  )
}
