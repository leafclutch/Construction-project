import { FileText, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Ledger } from '../../components/Ledger'
import { Modal } from '../../components/Modal'
import { PendingEntries } from '../../components/PendingEntries'
import { DeleteRowButton, EditRowButton, FileLink, FilePicker, LedgerSkeleton, PrintButton, PrintHeader, StatStrip } from '../../components/records'
import { useToast } from '../../components/toast'
import { Button, EmptyState, ErrorState, Field, FormError, Input, PageHeader, Panel } from '../../components/ui'
import { MAX_RECEIPT_BYTES } from '../../lib/files'
import { calc, formatDate, formatNPR, formatNumber, todayISO } from '../../lib/format'
import { useAsyncData } from '../../lib/useAsyncData'
import { savedText } from '../../lib/outbox'
import { useProject } from '../../projects/ProjectLayout'
import { addBill, deleteBill, listBills, updateBill, type VatBill, type VatBillInput } from './api'

export function BillsPage() {
  const { project, can } = useProject()
  const { data, error, reload } = useAsyncData(() => listBills(project.id), [project.id], 'bills')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<VatBill | null>(null)
  const toast = useToast()

  const sum = (k: 'taxable_amount' | 'vat_amount' | 'gross_amount') => data?.reduce((s, r) => s + Number(r[k]), 0) ?? 0

  return (
    <>
      <PrintHeader project={project} title="VAT bills" />
      <PageHeader
        title="VAT bills"
        description="Supplier invoices with 13% VAT, kept for tax and client claims."
        actions={
          <>
            <PrintButton />
            {can('bills.add') && (
              <Button onClick={() => setAdding(true)}>
                <Plus className="size-4" aria-hidden />
                Add bill
              </Button>
            )}
          </>
        }
      />

      <StatStrip
        items={[
          { label: 'Bills', value: data ? formatNumber(data.length) : '…' },
          { label: 'Taxable', value: data ? formatNPR(sum('taxable_amount')) : '…' },
          { label: 'VAT 13%', value: data ? formatNPR(sum('vat_amount')) : '…' },
          { label: 'Gross total', value: data ? formatNPR(sum('gross_amount')) : '…', tone: 'money' },
        ]}
      />

      <PendingEntries projectId={project.id} table="vat_bills" />

      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <Panel>
          {!data ? (
            <LedgerSkeleton />
          ) : data.length === 0 ? (
            <EmptyState icon={<FileText className="size-10" />} title="No VAT bills yet">
              Add each supplier invoice with its PAN, so VAT totals are ready at tax time.
            </EmptyState>
          ) : (
            <Ledger
              rows={data}
              rowKey={(r) => r.id}
              columns={[
                {
                  header: 'Bill',
                  cell: (r) => (
                    <>
                      <p className="whitespace-nowrap font-semibold">{r.bill_no}</p>
                      <p className="whitespace-nowrap text-xs text-muted">{formatDate(r.bill_date)}</p>
                    </>
                  ),
                },
                {
                  header: 'Supplier',
                  cell: (r) => (
                    <>
                      <p>{r.supplier_name}</p>
                      <p className="num text-xs text-muted">PAN {r.supplier_pan}</p>
                    </>
                  ),
                },
                { header: 'Taxable', cell: (r) => formatNPR(r.taxable_amount), align: 'right' },
                { header: 'VAT', cell: (r) => formatNPR(r.vat_amount), align: 'right' },
                { header: 'Gross', cell: (r) => <span className="font-semibold">{formatNPR(r.gross_amount)}</span>, align: 'right' },
                { header: 'Copy', cell: (r) => <FileLink bucket="receipts" path={r.file_path} />, className: 'print:hidden' },
              ]}
              mobile={(r) => ({
                main: (
                  <>
                    <p className="font-semibold">{r.supplier_name}</p>
                    <p className="num text-xs text-muted">
                      {r.bill_no} · {formatDate(r.bill_date)}
                    </p>
                    {r.file_path && <FileLink bucket="receipts" path={r.file_path} label="Bill copy" />}
                  </>
                ),
                side: (
                  <>
                    {formatNPR(r.gross_amount)}
                    <span className="block text-xs font-normal text-muted">VAT {formatNPR(r.vat_amount)}</span>
                  </>
                ),
              })}
              actions={(r) => (
                <>
                  <EditRowButton module="bills" what={`bill ${r.bill_no}`} onClick={() => setEditing(r)} />
                  <DeleteRowButton
                    module="bills"
                    what={`bill ${r.bill_no}`}
                    onDelete={async () => {
                      await deleteBill(r)
                      reload()
                    }}
                  />
                </>
              )}
              footer={{
                label: 'Total',
                cells: { 2: formatNPR(sum('taxable_amount')), 3: formatNPR(sum('vat_amount')), 4: formatNPR(sum('gross_amount')) },
              }}
            />
          )}
        </Panel>
      )}

      <Modal open={adding} title="Add VAT bill" onClose={() => setAdding(false)}>
        <BillForm
          onSave={async (input, file) => {
            const { queued } = await addBill(project.org_id, project.id, input, file)
            reload()
            setAdding(false)
            toast(savedText(queued, 'Bill added'))
          }}
        />
      </Modal>

      <Modal open={Boolean(editing)} title="Edit VAT bill" onClose={() => setEditing(null)}>
        {editing && (
          <BillForm
            key={editing.id}
            initial={editing}
            onSave={async (input) => {
              await updateBill(editing.id, input)
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

export function BillForm({ initial, onSave }: { initial?: VatBill; onSave: (input: VatBillInput, file: File | null) => Promise<void> }) {
  const [taxable, setTaxable] = useState(initial ? String(initial.taxable_amount) : '')
  const [vatIncluded, setVatIncluded] = useState(initial?.vat_included ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const vat = calc.vat(Number(taxable) || 0, vatIncluded)
  const gross = (Number(taxable) || 0) + vat

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const file = f.get('bill_file') as File | null
    if (file && file.size > MAX_RECEIPT_BYTES) return setError({ status: 413 })
    setBusy(true)
    setError(null)
    try {
      await onSave(
        {
          bill_date: String(f.get('bill_date')),
          bill_no: String(f.get('bill_no')).trim(),
          supplier_name: String(f.get('supplier_name')).trim(),
          supplier_pan: String(f.get('supplier_pan')).trim(),
          taxable_amount: Number(taxable),
          vat_included: vatIncluded,
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
      <Field label="Bill date">{(id) => <Input id={id} name="bill_date" type="date" defaultValue={initial?.bill_date ?? todayISO()} max={todayISO()} required />}</Field>
      <Field label="Bill / invoice no.">{(id) => <Input id={id} name="bill_no" defaultValue={initial?.bill_no} required maxLength={60} placeholder="VAT-2083-0145" />}</Field>
      <Field label="Supplier name">{(id) => <Input id={id} name="supplier_name" defaultValue={initial?.supplier_name} required maxLength={200} placeholder="Mithila Hardware" />}</Field>
      <Field label="Supplier PAN / VAT no." hint="9 digits, printed on the bill.">
        {(id) => (
          <Input id={id} name="supplier_pan" defaultValue={initial?.supplier_pan} required inputMode="numeric" pattern="[0-9]{9}" maxLength={9} title="9 digits" autoComplete="off" />
        )}
      </Field>
      <Field label="Taxable amount (Rs.)">
        {(id) => <Input id={id} type="number" inputMode="decimal" min={0} step="0.01" value={taxable} onChange={(e) => setTaxable(e.target.value)} required />}
      </Field>
      <label className="flex min-h-11 items-center gap-2 self-end text-sm font-medium">
        <input type="checkbox" checked={vatIncluded} onChange={(e) => setVatIncluded(e.target.checked)} className="size-4" />
        Bill includes 13% VAT
      </label>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md bg-line sm:col-span-2" aria-live="polite">
        <div className="bg-surface-2 px-4 py-3">
          <dt className="text-xs text-muted">VAT 13%</dt>
          <dd className="figure text-lg">{formatNPR(vat)}</dd>
        </div>
        <div className="bg-surface-2 px-4 py-3">
          <dt className="text-xs text-muted">Gross total</dt>
          <dd className="figure text-lg">{formatNPR(gross)}</dd>
        </div>
      </dl>
      {!initial && (
        <Field label="Bill photo or PDF" className="sm:col-span-2" hint="Optional, up to 10 MB.">
          {(id) => <FilePicker id={id} name="bill_file" accept="image/*,application/pdf" maxBytes={MAX_RECEIPT_BYTES} photo />}
        </Field>
      )}
      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormError error={error} messages={{ '23505': 'This bill number from this supplier is already recorded.' }} />
        <Button type="submit" busy={busy} className="sm:self-end">
          {initial ? 'Save changes' : 'Save bill'}
        </Button>
      </div>
    </form>
  )
}
