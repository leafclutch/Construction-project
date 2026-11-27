import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { AuthLayout } from '../auth/AuthLayout'
import { useAuth } from '../auth/AuthProvider'
import { SetPasswordPage } from '../auth/SetPasswordPage'
import { Button, ErrorState, Skeleton } from '../components/ui'
import { APP_NAME } from '../lib/brand'

function FullPageLoading() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-2 w-40" />
    </div>
  )
}

/** Signed-in users only. A temporary password must be replaced before anything else. */
export function RequireAuth() {
  const { session, ready, mustChangePassword } = useAuth()
  const location = useLocation()
  if (!ready) return <FullPageLoading />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (mustChangePassword) return <SetPasswordPage />
  return <Outlet />
}

function Blocked({ title, children }: { title: string; children: ReactNode }) {
  const { signOut } = useAuth()
  return (
    <AuthLayout title={title}>
      <p className="text-muted">{children}</p>
      <Button variant="secondary" className="mt-6" onClick={() => void signOut()}>
        Log out
      </Button>
    </AuthLayout>
  )
}

/** Signed-in users with working access to a firm (or support viewing one). */
export function RequireOrg() {
  const { membership, loadError, refresh, platformAdmin } = useAuth()
  if (loadError) {
    return (
      <div className="mx-auto max-w-md p-6">
        <ErrorState error={loadError} onRetry={() => void refresh()} />
      </div>
    )
  }
  if (!membership) {
    if (platformAdmin) return <Navigate to="/platform" replace />
    return <Blocked title="No firm yet">Your account is not part of any firm. Ask your firm owner to add you.</Blocked>
  }
  if (membership.orgStatus === 'suspended') {
    return <Blocked title="Account paused">{membership.orgName} is paused. The firm owner can contact {APP_NAME} support to turn it back on.</Blocked>
  }
  if (!membership.active) {
    return <Blocked title="Access turned off">Your access to {membership.orgName} has been turned off. Ask the firm owner if this is a mistake.</Blocked>
  }
  return <Outlet />
}

export function RequirePlatformAdmin() {
  const { platformAdmin } = useAuth()
  return platformAdmin ? <Outlet /> : <Navigate to="/" replace />
}

/** Logged-out pages bounce signed-in users into the app. */
export function GuestOnly() {
  const { session, ready } = useAuth()
  if (!ready) return <FullPageLoading />
  if (session) return <Navigate to="/" replace />
  return <Outlet />
}
