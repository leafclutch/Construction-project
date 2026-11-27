import {
  Building2,
  Check,
  ArrowLeft,
  ChevronRight,
  ChevronsUpDown,
  Eye,
  FileText,
  Gauge,
  HardHat,
  House,
  LayoutList,
  Menu,
  Plus,
  Ruler,
  Search,
  Truck,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { AccountMenu } from '../components/AccountMenu'
import { BrandMark } from '../components/BrandMark'
import { AppTips } from '../components/InstallPrompt'
import { OfflineBar } from '../components/OfflineBar'
import { PullToRefresh } from '../components/PullToRefresh'
import type { QuickKind } from '../components/QuickAdd'
import { cx, Skeleton } from '../components/ui'
import { APP_NAME } from '../lib/brand'
import type { ModuleKey } from '../lib/permissions'
import type { Project } from '../projects/api'
import { ProjectsProvider, useCanOn, useProjects } from '../projects/ProjectsProvider'

// The quick add sheet pulls in four record forms: load it on first tap.
const QuickAdd = lazy(() => import('../components/QuickAdd'))
const QUICK_KINDS: QuickKind[] = ['labour', 'materials', 'bills', 'steel']

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
  const { membership } = useAuth()
  const can = useCanOn(current)
  const addKinds = QUICK_KINDS.filter((k) => can(`${k}.add`))
  const [quick, setQuick] = useState<QuickKind | 'menu' | null>(null)

  // Home-screen shortcuts open "/?add=labour": start the quick add for that record.
  const [params, setParams] = useSearchParams()
  const addParam = params.get('add')
  useEffect(() => {
    if (!addParam || !current) return
    // Opens the sheet once the project is known.
    // eslint-disable-next-line react/set-state-in-effect
    if ((addKinds as string[]).includes(addParam)) setQuick(addParam as QuickKind)
    params.delete('add')
    setParams(params, { replace: true })
  }, [addParam, current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 select-none border-b border-line bg-surface/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-6 lg:px-10">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 sm:gap-2">
            <AppBarTitle />
            <Breadcrumbs />
            <AccountMenu profilePath={membership?.readOnly ? '/platform/profile' : '/profile'} />
          </div>
        </header>
        <div className="no-print sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20">
          <OfflineBar />
        </div>

        {/* Phones: the app bar shows the page title, so the page's own h1 is for screen readers only. */}
        <main
          id="main"
          tabIndex={-1}
          className="min-w-0 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 outline-none sm:px-6 lg:px-10 lg:pb-12 lg:pt-6 max-lg:[&_.page-title]:sr-only max-lg:[&_.page-header-bare]:mb-0 print:p-0"
        >
          <div className="mx-auto max-w-6xl">
            <SupportBanner />
            {/^\/(projects|p\/[^/]+)\/?$/.test(location.pathname) && <AppTips />}
            <Outlet />
          </div>
        </main>
      </div>

      {drawerOpen && <Drawer onClose={() => setDrawerOpen(false)} />}

      <BottomTabs project={current} onMore={() => setDrawerOpen(true)} onAdd={current && addKinds.length ? () => setQuick('menu') : undefined} />
      <PullToRefresh />
      {quick && current && (
        <Suspense fallback={null}>
          <QuickAdd project={current} kinds={addKinds} start={quick} onClose={() => setQuick(null)} />
        </Suspense>
      )}
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
    'relative flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium lg:min-h-8 transition-colors',
    isActive ? 'bg-white/10 text-ink-text before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-hivis' : 'text-ink-muted hover:bg-white/5 hover:text-ink-text',
  )

/** Same on every page: the current (or last opened) project's menu stays put. */
function Sidebar() {
  const { membership, isAdmin } = useAuth()
  const { current } = useProjects()
  const groups = useProjectNav(current)

  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-2.5 overflow-y-auto bg-ink px-3 py-3 text-ink-text [scrollbar-color:rgb(255_255_255/0.18)_transparent] [scrollbar-width:thin]">
      <div className="flex items-center gap-2.5 px-2">
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
        <div className="flex flex-col gap-2.5">
          {groups.map(({ group, items }) => (
            <div key={group || 'top'}>
              {group && <p className="px-3 pb-1 text-xs font-medium text-ink-muted">{group}</p>}
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink to={`/p/${current.id}${item.to ? `/${item.to}` : ''}`} end viewTransition className={linkClass}>
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

      <div className="border-t border-white/10 pt-2.5">
        <p className="px-3 pb-1 text-xs font-medium text-ink-muted">Firm</p>
        <ul className="flex flex-col gap-0.5">
          <li>
            <NavLink to="/projects" end viewTransition className={linkClass}>
              <HardHat className="size-[1.125rem]" aria-hidden />
              {isAdmin || membership?.readOnly ? 'All projects' : 'My projects'}
            </NavLink>
          </li>
          {(isAdmin || membership?.readOnly) && (
            <li>
              <NavLink to="/staff" viewTransition className={linkClass}>
                <Users className="size-[1.125rem]" aria-hidden />
                Staff
              </NavLink>
            </li>
          )}
        </ul>
      </div>

    </nav>
  )
}

const SECTION_LABEL: Record<string, string> = {
  ...Object.fromEntries(projectNav.flatMap((g) => g.items).map((i) => [i.to, i.label])),
  team: 'Team',
}

/** Project › Section from the URL (Home, the projects list, comes before it). */
function useTrail() {
  const { pathname } = useLocation()
  const { projects } = useProjects()
  const [, first, id, section] = pathname.split('/')
  const trail: { label: ReactNode; to: string }[] = []
  if (first === 'p') {
    const name = projects?.find((p) => p.id === id)?.name
    trail.push({ label: name ?? (projects ? 'Project' : <Skeleton className="h-4 w-28" />), to: `/p/${id}` })
    if (section) trail.push({ label: SECTION_LABEL[section] ?? section, to: pathname })
  } else if (first === 'staff') trail.push({ label: 'Staff', to: '/staff' })
  else if (first === 'profile') trail.push({ label: 'My profile', to: '/profile' })
  return trail
}

/** Phones: back to the parent page, and the page title (like a native app bar). */
function AppBarTitle() {
  const trail = useTrail()
  const title = trail.at(-1)
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 lg:hidden">
      {title ? (
        <Link to={trail.at(-2)?.to ?? '/projects'} viewTransition aria-label="Back" className="-ml-1 grid size-11 shrink-0 place-items-center rounded-full active:bg-surface-2">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
      ) : (
        <BrandMark className="ml-2 mr-1.5 size-7 shrink-0" />
      )}
      <h2 className="truncate text-[1.0625rem] font-semibold" aria-hidden>
        {title?.label ?? 'Projects'}
      </h2>
    </div>
  )
}

/** Desktop: Home › Project › Section. Home is the projects list. */
function Breadcrumbs() {
  const trail = useTrail()

  const home = (
    <>
      <House className="size-4 shrink-0" aria-hidden />
      <span className={cx(trail.length > 0 && 'sr-only sm:not-sr-only')}>Home</span>
    </>
  )
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 lg:block">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        <li className="shrink-0">
          {trail.length ? (
            <Link to="/projects" className="flex min-h-11 items-center gap-1.5 rounded-md px-1 text-muted hover:text-text">
              {home}
            </Link>
          ) : (
            <span aria-current="page" className="flex items-center gap-1.5 px-1 font-semibold">
              {home}
            </span>
          )}
        </li>
        {trail.map((c, i) => (
          <li key={i} className={cx('flex items-center gap-1.5', i === trail.length - 1 && trail.length > 1 ? 'shrink-0' : 'min-w-0')}>
            <ChevronRight className="size-3.5 shrink-0 text-muted" aria-hidden />
            {i < trail.length - 1 ? (
              <Link to={c.to} className="flex min-h-11 min-w-0 items-center text-muted hover:text-text">
                <span className="truncate">{c.label}</span>
              </Link>
            ) : (
              <span aria-current="page" className="truncate font-semibold">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
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
    <div>
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

type Tab = { to: string; label: string; icon: LucideIcon; end?: boolean }

/**
 * Phones: the app's tab bar on every page. With a project: Hub and the first modules this
 * person can open, the + (quick add) in the middle, and More (the full menu).
 */
function BottomTabs({ project, onMore, onAdd }: { project: Project | undefined; onMore: () => void; onAdd?: () => void }) {
  const groups = useProjectNav(project)
  const { isAdmin, membership } = useAuth()
  const tabs: Tab[] = project
    ? groups
        .flatMap((g) => g.items)
        .filter((i) => i.to !== 'team')
        .slice(0, onAdd ? 3 : 4)
        .map((i) => ({ to: `/p/${project.id}${i.to ? `/${i.to}` : ''}`, label: i.short ?? i.label, icon: i.icon, end: true }))
    : [
        { to: '/projects', label: 'Projects', icon: HardHat },
        ...(isAdmin || membership?.readOnly ? [{ to: '/staff', label: 'Staff', icon: Users }] : []),
      ]
  const cell = 'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium'
  const links = tabs.map((t) => (
    <NavLink key={t.to} to={t.to} end={t.end} viewTransition className={({ isActive }) => cx(cell, isActive ? 'text-text' : 'text-muted')}>
      {({ isActive }) => (
        <>
          <span className={cx('grid h-7 w-12 place-items-center rounded-full transition-colors', isActive && 'bg-hivis text-hivis-ink')}>
            <t.icon className="size-[1.125rem]" aria-hidden />
          </span>
          {t.label}
        </>
      )}
    </NavLink>
  ))
  if (onAdd)
    links.splice(
      Math.min(2, links.length),
      0,
      <div key="add" className="flex justify-center">
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add a record"
          className="-mt-5 grid size-14 place-items-center rounded-full bg-hivis text-hivis-ink shadow-lg ring-4 ring-surface transition-transform active:scale-95"
        >
          <Plus className="size-7" strokeWidth={2.5} aria-hidden />
        </button>
      </div>,
    )
  return (
    <nav
      aria-label="App"
      style={{ gridTemplateColumns: `repeat(${links.length + 1}, minmax(0, 1fr))` }}
      className="no-print fixed inset-x-0 bottom-0 z-30 grid select-none border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {links}
      <button type="button" onClick={onMore} className={cx(cell, 'text-muted')}>
        <span className="grid h-7 w-12 place-items-center">
          <Menu className="size-[1.125rem]" aria-hidden />
        </span>
        More
      </button>
    </nav>
  )
}
