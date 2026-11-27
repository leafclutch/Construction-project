import { fetchAll } from '../../lib/fetchAll'
import { saveRecord } from '../../lib/outbox'
import { supabase, type Tables } from '../../lib/supabase'

export type BbsItem = Tables<'bbs_items'>
export type SteelInput = Pick<BbsItem, 'member' | 'bar_dia_mm' | 'bar_count' | 'cut_length_m'>

export const listBbs = (projectId: string) =>
  fetchAll<BbsItem>((from, to) => supabase.from('bbs_items').select('*').eq('project_id', projectId).order('created_at').range(from, to))

/** Saves now, or on the phone to upload later when there is no signal. */
export const addBbs = (orgId: string, projectId: string, input: SteelInput) =>
  saveRecord({ table: 'bbs_items', orgId, projectId, row: input, summary: `${input.bar_count} × ${input.bar_dia_mm} mm · ${input.member}` })
