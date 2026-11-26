import { unwrap } from '../lib/useAsyncData'
import { supabase, type Tables, type Views } from '../lib/supabase'

export type Project = Tables<'projects'>
export type ProjectSummary = Views<'project_summaries'>
export type ProjectInput = Pick<Project, 'name' | 'code' | 'location' | 'client_name' | 'contract_amount' | 'status' | 'start_date'>

export const listProjects = (orgId: string) =>
  unwrap(supabase.from('projects').select('*').eq('org_id', orgId).order('created_at', { ascending: false }))

export const getProjectSummary = (id: string) =>
  unwrap(supabase.from('project_summaries').select('*').eq('project_id', id).single())

export const createProject = (orgId: string, input: ProjectInput) =>
  unwrap(supabase.from('projects').insert({ ...input, org_id: orgId }).select().single())

export const updateProject = (id: string, input: Partial<ProjectInput> & { billed_amount?: number }) =>
  unwrap(supabase.from('projects').update(input).eq('id', id).select().single())

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
