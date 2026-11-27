import { KeyRound, Power, Search, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CredentialsCard } from '../components/CredentialsCard'
import { Modal } from '../components/Modal'
import { LedgerSkeleton } from '../components/records'
import { useToast } from '../components/toast'
import { Button, EmptyState, ErrorState, Input, PageHeader, Panel, Select, cx } from '../components/ui'
import { resetPassword, type Credentials } from '../lib/accounts'
import { ROLE_LABEL, type Role } from '../lib/brand'
import { useAsyncData } from '../lib/useAsyncData'
import { useProjects } from '../projects/ProjectsProvider'
import { listAssignments, listStaff, setActive, setRole, type StaffMember } from './api'
import { NewStaffForm } from './NewStaffForm'

type Dialog = { kind: 'new' } | { kind: 'reset' | 'off'; member: StaffMember } | { kind: 'credentials'; title: string; name: string; credentials: Credentials }

const nameOf = (m: StaffMember) => m.profiles?.full_name || m.profiles?.email || 'Unnamed'

/** Everyone who can log in to the firm. Owners/admins add people, reset passwords and turn access off. */
export function StaffPage() {
  const { membership, isAdmin, session } = useAuth()
  const orgId = membership!.orgId
  const staff = useAsyncData(() => Promise.all([listStaff(orgId), listAssignments(orgId)]), [orgId], 'staff')
  const { projects } = useProjects()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const toast = useToast()

  if (!isAdmin && !membership?.readOnly) {
    return (
      <EmptyState icon={<Users className="size-10" />} title="Only the firm owner and admins manage staff">
        <Link to="/projects" className="font-semibold text-text underline underline-offset-4">
          Back to your projects
        </Link>
      </EmptyState>
    )
  }

  const [members, assignments] = staff.data ?? [undefined, []]
  const projectName = new Map(projects?.map((p) => [p.id, p.name]))
  const needle = q.trim().toLowerCase()
  const shown = members?.filter((m) => !needle || `${m.profiles?.full_name} ${m.profiles?.email}`.toLowerCase().includes(needle))

  return (
    <>
      <PageHeader
        title="Staff"
        description={`Everyone who can log in to ${membership!.orgName}.`}
        actions={
          isAdmin && (
            <Button onClick={() => setDialog({ kind: 'new' })}>
              <UserPlus className="size-4" aria-hidden />
              Add staff
            </Button>
          )
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input
          type="search"
          aria-label="Search staff"
          placeholder="Search by name or email"
          value={q}
          onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
          className="pl-9"
        />
      </div>

      {staff.error && !staff.data ? (
        <ErrorState error={staff.error} onRetry={staff.reload} />
      ) : (
        <Panel>
          {!shown ? (
            <LedgerSkeleton rows={3} />
          ) : shown.length === 0 ? (
            <EmptyState icon={<Users className="size-10" />} title={needle ? 'Nobody matches' : 'No staff yet'}>
              {needle ? 'Try a different name or email.' : 'Add the people who record work on your sites.'}
            </EmptyState>
          ) : (
            <ul>
              {shown.map((m) => {
                const isMe = m.user_id === session?.user.id
                const manageable = isAdmin && m.role !== 'owner' && !isMe && (membership!.role === 'owner' || m.role === 'site_staff')
                const onProjects = assignments.filter((a) => a.user_id === m.user_id).map((a) => projectName.get(a.project_id) ?? '')
                return (
                  <li key={m.user_id} className={cx('flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-0', !m.active && 'bg-surface-2')}>
                    <div className="min-w-48 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {nameOf(m)}
                        {isMe && <span className="font-normal text-muted">(you)</span>}
                        {!m.active && <span className="rounded bg-signal-soft px-1.5 py-0.5 text-xs font-medium text-signal">Access off</span>}
                      </p>
                      <p className="truncate text-sm text-muted">{m.profiles?.email}</p>
                      <p className="mt-0.5 text-sm">
                        {m.role === 'site_staff' ? (
                          onProjects.length ? (
                            onProjects.join(', ')
                          ) : (
                            <span className="text-muted">Not on any project yet</span>
                          )
                        ) : (
                          <span className="text-muted">All projects</span>
                        )}
                      </p>
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      {manageable && membership!.role === 'owner' ? (
                        <RoleSelect orgId={orgId} member={m} onChanged={staff.reload} />
                      ) : (
                        <span className="px-2 text-sm font-medium">{ROLE_LABEL[m.role]}</span>
                      )}
                      {manageable && (
                        <>
                          <button
                            type="button"
                            aria-label={`Reset password of ${nameOf(m)}`}
                            title="Reset password"
                            onClick={() => setDialog({ kind: 'reset', member: m })}
                            className="grid size-11 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
                          >
                            <KeyRound className="size-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            aria-label={m.active ? `Turn off access of ${nameOf(m)}` : `Turn on access of ${nameOf(m)}`}
                            title={m.active ? 'Turn off access' : 'Turn on access'}
                            onClick={async () => {
                              if (m.active) return setDialog({ kind: 'off', member: m })
                              try {
                                await setActive(orgId, m.user_id, true)
                                staff.reload()
                                toast(`${nameOf(m)} can log in again`)
                              } catch {
                                toast('Could not turn access on. Try again.', 'error')
                              }
                            }}
                            className={cx(
                              'grid size-11 place-items-center rounded-md hover:bg-surface-2',
                              m.active ? 'text-muted hover:text-signal' : 'text-ledger',
                            )}
                          >
                            <Power className="size-4" aria-hidden />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      )}

      <p className="mt-4 text-sm text-muted">
        To choose what someone can do on a site, open the project and go to <span className="font-medium text-text">Team</span>.
      </p>

      <Modal
        open={dialog?.kind === 'new' || dialog?.kind === 'credentials'}
        title={dialog?.kind === 'credentials' ? dialog.title : 'Add staff'}
        onClose={() => setDialog(null)}
      >
        {dialog?.kind === 'credentials' ? (
          <CredentialsCard name={dialog.name} credentials={dialog.credentials} onDone={() => setDialog(null)} />
        ) : (
          <NewStaffForm
            projects={projects}
            onCreated={(name, credentials) => {
              staff.reload()
              setDialog({ kind: 'credentials', title: 'Login created', name, credentials })
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={dialog?.kind === 'reset'}
        title={dialog?.kind === 'reset' ? `Reset password of ${nameOf(dialog.member)}?` : ''}
        confirmLabel="Reset password"
        tone="primary"
        // The confirm step hands over to the credentials dialog; only close if still on the confirm step.
        onClose={() => setDialog((d) => (d?.kind === 'reset' ? null : d))}
        onConfirm={async () => {
          if (dialog?.kind !== 'reset') return
          const credentials = await resetPassword(orgId, dialog.member.user_id)
          setDialog({ kind: 'credentials', title: 'New temporary password', name: nameOf(dialog.member), credentials })
        }}
      >
        Their old password stops working. You get a new temporary password to send them, and they set their own after logging in.
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === 'off'}
        title={dialog?.kind === 'off' ? `Turn off access of ${nameOf(dialog.member)}?` : ''}
        confirmLabel="Turn off access"
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          if (dialog?.kind !== 'off') return
          await setActive(orgId, dialog.member.user_id, false)
          staff.reload()
          toast(`${nameOf(dialog.member)} can no longer log in to this firm`)
        }}
      >
        They lose access to every project at once. The records they added stay. You can turn access back on any time.
      </ConfirmDialog>
    </>
  )
}

function RoleSelect({ orgId, member, onChanged }: { orgId: string; member: StaffMember; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  return (
    <Select
      aria-label={`Role of ${nameOf(member)}`}
      value={member.role}
      disabled={busy}
      className="w-32"
      onChange={async (e) => {
        setBusy(true)
        try {
          await setRole(orgId, member.user_id, e.target.value as Role)
          onChanged()
          toast('Role changed')
        } catch {
          toast('Could not change the role. Try again.', 'error')
        } finally {
          setBusy(false)
        }
      }}
    >
      <option value="admin">{ROLE_LABEL.admin}</option>
      <option value="site_staff">{ROLE_LABEL.site_staff}</option>
    </Select>
  )
}
