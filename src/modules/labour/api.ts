import { fetchAll } from '../../lib/fetchAll'
import { supabase, type Tables } from '../../lib/supabase'
import { unwrap, updateOne } from '../../lib/useAsyncData'

export type LabourEntry = Tables<'labour_entries'>
export type LabourInput = Pick<LabourEntry, 'entry_date' | 'category' | 'worker_count' | 'daily_rate' | 'remarks'>

export const LABOUR_CATEGORIES = [
  'Mason (Mistri)',
  'Helper (Labour)',
  'Carpenter',
  'Steel fixer',
  'Plumber',
  'Electrician',
  'Painter',
  'Welder',
  'Machine operator',
  'Other',
]

export function listLabour(projectId: string, filter: { date?: string; category?: string }) {
  return fetchAll<LabourEntry>((from, to) => {
    let q = supabase.from('labour_entries').select('*').eq('project_id', projectId)
    if (filter.date) q = q.eq('entry_date', filter.date)
    if (filter.category) q = q.eq('category', filter.category)
    return q.order('entry_date', { ascending: false }).order('created_at', { ascending: false }).range(from, to)
  })
}

export const addLabour = (orgId: string, projectId: string, input: LabourInput) =>
  unwrap(supabase.from('labour_entries').insert({ ...input, org_id: orgId, project_id: projectId }))

export const updateLabour = (id: string, input: LabourInput) =>
  updateOne(supabase.from('labour_entries').update(input).eq('id', id).select('id'))

export const deleteLabour = (id: string) => unwrap(supabase.from('labour_entries').delete().eq('id', id))
