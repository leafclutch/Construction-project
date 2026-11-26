import { fetchAll } from '../../lib/fetchAll'
import { removeFile, uploadFile } from '../../lib/files'
import { supabase, type Tables } from '../../lib/supabase'
import { unwrap } from '../../lib/useAsyncData'

export type VatBill = Tables<'vat_bills'>
export type VatBillInput = Pick<VatBill, 'bill_date' | 'bill_no' | 'supplier_name' | 'supplier_pan' | 'taxable_amount' | 'vat_included'>

export const listBills = (projectId: string) =>
  fetchAll<VatBill>((from, to) =>
    supabase
      .from('vat_bills')
      .select('*')
      .eq('project_id', projectId)
      .order('bill_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to),
  )

export async function addBill(orgId: string, projectId: string, input: VatBillInput, file: File | null) {
  const file_path = file ? await uploadFile('receipts', orgId, projectId, file) : null
  try {
    await unwrap(supabase.from('vat_bills').insert({ ...input, file_path, org_id: orgId, project_id: projectId }))
  } catch (e) {
    await removeFile('receipts', file_path).catch(() => {})
    throw e
  }
}

export async function deleteBill(row: VatBill) {
  await unwrap(supabase.from('vat_bills').delete().eq('id', row.id))
  await removeFile('receipts', row.file_path).catch(() => {})
}
