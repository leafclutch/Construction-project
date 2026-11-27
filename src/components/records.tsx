import { Camera, Paperclip, Pencil, Printer, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { compressImage } from '../lib/compressImage'
import { openFile, type Bucket } from '../lib/files'
import { formatDate, todayISO } from '../lib/format'
import type { ModuleKey } from '../lib/permissions'
import type { Project } from '../projects/api'
import { useProject } from '../projects/ProjectLayout'
import { ConfirmDialog } from './ConfirmDialog'
import { useToast } from './toast'
import { Button, cx } from './ui'

export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden />
      Print / PDF
    </Button>
  )
}

/** Only visible on paper: who, which site, when. */
export function PrintHeader({ project, title }: { project: Project; title: string }) {
  const { membership } = useAuth()
  return (
    <div className="mb-4 hidden border-b-2 border-black pb-2 print:block">
      <p className="text-lg font-bold">
        {title} — {project.name}
      </p>
      <p className="text-sm">
        {membership?.orgName} · Printed {formatDate(todayISO())}
      </p>
    </div>
  )
}

/** A row of key totals above a ledger. */
export function StatStrip({ items }: { items: { label: string; value: ReactNode; tone?: 'money' }[] }) {
  return (
    <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="bg-surface px-3 py-3 sm:px-4">
          <dt className="text-xs font-medium text-muted">{it.label}</dt>
          <dd className={cx('figure mt-0.5 text-lg sm:text-xl', it.tone === 'money' && 'text-ledger')}>{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Shown only to people allowed to edit this module on this project. */
export function EditRowButton({ module, what, onClick }: { module: ModuleKey; what: string; onClick: () => void }) {
  const { can } = useProject()
  if (!can(`${module}.edit`)) return null
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Edit ${what}`}
      className="no-print grid size-11 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
    >
      <Pencil className="size-4" aria-hidden />
    </button>
  )
}

/** Delete with confirmation, shown only to people allowed to delete in this module on this project. */
export function DeleteRowButton({ module, what, onDelete }: { module: ModuleKey; what: string; onDelete: () => Promise<void> }) {
  const { can } = useProject()
  const [open, setOpen] = useState(false)
  const toast = useToast()
  if (!can(`${module}.delete`)) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${what}`}
        className="no-print grid size-11 shrink-0 place-items-center rounded-md text-muted hover:bg-signal-soft hover:text-signal"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
      <ConfirmDialog
        open={open}
        title={`Delete ${what}?`}
        confirmLabel="Delete"
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          await onDelete()
          toast('Deleted')
        }}
      >
        This cannot be undone.
      </ConfirmDialog>
    </>
  )
}

export function FileLink({ bucket, path, label = 'View' }: { bucket: Bucket; path: string | null; label?: string }) {
  const toast = useToast()
  if (!path) return <span className="text-sm text-muted">None</span>
  return (
    <button
      type="button"
      onClick={() => openFile(bucket, path).catch(() => toast('Could not open the file. Try again.', 'error'))}
      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
    >
      <Paperclip className="size-4" aria-hidden />
      {label}
    </button>
  )
}

/** Ledger skeleton with the same row height as real rows. */
export function LedgerSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-16 items-center gap-4 border-b border-line px-4 last:border-0">
          <div className="h-4 w-24 animate-pulse rounded bg-line/60" />
          <div className="h-4 flex-1 animate-pulse rounded bg-line/60" />
          <div className="h-4 w-20 animate-pulse rounded bg-line/60" />
        </div>
      ))}
    </div>
  )
}

/**
 * File field; the form reads the file from the hidden input named `name`.
 * With `photo` (receipts, bills): a "Take photo" button opens the camera, and big photos are
 * shrunk first (compressImage) so the size limit and the upload use the small copy.
 * Without it (drawings) the file is kept exactly as chosen.
 */
export function FilePicker({ id, name, accept, maxBytes, photo }: { id: string; name: string; accept: string; maxBytes: number; photo?: boolean }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const tooBig = file && file.size > maxBytes
  const limit = `File is larger than ${Math.round(maxBytes / 1048576)} MB.`

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  async function pick(chosen: File | undefined) {
    const target = input.current!
    if (!chosen) return
    setBusy(true)
    // Block saving until the small copy is in place.
    target.setCustomValidity('Preparing the photo…')
    const small = photo ? await compressImage(chosen) : chosen
    const dt = new DataTransfer()
    dt.items.add(small)
    target.files = dt.files
    target.setCustomValidity(small.size > maxBytes ? limit : '')
    setFile(small)
    setPreview(small.type.startsWith('image/') ? URL.createObjectURL(small) : null)
    setBusy(false)
  }

  function clear() {
    input.current!.value = ''
    input.current!.setCustomValidity('')
    setFile(null)
    setPreview(null)
  }

  const button = 'flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-line bg-surface-2 px-3 text-sm font-medium hover:border-focus has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus'
  return (
    <div>
      {file ? (
        <div className="flex items-center gap-3 rounded-md border border-line bg-surface-2 p-2">
          {preview ? (
            <img src={preview} alt="" className="size-14 shrink-0 rounded object-cover" />
          ) : (
            <Paperclip className="mx-2 size-5 shrink-0 text-muted" aria-hidden />
          )}
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-medium">{file.name}</p>
            <p className="text-xs text-muted">{busy ? 'Preparing…' : `${Math.max(1, Math.round(file.size / 1024))} KB`}</p>
          </div>
          <button type="button" onClick={clear} aria-label="Remove file" className="grid size-11 shrink-0 place-items-center rounded-md text-muted hover:bg-surface hover:text-text">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          {photo && (
            <label className={button}>
              <Camera className="size-4 shrink-0 text-muted" aria-hidden />
              Take photo
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
            </label>
          )}
          <label htmlFor={id} className={button}>
            <Paperclip className="size-4 shrink-0 text-muted" aria-hidden />
            Choose file
          </label>
        </div>
      )}
      <input ref={input} id={id} name={name} type="file" accept={accept} className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
      {busy && !file && <p className="mt-1 text-xs text-muted">Preparing the photo…</p>}
      {tooBig && <p className="mt-1 text-xs text-signal">{limit}</p>}
    </div>
  )
}
