import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Button, Field, FormError, Input, cx } from '../components/ui'
import { supabase } from '../lib/supabase'
import { AuthLayout } from './AuthLayout'
import { useAuth } from './AuthProvider'

export function OnboardingPage() {
  const { memberships, refreshMemberships, selectOrg, signOut } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  if (memberships?.length) return <Navigate to="/" replace />

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = String(new FormData(e.currentTarget).get('value')).trim()
    setBusy(true)
    setError(null)
    const { data, error } =
      mode === 'create'
        ? await supabase.rpc('create_organization', { p_name: value })
        : await supabase.rpc('accept_invite', { p_code: value })
    if (error) {
      setBusy(false)
      return setError(error)
    }
    selectOrg(data)
    await refreshMemberships()
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout
      title="Set up your firm"
      subtitle="Owners create the firm. Site staff join with the invite code their owner shares."
      footer={
        <button type="button" onClick={() => void signOut()} className="underline underline-offset-4 hover:text-text">
          Log out
        </button>
      }
    >
      <div role="tablist" aria-label="Setup" className="mb-5 grid grid-cols-2 rounded-md border border-line bg-surface p-1">
        {(['create', 'join'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m)
              setError(null)
            }}
            className={cx('min-h-11 rounded text-sm font-semibold', mode === m ? 'bg-ink text-ink-text dark:bg-hivis dark:text-hivis-ink' : 'text-muted')}
          >
            {m === 'create' ? 'Create a firm' : 'Join with code'}
          </button>
        ))}
      </div>
      <form key={mode} onSubmit={submit} className="flex flex-col gap-4">
        {mode === 'create' ? (
          <Field label="Firm name" hint="As written on your registration, e.g. RAR Engineering Services.">
            {(id) => <Input id={id} name="value" required minLength={2} maxLength={120} autoComplete="organization" />}
          </Field>
        ) : (
          <Field label="Invite code" hint="8 letters and numbers, from your firm owner.">
            {(id) => (
              <Input
                id={id}
                name="value"
                required
                minLength={8}
                maxLength={8}
                autoComplete="off"
                autoCapitalize="characters"
                className="font-semibold uppercase tracking-[0.2em]"
              />
            )}
          </Field>
        )}
        <FormError error={error} />
        <Button type="submit" busy={busy} className="w-full">
          {mode === 'create' ? 'Create firm' : 'Join firm'}
        </Button>
      </form>
    </AuthLayout>
  )
}
