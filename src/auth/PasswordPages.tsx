import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, Field, FormError, Input } from '../components/ui'
import { supabase } from '../lib/supabase'
import { AuthLayout } from './AuthLayout'
import { useAuth } from './AuthProvider'

export function ForgotPasswordPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [sent, setSent] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(String(new FormData(e.currentTarget).get('email')).trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setBusy(false)
    if (error) setError(error)
    else setSent(true)
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle={sent ? 'If that email has an account, a reset link is on its way.' : 'We will email you a link to set a new password.'}
      footer={
        <Link to="/login" className="font-semibold text-text underline underline-offset-4">
          Back to log in
        </Link>
      }
    >
      {!sent && (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Email">{(id) => <Input id={id} name="email" type="email" autoComplete="email" required />}</Field>
          <FormError error={error} />
          <Button type="submit" busy={busy} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}

export function ResetPasswordPage() {
  const { session, ready } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password: String(new FormData(e.currentTarget).get('password')) })
    setBusy(false)
    if (error) return setError(error)
    navigate('/', { replace: true })
  }

  if (ready && !session) {
    return (
      <AuthLayout title="Link expired" subtitle="This reset link is no longer valid. Ask for a new one.">
        <Link to="/forgot-password" className="font-semibold underline underline-offset-4">
          Send a new link
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Set a new password">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="New password" hint="At least 8 characters.">
          {(id) => <Input id={id} name="password" type="password" autoComplete="new-password" required minLength={8} />}
        </Field>
        <FormError error={error} />
        <Button type="submit" busy={busy} disabled={!ready} className="w-full">
          Save password
        </Button>
      </form>
    </AuthLayout>
  )
}
