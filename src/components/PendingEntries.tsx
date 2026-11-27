import { CloudUpload, TriangleAlert } from 'lucide-react'
import { discard, retry, type RecordTable } from '../lib/outbox'
import { useOutbox } from '../lib/useOutbox'
import { Panel } from './ui'

/** Entries of this kind saved on the phone for this project, above the list. Totals don't include them yet. */
export function PendingEntries({ projectId, table }: { projectId: string; table: RecordTable }) {
  const { items } = useOutbox()
  const mine = items.filter((i) => i.projectId === projectId && i.table === table)
  if (!mine.length) return null
  return (
    <Panel className="no-print mb-4 border-dashed">
      <h2 className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-sm font-semibold">
        <CloudUpload className="size-4 text-muted" aria-hidden />
        On this phone, not uploaded yet
      </h2>
      <ul>
        {mine.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2.5 text-sm last:border-0">
            <span className="min-w-0 flex-1 font-medium">{i.summary}</span>
            {i.error ? (
              <>
                <span className="flex w-full items-center gap-1.5 text-signal sm:order-last">
                  <TriangleAlert className="size-4 shrink-0" aria-hidden />
                  {i.error}
                </span>
                <button type="button" onClick={() => void retry(i.id)} className="min-h-11 font-semibold underline underline-offset-4">
                  Retry
                </button>
                <button type="button" onClick={() => void discard(i.id)} className="min-h-11 font-semibold text-signal underline underline-offset-4">
                  Discard
                </button>
              </>
            ) : (
              <span className="text-muted">Waiting for signal</span>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  )
}
