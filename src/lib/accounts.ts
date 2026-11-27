import { FunctionsHttpError } from '@supabase/supabase-js'
import type { Permission } from './permissions'
import { supabase } from './supabase'

// Client for supabase/functions/accounts. Account creation and password resets need the
// service key, so they run there; the function checks who is calling.

export type Credentials = { email: string; password: string }

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('accounts', { body })
  if (error instanceof FunctionsHttpError) throw (await error.context.json().catch(() => null)) ?? { code: 'server_error' }
  if (error) throw error
  return data as T
}

export const createFirm = (input: { firm_name: string; owner_name: string; owner_email: string }) =>
  call<Credentials & { org_id: string }>({ action: 'create_firm', ...input })

export const setFirmStatus = (orgId: string, status: 'active' | 'suspended') => call({ action: 'set_firm_status', org_id: orgId, status })

export const createStaff = (input: {
  org_id: string
  full_name: string
  email: string
  role: 'site_staff' | 'admin'
  project_id?: string
  permissions?: Permission[]
}) => call<Credentials & { user_id: string }>({ action: 'create_staff', ...input })

export const resetPassword = (orgId: string, userId: string) => call<Credentials>({ action: 'reset_password', org_id: orgId, user_id: userId })
