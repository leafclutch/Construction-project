import { Download, LogOut, Moon, Sun, UserRound } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { currentTheme, setTheme } from '../app/theme'
import { useAuth } from '../auth/AuthProvider'
import { APP_NAME, ROLE_LABEL } from '../lib/brand'
import { useInstall } from '../lib/install'
import { listOutbox } from '../lib/outbox'
import { ConfirmDialog } from './ConfirmDialog'
import { IosInstallSteps } from './InstallPrompt'
import { cx } from './ui'

function initials(name: string) {
  const words = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase()
}

/** Round initials badge for the signed-in person. */
export function Avatar({ className }: { className?: string }) {
  const { fullName, session, avatarUrl } = useAuth()
  // A link that fails (expired offline, photo removed) falls back to initials.
  const [failed, setFailed] = useState<string | null>(null)
  return (
    <span aria-hidden className={cx('grid shrink-0 place-items-center overflow-hidden rounded-full bg-hivis font-bold text-hivis-ink', className)}>
      {avatarUrl && failed !== avatarUrl ? (
        <img src={avatarUrl} alt="" className="size-full object-cover" onError={() => setFailed(avatarUrl)} />
      ) : (
        initials(fullName || session?.user.email || '?')
      )}
    </span>
  )
}

/** "Owner · RAR Engineering", or what a super admin is doing. */
// eslint-disable-next-line react-refresh/only-export-components
export function useRoleLine() {
  const { membership, platformAdmin } = useAuth()
  if (membership?.readOnly) return `${APP_NAME} support · viewing ${membership.orgName}`
  if (membership) return `${ROLE_LABEL[membership.role]} · ${membership.orgName}`
  return platformAdmin ? `${APP_NAME} admin` : ''
}

/** Avatar button (top right) that opens: who you are, My profile, theme, Log out. */
export function AccountMenu({ profilePath }: { profilePath: string }) {
  const { fullName, session, signOut } = useAuth()
  const roleLine = useRoleLine()
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [theme, setThemeState] = useState(currentTheme)
  const [unsent, setUnsent] = useState(0)
  const install = useInstall()
  const [iosSteps, setIosSteps] = useState(false)
  const menuId = useId()
  const email = session?.user.email ?? ''

  useEffect(() => {
    const el = panel.current
    const onToggle = (e: Event) => setOpen((e as ToggleEvent).newState === 'open')
    el?.addEventListener('toggle', onToggle)
    return () => el?.removeEventListener('toggle', onToggle)
  }, [])

  function show() {
    const r = button.current!.getBoundingClientRect()
    Object.assign(panel.current!.style, { top: `${r.bottom + 6}px`, right: `${Math.max(8, innerWidth - r.right)}px` })
    panel.current!.showPopover()
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus())
  }

  const hide = () => panel.current?.hidePopover()

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...panel.current!.querySelectorAll<HTMLElement>('[role=menuitem]')]
    const i = items.indexOf(document.activeElement as HTMLElement)
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  }

  const item = 'flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium hover:bg-surface-2 focus:bg-surface-2 focus:outline-none'

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Account menu"
        onClick={() => (open ? hide() : show())}
        className="grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Avatar className={cx('size-9 text-sm ring-2 transition-shadow', open ? 'ring-hivis/60' : 'ring-transparent hover:ring-hivis/40')} />
      </button>

      <div
        ref={panel}
        id={menuId}
        popover="auto"
        role="menu"
        aria-label="Account"
        onKeyDown={onKeyDown}
        className="m-0 w-[min(17rem,calc(100vw-1rem))] overflow-hidden rounded-lg border border-line bg-surface p-0 text-text shadow-xl [inset:auto]"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Avatar className="size-10 text-sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{fullName || email}</p>
            {fullName && <p className="truncate text-xs text-muted">{email}</p>}
            {roleLine && <p className="truncate text-xs text-muted">{roleLine}</p>}
          </div>
        </div>
        <div className="p-1">
          <Link role="menuitem" to={profilePath} onClick={hide} className={item}>
            <UserRound className="size-4 text-muted" aria-hidden />
            My profile
          </Link>
          <button
            role="menuitem"
            type="button"
            className={item}
            onClick={() => {
              const next = theme === 'dark' ? 'light' : 'dark'
              setTheme(next)
              setThemeState(next)
            }}
          >
            {theme === 'dark' ? <Sun className="size-4 text-muted" aria-hidden /> : <Moon className="size-4 text-muted" aria-hidden />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          {(install.canPrompt || install.iosSteps) && (
            <button
              role="menuitem"
              type="button"
              className={item}
              onClick={() => {
                hide()
                if (install.canPrompt) void install.prompt()
                else setIosSteps(true)
              }}
            >
              <Download className="size-4 text-muted" aria-hidden />
              Install app
            </button>
          )}
        </div>
        <div className="border-t border-line p-1">
          <button
            role="menuitem"
            type="button"
            className={item}
            onClick={async () => {
              // Entries saved without signal live only on this phone: warn before deleting them.
              const waiting = (await listOutbox()).length
              hide()
              if (waiting) setUnsent(waiting)
              else void signOut()
            }}
          >
            <LogOut className="size-4 text-muted" aria-hidden />
            Log out
          </button>
        </div>
      </div>

      <IosInstallSteps open={iosSteps} onClose={() => setIosSteps(false)} />
      <ConfirmDialog
        open={unsent > 0}
        title={`${unsent} ${unsent === 1 ? 'entry is' : 'entries are'} not uploaded yet`}
        confirmLabel="Log out and delete them"
        onClose={() => setUnsent(0)}
        onConfirm={signOut}
      >
        They were saved on this phone without signal. Logging out deletes them. Connect to the internet first so they upload.
      </ConfirmDialog>
    </>
  )
}
