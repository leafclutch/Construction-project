import { Check, Copy, Share2 } from 'lucide-react'
import { useState } from 'react'
import type { Credentials } from '../lib/accounts'
import { APP_NAME } from '../lib/brand'
import { Button } from './ui'

/** New login details, shown once. Copy/share sends one ready message for WhatsApp or Viber. */
export function CredentialsCard({ name, credentials, onDone }: { name: string; credentials: Credentials; onDone: () => void }) {
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null)
  const message = [
    `${APP_NAME} login for ${name}`,
    `Link: ${window.location.origin}/login`,
    `Email: ${credentials.email}`,
    `Temporary password: ${credentials.password}`,
    'You will set your own password after logging in.',
  ].join('\n')

  async function copy() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied('ok')
    } catch {
      setCopied('failed')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        Send these to <span className="font-semibold">{name}</span>. The password is shown only once. If it is lost, reset it again.
      </p>
      <dl className="grid gap-3 rounded-md border border-line bg-surface-2 p-4">
        <div>
          <dt className="text-xs font-medium text-muted">Email</dt>
          <dd className="font-semibold break-all select-all">{credentials.email}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted">Temporary password</dt>
          <dd className="figure text-xl tracking-wider select-all">{credentials.password}</dd>
        </div>
      </dl>
      <p className="text-sm" role="status">
        {copied === 'ok' ? 'Login details copied. Paste them in a message.' : copied === 'failed' ? 'Could not copy. Select the email and password and copy them by hand.' : ''}
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onDone}>
          Done
        </Button>
        {'share' in navigator && (
          <Button variant="secondary" onClick={() => void navigator.share({ text: message }).catch(() => {})}>
            <Share2 className="size-4" aria-hidden />
            Share
          </Button>
        )}
        <Button onClick={() => void copy()}>
          {copied === 'ok' ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          Copy login details
        </Button>
      </div>
    </div>
  )
}
