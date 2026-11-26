import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { ErrorState, Skeleton } from '../components/ui'

function FullPageLoading() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-2 w-40" />
    </div>
  )
}

/** Signed-in users only. */
export function RequireAuth() {
  const { session, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <FullPageLoading />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

/** Signed-in users who belong to a firm. */
export function RequireOrg() {
  const { membership, membershipError, refreshMemberships } = useAuth()
  if (membershipError) {
    return (
      <div className="mx-auto max-w-md p-6">
        <ErrorState error={membershipError} onRetry={() => void refreshMemberships()} />
      </div>
    )
  }
  if (!membership) return <Navigate to="/onboarding" replace />
  return <Outlet />
}

/** Logged-out pages bounce signed-in users into the app. */
export function GuestOnly() {
  const { session, ready } = useAuth()
  if (!ready) return <FullPageLoading />
  if (session) return <Navigate to="/" replace />
  return <Outlet />
}
