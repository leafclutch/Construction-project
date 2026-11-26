import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useToast } from '../components/toast'
import { Button, ErrorState, Field, FormError, Input, PageHeader, Panel, Skeleton } from '../components/ui'
import { ROLE_LABEL } from '../lib/brand'
import { supabase } from '../lib/supabase'
import { unwrap, useAsyncData } from '../lib/useAsyncData'

const getProfile = (userId: string) => unwrap(supabase.from('profiles').select('full_name, email').eq('id', userId).single())

export function ProfilePage() {
  const { session, memberships, membership, selectOrg } = useAuth()
  const userId = session!.user.id
  const profile = useAsyncData(() => getProfile(userId), [userId])
  const navigate = useNavigate()

  return (
    <>
      <PageHeader title="My profile" description="Your name, password and firms." />

      <div className="grid max-w-2xl gap-6">
        <Panel className="p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold">Your details</h2>
          {profile.error && !profile.data ? (
            <ErrorState error={profile.error} onRetry={profile.reload} />
          ) : !profile.data ? (
            <div className="flex flex-col gap-4" aria-busy="true">
              <Skeleton className="h-[4.5rem]" />
              <Skeleton className="h-11" />
            </div>
          ) : (
            <NameForm userId={userId} fullName={profile.data.full_name ?? ''} email={profile.data.email ?? session!.user.email ?? ''} onSaved={profile.reload} />
          )}
        </Panel>

        <Panel className="p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold">Password</h2>
          <PasswordForm />
        </Panel>

        <Panel>
          <h2 className="px-4 pt-4 text-lg font-semibold sm:px-5">Your firms</h2>
          <ul className="mt-2">
            {memberships?.map((m) => (
              <li key={m.orgId} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{m.orgName}</p>
                  <p className="text-sm text-muted">{ROLE_LABEL[m.role]}</p>
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
        </Panel>
      </div>
    </>
  )
}

function NameForm({ userId, fullName, email, onSaved }: { userId: string; fullName: string; email: string; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const toast = useToast()

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await unwrap(supabase.from('profiles').update({ full_name: String(new FormData(e.currentTarget).get('full_name')).trim() }).eq('id', userId).select('id'))
      onSaved()
      toast('Name saved')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Full name" hint="Your team sees this name in the team list.">
        {(id) => <Input id={id} name="full_name" defaultValue={fullName} autoComplete="name" required maxLength={120} />}
      </Field>
      <div>
        <p className="text-sm font-medium">Email</p>
        <p className="mt-1 break-all text-sm text-muted">{email}</p>
      </div>
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
      <Field label="New password" hint="At least 8 characters.">
        {(id) => <Input id={id} name="password" type="password" autoComplete="new-password" required minLength={8} />}
      </Field>
      <Field label="Type it again">{(id) => <Input id={id} name="confirm" type="password" autoComplete="new-password" required minLength={8} />}</Field>
      <FormError error={error} />
      <Button type="submit" busy={busy} className="self-start">
        Change password
      </Button>
    </form>
  )
}
