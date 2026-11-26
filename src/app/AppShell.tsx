import {
  Building2,
  ChevronsUpDown,
  FileText,
  Gauge,
  HardHat,
  LayoutList,
  LogOut,
  Menu,
  Moon,
  Ruler,
  Sun,
  Truck,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { BrandMark } from '../components/BrandMark'
import { cx } from '../components/ui'
import { ProjectsProvider, useProjects } from '../projects/ProjectsProvider'
import { currentTheme, setTheme } from './theme'

type NavItem = { to: string; label: string; short?: string; icon: LucideIcon }

export const projectNav: { group: string; items: NavItem[] }[] = [
  { group: '', items: [{ to: '', label: 'Site Hub', short: 'Hub', icon: Gauge }] },
  {
    group: 'Daily records',
    items: [
      { to: 'labour', label: 'Labour', icon: UsersRound },
      { to: 'materials', label: 'Materials', icon: Truck },
      { to: 'bills', label: 'VAT bills', short: 'Bills', icon: FileText },
    ],
  },
  {
    group: 'Plans',
    items: [
      { to: 'steel', label: 'Steel (BBS)', icon: Ruler },
      { to: 'boq', label: 'BOQ', icon: LayoutList },
      { to: 'drawings', label: 'Drawings', icon: Building2 },
    ],
  },
]

export function AppShell() {
  return (
    <ProjectsProvider>
      <Shell />
    </ProjectsProvider>
  )
}

function Shell() {
  const location = useLocation()
  // The drawer belongs to the page it was opened on, so navigating closes it.
  const [drawerPath, setDrawerPath] = useState<string | null>(null)
  const drawerOpen = drawerPath === location.pathname
  const setDrawerOpen = (open: boolean) => setDrawerPath(open ? location.pathname : null)
  const projectId = useMatch('/p/:projectId/*')?.params.projectId
  const { projects } = useProjects()
  const project = projects?.find((p) => p.id === projectId)

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr] print:block">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-hivis px-4 py-3 font-semibold text-hivis-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-dvh lg:block">
        <Sidebar />
      </aside>

      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="grid size-11 place-items-center rounded-md hover:bg-surface-2"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <BrandMark className="size-7 shrink-0" />
        <span className="truncate font-semibold">{project?.name ?? 'Nirman Sathi'}</span>
      </header>

      {drawerOpen && <Drawer onClose={() => setDrawerOpen(false)} />}

      <main id="main" tabIndex={-1} className="min-w-0 outline-none px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8 print:p-0">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      {project && <BottomTabs projectId={project.id} onMore={() => setDrawerOpen(true)} />}
    </div>
  )
}

/** Mobile menu: native modal dialog gives Esc, focus trap and inert background. */
function Drawer({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label="Menu"
      className="no-print m-0 h-dvh max-h-none w-[min(18rem,85vw)] p-0 backdrop:bg-ink/50 lg:hidden"
    >
      <Sidebar />
    </dialog>
  )
}

function Sidebar() {
  const { membership, memberships, selectOrg, signOut, session } = useAuth()
  const projectId = useMatch('/p/:projectId/*')?.params.projectId
  const navigate = useNavigate()
  const { projects } = useProjects()
  const [theme, setThemeState] = useState(currentTheme)

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cx(
      'relative flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
      isActive ? 'bg-white/10 text-ink-text before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-hivis' : 'text-ink-muted hover:bg-white/5 hover:text-ink-text',
    )

  return (
    <nav aria-label="Main" className="flex h-full flex-col overflow-y-auto bg-ink px-3 py-4 text-ink-text">
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <BrandMark className="size-9 shrink-0" />
        <div className="min-w-0">
          <p className="truncate font-bold leading-tight" style={{ fontVariationSettings: "'wdth' 85" }}>
            Nirman Sathi
          </p>
          {memberships && memberships.length > 1 ? (
            <select
              aria-label="Firm"
              value={membership?.orgId}
              onChange={(e) => {
                selectOrg(e.target.value)
                navigate('/projects')
              }}
              className="w-full truncate bg-transparent text-xs text-ink-muted"
            >
              {memberships.map((m) => (
                <option key={m.orgId} value={m.orgId} className="text-black">
                  {m.orgName}
                </option>
              ))}
            </select>
          ) : (
            <p className="truncate text-xs text-ink-muted">{membership?.orgName}</p>
          )}
        </div>
      </div>

      <label className="relative mb-4 block">
        <span className="sr-only">Current project</span>
        <select
          value={projectId ?? ''}
          onChange={(e) => navigate(e.target.value ? `/p/${e.target.value}` : '/projects')}
          className="min-h-11 w-full appearance-none truncate rounded-md border border-white/15 bg-white/5 pl-3 pr-9 text-sm font-semibold text-ink-text"
        >
          <option value="" className="text-black">
            {projects?.length ? 'Choose a project' : 'No projects yet'}
          </option>
          {projects?.map((p) => (
            <option key={p.id} value={p.id} className="text-black">
              {p.name}
            </option>
          ))}
        </select>
        <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
      </label>

      {projectId && projects?.some((p) => p.id === projectId) && (
        <div className="flex flex-col gap-4">
          {projectNav.map(({ group, items }) => (
            <div key={group || 'top'}>
              {group && <p className="px-3 pb-1 text-xs font-medium text-ink-muted">{group}</p>}
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink to={`/p/${projectId}${item.to ? `/${item.to}` : ''}`} end className={linkClass}>
                      <item.icon className="size-[1.125rem] shrink-0" aria-hidden />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 border-t border-white/10 pt-4">
        <p className="px-3 pb-1 text-xs font-medium text-ink-muted">Firm</p>
        <ul className="flex flex-col gap-0.5">
          <li>
            <NavLink to="/projects" end className={linkClass}>
              <HardHat className="size-[1.125rem]" aria-hidden />
              All projects
            </NavLink>
          </li>
          <li>
            <NavLink to="/team" className={linkClass}>
              <Users className="size-[1.125rem]" aria-hidden />
              Team
            </NavLink>
          </li>
        </ul>
      </div>

      <div className="mt-auto flex flex-col gap-1 border-t border-white/10 pt-4">
        <p className="truncate px-3 pb-1 text-xs text-ink-muted">
          {session?.user.email} · {membership?.role === 'site_staff' ? 'Site staff' : membership?.role === 'owner' ? 'Owner' : 'Admin'}
        </p>
        <button
          type="button"
          onClick={() => {
            const next = theme === 'dark' ? 'light' : 'dark'
            setTheme(next)
            setThemeState(next)
          }}
          className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-ink-muted hover:bg-white/5 hover:text-ink-text"
        >
          {theme === 'dark' ? <Sun className="size-[1.125rem]" aria-hidden /> : <Moon className="size-[1.125rem]" aria-hidden />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-ink-muted hover:bg-white/5 hover:text-ink-text"
        >
          <LogOut className="size-[1.125rem]" aria-hidden />
          Log out
        </button>
      </div>
    </nav>
  )
}

function BottomTabs({ projectId, onMore }: { projectId: string; onMore: () => void }) {
  const tabs = [projectNav[0].items[0], ...projectNav[1].items]
  return (
    <nav
      aria-label="Project"
      className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={`/p/${projectId}${t.to ? `/${t.to}` : ''}`}
          end
          className={({ isActive }) =>
            cx('flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium', isActive ? 'text-text' : 'text-muted')
          }
        >
          {({ isActive }) => (
            <>
              <span className={cx('grid h-7 w-12 place-items-center rounded-full', isActive && 'bg-hivis text-hivis-ink')}>
                <t.icon className="size-[1.125rem]" aria-hidden />
              </span>
              {t.short ?? t.label}
            </>
          )}
        </NavLink>
      ))}
      <button type="button" onClick={onMore} className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium text-muted">
        <span className="grid h-7 w-12 place-items-center">
          <Menu className="size-[1.125rem]" aria-hidden />
        </span>
        More
      </button>
    </nav>
  )
}
