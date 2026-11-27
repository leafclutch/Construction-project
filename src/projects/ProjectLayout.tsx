import { HardHat, Lock } from 'lucide-react'
import { Link, Outlet, useLocation, useOutletContext, useParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { EmptyState, ErrorState, Skeleton } from '../components/ui'
import { MODULES, type Permission } from '../lib/permissions'
import type { Project } from './api'
import { useCanOn, useProjects } from './ProjectsProvider'

type ProjectOutlet = { project: Project; reloadProject: () => void; can: (perm: Permission) => boolean }

/** Resolves :projectId from the person's project list, checks the page is allowed, and hands the project to module pages. */
export function ProjectLayout() {
  const { projectId } = useParams()
  const section = useLocation().pathname.split('/')[3] ?? ''
  const { projects, error, loading, reload } = useProjects()
  const { isAdmin, membership } = useAuth()
  const project = projects?.find((p) => p.id === projectId)
  const can = useCanOn(project)

  if (error && !projects) return <ErrorState error={error} onRetry={reload} />
  if (!projects || (!project && loading)) {
    return (
      <div aria-busy="true" aria-label="Loading project" className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-56 w-full" />
      </div>
    )
  }

  if (!project) {
    return (
      <EmptyState icon={<HardHat className="size-10" />} title="Project not found">
        It may have been deleted, or you have not been added to it.{' '}
        <Link to="/projects" className="font-semibold text-text underline underline-offset-4">
          See your projects
        </Link>
      </EmptyState>
    )
  }

  const module = MODULES.find((m) => m.key === section)
  const blocked = (module && !can(`${module.key}.view`)) || (section === 'team' && !isAdmin && !membership?.readOnly)
  if (blocked) {
    return (
      <EmptyState icon={<Lock className="size-10" />} title="You do not have access to this page">
        Ask the firm owner to turn it on for you on this project.
      </EmptyState>
    )
  }

  return <Outlet context={{ project, reloadProject: reload, can } satisfies ProjectOutlet} />
}

// eslint-disable-next-line react-refresh/only-export-components
export const useProject = () => useOutletContext<ProjectOutlet>()
