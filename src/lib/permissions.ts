// Per-project permissions for site staff. The database checks the same names
// (project_members.permissions check constraint, private.can); keep both lists equal.
export const MODULES = [
  { key: 'labour', label: 'Labour', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'materials', label: 'Materials', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'bills', label: 'VAT bills', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'steel', label: 'Steel (BBS)', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'boq', label: 'BOQ', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'drawings', label: 'Drawings', actions: ['view', 'add', 'delete'] },
] as const

export type ModuleKey = (typeof MODULES)[number]['key']
export type Action = 'view' | 'add' | 'edit' | 'delete'
export type Permission = `${ModuleKey}.${Action}` | 'money.view'

export const MONEY: Permission = 'money.view'
export const ACTIONS: Action[] = ['view', 'add', 'edit', 'delete']
export const ACTION_LABEL: Record<Action, string> = { view: 'View', add: 'Add', edit: 'Edit', delete: 'Delete' }

export const ALL_PERMISSIONS: Permission[] = [...MODULES.flatMap((m) => m.actions.map((a) => `${m.key}.${a}` as Permission)), MONEY]

const all = (...modules: ModuleKey[]) => (actions: Action[]) => modules.flatMap((m) => actions.map((a) => `${m}.${a}` as Permission))

export const PRESETS: { label: string; permissions: Permission[] }[] = [
  {
    label: 'Site supervisor',
    permissions: [...all('labour', 'materials', 'bills', 'steel')(['view', 'add', 'edit']), 'boq.view', 'drawings.view'],
  },
  { label: 'Store keeper', permissions: [...all('materials')(['view', 'add', 'edit']), 'bills.view', 'bills.add', 'drawings.view'] },
  {
    label: 'Accountant',
    permissions: [...all('bills')(['view', 'add', 'edit', 'delete']), 'labour.view', 'materials.view', 'boq.view', MONEY],
  },
  { label: 'Viewer', permissions: MODULES.map((m) => `${m.key}.view` as Permission) },
]

/** Doing anything in a module needs seeing it: turning on add/edit/delete turns on view, turning off view turns the rest off. */
export function togglePermission(list: readonly Permission[], perm: Permission, on: boolean): Permission[] {
  const [module, action] = perm.split('.')
  const next = new Set(list)
  if (on) {
    next.add(perm)
    next.add(`${module}.view` as Permission)
  } else if (action === 'view' && module !== 'money') {
    for (const p of list) if (p.startsWith(`${module}.`)) next.delete(p)
  } else {
    next.delete(perm)
  }
  return ALL_PERMISSIONS.filter((p) => next.has(p))
}

export type Access = { admin: boolean; readOnly: boolean; permissions: readonly string[] }

/** Owners/admins can do everything; support (read only) can only look; staff need the toggle. */
export function allowed(access: Access, perm: Permission) {
  if (access.readOnly) return perm.endsWith('.view')
  return access.admin || access.permissions.includes(perm)
}

/** "Labour: view, add · Money" style summary for lists. */
export function describePermissions(list: readonly string[]) {
  if (list.length === 0) return 'No access yet'
  const parts = MODULES.flatMap((m) => {
    const acts = m.actions.filter((a) => list.includes(`${m.key}.${a}`))
    return acts.length ? [`${m.label}: ${acts.map((a) => ACTION_LABEL[a].toLowerCase()).join(', ')}`] : []
  })
  if (list.includes(MONEY)) parts.push('Money')
  return parts.join(' · ')
}
