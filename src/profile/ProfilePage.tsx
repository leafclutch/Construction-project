import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Avatar, useRoleLine } from '../components/AccountMenu'
import { useToast } from '../components/toast'
import { Button, Field, FormError, Input, PageHeader, Panel } from '../components/ui'
import { ROLE_LABEL } from '../lib/brand'
import { supabase } from '../lib/supabase'
import { unwrap } from '../lib/useAsyncData'

export function ProfilePage() {
  const { session, memberships, membership, selectOrg, fullName, refresh } = useAuth()
  const roleLine = useRoleLine()
  const navigate = useNavigate()
  const email = session!.user.email ?? ''

  return (
    <>
      <PageHeader title="My profile" />

      <div className="grid max-w-4xl gap-5">
        <Panel className="flex items-center gap-4 p-4 sm:p-5">
          <Avatar className="size-14 text-lg sm:size-16 sm:text-xl" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{fullName || 'No name yet'}</p>
            <p className="truncate text-sm text-muted">{email}</p>
            {roleLine && <p className="mt-1.5 inline-block rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium">{roleLine}</p>}
          </div>
        </Panel>

        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <Section title="Your name" description="Your team sees this name in lists and on records.">
            <NameForm userId={session!.user.id} fullName={fullName ?? ''} onSaved={refresh} />
          </Section>
          <Section title="Password" description="At least 8 characters. You stay logged in here.">
            <PasswordForm />
          </Section>
        </div>

        {memberships && memberships.length > 1 && (
          <Section title="Your firms" description="Switch to work in another firm.">
            <ul className="-m-4 sm:-m-5">
              {memberships.map((m) => (
                <li key={m.orgId} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3 first:border-t-0 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{m.orgName}</p>
                    <p className="text-sm text-muted">{m.active ? ROLE_LABEL[m.role] : `${ROLE_LABEL[m.role]} · access off`}</p>
                  </div>
                  {m.orgId === membership?.orgId ? (
                    <span className="text-sm font-medium text-muted">Current</span>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        selectOrg(m.orgId)
                        navigate('/projects')
                      }}
                    >
                      Switch
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </>
  )
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Panel>
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </Panel>
  )
}

function NameForm({ userId, fullName, onSaved }: { userId: string; fullName: string; onSaved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const toast = useToast()

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await unwrap(supabase.from('profiles').update({ full_name: String(new FormData(e.currentTarget).get('full_name')).trim() }).eq('id', userId).select('id'))
      await onSaved()
      toast('Name saved')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Full name">{(id) => <Input id={id} name="full_name" defaultValue={fullName} autoComplete="name" required maxLength={120} />}</Field>
      <FormError error={error} />
      <Button type="submit" busy={busy} className="self-start">
        Save name
      </Button>
    </form>
  )
}

function PasswordForm() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const toast = useToast()

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const password = String(f.get('password'))
    if (password !== String(f.get('confirm'))) return setError({ code: 'password_mismatch' })
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(error)
    form.reset()
    toast('Password changed')
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="New password">{(id) => <Input id={id} name="password" type="password" autoComplete="new-password" required minLength={8} />}</Field>
      <Field label="Type it again">{(id) => <Input id={id} name="confirm" type="password" autoComplete="new-password" required minLength={8} />}</Field>
      <FormError error={error} />
      <Button type="submit" busy={busy} className="self-start">
        Change password
      </Button>
    </form>
  )
}
