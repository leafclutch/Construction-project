import { unwrap, updateOne } from '../lib/useAsyncData'
import { supabase, type Tables, type Views } from '../lib/supabase'

export type Finance = Pick<Tables<'project_finance'>, 'contract_amount' | 'billed_amount'>
/** finance is null when the person may not see money; permissions are this person's toggles (empty for admins). */
export type Project = Tables<'projects'> & { finance: Finance | null; permissions: string[] }
export type ProjectSummary = Views<'project_summaries'>
export type ProjectInput = Pick<Project, 'name' | 'code' | 'location' | 'client_name' | 'status' | 'start_date'>

export async function listProjects(orgId: string, userId: string): Promise<Project[]> {
  const rows = await unwrap(
    supabase
      .from('projects')
      .select('*, project_finance(contract_amount, billed_amount), project_members(permissions)')
      .eq('org_id', orgId)
      .eq('project_members.user_id', userId)
      .order('created_at', { ascending: false }),
  )
  return rows.map(({ project_finance, project_members, ...p }) => ({ ...p, finance: project_finance, permissions: project_members[0]?.permissions ?? [] }))
}

export const getProjectSummary = (id: string) =>
  unwrap(supabase.from('project_summaries').select('*').eq('project_id', id).single())

export const updateFinance = (projectId: string, input: Partial<Finance>) =>
  updateOne(supabase.from('project_finance').update(input).eq('project_id', projectId).select('project_id'))

/** The finance row is created by a DB trigger; the contract amount is set right after. */
export async function createProject(orgId: string, input: ProjectInput, contractAmount: number) {
  const project = await unwrap(supabase.from('projects').insert({ ...input, org_id: orgId }).select().single())
  if (contractAmount > 0) await updateFinance(project.id, { contract_amount: contractAmount })
  return project
}

export const updateProject = (id: string, input: ProjectInput) => updateOne(supabase.from('projects').update(input).eq('id', id).select('id'))

/** Deletes the project's uploaded files first; rows cascade in the DB. */
export async function deleteProject(project: Project) {
  const prefix = `${project.org_id}/${project.id}`
  for (const bucket of ['drawings', 'receipts']) {
    // ponytail: one page of 1000 files per bucket; loop with offset if a site ever exceeds that.
    const files = await unwrap(supabase.storage.from(bucket).list(prefix, { limit: 1000 }))
    if (files.length) await unwrap(supabase.storage.from(bucket).remove(files.map((f) => `${prefix}/${f.name}`)))
  }
  await unwrap(supabase.from('projects').delete().eq('id', project.id))
}
