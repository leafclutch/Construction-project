import { fetchAll } from '../../lib/fetchAll'
import { removeFile } from '../../lib/files'
import { saveRecord } from '../../lib/outbox'
import { supabase, type Tables } from '../../lib/supabase'
import { unwrap, updateOne } from '../../lib/useAsyncData'

export type MaterialEntry = Tables<'material_entries'>
export type MaterialInput = Pick<MaterialEntry, 'entry_date' | 'material' | 'quantity' | 'unit' | 'supplier'>

export const MATERIALS = ['Cement', 'Sand', 'Aggregate (Gitti)', 'Steel rod', 'Bricks', 'Stone', 'Blocks', 'Timber', 'Waterproofing', 'Other']
export const UNITS = ['Bags', 'Kg', 'Ton', 'Tractor', 'Truck', 'Cft', 'm³', 'Pcs', 'Litre']

export function listMaterials(projectId: string, material?: string) {
  return fetchAll<MaterialEntry>((from, to) => {
    let q = supabase.from('material_entries').select('*').eq('project_id', projectId)
    if (material) q = q.eq('material', material)
    return q.order('entry_date', { ascending: false }).order('created_at', { ascending: false }).range(from, to)
  })
}

/** Saves now (challan photo first), or on the phone to upload later when there is no signal. */
export const addMaterial = (orgId: string, projectId: string, input: MaterialInput, challan: File | null) =>
  saveRecord({
    table: 'material_entries',
    orgId,
    projectId,
    row: input,
    summary: `${input.quantity} ${input.unit} ${input.material}`,
    file: { bucket: 'receipts', column: 'challan_path', file: challan },
  })

/** Edits the text and number fields; the challan photo stays as it is. */
export const updateMaterial = (id: string, input: MaterialInput) =>
  updateOne(supabase.from('material_entries').update(input).eq('id', id).select('id'))

export async function deleteMaterial(row: MaterialEntry) {
  await unwrap(supabase.from('material_entries').delete().eq('id', row.id))
  await removeFile('receipts', row.challan_path).catch(() => {})
}
