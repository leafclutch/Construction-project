import type { Enums } from './supabase'

export { APP_NAME } from './appName'

export type Role = Enums<'member_role'>

export const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', admin: 'Admin', site_staff: 'Site staff' }

export const ROLE_HELP: Record<Role, string> = {
  owner: 'Created the firm. Full control.',
  admin: 'Manages projects, BOQ, drawings and team. Can edit and delete records.',
  site_staff: 'Adds labour, materials, bills and steel. Cannot edit or delete.',
}
