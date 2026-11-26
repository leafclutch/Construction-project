import { Plus, Ruler } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Ledger } from '../../components/Ledger'
import { DeleteRowButton, LedgerSkeleton, PrintButton, PrintHeader } from '../../components/records'
import { useToast } from '../../components/toast'
import { Button, EmptyState, ErrorState, Field, FormError, Input, PageHeader, Panel, Select } from '../../components/ui'
import { fetchAll } from '../../lib/fetchAll'
import { calc, formatNumber } from '../../lib/format'
import { supabase, type Tables } from '../../lib/supabase'
import { unwrap, useAsyncData } from '../../lib/useAsyncData'
import { useProject } from '../../projects/ProjectLayout'

type BbsItem = Tables<'bbs_items'>
// Must match the CHECK constraint on bbs_items.bar_dia_mm.
const DIAMETERS = [6, 8, 10, 12, 16, 20, 25, 28, 32, 36, 40]

const listBbs = (projectId: string) =>
  fetchAll<BbsItem>((from, to) => supabase.from('bbs_items').select('*').eq('project_id', projectId).order('created_at').range(from, to))

export function SteelPage() {
  const { project } = useProject()
  const { data, error, reload } = useAsyncData(() => listBbs(project.id), [project.id])
  const toast = useToast()

  const total = data?.reduce((s, r) => s + Number(r.total_weight_kg), 0) ?? 0
  const byDia = new Map<number, number>()
  data?.forEach((r) => byDia.set(r.bar_dia_mm, (byDia.get(r.bar_dia_mm) ?? 0) + Number(r.total_weight_kg)))

  return (
    <>
      <PrintHeader project={project} title="Bar bending schedule" />
      <PageHeader title="Steel (BBS)" description="Bar bending schedule. Weight per metre = D² ÷ 162 (D in mm)." actions={<PrintButton />} />

      <Panel className="no-print mb-6 p-4 sm:p-5">
        <SteelForm
          onSave={async (input) => {
            await unwrap(supabase.from('bbs_items').insert({ ...input, org_id: project.org_id, project_id: project.id }))
            reload()
            toast('Steel row added')
          }}
        />
      </Panel>

      <section aria-label="Steel total" className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-ink px-5 py-4 text-ink-text print:border print:border-black print:bg-transparent print:text-black">
        <div>
          <p className="text-sm text-ink-muted print:text-black">Total steel</p>
          <p className="figure text-3xl">
            {formatNumber(total.toFixed(2))} kg <span className="text-lg text-hivis print:text-black">{(total / 1000).toFixed(3)} t</span>
          </p>
        </div>
        {byDia.size > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="By bar diameter">
            {[...byDia.entries()]
              .sort(([a], [b]) => a - b)
              .map(([dia, kg]) => (
                <li key={dia} className="num rounded border border-white/20 px-2.5 py-1 text-sm print:border-black">
                  Ø{dia}: {formatNumber(kg.toFixed(2))} kg
                </li>
              ))}
          </ul>
        )}
      </section>

      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <Panel>
          {!data ? (
            <LedgerSkeleton />
          ) : data.length === 0 ? (
            <EmptyState icon={<Ruler className="size-10" />} title="No steel rows yet">
              Add each member (footing, column, beam) to get the total weight to order.
            </EmptyState>
          ) : (
            <Ledger
              rows={data}
              rowKey={(r) => r.id}
              columns={[
                { header: 'Member / location', cell: (r) => <span className="font-semibold">{r.member}</span> },
                { header: 'Dia', cell: (r) => `${r.bar_dia_mm} mm`, align: 'right' },
                { header: 'Bars', cell: (r) => r.bar_count, align: 'right' },
                { header: 'Cut length', cell: (r) => `${formatNumber(r.cut_length_m)} m`, align: 'right' },
                { header: 'Kg / m', cell: (r) => formatNumber(r.unit_weight), align: 'right' },
                { header: 'Weight', cell: (r) => <span className="font-semibold">{formatNumber(r.total_weight_kg)} kg</span>, align: 'right' },
              ]}
              mobile={(r) => ({
                main: (
                  <>
                    <p className="font-semibold">{r.member}</p>
                    <p className="num text-xs text-muted">
                      Ø{r.bar_dia_mm} · {r.bar_count} bars × {formatNumber(r.cut_length_m)} m
                    </p>
                  </>
                ),
                side: `${formatNumber(r.total_weight_kg)} kg`,
              })}
              actions={(r) => (
                <DeleteRowButton
                  what={r.member}
                  onDelete={async () => {
                    await unwrap(supabase.from('bbs_items').delete().eq('id', r.id))
                    reload()
                  }}
                />
              )}
              footer={{ label: 'Total', cells: { 5: `${formatNumber(total.toFixed(2))} kg` } }}
            />
          )}
        </Panel>
      )}
    </>
  )
}

type SteelInput = Pick<BbsItem, 'member' | 'bar_dia_mm' | 'bar_count' | 'cut_length_m'>

function SteelForm({ onSave }: { onSave: (input: SteelInput) => Promise<void> }) {
  const [member, setMember] = useState('')
  const [dia, setDia] = useState(12)
  const [bars, setBars] = useState('')
  const [length, setLength] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave({ member: member.trim(), bar_dia_mm: dia, bar_count: Number(bars), cut_length_m: Number(length) })
      // Keep member and diameter: the next row is usually the same member.
      setBars('')
      setLength('')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
      <Field label="Member / location">{(id) => <Input id={id} value={member} onChange={(e) => setMember(e.target.value)} required maxLength={200} placeholder="F1 footing bottom mesh" />}</Field>
      <Field label="Bar dia">
        {(id) => (
          <Select id={id} value={dia} onChange={(e) => setDia(Number(e.target.value))}>
            {DIAMETERS.map((d) => (
              <option key={d} value={d}>
                {d} mm
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Bars">{(id) => <Input id={id} type="number" inputMode="numeric" min={1} step={1} value={bars} onChange={(e) => setBars(e.target.value)} required />}</Field>
      <Field label="Cut length (m)">
        {(id) => <Input id={id} type="number" inputMode="decimal" min="0.001" step="0.001" value={length} onChange={(e) => setLength(e.target.value)} required />}
      </Field>
      <Button type="submit" busy={busy}>
        <Plus className="size-4" aria-hidden />
        Add row
      </Button>
      <p className="num text-sm text-muted sm:col-span-2 lg:col-span-5" aria-live="polite">
        {calc.steelUnitWeight(dia)} kg/m × {Number(bars) || 0} bars × {Number(length) || 0} m ={' '}
        <strong className="text-text">{formatNumber(calc.steelWeight(dia, Number(bars) || 0, Number(length) || 0))} kg</strong>
      </p>
      {Boolean(error) && (
        <div className="sm:col-span-2 lg:col-span-5">
          <FormError error={error} />
        </div>
      )}
    </form>
  )
}
