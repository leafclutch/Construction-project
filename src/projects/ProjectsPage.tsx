import { HardHat, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Modal } from '../components/Modal'
import { useToast } from '../components/toast'
import { Button, EmptyState, ErrorState, PageHeader, Panel, Skeleton, cx } from '../components/ui'
import { formatNPRShort } from '../lib/format'
import { createProject } from './api'
import { ProjectForm, statusLabel } from './ProjectForm'
import { useProjects } from './ProjectsProvider'

const LAST_PROJECT = 'ns.project'

export function rememberProject(id: string) {
  localStorage.setItem(LAST_PROJECT, id)
}

/** "/" opens the last project, the only project, or the list. */
export function HomeRedirect() {
  const { projects, error } = useProjects()
  if (!projects) return error ? <Navigate to="/projects" replace /> : <Skeleton className="h-56 w-full" />
  const last = localStorage.getItem(LAST_PROJECT)
  const target = projects.find((p) => p.id === last) ?? (projects.length === 1 ? projects[0] : null)
  return <Navigate to={target ? `/p/${target.id}` : '/projects'} replace />
}

export function ProjectsPage() {
  const { membership, isAdmin } = useAuth()
  const { projects, error, reload } = useProjects()
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()

  return (
    <>
      <PageHeader
        title="Projects"
        description={membership?.orgName}
        actions={
          isAdmin && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden />
              New project
            </Button>
          )
        }
      />

      {error && !projects ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !projects ? (
        <Panel>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4 border-b border-line p-4 last:border-0">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </Panel>
      ) : projects.length === 0 ? (
        <Panel>
          <EmptyState icon={<HardHat className="size-10" />} title="No projects yet">
            {isAdmin ? (
              <>
                Add your first site to start recording labour, materials and bills.
                <div className="mt-4">
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="size-4" aria-hidden />
                    New project
                  </Button>
                </div>
              </>
            ) : (
              'Your firm owner has not added a project yet.'
            )}
          </EmptyState>
        </Panel>
      ) : (
        <Panel>
          <ul>
            {projects.map((p) => {
              const contract = Number(p.contract_amount)
              const pct = contract > 0 ? Math.min(100, (Number(p.billed_amount) / contract) * 100) : 0
              return (
                <li key={p.id} className="border-b border-line last:border-0">
                  <Link to={`/p/${p.id}`} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4 hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        <span className="truncate">{p.name}</span>
                        <span
                          className={cx(
                            'rounded px-1.5 py-0.5 text-xs font-medium',
                            p.status === 'running' ? 'bg-ledger-soft text-ledger' : 'bg-surface-2 text-muted',
                          )}
                        >
                          {statusLabel[p.status]}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-sm text-muted">{[p.location, p.client_name].filter(Boolean).join(', ') || 'No location added'}</p>
                    </div>
                    <div className="flex w-full items-center gap-3 sm:w-56">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
                        <div className="h-full bg-ledger" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="num w-24 text-right text-sm font-semibold">{formatNPRShort(contract)}</span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Panel>
      )}

      <Modal open={creating} title="New project" onClose={() => setCreating(false)}>
        <ProjectForm
          submitLabel="Create project"
          onSubmit={async (input) => {
            const p = await createProject(membership!.orgId, input)
            reload()
            setCreating(false)
            toast('Project created')
            navigate(`/p/${p.id}`)
          }}
        />
      </Modal>
    </>
  )
}
