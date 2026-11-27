import { CloudOff, CloudUpload, Loader2, TriangleAlert } from 'lucide-react'
import { sync } from '../lib/outbox'
import { useOnline, useOutbox, useOutboxSync } from '../lib/useOutbox'

const entries = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`

/** Thin strip under the top bar: no signal, entries waiting on this phone, uploads running. */
export function OfflineBar() {
  useOutboxSync()
  const online = useOnline()
  const { items, syncing } = useOutbox()
  const failed = items.filter((i) => i.error).length
  const waiting = items.length - failed

  let icon = <CloudOff className="size-4 shrink-0" aria-hidden />
  let text: string
  if (!online) text = waiting ? `Offline · ${entries(waiting)} waiting to upload` : 'Offline · showing what was saved on this phone'
  else if (syncing) {
    icon = <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
    text = `Uploading ${entries(waiting)}…`
  } else if (failed) {
    icon = <TriangleAlert className="size-4 shrink-0" aria-hidden />
    text = `${entries(failed)} could not upload. Open the record page to fix or discard.`
  } else if (waiting) {
    icon = <CloudUpload className="size-4 shrink-0" aria-hidden />
    text = `${entries(waiting)} waiting to upload`
  } else return null

  return (
    <div role="status" className="no-print flex min-h-9 items-center gap-2 border-b border-line bg-surface-2 px-4 py-1.5 text-sm sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2">
        {icon}
        <span className="min-w-0 flex-1">{text}</span>
        {online && waiting > 0 && !syncing && (
          <button type="button" onClick={() => void sync()} className="min-h-9 shrink-0 font-semibold underline underline-offset-4">
            Upload now
          </button>
        )}
      </div>
    </div>
  )
}
