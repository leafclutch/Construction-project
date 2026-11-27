import { Building } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { AccountMenu } from '../components/AccountMenu'
import { BrandMark } from '../components/BrandMark'
import { cx } from '../components/ui'
import { APP_NAME } from '../lib/brand'

/** Shell for Leafclutch super admins: firms and their own profile. */
export function PlatformLayout() {
  const item = ({ isActive }: { isActive: boolean }) =>
    cx(
      'flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium lg:min-h-8',
      isActive ? 'bg-white/10 text-ink-text' : 'text-ink-muted hover:bg-white/5 hover:text-ink-text',
    )
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded-md bg-hivis px-4 py-3 font-semibold text-hivis-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <header className="bg-ink text-ink-text">
        <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center gap-1 px-3 py-2 sm:px-6">
          <span className="mr-auto flex items-center gap-2.5 py-1 pr-2">
            <BrandMark className="size-8 shrink-0" />
            <span className="font-bold leading-tight" style={{ fontVariationSettings: "'wdth' 85" }}>
              {APP_NAME} <span className="font-medium text-ink-muted">admin</span>
            </span>
          </span>
          <NavLink to="/platform" end className={item}>
            <Building className="size-4" aria-hidden />
            Firms
          </NavLink>
          <AccountMenu profilePath="/platform/profile" />
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-16 pt-6 outline-none sm:px-6 lg:pt-8">
        <Outlet />
      </main>
    </div>
  )
}
