import { createBrowserRouter, Link } from 'react-router'
import { LoginPage } from '../auth/LoginPage'
import { OnboardingPage } from '../auth/OnboardingPage'
import { ForgotPasswordPage, ResetPasswordPage } from '../auth/PasswordPages'
import { SignupPage } from '../auth/SignupPage'
import { EmptyState } from '../components/ui'
import { ProjectLayout } from '../projects/ProjectLayout'
import { HomeRedirect, ProjectsPage } from '../projects/ProjectsPage'
import { SiteHubPage } from '../projects/SiteHubPage'
import { AppShell } from './AppShell'
import { GuestOnly, RequireAuth, RequireOrg } from './guards'

function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <EmptyState icon={<span className="figure text-5xl">404</span>} title="This page does not exist">
        <Link to="/" className="font-semibold text-text underline underline-offset-4">
          Go to your projects
        </Link>
      </EmptyState>
    </div>
  )
}

export const router = createBrowserRouter([
  {
    element: <GuestOnly />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
    ],
  },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/onboarding', element: <OnboardingPage /> },
      {
        element: <RequireOrg />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <HomeRedirect /> },
              { path: '/projects', element: <ProjectsPage /> },
              { path: '/team', lazy: () => import('../team/TeamPage').then((m) => ({ Component: m.TeamPage })) },
              { path: '/profile', lazy: () => import('../profile/ProfilePage').then((m) => ({ Component: m.ProfilePage })) },
              {
                path: '/p/:projectId',
                element: <ProjectLayout />,
                children: [
                  { index: true, element: <SiteHubPage /> },
                  { path: 'labour', lazy: () => import('../modules/labour/LabourPage').then((m) => ({ Component: m.LabourPage })) },
                  { path: 'materials', lazy: () => import('../modules/materials/MaterialsPage').then((m) => ({ Component: m.MaterialsPage })) },
                  { path: 'bills', lazy: () => import('../modules/bills/BillsPage').then((m) => ({ Component: m.BillsPage })) },
                  { path: 'steel', lazy: () => import('../modules/steel/SteelPage').then((m) => ({ Component: m.SteelPage })) },
                  { path: 'boq', lazy: () => import('../modules/boq/BoqPage').then((m) => ({ Component: m.BoqPage })) },
                  { path: 'drawings', lazy: () => import('../modules/drawings/DrawingsPage').then((m) => ({ Component: m.DrawingsPage })) },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
])
