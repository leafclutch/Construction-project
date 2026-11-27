import { Plus, UsersRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Ledger } from '../../components/Ledger'
import { Modal } from '../../components/Modal'
import { DeleteRowButton, EditRowButton, LedgerSkeleton, PrintButton, PrintHeader, StatStrip } from '../../components/records'
import { useToast } from '../../components/toast'
import { Button, EmptyState, ErrorState, Field, FormError, Input, PageHeader, Panel, Select } from '../../components/ui'
import { calc, formatDate, formatNPR, formatNumber, todayISO } from '../../lib/format'
import { useAsyncData } from '../../lib/useAsyncData'
import { useProject } from '../../projects/ProjectLayout'
import { addLabour, deleteLabour, LABOUR_CATEGORIES, listLabour, updateLabour, type LabourEntry, type LabourInput } from './api'

export function LabourPage() {
  const { project, can } = useProject()
  const [params, setParams] = useSearchParams()
  const filter = { date: params.get('date') ?? '', category: params.get('category') ?? '' }
  const { data, error, reload } = useAsyncData(() => listLabour(project.id, filter), [project.id, filter.date, filter.category])
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<LabourEntry | null>(null)
  const toast = useToast()

  const totalWage = data?.reduce((s, r) => s + Number(r.total_wage), 0) ?? 0
  const manDays = data?.reduce((s, r) => s + r.worker_count, 0) ?? 0
  const filtered = Boolean(filter.date || filter.category)

  function setFilter(key: 'date' | 'category', value: string) {
    setParams(
      (p) => {
        if (value) p.set(key, value)
        else p.delete(key)
        return p
      },
      { replace: true },
    )
  }

  return (
    <>
      <PrintHeader project={project} title="Labour record" />
      <PageHeader
        title="Labour"
        description="Daily workers and wages."
        actions={
          <>
            <PrintButton />
            {can('labour.add') && (
              <Button onClick={() => setAdding(true)}>
                <Plus className="size-4" aria-hidden />
                Add labour
              </Button>
            )}
          </>
        }
      />

      <StatStrip
        items={[
          { label: filtered ? 'Wages (filtered)' : 'Total wages', value: data ? formatNPR(totalWage) : '…', tone: 'money' },
          { label: 'Man-days', value: data ? formatNumber(manDays) : '…' },
          { label: 'Entries', value: data ? formatNumber(data.length) : '…' },
          { label: 'Avg. daily rate', value: data && manDays ? formatNPR(totalWage / manDays) : '—' },
        ]}
      />

      <div className="no-print mb-4 flex flex-wrap items-end gap-3">
        <Field label="Date" className="w-full sm:w-44">
          {(id) => <Input id={id} type="date" value={filter.date} onChange={(e) => setFilter('date', e.target.value)} />}
        </Field>
        <Field label="Category" className="w-full sm:w-56">
          {(id) => (
            <Select id={id} value={filter.category} onChange={(e) => setFilter('category', e.target.value)}>
              <option value="">All categories</option>
              {LABOUR_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>
        {filtered && (
          <Button variant="ghost" onClick={() => setParams({}, { replace: true })}>
            Clear filters
          </Button>
        )}
      </div>

      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <Panel>
          {!data ? (
            <LedgerSkeleton />
          ) : data.length === 0 ? (
            <EmptyState icon={<UsersRound className="size-10" />} title={filtered ? 'No labour matches these filters' : 'No labour recorded yet'}>
              {filtered ? 'Change or clear the filters.' : 'Add today’s workers to start tracking wages.'}
            </EmptyState>
          ) : (
            <Ledger
              rows={data}
              rowKey={(r) => r.id}
              columns={[
                { header: 'Date', cell: (r) => formatDate(r.entry_date), className: 'whitespace-nowrap' },
                { header: 'Category', cell: (r) => <span className="font-semibold">{r.category}</span> },
                { header: 'Work area', cell: (r) => r.remarks },
                { header: 'Workers', cell: (r) => r.worker_count, align: 'right' },
                { header: 'Daily rate', cell: (r) => formatNPR(r.daily_rate), align: 'right' },
                { header: 'Wage', cell: (r) => <span className="font-semibold">{formatNPR(r.total_wage)}</span>, align: 'right' },
              ]}
              mobile={(r) => ({
                main: (
                  <>
                    <p className="font-semibold">{r.category}</p>
                    <p className="truncate text-muted">{r.remarks}</p>
                    <p className="num text-xs text-muted">
                      {formatDate(r.entry_date)} · {r.worker_count} × {formatNPR(r.daily_rate)}
                    </p>
                  </>
                ),
                side: formatNPR(r.total_wage),
              })}
              actions={(r) => (
                <>
                  <EditRowButton module="labour" what={`${r.category} on ${formatDate(r.entry_date)}`} onClick={() => setEditing(r)} />
                  <DeleteRowButton
                    module="labour"
                    what={`${r.category} on ${formatDate(r.entry_date)}`}
                    onDelete={async () => {
                      await deleteLabour(r.id)
                      reload()
                    }}
                  />
                </>
              )}
              footer={{ label: 'Total', cells: { 3: formatNumber(manDays), 5: formatNPR(totalWage) } }}
            />
          )}
        </Panel>
      )}

      <Modal open={adding} title="Add labour" onClose={() => setAdding(false)}>
        <LabourForm
          onSave={async (input) => {
            await addLabour(project.org_id, project.id, input)
            reload()
            toast('Labour added')
          }}
          onDone={() => setAdding(false)}
        />
      </Modal>

      <Modal open={Boolean(editing)} title="Edit labour" onClose={() => setEditing(null)}>
        {editing && (
          <LabourForm
            key={editing.id}
            initial={editing}
            onSave={async (input) => {
              await updateLabour(editing.id, input)
              reload()
              toast('Changes saved')
            }}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </>
  )
}

function LabourForm({ initial, onSave, onDone }: { initial?: LabourEntry; onSave: (input: LabourInput) => Promise<void>; onDone: () => void }) {
  const [workers, setWorkers] = useState(initial ? String(initial.worker_count) : '')
  const [rate, setRate] = useState(initial ? String(initial.daily_rate) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [addAnother, setAddAnother] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    setBusy(true)
    setError(null)
    try {
      await onSave({
        entry_date: String(f.get('entry_date')),
        category: String(f.get('category')),
        worker_count: Number(workers),
        daily_rate: Number(rate),
        remarks: String(f.get('remarks')).trim(),
      })
      if (addAnother) {
        // Keep the date, clear the rest for the next row.
        setWorkers('')
        setRate('')
        ;(form.elements.namedItem('remarks') as HTMLInputElement).value = ''
      } else onDone()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Date">{(id) => <Input id={id} name="entry_date" type="date" defaultValue={initial?.entry_date ?? todayISO()} max={todayISO()} required />}</Field>
      <Field label="Category">
        {(id) => (
          <Select id={id} name="category" defaultValue={initial?.category} required>
            {LABOUR_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Number of workers">
        {(id) => <Input id={id} type="number" inputMode="numeric" min={1} max={10000} step={1} value={workers} onChange={(e) => setWorkers(e.target.value)} required />}
      </Field>
      <Field label="Daily rate (Rs.)">
        {(id) => <Input id={id} type="number" inputMode="decimal" min={0} step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} required />}
      </Field>
      <Field label="Work area" className="sm:col-span-2" hint="What they worked on, e.g. Block A column casting.">
        {(id) => <Input id={id} name="remarks" defaultValue={initial?.remarks} required maxLength={300} />}
      </Field>
      <div className="flex items-center justify-between rounded-md bg-surface-2 px-4 py-3 sm:col-span-2" aria-live="polite">
        <span className="text-sm text-muted">Total wage</span>
        <span className="figure text-xl">{formatNPR(calc.wage(Number(workers) || 0, Number(rate) || 0))}</span>
      </div>
      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormError error={error} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!initial && (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={addAnother} onChange={(e) => setAddAnother(e.target.checked)} className="size-4" />
              Add another after saving
            </label>
          )}
          <Button type="submit" busy={busy} className="ml-auto">
            {initial ? 'Save changes' : 'Save labour'}
          </Button>
        </div>
      </div>
    </form>
  )
}
