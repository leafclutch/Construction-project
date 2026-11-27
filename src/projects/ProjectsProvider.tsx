import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useMatch } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { allowed, type Permission } from '../lib/permissions'
import { useAsyncData } from '../lib/useAsyncData'
import { listProjects, type Project } from './api'

type ProjectsState = {
  projects: Project[] | undefined
  /** The project in the URL, else the last one opened. Keeps the sidebar the same on every page. */
  current: Project | undefined
  error: unknown
  loading: boolean
  reload: () => void
}
const ProjectsContext = createContext<ProjectsState | null>(null)
const LAST_PROJECT = 'ns.project'

/** The projects this person can open, shared by the switcher, the projects page and the project pages. */
export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { membership, session } = useAuth()
  const orgId = membership!.orgId
  const userId = session!.user.id
  const { data, error, loading, reload } = useAsyncData(() => listProjects(orgId, userId), [orgId, userId])
  const routeId = useMatch('/p/:projectId/*')?.params.projectId
  const [lastId, setLastId] = useState(() => localStorage.getItem(LAST_PROJECT))

  const current = data?.find((p) => p.id === (routeId ?? lastId)) ?? (!routeId && data?.length === 1 ? data[0] : undefined)
  useEffect(() => {
    if (routeId && current?.id === routeId) {
      localStorage.setItem(LAST_PROJECT, routeId)
      // Remembers the project once it is known to exist.
      // eslint-disable-next-line react/set-state-in-effect
      setLastId(routeId)
    }
  }, [routeId, current?.id])

  return <ProjectsContext.Provider value={{ projects: data, current, error, loading, reload }}>{children}</ProjectsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProjects() {
  const ctx = useContext(ProjectsContext)
  if (!ctx) throw new Error('useProjects must be used inside ProjectsProvider')
  return ctx
}

/** What the signed-in person may do on a project. */
// eslint-disable-next-line react-refresh/only-export-components
export function useCanOn(project: Project | undefined) {
  const { isAdmin, membership } = useAuth()
  return (perm: Permission) => Boolean(project) && allowed({ admin: isAdmin, readOnly: Boolean(membership?.readOnly), permissions: project!.permissions }, perm)
}
