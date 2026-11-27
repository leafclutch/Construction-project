import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { isNetworkError } from '../lib/errors'
import { clearCache, setCacheUser } from '../lib/offlineCache'
import { clearOutbox, setOutboxUser } from '../lib/outbox'
import { disablePush } from '../lib/push'
import { supabase, type Enums } from '../lib/supabase'

export type Membership = {
  orgId: string
  orgName: string
  role: Enums<'member_role'>
  /** false: the firm turned this person's access off */
  active: boolean
  orgStatus: Enums<'org_status'>
  /** Thekka support looking at a firm: can see everything, change nothing */
  readOnly?: boolean
}

type Loaded = { userId: string; list: Membership[]; fullName: string | null; mustChangePassword: boolean; platformAdmin: boolean }

type AuthState = {
  session: Session | null
  /** undefined while loading */
  memberships: Membership[] | undefined
  membership: Membership | null
  loadError: unknown
  ready: boolean
  isAdmin: boolean
  /** Leafclutch super admin */
  platformAdmin: boolean
  mustChangePassword: boolean
  /** From profiles; null until set */
  fullName: string | null
  selectOrg: (orgId: string) => void
  /** Super admin only: open a firm read-only, or null to leave it */
  viewOrg: (org: { id: string; name: string } | null) => void
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)
const ORG_KEY = 'ns.org'
const VIEW_KEY = 'ns.view'
const authKey = (userId: string) => `ns.auth.${userId}`

function readView(): { id: string; name: string } | null {
  try {
    return JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null')
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [orgId, setOrgId] = useState(() => localStorage.getItem(ORG_KEY))
  const [viewing, setViewing] = useState(readView)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  const refresh = useCallback(async () => {
    if (!userId) return
    const [memberships, profile, platform] = await Promise.all([
      supabase.from('memberships').select('role, org_id, active, organizations(name, status)').eq('user_id', userId).order('created_at'),
      supabase.from('profiles').select('must_change_password, full_name').eq('id', userId).maybeSingle(),
      supabase.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle(),
    ])
    const error = memberships.error ?? profile.error ?? platform.error
    // No signal: open with what this person had last time (their firm, role, name).
    if (error && isNetworkError(error)) {
      const saved = localStorage.getItem(authKey(userId))
      if (saved) {
        setLoadError(null)
        setLoaded(JSON.parse(saved))
        return
      }
    }
    setLoadError(error)
    const next: Loaded = {
      userId,
      list: (memberships.data ?? []).map((m) => ({
        orgId: m.org_id,
        orgName: m.organizations?.name ?? '',
        role: m.role,
        active: m.active,
        orgStatus: m.organizations?.status ?? 'active',
      })),
      fullName: profile.data?.full_name ?? null,
      mustChangePassword: profile.data?.must_change_password ?? false,
      platformAdmin: Boolean(platform.data),
    }
    setLoaded(next)
    if (!error) localStorage.setItem(authKey(userId), JSON.stringify(next))
  }, [userId])

  // Offline data and the outbox belong to whoever is signed in.
  useEffect(() => {
    setCacheUser(userId ?? null)
    setOutboxUser(userId ?? null)
  }, [userId])

  useEffect(() => {
    // State is set after the fetch resolves, not synchronously.
    // eslint-disable-next-line react/set-state-in-effect
    void refresh()
  }, [refresh])

  // Signed out => nothing; signed in => undefined until this user's data arrives.
  const mine = session === undefined ? undefined : !userId ? null : loaded?.userId === userId ? loaded : undefined
  const memberships = mine === undefined ? undefined : (mine?.list ?? [])
  const platformAdmin = mine?.platformAdmin ?? false

  const membership: Membership | null =
    platformAdmin && viewing
      ? { orgId: viewing.id, orgName: viewing.name, role: 'site_staff', active: true, orgStatus: 'active', readOnly: true }
      : memberships?.length
        ? (memberships.find((m) => m.orgId === orgId) ?? memberships[0])
        : null

  const selectOrg = useCallback((id: string) => {
    localStorage.setItem(ORG_KEY, id)
    setOrgId(id)
  }, [])

  const viewOrg = useCallback((org: { id: string; name: string } | null) => {
    if (org) localStorage.setItem(VIEW_KEY, JSON.stringify(org))
    else localStorage.removeItem(VIEW_KEY)
    setViewing(org)
  }, [])

  const signOut = useCallback(async () => {
    if (userId) localStorage.removeItem(authKey(userId))
    await disablePush().catch(() => undefined)
    await clearOutbox()
    await clearCache()
    await supabase.auth.signOut()
    for (const key of [ORG_KEY, VIEW_KEY]) localStorage.removeItem(key)
    setOrgId(null)
    setViewing(null)
  }, [userId])

  const value: AuthState = {
    session: session ?? null,
    memberships,
    membership,
    loadError,
    ready: session !== undefined && (session === null || mine !== undefined),
    isAdmin: Boolean(membership && !membership.readOnly && membership.active && membership.orgStatus === 'active' && membership.role !== 'site_staff'),
    platformAdmin,
    mustChangePassword: mine?.mustChangePassword ?? false,
    fullName: mine?.fullName ?? null,
    selectOrg,
    viewOrg,
    refresh,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
