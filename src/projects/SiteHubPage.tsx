import { Building2, ChevronRight, FileText, LayoutList, Pencil, Ruler, Truck, UsersRound, type LucideIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Modal } from '../components/Modal'
import { useToast } from '../components/toast'
import { Button, cx, ErrorState, Field, FormError, Input, Panel, Skeleton } from '../components/ui'
import { MODULES } from '../lib/permissions'
import { formatDate, formatNPR, formatNumber } from '../lib/format'
import { useAsyncData } from '../lib/useAsyncData'
import { deleteProject, getProjectSummary, updateFinance, updateProject } from './api'
import { ProjectForm, statusLabel } from './ProjectForm'
import { useProject } from './ProjectLayout'

export function SiteHubPage() {
  const { project, reloadProject, can } = useProject()
  const { isAdmin } = useAuth()
  const summary = useAsyncData(() => getProjectSummary(project.id), [project.id], 'summary')
  const [dialog, setDialog] = useState<'progress' | 'edit' | 'delete' | null>(null)
  const navigate = useNavigate()
  const toast = useToast()

  const finance = project.finance
  const contract = Number(finance?.contract_amount ?? 0)
  const billed = Number(finance?.billed_amount ?? 0)
  const pct = contract > 0 ? (billed / contract) * 100 : 0
  const s = summary.data
  const spent = s ? Number(s.labour_cost) + Number(s.vat_gross) : 0

  return (
    <>
      {/* The project information board (सूचना पाटी) that stands outside every site. */}
      <section aria-labelledby="board-title" className="overflow-hidden rounded-lg bg-hivis text-hivis-ink">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-6">
          <p className="min-w-0 text-sm font-semibold wrap-anywhere">
            {statusLabel[project.status]}
            {project.code && <span className="font-normal"> · {project.code}</span>}
          </p>
          {isAdmin && (
            <div className="no-print flex gap-2">
              <button
                type="button"
                onClick={() => setDialog('edit')}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-hivis-ink/25 px-3 text-sm font-semibold hover:bg-hivis-ink/10"
              >
                <Pencil className="size-4" aria-hidden />
                Edit
              </button>
              <button
                type="button"
                onClick={() => setDialog('progress')}
                className="min-h-11 rounded-md bg-hivis-ink px-3 text-sm font-semibold text-hivis hover:bg-hivis-ink/90"
              >
                Update billing
              </button>
            </div>
          )}
        </div>
        <div className="px-5 pb-5 pt-2 sm:px-7">
          <h1 id="board-title" className="text-3xl leading-[1.05] sm:text-[2.75rem]" style={{ fontVariationSettings: "'wdth' 75", fontWeight: 800 }}>
            {project.name}
          </h1>
          {(project.location || project.client_name || project.start_date) && (
            <p className="mt-2 text-sm">
              {[project.location, project.client_name && `Client: ${project.client_name}`, project.start_date && `Started ${formatDate(project.start_date)}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
        {finance && (
          <>
            <dl className="grid border-t-2 border-hivis-ink/80 sm:grid-cols-3">
              <BoardFigure label="Contract amount" value={contract} />
              <BoardFigure label="Billed so far" value={billed} />
              <BoardFigure label="Remaining" value={Math.max(0, contract - billed)} />
            </dl>
            <div className="flex items-center gap-3 bg-hivis-ink px-5 py-3 text-hivis sm:px-7">
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-hivis/25"
                role="progressbar"
                aria-label="Billed of contract"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full rounded-full bg-hivis" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              <span className="figure text-lg">{pct.toFixed(1)}%</span>
            </div>
          </>
        )}
      </section>

      <div className={cx('mt-8 grid gap-8', finance && 'lg:grid-cols-[1fr_18rem]')}>
        <section aria-labelledby="records-title">
          <h2 id="records-title" className="mb-3 text-lg font-semibold">
            Site records
          </h2>
          {summary.error && !s ? (
            <ErrorState error={summary.error} onRetry={summary.reload} />
          ) : (
            <Panel>
              <ul>
                {can('labour.view') && (
                  <RecordRow to="labour" icon={UsersRound} label="Labour" value={s && formatNPR(s.labour_cost)} detail={s && plural(s.man_days, 'man-day')} />
                )}
                {can('materials.view') && <RecordRow to="materials" icon={Truck} label="Materials" value={s && plural(s.material_count, 'delivery', 'deliveries')} />}
                {can('bills.view') && (
                  <RecordRow to="bills" icon={FileText} label="VAT bills" value={s && formatNPR(s.vat_gross)} detail={s && plural(s.vat_bill_count, 'bill')} />
                )}
                {can('steel.view') && (
                  <RecordRow to="steel" icon={Ruler} label="Steel (BBS)" value={s && `${formatNumber(s.steel_kg)} kg`} detail={s && `${(Number(s.steel_kg) / 1000).toFixed(3)} t`} />
                )}
                {can('boq.view') && <RecordRow to="boq" icon={LayoutList} label="BOQ" value={s && formatNPR(s.boq_total)} />}
                {can('drawings.view') && <RecordRow to="drawings" icon={Building2} label="Drawings" value={s && plural(s.drawing_count, 'file')} />}
              </ul>
              {!MODULES.some((m) => can(`${m.key}.view`)) && (
                <p className="p-4 text-sm text-muted">You can see this project, but no records yet. Ask the firm owner to turn on what you need.</p>
              )}
            </Panel>
          )}
        </section>

        {finance && (
          <section aria-labelledby="money-title">
            <h2 id="money-title" className="mb-3 text-lg font-semibold">
              Money so far
            </h2>
            <Panel className="p-5">
              {s ? (
                <dl className="flex flex-col gap-4">
                  <MoneyLine label="Billed to client" value={billed} />
                  <MoneyLine label="Recorded costs" value={spent} hint="Labour + VAT bills" />
                  <div className="border-t border-line pt-4">
                    <MoneyLine label={billed - spent >= 0 ? 'Margin so far' : 'Spent beyond billing'} value={Math.abs(billed - spent)} tone={billed - spent >= 0 ? 'good' : 'bad'} />
                  </div>
                </dl>
              ) : (
                <div className="flex flex-col gap-4" aria-busy="true">
                  <Skeleton className="h-11" />
                  <Skeleton className="h-11" />
                  <Skeleton className="h-11" />
                </div>
              )}
            </Panel>
          </section>
        )}
      </div>

      <Modal open={dialog === 'progress'} title="Update billing" onClose={() => setDialog(null)}>
        <BillingForm
          billed={billed}
          contract={contract}
          onSave={async (value) => {
            await updateFinance(project.id, { billed_amount: value })
            reloadProject()
            setDialog(null)
            toast('Billing updated')
          }}
        />
      </Modal>

      <Modal open={dialog === 'edit'} title="Edit project" onClose={() => setDialog(null)}>
        <ProjectForm
          initial={project}
          submitLabel="Save changes"
          onSubmit={async (input, contractAmount) => {
            await updateProject(project.id, input)
            await updateFinance(project.id, { contract_amount: contractAmount })
            reloadProject()
            setDialog(null)
            toast('Changes saved')
          }}
        />
        <div className="mt-6 border-t border-line pt-4">
          <button type="button" onClick={() => setDialog('delete')} className="text-sm font-semibold text-signal underline underline-offset-4">
            Delete this project
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={dialog === 'delete'}
        title={`Delete ${project.name}?`}
        confirmLabel="Delete project"
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          await deleteProject(project)
          reloadProject()
          toast('Project deleted')
          navigate('/projects', { replace: true })
        }}
      >
        All labour, material, bill, steel, BOQ and drawing records of this project, and their uploaded files, are removed for good.
      </ConfirmDialog>
    </>
  )
}

function plural(n: number | string | null, one: string, many = `${one}s`) {
  const v = Number(n ?? 0)
  return `${formatNumber(v)} ${v === 1 ? one : many}`
}

function BoardFigure({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-hivis-ink/30 px-5 py-3 not-last:border-b sm:block sm:px-7 sm:py-4 sm:not-last:border-r sm:not-last:border-b-0">
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="figure whitespace-nowrap text-xl sm:mt-1 sm:text-[1.625rem]">{formatNPR(value)}</dd>
    </div>
  )
}

function RecordRow({ to, icon: Icon, label, value, detail }: { to: string; icon: LucideIcon; label: string; value?: string; detail?: string }) {
  return (
    <li className="border-b border-line last:border-0">
      <Link to={to} className="flex min-h-16 items-center gap-4 px-4 hover:bg-surface-2">
        <Icon className="size-5 shrink-0 text-muted" aria-hidden />
        <span className="flex-1 font-medium">{label}</span>
        <span className="flex flex-col items-end">
          {value === undefined ? <Skeleton className="h-5 w-28" /> : <span className="num font-semibold">{value}</span>}
          {detail && <span className="num text-xs text-muted">{detail}</span>}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  )
}

function MoneyLine({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div>
      <dt className="text-sm text-muted">
        {label}
        {hint && <span className="block text-xs">{hint}</span>}
      </dt>
      <dd className={`figure mt-0.5 text-xl ${tone === 'good' ? 'text-ledger' : tone === 'bad' ? 'text-signal' : ''}`}>{formatNPR(value)}</dd>
    </div>
  )
}

function BillingForm({ billed, contract, onSave }: { billed: number; contract: number; onSave: (v: number) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave(Number(new FormData(e.currentTarget).get('billed')))
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Total billed to client (Rs.)" hint={`Contract amount is ${formatNPR(contract)}. Enter the running total of all bills, not just the latest one.`}>
        {(id) => <Input id={id} name="billed" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={billed} required autoFocus />}
      </Field>
      <FormError error={error} />
      <Button type="submit" busy={busy} className="self-end">
        Save billing
      </Button>
    </form>
  )
}
