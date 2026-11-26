import { Plus, Truck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Ledger } from '../../components/Ledger'
import { Modal } from '../../components/Modal'
import { DeleteRowButton, EditRowButton, FileLink, FilePicker, LedgerSkeleton, PrintButton, PrintHeader, StatStrip } from '../../components/records'
import { useToast } from '../../components/toast'
import { Button, EmptyState, ErrorState, Field, FormError, Input, PageHeader, Panel, Select } from '../../components/ui'
import { MAX_RECEIPT_BYTES } from '../../lib/files'
import { formatDate, formatNumber, todayISO } from '../../lib/format'
import { useAsyncData } from '../../lib/useAsyncData'
import { useProject } from '../../projects/ProjectLayout'
import { addMaterial, deleteMaterial, listMaterials, MATERIALS, UNITS, updateMaterial, type MaterialEntry, type MaterialInput } from './api'

export function MaterialsPage() {
  const { project } = useProject()
  const [params, setParams] = useSearchParams()
  const material = params.get('material') ?? ''
  const { data, error, reload } = useAsyncData(() => listMaterials(project.id, material || undefined), [project.id, material])
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<MaterialEntry | null>(null)
  const toast = useToast()

  const withChallan = data?.filter((r) => r.challan_path).length ?? 0
  const suppliers = new Set(data?.map((r) => r.supplier?.trim().toLowerCase()).filter(Boolean)).size

  return (
    <>
      <PrintHeader project={project} title="Material record" />
      <PageHeader
        title="Materials"
        description="Deliveries that reached the site, with challan photos."
        actions={
          <>
            <PrintButton />
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden />
              Add delivery
            </Button>
          </>
        }
      />

      <StatStrip
        items={[
          { label: material ? `${material} deliveries` : 'Deliveries', value: data ? formatNumber(data.length) : '…' },
          { label: 'With challan photo', value: data ? formatNumber(withChallan) : '…' },
          { label: 'Suppliers', value: data ? formatNumber(suppliers) : '…' },
          { label: 'Latest delivery', value: data?.[0] ? formatDate(data[0].entry_date) : '—' },
        ]}
      />

      <div className="no-print mb-4 flex flex-wrap items-end gap-3">
        <Field label="Material" className="w-full sm:w-56">
          {(id) => (
            <Select
              id={id}
              value={material}
              onChange={(e) => setParams(e.target.value ? { material: e.target.value } : {}, { replace: true })}
            >
              <option value="">All materials</option>
              {MATERIALS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <Panel>
          {!data ? (
            <LedgerSkeleton />
          ) : data.length === 0 ? (
            <EmptyState icon={<Truck className="size-10" />} title={material ? `No ${material.toLowerCase()} deliveries yet` : 'No deliveries recorded yet'}>
              Record each truck or tractor load when it arrives, with a photo of the challan.
            </EmptyState>
          ) : (
            <Ledger
              rows={data}
              rowKey={(r) => r.id}
              columns={[
                { header: 'Date', cell: (r) => formatDate(r.entry_date), className: 'whitespace-nowrap' },
                { header: 'Material', cell: (r) => <span className="font-semibold">{r.material}</span> },
                { header: 'Supplier / remarks', cell: (r) => r.supplier || <span className="text-muted">—</span> },
                { header: 'Quantity', cell: (r) => `${formatNumber(r.quantity)} ${r.unit}`, align: 'right' },
                { header: 'Challan', cell: (r) => <FileLink bucket="receipts" path={r.challan_path} />, className: 'print:hidden' },
              ]}
              mobile={(r) => ({
                main: (
                  <>
                    <p className="font-semibold">{r.material}</p>
                    {r.supplier && <p className="truncate text-muted">{r.supplier}</p>}
                    <p className="flex items-center gap-3 text-xs text-muted">
                      {formatDate(r.entry_date)}
                      {r.challan_path && <FileLink bucket="receipts" path={r.challan_path} label="Challan" />}
                    </p>
                  </>
                ),
                side: `${formatNumber(r.quantity)} ${r.unit}`,
              })}
              actions={(r) => (
                <>
                  <EditRowButton what={`${r.material} delivery of ${formatDate(r.entry_date)}`} onClick={() => setEditing(r)} />
                  <DeleteRowButton
                    what={`${r.material} delivery of ${formatDate(r.entry_date)}`}
                    onDelete={async () => {
                      await deleteMaterial(r)
                      reload()
                    }}
                  />
                </>
              )}
            />
          )}
        </Panel>
      )}

      <Modal open={adding} title="Add delivery" onClose={() => setAdding(false)}>
        <MaterialForm
          onSave={async (input, file) => {
            await addMaterial(project.org_id, project.id, input, file)
            reload()
            setAdding(false)
            toast('Delivery added')
          }}
        />
      </Modal>

      <Modal open={Boolean(editing)} title="Edit delivery" onClose={() => setEditing(null)}>
        {editing && (
          <MaterialForm
            key={editing.id}
            initial={editing}
            onSave={async (input) => {
              await updateMaterial(editing.id, input)
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

function MaterialForm({ initial, onSave }: { initial?: MaterialEntry; onSave: (input: MaterialInput, file: File | null) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const file = f.get('challan') as File | null
    if (file && file.size > MAX_RECEIPT_BYTES) return setError({ status: 413 })
    setBusy(true)
    setError(null)
    try {
      await onSave(
        {
          entry_date: String(f.get('entry_date')),
          material: String(f.get('material')),
          quantity: Number(f.get('quantity')),
          unit: String(f.get('unit')).trim(),
          supplier: String(f.get('supplier')).trim() || null,
        },
        file && file.size > 0 ? file : null,
      )
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Date">{(id) => <Input id={id} name="entry_date" type="date" defaultValue={initial?.entry_date ?? todayISO()} max={todayISO()} required />}</Field>
      <Field label="Material">
        {(id) => (
          <Select id={id} name="material" defaultValue={initial?.material} required>
            {MATERIALS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Quantity">{(id) => <Input id={id} name="quantity" type="number" inputMode="decimal" min="0.001" step="0.001" defaultValue={initial?.quantity} required />}</Field>
      <Field label="Unit">
        {(id) => (
          <>
            <Input id={id} name="unit" list="material-units" defaultValue={initial?.unit} required maxLength={30} placeholder="Bags" />
            <datalist id="material-units">
              {UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </>
        )}
      </Field>
      <Field label="Supplier / remarks" className="sm:col-span-2" hint="Optional, e.g. Shivam Hardware, challan #108.">
        {(id) => <Input id={id} name="supplier" defaultValue={initial?.supplier ?? undefined} maxLength={300} />}
      </Field>
      {!initial && (
        <Field label="Challan photo" className="sm:col-span-2" hint="Optional. Photo or PDF up to 10 MB.">
          {(id) => <FilePicker id={id} name="challan" accept="image/*,application/pdf" maxBytes={MAX_RECEIPT_BYTES} label="Take photo or choose file" />}
        </Field>
      )}
      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormError error={error} />
        <Button type="submit" busy={busy} className="sm:self-end">
          {initial ? 'Save changes' : 'Save delivery'}
        </Button>
      </div>
    </form>
  )
}
