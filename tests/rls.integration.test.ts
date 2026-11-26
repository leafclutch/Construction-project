// Tenant isolation + role checks against the real dev Supabase project.
// Run: pnpm test:db   (needs .env.local with URL, publishable and secret keys)
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const url = process.env.VITE_SUPABASE_URL!
const publishable = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
const secret = process.env.SUPABASE_SECRET_KEY!

const admin = createClient(url, secret, { auth: { persistSession: false } })
const run = randomBytes(3).toString('hex')
const password = randomBytes(18).toString('base64url')

async function userClient(label: string) {
  const email = `rls-${label}-${run}@nirman-sathi.test`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Test ${label}` },
  })
  if (error) throw error
  const client = createClient(url, publishable, { auth: { persistSession: false } })
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError
  return { client, id: data.user.id }
}

let ownerA: { client: SupabaseClient; id: string }
let staffA: { client: SupabaseClient; id: string }
let ownerB: { client: SupabaseClient; id: string }
let orgA: string
let orgB: string
let projectA: string
let projectB: string

beforeAll(async () => {
  ;[ownerA, staffA, ownerB] = await Promise.all([userClient('owner-a'), userClient('staff-a'), userClient('owner-b')])

  orgA = (await ownerA.client.rpc('create_organization', { p_name: `Org A ${run}` })).data
  orgB = (await ownerB.client.rpc('create_organization', { p_name: `Org B ${run}` })).data
  expect(orgA).toBeTruthy()
  expect(orgB).toBeTruthy()

  const pa = await ownerA.client.from('projects').insert({ org_id: orgA, name: 'Site A', contract_amount: 1000000 }).select().single()
  const pb = await ownerB.client.from('projects').insert({ org_id: orgB, name: 'Site B' }).select().single()
  expect(pa.error).toBeNull()
  expect(pb.error).toBeNull()
  projectA = pa.data.id
  projectB = pb.data.id

  const invite = await ownerA.client.from('invites').insert({ org_id: orgA, role: 'site_staff' }).select().single()
  expect(invite.error).toBeNull()
  const accepted = await staffA.client.rpc('accept_invite', { p_code: invite.data.code.toLowerCase() })
  expect(accepted.error).toBeNull()
  expect(accepted.data).toBe(orgA)
}, 60_000)

afterAll(async () => {
  if (orgA) await admin.from('organizations').delete().eq('id', orgA)
  if (orgB) await admin.from('organizations').delete().eq('id', orgB)
  for (const u of [ownerA, staffA, ownerB]) if (u) await admin.auth.admin.deleteUser(u.id)
}, 60_000)

describe('roles inside one tenant', () => {
  it('site staff can record labour, and the wage is computed by the DB', async () => {
    const { data, error } = await staffA.client
      .from('labour_entries')
      .insert({ org_id: orgA, project_id: projectA, category: 'Mason', worker_count: 4, daily_rate: 1150, remarks: 'Column casting' })
      .select()
      .single()
    expect(error).toBeNull()
    expect(Number(data.total_wage)).toBe(4600)
  })

  it('site staff cannot delete or edit records', async () => {
    const { data: rows } = await staffA.client.from('labour_entries').select('id').eq('project_id', projectA)
    const id = rows![0].id
    const del = await staffA.client.from('labour_entries').delete().eq('id', id).select()
    expect(del.data).toEqual([])
    const upd = await staffA.client.from('labour_entries').update({ daily_rate: 1 }).eq('id', id).select()
    expect(upd.data).toEqual([])
  })

  it('site staff cannot create projects, BOQ items or invites', async () => {
    const p = await staffA.client.from('projects').insert({ org_id: orgA, name: 'Sneaky' })
    expect(p.error?.code).toBe('42501')
    const b = await staffA.client.from('boq_items').insert({ org_id: orgA, project_id: projectA, description: 'x', unit: 'm3', quantity: 1, rate: 1 })
    expect(b.error?.code).toBe('42501')
    const i = await staffA.client.from('invites').insert({ org_id: orgA, role: 'admin' })
    expect(i.error?.code).toBe('42501')
  })

  it('site staff cannot promote themselves', async () => {
    const r = await staffA.client.from('memberships').update({ role: 'admin' }).eq('user_id', staffA.id).select()
    expect(r.data).toEqual([])
  })

  it('nobody can forge who recorded an entry or rewrite tenancy keys', async () => {
    const forged = await staffA.client
      .from('labour_entries')
      .insert({ org_id: orgA, project_id: projectA, category: 'Mason', worker_count: 1, daily_rate: 1, remarks: 'x', created_by: ownerA.id })
    expect(forged.error?.code).toBe('42501')

    const moved = await ownerA.client.from('projects').update({ org_id: orgB }).eq('id', projectA)
    expect(moved.error?.code).toBe('42501')

    const email = await staffA.client.from('profiles').update({ email: 'boss@evil.test' }).eq('id', staffA.id)
    expect(email.error?.code).toBe('42501')
    const name = await staffA.client.from('profiles').update({ full_name: 'Staff A' }).eq('id', staffA.id).select()
    expect(name.data).toHaveLength(1)
  })

  it('owner can delete records', async () => {
    const { data: rows } = await ownerA.client.from('labour_entries').select('id').eq('project_id', projectA)
    const del = await ownerA.client.from('labour_entries').delete().eq('id', rows![0].id).select()
    expect(del.data).toHaveLength(1)
  })

  it('VAT and BBS math is done by the DB', async () => {
    const v = await staffA.client
      .from('vat_bills')
      .insert({ org_id: orgA, project_id: projectA, bill_date: '2026-11-18', bill_no: 'VAT-1', supplier_name: 'Mithila', supplier_pan: '601845219', taxable_amount: 125000 })
      .select()
      .single()
    expect(v.error).toBeNull()
    expect(Number(v.data.vat_amount)).toBe(16250)
    expect(Number(v.data.gross_amount)).toBe(141250)

    const s = await staffA.client
      .from('bbs_items')
      .insert({ org_id: orgA, project_id: projectA, member: 'F1', bar_dia_mm: 12, bar_count: 20, cut_length_m: 1.7 })
      .select()
      .single()
    expect(s.error).toBeNull()
    expect(Number(s.data.total_weight_kg)).toBe(30.22)
  })
})

describe('dashboard summary', () => {
  it('project_summaries adds up the records the member can see', async () => {
    const { data, error } = await staffA.client.from('project_summaries').select('*').eq('project_id', projectA).single()
    expect(error).toBeNull()
    expect(Number(data!.vat_gross)).toBe(141250)
    expect(Number(data!.steel_kg)).toBe(30.22)
    expect(Number(data!.labour_cost)).toBe(0) // the one labour row was deleted by the owner
  })
})

describe('tenant isolation', () => {
  it('another tenant sees nothing of tenant A', async () => {
    for (const table of ['projects', 'labour_entries', 'vat_bills', 'bbs_items', 'memberships', 'organizations', 'project_summaries']) {
      const { data, error } = await ownerB.client.from(table).select('*').eq(table === 'organizations' ? 'id' : 'org_id', orgA)
      expect(error, table).toBeNull()
      expect(data, table).toEqual([])
    }
    const profiles = await ownerB.client.from('profiles').select('id').eq('id', ownerA.id)
    expect(profiles.data).toEqual([])
  })

  it('another tenant cannot write into tenant A', async () => {
    const direct = await ownerB.client
      .from('material_entries')
      .insert({ org_id: orgA, project_id: projectA, material: 'Cement', quantity: 10, unit: 'Bags' })
    expect(direct.error?.code).toBe('42501')

    // Own org id + someone else's project: blocked by the composite FK.
    const crossed = await ownerB.client
      .from('material_entries')
      .insert({ org_id: orgB, project_id: projectA, material: 'Cement', quantity: 10, unit: 'Bags' })
    expect(crossed.error?.code).toBe('23503')

    const upd = await ownerB.client.from('projects').update({ name: 'hacked' }).eq('id', projectA).select()
    expect(upd.data).toEqual([])
  })

  it('storage objects are scoped to the tenant folder', async () => {
    const path = `${orgA}/${projectA}/challan-${run}.png`
    const file = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
    const up = await staffA.client.storage.from('receipts').upload(path, file)
    expect(up.error).toBeNull()

    const foreignRead = await ownerB.client.storage.from('receipts').download(path)
    expect(foreignRead.error).not.toBeNull()
    const foreignWrite = await ownerB.client.storage.from('receipts').upload(`${orgA}/${projectA}/evil-${run}.png`, file)
    expect(foreignWrite.error).not.toBeNull()
    const staffDrawing = await staffA.client.storage.from('drawings').upload(`${orgA}/${projectA}/d-${run}.png`, file)
    expect(staffDrawing.error).not.toBeNull()

    const ownRead = await ownerA.client.storage.from('receipts').download(path)
    expect(ownRead.error).toBeNull()
    await admin.storage.from('receipts').remove([path])
  })

  it('unused project B stays private too', async () => {
    const { data } = await ownerA.client.from('projects').select('id').eq('id', projectB)
    expect(data).toEqual([])
  })
})
