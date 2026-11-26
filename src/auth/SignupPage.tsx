import { MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, Field, FormError, Input } from '../components/ui'
import { supabase } from '../lib/supabase'
import { AuthLayout } from './AuthLayout'

export function SignupPage() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const email = String(form.get('email')).trim()
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.auth.signUp({
      email,
      password: String(form.get('password')),
      options: {
        data: { full_name: String(form.get('full_name')).trim() },
        emailRedirectTo: `${window.location.origin}/onboarding`,
      },
    })
    setBusy(false)
    if (error) return setError(error)
    // With "Confirm email" off, Supabase signs the user in straight away.
    if (data.session) navigate('/onboarding', { replace: true })
    else setSentTo(email)
  }

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" subtitle={`We sent a confirmation link to ${sentTo}. Open it to finish creating your account.`}>
        <MailCheck className="size-10 text-ledger" aria-hidden />
        <p className="mt-6 text-sm text-muted">
          Already confirmed?{' '}
          <Link to="/login" className="font-semibold text-text underline underline-offset-4">
            Log in
          </Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start with your own firm, or join one with an invite code from your owner."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-text underline underline-offset-4">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Full name">
          {(id) => <Input id={id} name="full_name" autoComplete="name" required minLength={2} maxLength={80} />}
        </Field>
        <Field label="Email">{(id) => <Input id={id} name="email" type="email" autoComplete="email" required />}</Field>
        <Field label="Password" hint="At least 8 characters.">
          {(id) => <Input id={id} name="password" type="password" autoComplete="new-password" required minLength={8} />}
        </Field>
        <FormError error={error} />
        <Button type="submit" busy={busy} className="w-full">
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}
