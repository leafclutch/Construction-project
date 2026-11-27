import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { PermissionPicker } from '../components/PermissionPicker'
import { Button, Field, FormError, Input, Select } from '../components/ui'
import { createStaff, type Credentials } from '../lib/accounts'
import { PRESETS, type Permission } from '../lib/permissions'
import type { Project } from '../projects/api'

/**
 * Creates a login for a new person. With `project` they go straight onto that project;
 * with `projects` the owner may pick one now or add them later.
 */
export function NewStaffForm({
  project,
  projects,
  onCreated,
}: {
  project?: Project
  projects?: Project[]
  onCreated: (name: string, credentials: Credentials) => void
}) {
  const { membership } = useAuth()
  const [role, setRole] = useState<'site_staff' | 'admin'>('site_staff')
  const [projectId, setProjectId] = useState(project?.id ?? '')
  const [permissions, setPermissions] = useState<Permission[]>(PRESETS[0].permissions)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const onProject = role === 'site_staff' && Boolean(projectId)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const name = String(f.get('full_name')).trim()
    setBusy(true)
    setError(null)
    try {
      const created = await createStaff({
        org_id: membership!.orgId,
        full_name: name,
        email: String(f.get('email')).trim(),
        role,
        ...(onProject ? { project_id: projectId, permissions } : {}),
      })
      onCreated(name, created)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Full name">{(id) => <Input id={id} name="full_name" required maxLength={120} autoComplete="off" placeholder="Ram Bahadur Thapa" />}</Field>
      <Field label="Email" hint="Used to log in. No email is sent, so a made-up address like ram.duhabi@yourfirm.com also works.">
        {(id) => <Input id={id} name="email" type="email" required maxLength={254} autoComplete="off" />}
      </Field>
      {membership?.role === 'owner' && (
        <Field label="Role" hint={role === 'admin' ? 'Admins see and manage every project, staff and money.' : 'Site staff see only the projects you add them to.'}>
          {(id) => (
            <Select id={id} value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="site_staff">Site staff</option>
              <option value="admin">Admin</option>
            </Select>
          )}
        </Field>
      )}
      {role === 'site_staff' && projects && (
        <Field label="Add to project" hint="Optional. You can add them to more projects later.">
          {(id) => (
            <Select id={id} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Not now</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      {onProject && <PermissionPicker value={permissions} onChange={setPermissions} />}
      <FormError error={error} />
      <Button type="submit" busy={busy} className="sm:self-end">
        Create login
      </Button>
    </form>
  )
}
