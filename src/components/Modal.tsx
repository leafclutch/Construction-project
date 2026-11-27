import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

/** Native <dialog>: bottom sheet on phones, centered panel from sm up. */
export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      // Only Esc / the user closing it counts. When the parent sets open=false (e.g. to open
      // a confirm dialog instead) the effect closes it, and that must not call onClose again.
      onClose={() => open && onClose()}
      aria-labelledby="modal-title"
      className="mb-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-xl border border-line bg-surface p-0 text-text backdrop:bg-ink/50 sm:m-auto sm:w-[min(34rem,calc(100vw-2rem))] sm:rounded-lg"
    >
      {open && (
        // 2px less than the dialog: its 1px border would otherwise add a second scrollbar.
        <div className="flex max-h-[calc(92dvh-2px)] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
            <h2 id="modal-title" className="text-lg font-semibold">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 grid size-11 place-items-center rounded-md hover:bg-surface-2">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto p-5">{children}</div>
        </div>
      )}
    </dialog>
  )
}
