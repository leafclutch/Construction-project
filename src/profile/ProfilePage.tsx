import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Avatar, useRoleLine } from '../components/AccountMenu'
import { useToast } from '../components/toast'
import { Button, cx, Field, FormError, Input, PageHeader, Panel } from '../components/ui'
import { ROLE_LABEL } from '../lib/brand'
import { compressImage } from '../lib/compressImage'
import { isInstalled, isIos } from '../lib/install'
import { currentSubscription, disablePush, enablePush, pushSupported } from '../lib/push'
import { supabase } from '../lib/supabase'
import { unwrap } from '../lib/useAsyncData'

export function ProfilePage() {
  const { session, memberships, membership, selectOrg, fullName, refresh, isAdmin, avatarUrl } = useAuth()
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
            <PhotoButtons userId={session!.user.id} hasPhoto={Boolean(avatarUrl)} onSaved={refresh} />
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

        {isAdmin && (
          <Section title="Notifications on this phone" description="A message when your site staff add labour, deliveries, bills or steel.">
            <PushToggle />
          </Section>
        )}

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

function PushToggle() {
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const toast = useToast()

  useEffect(() => {
    void currentSubscription().then((s) => setOn(Boolean(s)))
  }, [])

  if (!pushSupported())
    return <p className="text-sm text-muted">{isIos() && !isInstalled() ? 'On iPhone, install the app first (Share → Add to Home Screen), then turn this on there.' : 'This browser cannot show notifications.'}</p>

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      if (on) await disablePush()
      else await enablePush()
      setOn(!on)
      toast(on ? 'Notifications are off for this phone' : 'Notifications are on for this phone')
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-3">
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
        <span className="text-sm font-medium">{on ? 'On' : 'Off'}</span>
        <input
          type="checkbox"
          role="switch"
          checked={Boolean(on)}
          disabled={on === null || busy}
          onChange={() => void toggle()}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className="relative h-7 w-12 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-ledger peer-focus-visible:outline-2 peer-focus-visible:outline-focus peer-disabled:opacity-50 after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-surface after:shadow after:transition-transform peer-checked:after:translate-x-5"
        />
      </label>
      <FormError error={error} />
    </div>
  )
}

/** Swaps the profile photo: upload the new file, point the profile at it, then delete the old one. */
async function savePhoto(userId: string, file: File | null) {
  const { avatar_path: old } = await unwrap(supabase.from('profiles').select('avatar_path').eq('id', userId).single())
  let path: string | null = null
  if (file) {
    // Always scaled: the avatar is shown at most 64 px wide.
    const small = await compressImage(file, 512, 0.85, 0)
    path = `${userId}/${crypto.randomUUID()}.${small.type === 'image/png' ? 'png' : small.type === 'image/webp' ? 'webp' : 'jpg'}`
    await unwrap(supabase.storage.from('avatars').upload(path, small, { contentType: small.type }))
  }
  try {
    await unwrap(supabase.from('profiles').update({ avatar_path: path }).eq('id', userId).select('id').single())
  } catch (e) {
    if (path) await supabase.storage.from('avatars').remove([path])
    throw e
  }
  if (old) await supabase.storage.from('avatars').remove([old])
}

function PhotoButtons({ userId, hasPhoto, onSaved }: { userId: string; hasPhoto: boolean; onSaved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const toast = useToast()

  async function save(file: File | null) {
    setBusy(true)
    setError(null)
    try {
      await savePhoto(userId, file)
      await onSaved()
      toast(file ? 'Photo updated' : 'Photo removed')
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  const link = 'min-h-11 text-sm font-semibold underline underline-offset-4 disabled:opacity-50'
  return (
    <div className="mt-1">
      <div className="flex flex-wrap gap-x-4">
        <label className={cx(link, 'flex cursor-pointer items-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus', busy && 'pointer-events-none opacity-50')}>
          {busy ? 'Saving…' : hasPhoto ? 'Change photo' : 'Add photo'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void save(file)
            }}
          />
        </label>
        {hasPhoto && (
          <button type="button" disabled={busy} onClick={() => void save(null)} className={cx(link, 'text-muted')}>
            Remove
          </button>
        )}
      </div>
      <FormError error={error} />
    </div>
  )
}
