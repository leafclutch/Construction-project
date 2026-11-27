import {
  Building2,
  Check,
  ChevronsUpDown,
  Eye,
  FileText,
  Gauge,
  HardHat,
  LayoutList,
  LogOut,
  Menu,
  Moon,
  Ruler,
  Search,
  Sun,
  Truck,
  UserRound,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { BrandMark } from '../components/BrandMark'
import { cx } from '../components/ui'
import { APP_NAME, ROLE_LABEL } from '../lib/brand'
import type { ModuleKey } from '../lib/permissions'
import type { Project } from '../projects/api'
import { ProjectsProvider, useCanOn, useProjects } from '../projects/ProjectsProvider'
import { currentTheme, setTheme } from './theme'

type NavItem = { to: string; label: string; short?: string; icon: LucideIcon; module?: ModuleKey }

const projectNav: { group: string; items: NavItem[] }[] = [
  { group: '', items: [{ to: '', label: 'Site Hub', short: 'Hub', icon: Gauge }] },
  {
    group: 'Daily records',
    items: [
      { to: 'labour', label: 'Labour', icon: UsersRound, module: 'labour' },
      { to: 'materials', label: 'Materials', icon: Truck, module: 'materials' },
      { to: 'bills', label: 'VAT bills', short: 'Bills', icon: FileText, module: 'bills' },
    ],
  },
  {
    group: 'Plans',
    items: [
      { to: 'steel', label: 'Steel (BBS)', short: 'Steel', icon: Ruler, module: 'steel' },
      { to: 'boq', label: 'BOQ', icon: LayoutList, module: 'boq' },
      { to: 'drawings', label: 'Drawings', icon: Building2, module: 'drawings' },
    ],
  },
]

/** Project menu items this person may open: modules need view; Team is for owners/admins (and support, read only). */
function useProjectNav(project: Project | undefined) {
  const can = useCanOn(project)
  const { isAdmin, membership } = useAuth()
  const groups = projectNav
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.module || can(`${i.module}.view`)) }))
    .filter((g) => g.items.length)
  if (isAdmin || membership?.readOnly) groups.push({ group: 'People', items: [{ to: 'team', label: 'Team', icon: Users }] })
  return groups
}

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
  const { current } = useProjects()

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
        <span className="truncate font-semibold">{current?.name ?? APP_NAME}</span>
      </header>

      {drawerOpen && <Drawer onClose={() => setDrawerOpen(false)} />}

      <main id="main" tabIndex={-1} className="min-w-0 outline-none px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8 print:p-0">
        <div className="mx-auto max-w-6xl">
          <SupportBanner />
          <Outlet />
        </div>
      </main>

      {current && <BottomTabs project={current} onMore={() => setDrawerOpen(true)} />}
    </div>
  )
}

/** Super admins looking at a firm see what the firm sees, and nothing they can change. */
function SupportBanner() {
  const { membership, viewOrg } = useAuth()
  const navigate = useNavigate()
  if (!membership?.readOnly) return null
  return (
    <div role="status" className="no-print mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-line bg-surface-2 px-4 py-2 text-sm">
      <Eye className="size-4 shrink-0 text-muted" aria-hidden />
      <span className="min-w-0 flex-1">
        Viewing <span className="font-semibold">{membership.orgName}</span> as {APP_NAME} support. Read only.
      </span>
      <button
        type="button"
        onClick={() => {
          viewOrg(null)
          navigate('/platform')
        }}
        className="min-h-11 font-semibold underline underline-offset-4"
      >
        Back to firms
      </button>
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

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    'relative flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
    isActive ? 'bg-white/10 text-ink-text before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-hivis' : 'text-ink-muted hover:bg-white/5 hover:text-ink-text',
  )

/** Same on every page: the current (or last opened) project's menu stays put. */
function Sidebar() {
  const { membership, isAdmin, signOut } = useAuth()
  const { current } = useProjects()
  const groups = useProjectNav(current)

  return (
    <nav aria-label="Main" className="flex h-full flex-col overflow-y-auto bg-ink px-3 py-4 text-ink-text">
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <BrandMark className="size-9 shrink-0" />
        <div className="min-w-0">
          <p className="truncate font-bold leading-tight" style={{ fontVariationSettings: "'wdth' 85" }}>
            {APP_NAME}
          </p>
          <p className="truncate text-xs text-ink-muted">{membership?.orgName}</p>
        </div>
      </div>

      <ProjectSwitcher />

      {current && (
        <div className="flex flex-col gap-4">
          {groups.map(({ group, items }) => (
            <div key={group || 'top'}>
              {group && <p className="px-3 pb-1 text-xs font-medium text-ink-muted">{group}</p>}
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink to={`/p/${current.id}${item.to ? `/${item.to}` : ''}`} end className={linkClass}>
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
              {isAdmin || membership?.readOnly ? 'All projects' : 'My projects'}
            </NavLink>
          </li>
          {(isAdmin || membership?.readOnly) && (
            <li>
              <NavLink to="/staff" className={linkClass}>
                <Users className="size-[1.125rem]" aria-hidden />
                Staff
              </NavLink>
            </li>
          )}
        </ul>
      </div>

      <div className="mt-auto flex flex-col gap-1 border-t border-white/10 pt-4">
        {!membership?.readOnly && (
          <NavLink to="/profile" className={linkClass}>
            <UserRound className="size-[1.125rem] shrink-0" aria-hidden />
            <span className="min-w-0">
              <span className="block">My profile</span>
              {membership && <span className="block text-xs font-normal text-ink-muted">{ROLE_LABEL[membership.role]}</span>}
            </span>
          </NavLink>
        )}
        <ThemeToggle />
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

/** Light/dark switch for dark (ink) surfaces. `compact` hides the label on phones. */
// eslint-disable-next-line react-refresh/only-export-components
export function ThemeToggle({ compact }: { compact?: boolean }) {
  const [theme, setThemeState] = useState(currentTheme)
  const label = theme === 'dark' ? 'Light mode' : 'Dark mode'
  return (
    <button
      type="button"
      aria-label={compact ? label : undefined}
      onClick={() => {
        const next = theme === 'dark' ? 'light' : 'dark'
        setTheme(next)
        setThemeState(next)
      }}
      className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-ink-muted hover:bg-white/5 hover:text-ink-text"
    >
      {theme === 'dark' ? <Sun className="size-[1.125rem]" aria-hidden /> : <Moon className="size-[1.125rem]" aria-hidden />}
      <span className={cx(compact && 'sr-only sm:not-sr-only')}>{label}</span>
    </button>
  )
}

/**
 * Styled project picker. A native popover gives outside-click and Esc closing for free;
 * search shows once the list is long; arrow keys move through the options.
 */
function ProjectSwitcher() {
  const { projects, current } = useProjects()
  const navigate = useNavigate()
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const listId = useId()

  useEffect(() => {
    const el = panel.current
    const onToggle = (e: Event) => setOpen((e as ToggleEvent).newState === 'open')
    el?.addEventListener('toggle', onToggle)
    return () => el?.removeEventListener('toggle', onToggle)
  }, [])

  function show() {
    const r = button.current!.getBoundingClientRect()
    Object.assign(panel.current!.style, { top: `${r.bottom + 6}px`, left: `${r.left}px`, width: `${Math.max(r.width, 256)}px` })
    setQuery('')
    panel.current!.showPopover()
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('input, [aria-selected=true], [role=option]')?.focus())
  }

  function pick(id: string | null) {
    panel.current?.hidePopover()
    navigate(id ? `/p/${id}` : '/projects')
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const options = [...panel.current!.querySelectorAll<HTMLElement>('[role=option]')]
    const i = options.indexOf(document.activeElement as HTMLElement)
    options[e.key === 'ArrowDown' ? Math.min(options.length - 1, i + 1) : Math.max(0, i - 1)]?.focus()
  }

  const needle = query.trim().toLowerCase()
  const shown = projects?.filter((p) => !needle || `${p.name} ${p.location ?? ''} ${p.code ?? ''}`.toLowerCase().includes(needle)) ?? []

  return (
    <div className="mb-4">
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? panel.current?.hidePopover() : show())}
        className="flex min-h-12 w-full items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-left hover:bg-white/10"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-ink-muted">Project</span>
          <span className="block truncate text-sm font-semibold">{current?.name ?? (projects?.length ? 'Choose a project' : 'No projects yet')}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-ink-muted" aria-hidden />
      </button>

      <div
        ref={panel}
        popover="auto"
        onKeyDown={onKeyDown}
        className="m-0 overflow-hidden rounded-lg border border-line bg-surface p-0 text-text shadow-xl [inset:auto]"
      >
        {(projects?.length ?? 0) > 6 && (
          <div className="relative border-b border-line p-2">
            <Search className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              aria-label="Search projects"
              placeholder="Search projects"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-11 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-base focus:border-focus focus:outline-none sm:text-sm"
            />
          </div>
        )}
        <div role="listbox" id={listId} aria-label="Projects" className="max-h-[min(18rem,calc(100dvh-12rem))] overflow-y-auto p-1">
          {shown.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={p.id === current?.id}
              onClick={() => pick(p.id)}
              className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-1.5 text-left hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{p.name}</span>
                {p.location && <span className="block truncate text-xs text-muted">{p.location}</span>}
              </span>
              {p.id === current?.id && <Check className="size-4 shrink-0" aria-hidden />}
            </button>
          ))}
          {projects && shown.length === 0 && (
            <p className="px-3 py-3 text-sm text-muted">{projects.length ? 'No project matches.' : 'No projects yet.'}</p>
          )}
        </div>
        <div className="border-t border-line p-1">
          <button type="button" onClick={() => pick(null)} className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium hover:bg-surface-2">
            <HardHat className="size-4 text-muted" aria-hidden />
            See all projects
          </button>
        </div>
      </div>
    </div>
  )
}

function BottomTabs({ project, onMore }: { project: Project; onMore: () => void }) {
  const groups = useProjectNav(project)
  // Hub plus the first three modules this person can open; everything else is under More.
  const tabs = groups
    .flatMap((g) => g.items)
    .filter((i) => i.to !== 'team')
    .slice(0, 4)
  return (
    <nav
      aria-label="Project"
      style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}
      className="no-print fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={`/p/${project.id}${t.to ? `/${t.to}` : ''}`}
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
