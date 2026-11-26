import { HardHat } from 'lucide-react'
import { useEffect } from 'react'
import { Link, Outlet, useOutletContext, useParams } from 'react-router'
import { EmptyState, ErrorState, Skeleton } from '../components/ui'
import type { Project } from './api'
import { rememberProject } from './ProjectsPage'
import { useProjects } from './ProjectsProvider'

type ProjectOutlet = { project: Project; reloadProject: () => void }

/** Resolves :projectId from the firm's project list and hands it to module pages. */
export function ProjectLayout() {
  const { projectId } = useParams()
  const { projects, error, loading, reload } = useProjects()
  const project = projects?.find((p) => p.id === projectId)

  useEffect(() => {
    if (project) rememberProject(project.id)
  }, [project])

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
        It may have been deleted, or it belongs to another firm.{' '}
        <Link to="/projects" className="font-semibold text-text underline underline-offset-4">
          See all projects
        </Link>
      </EmptyState>
    )
  }

  return <Outlet context={{ project, reloadProject: reload } satisfies ProjectOutlet} />
}

// eslint-disable-next-line react-refresh/only-export-components
export const useProject = () => useOutletContext<ProjectOutlet>()
