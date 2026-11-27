import { fetchAll } from '../../lib/fetchAll'
import { removeFile } from '../../lib/files'
import { saveRecord } from '../../lib/outbox'
import { supabase, type Tables } from '../../lib/supabase'
import { unwrap, updateOne } from '../../lib/useAsyncData'

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

/** Saves now (bill copy first), or on the phone to upload later when there is no signal. */
export const addBill = (orgId: string, projectId: string, input: VatBillInput, file: File | null) =>
  saveRecord({
    table: 'vat_bills',
    orgId,
    projectId,
    row: input,
    summary: `Bill ${input.bill_no} · ${input.supplier_name}`,
    file: { bucket: 'receipts', column: 'file_path', file },
  })

/** Edits the bill details; the bill copy stays as it is. */
export const updateBill = (id: string, input: VatBillInput) =>
  updateOne(supabase.from('vat_bills').update(input).eq('id', id).select('id'))

export async function deleteBill(row: VatBill) {
  await unwrap(supabase.from('vat_bills').delete().eq('id', row.id))
  await removeFile('receipts', row.file_path).catch(() => {})
}
