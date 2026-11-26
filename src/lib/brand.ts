import type { Enums } from './supabase'

/** Product name shown in the UI. Also update <title> in index.html when it changes. */
export const APP_NAME = 'Nirman Sathi'

export type Role = Enums<'member_role'>

export const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', admin: 'Admin', site_staff: 'Site staff' }

export const ROLE_HELP: Record<Role, string> = {
  owner: 'Created the firm. Full control.',
  admin: 'Manages projects, BOQ, drawings and team. Can edit and delete records.',
  site_staff: 'Adds labour, materials, bills and steel. Cannot edit or delete.',
}
