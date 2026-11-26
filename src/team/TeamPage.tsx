import { Copy, Share2, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DeleteRowButton, LedgerSkeleton } from '../components/records'
import { useToast } from '../components/toast'
import { Button, EmptyState, ErrorState, FormError, PageHeader, Panel, Select } from '../components/ui'
import { formatDate } from '../lib/format'
import { supabase, type Enums } from '../lib/supabase'
import { unwrap, useAsyncData } from '../lib/useAsyncData'

type Role = Enums<'member_role'>
const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', admin: 'Admin', site_staff: 'Site staff' }
const ROLE_HELP: Record<Role, string> = {
  owner: 'Created the firm. Full control.',
  admin: 'Manages projects, BOQ, drawings and team. Can edit and delete records.',
  site_staff: 'Adds labour, materials, bills and steel. Cannot edit or delete.',
}

const listMembers = (orgId: string) =>
  unwrap(supabase.from('memberships').select('user_id, role, created_at, profiles(full_name, email)').eq('org_id', orgId).order('created_at'))

const listInvites = (orgId: string) =>
  unwrap(
    supabase
      .from('invites')
      .select('id, code, role, expires_at')
      .eq('org_id', orgId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  )

export function TeamPage() {
  const { membership, isAdmin, session, refreshMemberships } = useAuth()
  const orgId = membership!.orgId
  const members = useAsyncData(() => listMembers(orgId), [orgId])
  const invites = useAsyncData(() => (isAdmin ? listInvites(orgId) : Promise.resolve([])), [orgId, isAdmin])
  const [leaving, setLeaving] = useState(false)
  const toast = useToast()

  return (
    <>
      <PageHeader title="Team" description={`People in ${membership!.orgName} and what they can do.`} />

      {isAdmin && <InvitePanel orgId={orgId} orgName={membership!.orgName} invites={invites} />}

      <h2 className="mb-3 mt-8 text-lg font-semibold">Members</h2>
      {members.error && !members.data ? (
        <ErrorState error={members.error} onRetry={members.reload} />
      ) : (
        <Panel>
          {!members.data ? (
            <LedgerSkeleton rows={2} />
          ) : members.data.length === 0 ? (
            <EmptyState icon={<Users className="size-10" />} title="No members" />
          ) : (
            <ul>
              {members.data.map((m) => {
                const isMe = m.user_id === session?.user.id
                const editable = isAdmin && m.role !== 'owner' && !isMe
                return (
                  <li key={m.user_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {m.profiles?.full_name || 'Unnamed'} {isMe && <span className="font-normal text-muted">(you)</span>}
                      </p>
                      <p className="truncate text-sm text-muted">{m.profiles?.email}</p>
                    </div>
                    {editable ? (
                      <RoleSelect
                        value={m.role}
                        onChange={async (role) => {
                          await unwrap(supabase.from('memberships').update({ role }).eq('org_id', orgId).eq('user_id', m.user_id))
                          members.reload()
                          toast('Role changed')
                        }}
                      />
                    ) : (
                      <span className="text-sm font-medium" title={ROLE_HELP[m.role]}>
                        {ROLE_LABEL[m.role]}
                      </span>
                    )}
                    {editable && (
                      <DeleteRowButton
                        what={`${m.profiles?.full_name || 'this member'} from the firm`}
                        onDelete={async () => {
                          await unwrap(supabase.from('memberships').delete().eq('org_id', orgId).eq('user_id', m.user_id))
                          members.reload()
                        }}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      )}

      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
          <div key={r}>
            <dt className="font-semibold">{ROLE_LABEL[r]}</dt>
            <dd className="text-muted">{ROLE_HELP[r]}</dd>
          </div>
        ))}
      </dl>

      {membership!.role !== 'owner' && (
        <div className="mt-10 border-t border-line pt-6">
          <Button variant="secondary" onClick={() => setLeaving(true)}>
            Leave {membership!.orgName}
          </Button>
          <ConfirmDialog
            open={leaving}
            title={`Leave ${membership!.orgName}?`}
            confirmLabel="Leave firm"
            onClose={() => setLeaving(false)}
            onConfirm={async () => {
              await unwrap(supabase.from('memberships').delete().eq('org_id', orgId).eq('user_id', session!.user.id))
              await refreshMemberships()
            }}
          >
            You will lose access to its projects until an admin invites you again.
          </ConfirmDialog>
        </div>
      )}
    </>
  )
}

function RoleSelect({ value, onChange }: { value: Role; onChange: (role: Role) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  return (
    <Select
      aria-label="Role"
      value={value}
      disabled={busy}
      className="w-36"
      onChange={async (e) => {
        setBusy(true)
        try {
          await onChange(e.target.value as Role)
        } catch {
          toast('Could not change the role. Try again.', 'error')
        } finally {
          setBusy(false)
        }
      }}
    >
      <option value="admin">Admin</option>
      <option value="site_staff">Site staff</option>
    </Select>
  )
}

type InvitesState = ReturnType<typeof useAsyncData<Awaited<ReturnType<typeof listInvites>>>>

function InvitePanel({ orgId, orgName, invites }: { orgId: string; orgName: string; invites: InvitesState }) {
  const [role, setRole] = useState<Role>('site_staff')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const toast = useToast()

  async function create() {
    setBusy(true)
    setError(null)
    try {
      await unwrap(supabase.from('invites').insert({ org_id: orgId, role }))
      invites.reload()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  function shareText(code: string) {
    return `Join ${orgName} on Nirman Sathi. Sign up at ${window.location.origin}/signup and enter invite code ${code}.`
  }

  async function share(code: string) {
    const text = shareText(code)
    if (navigator.share) {
      await navigator.share({ text }).catch(() => {})
      return
    }
    await navigator.clipboard.writeText(text)
    toast('Invite message copied')
  }

  return (
    <Panel className="p-4 sm:p-5">
      <h2 className="text-lg font-semibold">Invite someone</h2>
      <p className="mt-1 text-sm text-muted">Create a code and send it to them. It works once and expires in 7 days.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Select aria-label="Role for the invite" value={role} onChange={(e) => setRole(e.target.value as Role)} className="w-40">
          <option value="site_staff">Site staff</option>
          <option value="admin">Admin</option>
        </Select>
        <Button onClick={create} busy={busy}>
          <UserPlus className="size-4" aria-hidden />
          Create invite code
        </Button>
      </div>
      <div className="mt-3">
        <FormError error={error} />
      </div>

      {invites.error && !invites.data ? (
        <ErrorState error={invites.error} onRetry={invites.reload} className="mt-4" />
      ) : invites.data && invites.data.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {invites.data.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-surface-2 px-4 py-2">
              <span className="figure text-2xl tracking-[0.15em]">{inv.code}</span>
              <span className="flex-1 text-sm text-muted">
                {ROLE_LABEL[inv.role]} · expires {formatDate(inv.expires_at)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`Copy code ${inv.code}`}
                  onClick={() => navigator.clipboard.writeText(inv.code).then(() => toast('Code copied'))}
                  className="grid size-11 place-items-center rounded-md hover:bg-line/50"
                >
                  <Copy className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Share invite ${inv.code}`}
                  onClick={() => void share(inv.code)}
                  className="grid size-11 place-items-center rounded-md hover:bg-line/50"
                >
                  <Share2 className="size-4" aria-hidden />
                </button>
                <DeleteRowButton
                  what={`invite ${inv.code}`}
                  onDelete={async () => {
                    await unwrap(supabase.from('invites').delete().eq('id', inv.id))
                    invites.reload()
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  )
}
