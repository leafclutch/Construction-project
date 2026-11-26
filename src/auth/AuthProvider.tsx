import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, type Enums } from '../lib/supabase'

export type Membership = { orgId: string; orgName: string; role: Enums<'member_role'> }

type AuthState = {
  session: Session | null
  /** undefined while loading */
  memberships: Membership[] | undefined
  membership: Membership | null
  membershipError: unknown
  ready: boolean
  isAdmin: boolean
  selectOrg: (orgId: string) => void
  refreshMemberships: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)
const ORG_KEY = 'ns.org'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [loaded, setLoaded] = useState<{ userId: string; list: Membership[] } | null>(null)
  const [membershipError, setMembershipError] = useState<unknown>(null)
  const [orgId, setOrgId] = useState(() => localStorage.getItem(ORG_KEY))

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  const refreshMemberships = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('memberships')
      .select('role, org_id, organizations(name)')
      .eq('user_id', userId)
      .order('created_at')
    if (error) {
      setMembershipError(error)
      setLoaded({ userId, list: [] })
      return
    }
    setMembershipError(null)
    setLoaded({ userId, list: data.map((m) => ({ orgId: m.org_id, orgName: m.organizations?.name ?? '', role: m.role })) })
  }, [userId])

  useEffect(() => {
    // State is set after the fetch resolves, not synchronously.
    // eslint-disable-next-line react/set-state-in-effect
    void refreshMemberships()
  }, [refreshMemberships])

  // Signed out => no firms; signed in => undefined until this user's list arrives.
  const memberships = session === undefined ? undefined : !userId ? [] : loaded?.userId === userId ? loaded.list : undefined

  const membership = memberships?.length ? (memberships.find((m) => m.orgId === orgId) ?? memberships[0]) : null

  const selectOrg = useCallback((id: string) => {
    localStorage.setItem(ORG_KEY, id)
    setOrgId(id)
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    localStorage.removeItem(ORG_KEY)
    setOrgId(null)
  }, [])

  const value: AuthState = {
    session: session ?? null,
    memberships,
    membership,
    membershipError,
    ready: session !== undefined && (session === null || memberships !== undefined),
    isAdmin: membership?.role === 'owner' || membership?.role === 'admin',
    selectOrg,
    refreshMemberships,
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
