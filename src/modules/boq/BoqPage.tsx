import { LayoutList, Plus, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '../../auth/AuthProvider'
import { Ledger } from '../../components/Ledger'
import { Modal } from '../../components/Modal'
import { DeleteRowButton, EditRowButton, LedgerSkeleton, PrintButton, PrintHeader } from '../../components/records'
import { useToast } from '../../components/toast'
import { Button, EmptyState, ErrorState, Field, FormError, Input, PageHeader, Panel } from '../../components/ui'
import { fetchAll } from '../../lib/fetchAll'
import { calc, formatNPR, formatNumber } from '../../lib/format'
import { supabase, type Tables } from '../../lib/supabase'
import { unwrap, updateOne, useAsyncData } from '../../lib/useAsyncData'
import { useProject } from '../../projects/ProjectLayout'

type BoqItem = Tables<'boq_items'>
type BoqInput = Pick<BoqItem, 'description' | 'unit' | 'quantity' | 'rate'>

const listBoq = (projectId: string) =>
  fetchAll<BoqItem>((from, to) => supabase.from('boq_items').select('*').eq('project_id', projectId).order('created_at').range(from, to))

/** Lowercase letters and digits only, so "pcc" matches "P.C.C." and "1:1.5:3" matches "1 1.5 3". */
const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

export function BoqPage() {
  const { project } = useProject()
  const { isAdmin } = useAuth()
  const { data, error, reload } = useAsyncData(() => listBoq(project.id), [project.id])
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<BoqItem | null>(null)
  const toast = useToast()

  // Serial numbers follow the BOQ order, so they stay the same when searching.
  const numbered = data?.map((r, i) => ({ ...r, sn: i + 1 }))
  const needle = squash(q)
  const rows = needle ? numbered?.filter((r) => squash(`${r.description} ${r.unit}`).includes(needle)) : numbered
  const total = rows?.reduce((s, r) => s + Number(r.amount), 0) ?? 0

  return (
    <>
      <PrintHeader project={project} title="Bill of quantities" />
      <PageHeader
        title="BOQ"
        description="Bill of quantities from the contract: every work item, quantity and rate."
        actions={
          <>
            <PrintButton />
            {isAdmin && (
              <Button onClick={() => setAdding(true)}>
                <Plus className="size-4" aria-hidden />
                Add item
              </Button>
            )}
          </>
        }
      />

      <div className="no-print relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input
          type="search"
          aria-label="Search BOQ"
          placeholder="Search by description or unit"
          value={q}
          onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
          className="pl-9"
        />
      </div>

      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <Panel>
          {!rows ? (
            <LedgerSkeleton />
          ) : rows.length === 0 ? (
            <EmptyState icon={<LayoutList className="size-10" />} title={needle ? 'No items match your search' : 'No BOQ items yet'}>
              {needle ? 'Try a different word.' : isAdmin ? 'Add the work items from your contract BOQ.' : 'The owner has not added BOQ items yet.'}
            </EmptyState>
          ) : (
            <Ledger
              rows={rows}
              rowKey={(r) => r.id}
              columns={[
                { header: 'SN', cell: (r) => r.sn, className: 'w-12 num text-muted' },
                { header: 'Description', cell: (r) => <span className="block max-w-xl">{r.description}</span> },
                { header: 'Unit', cell: (r) => r.unit },
                { header: 'Qty', cell: (r) => formatNumber(r.quantity), align: 'right' },
                { header: 'Rate', cell: (r) => formatNPR(r.rate), align: 'right' },
                { header: 'Amount', cell: (r) => <span className="font-semibold">{formatNPR(r.amount)}</span>, align: 'right' },
              ]}
              mobile={(r) => ({
                main: (
                  <>
                    <p className="line-clamp-3">
                      <span className="num text-muted">{r.sn}. </span>
                      {r.description}
                    </p>
                    <p className="num text-xs text-muted">
                      {formatNumber(r.quantity)} {r.unit} × {formatNPR(r.rate)}
                    </p>
                  </>
                ),
                side: formatNPR(r.amount),
              })}
              actions={(r) => (
                <>
                  <EditRowButton what={`BOQ item ${r.sn}`} onClick={() => setEditing(r)} />
                  <DeleteRowButton
                    what={`BOQ item ${r.sn}`}
                    onDelete={async () => {
                      await unwrap(supabase.from('boq_items').delete().eq('id', r.id))
                      reload()
                    }}
                  />
                </>
              )}
              footer={{ label: needle ? 'Total (matching)' : 'Grand total', cells: { 5: formatNPR(total) } }}
            />
          )}
        </Panel>
      )}

      <Modal open={adding} title="Add BOQ item" onClose={() => setAdding(false)}>
        <BoqForm
          onSave={async (input) => {
            await unwrap(supabase.from('boq_items').insert({ ...input, org_id: project.org_id, project_id: project.id }))
            reload()
            toast('BOQ item added')
          }}
        />
      </Modal>

      <Modal open={Boolean(editing)} title="Edit BOQ item" onClose={() => setEditing(null)}>
        {editing && (
          <BoqForm
            key={editing.id}
            initial={editing}
            onSave={async (input) => {
              await updateOne(supabase.from('boq_items').update(input).eq('id', editing.id).select('id'))
              reload()
              setEditing(null)
              toast('Changes saved')
            }}
          />
        )}
      </Modal>
    </>
  )
}

function BoqForm({ initial, onSave }: { initial?: BoqItem; onSave: (input: BoqInput) => Promise<void> }) {
  const [qty, setQty] = useState(initial ? String(initial.quantity) : '')
  const [rate, setRate] = useState(initial ? String(initial.rate) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    setBusy(true)
    setError(null)
    try {
      await onSave({ description: String(f.get('description')).trim(), unit: String(f.get('unit')).trim(), quantity: Number(qty), rate: Number(rate) })
      if (initial) return
      // BOQs are entered item after item: clear and stay open.
      form.reset()
      setQty('')
      setRate('')
      ;(form.elements.namedItem('description') as HTMLTextAreaElement).focus()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
      <Field label="Description" className="sm:col-span-3">
        {(id) => (
          <textarea
            id={id}
            name="description"
            defaultValue={initial?.description}
            required
            maxLength={1000}
            rows={3}
            placeholder="Earth work in excavation in trenches, pits and foundation in all types of soil."
            className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-base focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/30 sm:text-sm"
          />
        )}
      </Field>
      <Field label="Unit">{(id) => <Input id={id} name="unit" defaultValue={initial?.unit} required maxLength={20} list="boq-units" placeholder="m³" />}</Field>
      <datalist id="boq-units">
        {['m³', 'm²', 'm', 'kg', 'MT', 'nos', 'LS', 'cft', 'sqft', 'rft'].map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <Field label="Quantity">{(id) => <Input id={id} type="number" inputMode="decimal" min={0} step="0.001" value={qty} onChange={(e) => setQty(e.target.value)} required />}</Field>
      <Field label="Rate (Rs.)">{(id) => <Input id={id} type="number" inputMode="decimal" min={0} step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} required />}</Field>
      <div className="flex items-center justify-between rounded-md bg-surface-2 px-4 py-3 sm:col-span-3" aria-live="polite">
        <span className="text-sm text-muted">Amount</span>
        <span className="figure text-xl">{formatNPR(calc.boqAmount(Number(qty) || 0, Number(rate) || 0))}</span>
      </div>
      <div className="flex flex-col gap-3 sm:col-span-3">
        <FormError error={error} />
        <Button type="submit" busy={busy} className="sm:self-end">
          {initial ? 'Save changes' : 'Add item'}
        </Button>
      </div>
    </form>
  )
}
