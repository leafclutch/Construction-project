import { createContext, useContext, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from '../lib/useAsyncData'
import { listProjects, type Project } from './api'

type ProjectsState = { projects: Project[] | undefined; error: unknown; loading: boolean; reload: () => void }
const ProjectsContext = createContext<ProjectsState | null>(null)

/** The firm's project list, shared by the switcher, the projects page and the project pages. */
export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { membership } = useAuth()
  const orgId = membership!.orgId
  const { data, error, loading, reload } = useAsyncData(() => listProjects(orgId), [orgId])
  return <ProjectsContext.Provider value={{ projects: data, error, loading, reload }}>{children}</ProjectsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProjects() {
  const ctx = useContext(ProjectsContext)
  if (!ctx) throw new Error('useProjects must be used inside ProjectsProvider')
  return ctx
}
