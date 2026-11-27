import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, FormError } from './ui'

type Props = {
  open: boolean
  title: string
  children?: ReactNode
  confirmLabel: string
  onConfirm: () => Promise<void>
  onClose: () => void
  /** danger (default) for destructive actions */
  tone?: 'danger' | 'primary'
}

/** Native <dialog> confirm. Stays open on error. */
export function ConfirmDialog(props: Props) {
  // Mounted only while open: long ledgers render one per row.
  return props.open ? <OpenConfirmDialog {...props} /> : null
}

function OpenConfirmDialog({ title, children, confirmLabel, onConfirm, onClose, tone = 'danger' }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-text backdrop:bg-ink/50"
    >
      <div className="flex flex-col gap-3 p-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        {children && <div className="text-sm text-muted">{children}</div>}
        <FormError error={error} />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone} onClick={confirm} busy={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
