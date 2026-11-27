import { useState, type FormEvent } from 'react'
import { Button, Field, FormError, Input } from '../components/ui'
import { supabase } from '../lib/supabase'
import { unwrap } from '../lib/useAsyncData'
import { AuthLayout } from './AuthLayout'
import { useAuth } from './AuthProvider'

/** Shown after logging in with a temporary password, until the person picks their own. */
export function SetPasswordPage() {
  const { session, refresh, signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const password = String(f.get('password'))
    if (password !== String(f.get('confirm'))) return setError({ code: 'password_mismatch' })
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      await unwrap(supabase.from('profiles').update({ must_change_password: false }).eq('id', session!.user.id).select('id'))
      await refresh()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Set your password"
      subtitle="You logged in with a temporary password. Choose your own to continue."
      footer={
        <button type="button" onClick={() => void signOut()} className="underline underline-offset-4 hover:text-text">
          Log out
        </button>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm">
          Logged in as <span className="font-semibold break-all">{session?.user.email}</span>
        </p>
        <Field label="New password" hint="At least 8 characters.">
          {(id) => <Input id={id} name="password" type="password" autoComplete="new-password" required minLength={8} autoFocus />}
        </Field>
        <Field label="Type it again">{(id) => <Input id={id} name="confirm" type="password" autoComplete="new-password" required minLength={8} />}</Field>
        <FormError error={error} />
        <Button type="submit" busy={busy} className="w-full">
          Save password and continue
        </Button>
      </form>
    </AuthLayout>
  )
}
