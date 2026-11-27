import { Pencil, Search, UserMinus, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CredentialsCard } from '../components/CredentialsCard'
import { Modal } from '../components/Modal'
import { PermissionPicker } from '../components/PermissionPicker'
import { LedgerSkeleton } from '../components/records'
import { useToast } from '../components/toast'
import { Button, EmptyState, ErrorState, FormError, Input, PageHeader, Panel, cx } from '../components/ui'
import type { Credentials } from '../lib/accounts'
import { describePermissions, PRESETS, type Permission } from '../lib/permissions'
import { useAsyncData } from '../lib/useAsyncData'
import { useProject } from '../projects/ProjectLayout'
import { addToProject, listProjectTeam, listStaff, removeFromProject, setPermissions, type TeamMember } from './api'
import { NewStaffForm } from './NewStaffForm'

type Dialog =
  | { kind: 'add' }
  | { kind: 'edit' | 'remove'; member: TeamMember }
  | { kind: 'credentials'; name: string; credentials: Credentials }

const nameOf = (m: TeamMember) => m.memberships?.profiles?.full_name || m.memberships?.profiles?.email || 'Unnamed'

/** Who works on this project and what each person may do here. Owners and admins always see everything. */
export function ProjectTeamPage() {
  const { project } = useProject()
  const { isAdmin } = useAuth()
  const team = useAsyncData(() => listProjectTeam(project.id), [project.id])
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const toast = useToast()

  return (
    <>
      <PageHeader
        title="Team"
        description="Who works on this project and what they can do here. Owners and admins can always see and do everything."
        actions={
          isAdmin && (
            <Button onClick={() => setDialog({ kind: 'add' })}>
              <UserPlus className="size-4" aria-hidden />
              Add people
            </Button>
          )
        }
      />

      {team.error && !team.data ? (
        <ErrorState error={team.error} onRetry={team.reload} />
      ) : (
        <Panel>
          {!team.data ? (
            <LedgerSkeleton rows={2} />
          ) : team.data.length === 0 ? (
            <EmptyState icon={<Users className="size-10" />} title="Nobody added yet">
              Add site staff so they can record work on this project from their phones.
            </EmptyState>
          ) : (
            <ul>
              {team.data.map((m) => (
                <li key={m.user_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-0">
                  <div className="min-w-48 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {nameOf(m)}
                      {m.memberships && !m.memberships.active && (
                        <span className="rounded bg-signal-soft px-1.5 py-0.5 text-xs font-medium text-signal">Access off</span>
                      )}
                    </p>
                    <p className="truncate text-sm text-muted">{m.memberships?.profiles?.email}</p>
                    <p className="mt-1 text-sm">{describePermissions(m.permissions)}</p>
                  </div>
                  {isAdmin && (
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Change what ${nameOf(m)} can do`}
                        title="Change permissions"
                        onClick={() => setDialog({ kind: 'edit', member: m })}
                        className="grid size-11 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${nameOf(m)} from this project`}
                        title="Remove from project"
                        onClick={() => setDialog({ kind: 'remove', member: m })}
                        className="grid size-11 place-items-center rounded-md text-muted hover:bg-signal-soft hover:text-signal"
                      >
                        <UserMinus className="size-4" aria-hidden />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <Modal
        open={dialog?.kind === 'add' || dialog?.kind === 'credentials'}
        title={dialog?.kind === 'credentials' ? 'Login created' : `Add people to ${project.name}`}
        onClose={() => setDialog(null)}
      >
        {dialog?.kind === 'credentials' ? (
          <CredentialsCard name={dialog.name} credentials={dialog.credentials} onDone={() => setDialog(null)} />
        ) : (
          dialog?.kind === 'add' && (
            <AddPeople
              onAdded={(name) => {
                team.reload()
                setDialog(null)
                toast(`${name} added to the project`)
              }}
              onCreated={(name, credentials) => {
                team.reload()
                setDialog({ kind: 'credentials', name, credentials })
              }}
              onTeam={new Set(team.data?.map((m) => m.user_id))}
            />
          )
        )}
      </Modal>

      <Modal open={dialog?.kind === 'edit'} title={dialog?.kind === 'edit' ? `What ${nameOf(dialog.member)} can do` : ''} onClose={() => setDialog(null)}>
        {dialog?.kind === 'edit' && (
          <PermissionsForm
            key={dialog.member.user_id}
            initial={dialog.member.permissions as Permission[]}
            submitLabel="Save permissions"
            onSave={async (permissions) => {
              await setPermissions(project.id, dialog.member.user_id, permissions)
              team.reload()
              setDialog(null)
              toast('Permissions saved')
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={dialog?.kind === 'remove'}
        title={dialog?.kind === 'remove' ? `Remove ${nameOf(dialog.member)} from ${project.name}?` : ''}
        confirmLabel="Remove"
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          if (dialog?.kind !== 'remove') return
          await removeFromProject(project.id, dialog.member.user_id)
          team.reload()
          toast('Removed from the project')
        }}
      >
        They can no longer open this project. Their login and their other projects stay. The records they added stay.
      </ConfirmDialog>
    </>
  )
}

function PermissionsForm({ initial, submitLabel, onSave }: { initial: Permission[]; submitLabel: string; onSave: (p: Permission[]) => Promise<void> }) {
  const [permissions, setPerms] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  return (
    <div className="flex flex-col gap-4">
      <PermissionPicker value={permissions} onChange={setPerms} />
      <FormError error={error} />
      <Button
        busy={busy}
        className="sm:self-end"
        onClick={async () => {
          setBusy(true)
          setError(null)
          try {
            await onSave(permissions)
          } catch (e) {
            setError(e)
            setBusy(false)
          }
        }}
      >
        {submitLabel}
      </Button>
    </div>
  )
}

/** Pick someone from the firm's staff list (searchable), or create a new login. */
function AddPeople({
  onTeam,
  onAdded,
  onCreated,
}: {
  onTeam: Set<string>
  onAdded: (name: string) => void
  onCreated: (name: string, credentials: Credentials) => void
}) {
  const { project } = useProject()
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const staff = useAsyncData(() => listStaff(project.org_id), [project.org_id])
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string | null>(null)

  const available = staff.data?.filter((m) => m.role === 'site_staff' && m.active && !onTeam.has(m.user_id))
  const needle = query.trim().toLowerCase()
  const shown = available?.filter((m) => !needle || `${m.profiles?.full_name} ${m.profiles?.email}`.toLowerCase().includes(needle))
  const person = available?.find((m) => m.user_id === picked)

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Who to add" className="grid grid-cols-2 gap-1 rounded-md bg-surface-2 p-1">
        {(['existing', 'new'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cx('min-h-11 rounded text-sm font-semibold', mode === m ? 'bg-surface shadow-sm' : 'text-muted')}
          >
            {m === 'existing' ? 'From your staff' : 'New person'}
          </button>
        ))}
      </div>

      {mode === 'new' ? (
        <NewStaffForm project={project} onCreated={onCreated} />
      ) : staff.error && !staff.data ? (
        <ErrorState error={staff.error} onRetry={staff.reload} />
      ) : !shown ? (
        <LedgerSkeleton rows={2} />
      ) : person ? (
        <>
          <div className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2">
            <div className="min-w-0">
              <p className="font-semibold">{person.profiles?.full_name}</p>
              <p className="truncate text-sm text-muted">{person.profiles?.email}</p>
            </div>
            <Button variant="ghost" onClick={() => setPicked(null)}>
              Change
            </Button>
          </div>
          <PermissionsForm
            initial={PRESETS[0].permissions}
            submitLabel="Add to project"
            onSave={async (permissions) => {
              await addToProject(project, person.user_id, permissions)
              onAdded(person.profiles?.full_name || 'Staff member')
            }}
          />
        </>
      ) : available!.length === 0 ? (
        <p className="text-sm text-muted">
          Everyone on your staff list is already on this project.{' '}
          <button type="button" onClick={() => setMode('new')} className="font-semibold text-text underline underline-offset-4">
            Add a new person
          </button>
        </p>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input type="search" aria-label="Search staff" placeholder="Search by name or email" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" autoFocus />
          </div>
          <ul className="max-h-72 overflow-y-auto rounded-md border border-line">
            {shown.map((m) => (
              <li key={m.user_id} className="border-b border-line last:border-0">
                <button type="button" onClick={() => setPicked(m.user_id)} className="flex min-h-12 w-full flex-col justify-center px-3 py-2 text-left hover:bg-surface-2">
                  <span className="font-semibold">{m.profiles?.full_name || 'Unnamed'}</span>
                  <span className="truncate text-sm text-muted">{m.profiles?.email}</span>
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="px-3 py-3 text-sm text-muted">Nobody matches “{query}”.</li>}
          </ul>
        </>
      )}
    </div>
  )
}
