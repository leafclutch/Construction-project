import { BellRing, Download, Share, SquarePlus, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { APP_NAME } from '../lib/brand'
import { getErrorMessage } from '../lib/errors'
import { useInstall } from '../lib/install'
import { currentSubscription, enablePush, pushSupported } from '../lib/push'
import { Modal } from './Modal'
import { useToast } from './toast'
import { Button } from './ui'

/** iPhone has no install button: show the two Safari steps. */
export function IosInstallSteps({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title={`Install ${APP_NAME}`} onClose={onClose}>
      <ol className="grid gap-4 text-sm">
        <li className="flex items-center gap-3">
          <Share className="size-6 shrink-0 text-muted" aria-hidden />
          <span>
            In Safari, tap <b>Share</b> at the bottom of the screen.
          </span>
        </li>
        <li className="flex items-center gap-3">
          <SquarePlus className="size-6 shrink-0 text-muted" aria-hidden />
          <span>
            Tap <b>Add to Home Screen</b>, then <b>Add</b>.
          </span>
        </li>
      </ol>
    </Modal>
  )
}

const DISMISS_DAYS = 14
const dismissedRecently = (key: string) => Date.now() - Number(localStorage.getItem(key) ?? 0) < DISMISS_DAYS * 864e5

/**
 * Phones, on Projects and the Site Hub: one card at a time. First "Install the app", then for
 * owners/admins in the installed app "Get notified". Closing a card hides it for two weeks.
 */
export function AppTips() {
  const { canPrompt, iosSteps, installed, prompt } = useInstall()
  const { isAdmin } = useAuth()
  const [, rerender] = useState(0)
  const [steps, setSteps] = useState(false)
  const [pushOn, setPushOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (installed && isAdmin) void currentSubscription().then((s) => setPushOn(Boolean(s)))
  }, [installed, isAdmin])

  const dismiss = (key: string) => {
    localStorage.setItem(key, String(Date.now()))
    rerender((n) => n + 1)
  }

  if ((canPrompt || iosSteps) && !dismissedRecently('ns.tip.install'))
    return (
      <>
        <Tip icon={<Download className="size-5" aria-hidden />} title={`Install ${APP_NAME} on this phone`} onClose={() => dismiss('ns.tip.install')}>
          Opens from the home screen like an app and works without signal.
          <Button className="mt-3 w-full sm:w-auto" onClick={() => (canPrompt ? void prompt() : setSteps(true))}>
            Install app
          </Button>
        </Tip>
        <IosInstallSteps open={steps} onClose={() => setSteps(false)} />
      </>
    )

  if (pushOn === false && pushSupported() && !dismissedRecently('ns.tip.push'))
    return (
      <Tip icon={<BellRing className="size-5" aria-hidden />} title="Get notified when staff add records" onClose={() => dismiss('ns.tip.push')}>
        Labour, deliveries, bills and steel added by your site staff.
        <Button
          className="mt-3 w-full sm:w-auto"
          busy={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await enablePush()
              setPushOn(true)
              toast('Notifications are on for this phone')
            } catch (e) {
              toast(getErrorMessage(e))
            } finally {
              setBusy(false)
            }
          }}
        >
          Turn on notifications
        </Button>
      </Tip>
    )
  return null
}

function Tip({ icon, title, children, onClose }: { icon: ReactNode; title: string; children: ReactNode; onClose: () => void }) {
  return (
    <aside className="no-print mb-5 flex gap-3 rounded-lg border border-line bg-surface p-4 lg:hidden">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-hivis text-hivis-ink">{icon}</span>
      <div className="min-w-0 flex-1 text-sm text-muted">
        <h2 className="font-semibold text-text">{title}</h2>
        {children}
      </div>
      <button type="button" onClick={onClose} aria-label="Not now" className="-m-2 grid size-11 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2">
        <X className="size-4" aria-hidden />
      </button>
    </aside>
  )
}
