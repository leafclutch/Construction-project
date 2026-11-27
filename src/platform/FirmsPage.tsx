import { Building, Eye, KeyRound, Pause, Play, Plus, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CredentialsCard } from '../components/CredentialsCard'
import { Modal } from '../components/Modal'
import { LedgerSkeleton } from '../components/records'
import { useToast } from '../components/toast'
import { Button, EmptyState, ErrorState, Field, FormError, Input, PageHeader, Panel, cx } from '../components/ui'
import { createFirm, resetPassword, setFirmStatus, type Credentials } from '../lib/accounts'
import { formatDate, formatNumber } from '../lib/format'
import { supabase } from '../lib/supabase'
import { unwrap, useAsyncData } from '../lib/useAsyncData'

// ponytail: loads every firm at once; page it when there are more than a few hundred.
const listFirms = () =>
  unwrap(
    supabase
      .from('organizations')
      .select('id, name, status, created_at, projects(count), memberships(user_id, role, profiles(full_name, email))')
      .order('created_at', { ascending: false }),
  )

type Firm = Awaited<ReturnType<typeof listFirms>>[number]
type Dialog = { kind: 'new' } | { kind: 'reset' | 'suspend'; firm: Firm } | { kind: 'credentials'; title: string; name: string; credentials: Credentials }

const ownerOf = (f: Firm) => f.memberships.find((m) => m.role === 'owner')

export function FirmsPage() {
  const firms = useAsyncData(listFirms, [])
  const { viewOrg } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const toast = useToast()

  const needle = q.trim().toLowerCase()
  const shown = firms.data?.filter((f) => {
    const owner = ownerOf(f)?.profiles
    return !needle || `${f.name} ${owner?.full_name} ${owner?.email}`.toLowerCase().includes(needle)
  })

  async function activate(firm: Firm) {
    try {
      await setFirmStatus(firm.id, 'active')
      firms.reload()
      toast(`${firm.name} is active again`)
    } catch {
      toast('Could not change the firm. Try again.', 'error')
    }
  }

  return (
    <>
      <PageHeader
        title="Firms"
        description="Every contractor firm on the platform. Create a firm to give its owner a login."
        actions={
          <Button onClick={() => setDialog({ kind: 'new' })}>
            <Plus className="size-4" aria-hidden />
            New firm
          </Button>
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input
          type="search"
          aria-label="Search firms"
          placeholder="Search firms or owners"
          value={q}
          onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
          className="pl-9"
        />
      </div>

      {firms.error && !firms.data ? (
        <ErrorState error={firms.error} onRetry={firms.reload} />
      ) : (
        <Panel>
          {!shown ? (
            <LedgerSkeleton rows={3} />
          ) : shown.length === 0 ? (
            <EmptyState icon={<Building className="size-10" />} title={needle ? 'No firm matches' : 'No firms yet'}>
              {needle ? 'Try another name or email.' : 'Create the first firm to hand its owner a login.'}
            </EmptyState>
          ) : (
            <ul>
              {shown.map((f) => {
                const owner = ownerOf(f)
                const suspended = f.status === 'suspended'
                return (
                  <li key={f.id} className={cx('flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-0', suspended && 'bg-surface-2')}>
                    <div className="min-w-56 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {f.name}
                        {suspended && <span className="rounded bg-signal-soft px-1.5 py-0.5 text-xs font-medium text-signal">Paused</span>}
                      </p>
                      <p className="truncate text-sm text-muted">
                        {owner ? `${owner.profiles?.full_name || 'Owner'} · ${owner.profiles?.email}` : 'No owner'}
                      </p>
                      <p className="num mt-0.5 text-xs text-muted">
                        {formatNumber(f.projects[0]?.count ?? 0)} projects · {formatNumber(f.memberships.length)} people · since {formatDate(f.created_at)}
                      </p>
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          viewOrg({ id: f.id, name: f.name })
                          navigate('/projects')
                        }}
                      >
                        <Eye className="size-4" aria-hidden />
                        Open
                      </Button>
                      {owner && (
                        <button
                          type="button"
                          title="Reset owner password"
                          aria-label={`Reset owner password of ${f.name}`}
                          onClick={() => setDialog({ kind: 'reset', firm: f })}
                          className="grid size-11 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
                        >
                          <KeyRound className="size-4" aria-hidden />
                        </button>
                      )}
                      <button
                        type="button"
                        title={suspended ? 'Turn the firm back on' : 'Pause the firm'}
                        aria-label={suspended ? `Turn ${f.name} back on` : `Pause ${f.name}`}
                        onClick={() => (suspended ? void activate(f) : setDialog({ kind: 'suspend', firm: f }))}
                        className={cx('grid size-11 place-items-center rounded-md hover:bg-surface-2', suspended ? 'text-ledger' : 'text-muted hover:text-signal')}
                      >
                        {suspended ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      )}

      <Modal open={dialog?.kind === 'new' || dialog?.kind === 'credentials'} title={dialog?.kind === 'credentials' ? dialog.title : 'New firm'} onClose={() => setDialog(null)}>
        {dialog?.kind === 'credentials' ? (
          <CredentialsCard name={dialog.name} credentials={dialog.credentials} onDone={() => setDialog(null)} />
        ) : (
          <NewFirmForm
            onCreated={(name, credentials) => {
              firms.reload()
              setDialog({ kind: 'credentials', title: 'Firm created', name, credentials })
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={dialog?.kind === 'reset'}
        title={dialog?.kind === 'reset' ? `Reset the owner password of ${dialog.firm.name}?` : ''}
        confirmLabel="Reset password"
        tone="primary"
        onClose={() => setDialog((d) => (d?.kind === 'reset' ? null : d))}
        onConfirm={async () => {
          if (dialog?.kind !== 'reset') return
          const owner = ownerOf(dialog.firm)!
          const credentials = await resetPassword(dialog.firm.id, owner.user_id)
          setDialog({ kind: 'credentials', title: 'New temporary password', name: owner.profiles?.full_name || dialog.firm.name, credentials })
        }}
      >
        The old password stops working. Send the owner the new temporary password; they set their own after logging in.
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === 'suspend'}
        title={dialog?.kind === 'suspend' ? `Pause ${dialog.firm.name}?` : ''}
        confirmLabel="Pause firm"
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          if (dialog?.kind !== 'suspend') return
          await setFirmStatus(dialog.firm.id, 'suspended')
          firms.reload()
          toast(`${dialog.firm.name} is paused`)
        }}
      >
        Nobody in this firm can open their projects until you turn it back on. Nothing is deleted.
      </ConfirmDialog>
    </>
  )
}

function NewFirmForm({ onCreated }: { onCreated: (ownerName: string, credentials: Credentials) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const ownerName = String(f.get('owner_name')).trim()
    setBusy(true)
    setError(null)
    try {
      const created = await createFirm({ firm_name: String(f.get('firm_name')).trim(), owner_name: ownerName, owner_email: String(f.get('owner_email')).trim() })
      onCreated(ownerName, created)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Firm name">{(id) => <Input id={id} name="firm_name" required minLength={2} maxLength={120} placeholder="RAR Engineering Services" autoComplete="off" />}</Field>
      <Field label="Owner name">{(id) => <Input id={id} name="owner_name" required maxLength={120} autoComplete="off" />}</Field>
      <Field label="Owner email" hint="The owner logs in with this. No email is sent; you share the login details yourself.">
        {(id) => <Input id={id} name="owner_email" type="email" required maxLength={254} autoComplete="off" />}
      </Field>
      <FormError error={error} />
      <Button type="submit" busy={busy} className="sm:self-end">
        Create firm and owner login
      </Button>
    </form>
  )
}
