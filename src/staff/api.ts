import type { Permission } from '../lib/permissions'
import { supabase, type Enums } from '../lib/supabase'
import { unwrap, updateOne } from '../lib/useAsyncData'

export const listStaff = (orgId: string) =>
  unwrap(supabase.from('memberships').select('user_id, role, active, created_at, profiles(full_name, email)').eq('org_id', orgId).order('created_at'))

export type StaffMember = Awaited<ReturnType<typeof listStaff>>[number]

export const listAssignments = (orgId: string) => unwrap(supabase.from('project_members').select('user_id, project_id').eq('org_id', orgId))

export const listProjectTeam = (projectId: string) =>
  unwrap(
    supabase
      .from('project_members')
      .select('user_id, permissions, memberships(active, profiles(full_name, email))')
      .eq('project_id', projectId)
      .order('created_at'),
  )

export type TeamMember = Awaited<ReturnType<typeof listProjectTeam>>[number]

export const setActive = (orgId: string, userId: string, active: boolean) =>
  updateOne(supabase.from('memberships').update({ active }).eq('org_id', orgId).eq('user_id', userId).select('user_id'))

export const setRole = (orgId: string, userId: string, role: Enums<'member_role'>) =>
  updateOne(supabase.from('memberships').update({ role }).eq('org_id', orgId).eq('user_id', userId).select('user_id'))

export const addToProject = (project: { id: string; org_id: string }, userId: string, permissions: Permission[]) =>
  unwrap(supabase.from('project_members').insert({ project_id: project.id, org_id: project.org_id, user_id: userId, permissions }))

export const setPermissions = (projectId: string, userId: string, permissions: Permission[]) =>
  updateOne(supabase.from('project_members').update({ permissions }).eq('project_id', projectId).eq('user_id', userId).select('user_id'))

export const removeFromProject = (projectId: string, userId: string) =>
  unwrap(supabase.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId))
