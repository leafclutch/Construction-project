import { Paperclip, Printer, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { openFile, type Bucket } from '../lib/files'
import { formatDate, todayISO } from '../lib/format'
import type { Project } from '../projects/api'
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

/** Admin-only delete with confirmation. Renders nothing for site staff. */
export function DeleteRowButton({ what, onDelete }: { what: string; onDelete: () => Promise<void> }) {
  const { isAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const toast = useToast()
  if (!isAdmin) return null
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

/** File input that shows the chosen name and enforces a size limit. */
export function FilePicker({ id, name, accept, maxBytes, label }: { id: string; name: string; accept: string; maxBytes: number; label: string }) {
  const [file, setFile] = useState<File | null>(null)
  const tooBig = file && file.size > maxBytes
  return (
    <div>
      <label
        htmlFor={id}
        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-dashed border-line bg-surface-2 px-3 text-sm hover:border-focus"
      >
        <Paperclip className="size-4 shrink-0 text-muted" aria-hidden />
        <span className="truncate">{file ? file.name : label}</span>
      </label>
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          setFile(f)
          e.target.setCustomValidity(f && f.size > maxBytes ? `File is larger than ${Math.round(maxBytes / 1048576)} MB.` : '')
        }}
      />
      {tooBig && <p className="mt-1 text-xs text-signal">File is larger than {Math.round(maxBytes / 1048576)} MB.</p>}
    </div>
  )
}
