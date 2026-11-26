import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Button, Field, FormError, Input } from '../components/ui'
import { supabase } from '../lib/supabase'
import { AuthLayout } from './AuthLayout'
import { APP_NAME } from '../lib/brand'

export function LoginPage() {
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get('email')).trim(),
      password: String(form.get('password')),
    })
    setBusy(false)
    if (error) return setError(error)
    navigate(from, { replace: true })
  }

  return (
    <AuthLayout
      title="Log in"
      subtitle="Your sites, bills and wages in one place."
      footer={
        <>
          New to {APP_NAME}?{' '}
          <Link to="/signup" className="font-semibold text-text underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Email">{(id) => <Input id={id} name="email" type="email" autoComplete="email" required />}</Field>
        <Field label="Password">
          {(id) => <Input id={id} name="password" type="password" autoComplete="current-password" required />}
        </Field>
        <FormError error={error} />
        <Button type="submit" busy={busy} className="w-full">
          Log in
        </Button>
        <Link to="/forgot-password" className="self-start text-sm text-muted underline underline-offset-4 hover:text-text">
          Forgot password?
        </Link>
      </form>
    </AuthLayout>
  )
}
