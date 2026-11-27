// Tenant isolation, project scoping and per-project permissions against the real dev Supabase project.
// Run: pnpm test:db   (needs .env.local with URL, publishable and secret keys)
// Firms and members are created with the secret key, the same way the accounts Edge Function does.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomBytes, randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const url = process.env.VITE_SUPABASE_URL!
const publishable = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
const secret = process.env.SUPABASE_SECRET_KEY!

const admin = createClient(url, secret, { auth: { persistSession: false } })
const run = randomBytes(3).toString('hex')
const password = randomBytes(18).toString('base64url')

type User = { client: SupabaseClient; id: string }

async function userClient(label: string): Promise<User> {
  const email = `rls-${label}-${run}@thekka.test`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Test ${label}` } })
  if (error) throw error
  const client = createClient(url, publishable, { auth: { persistSession: false } })
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError
  return { client, id: data.user.id }
}

async function ok<T>(p: PromiseLike<{ data: T; error: unknown }>) {
  const { data, error } = await p
  if (error) throw error
  return data
}

let ownerA: User, staffA: User, otherStaffA: User, ownerB: User, support: User
let orgA: string, orgB: string
let p1: string, p2: string, projectB: string

const STAFF_PERMS = ['labour.view', 'labour.add', 'materials.view', 'materials.add', 'bills.view', 'bills.add', 'steel.view', 'steel.add']

beforeAll(async () => {
  ;[ownerA, staffA, otherStaffA, ownerB, support] = await Promise.all(
    ['owner-a', 'staff-a', 'staff2-a', 'owner-b', 'support'].map(userClient),
  )
  orgA = (await ok(admin.from('organizations').insert({ name: `Org A ${run}` }).select().single())).id
  orgB = (await ok(admin.from('organizations').insert({ name: `Org B ${run}` }).select().single())).id
  await ok(
    admin.from('memberships').insert([
      { org_id: orgA, user_id: ownerA.id, role: 'owner' },
      { org_id: orgA, user_id: staffA.id, role: 'site_staff' },
      { org_id: orgA, user_id: otherStaffA.id, role: 'site_staff' },
      { org_id: orgB, user_id: ownerB.id, role: 'owner' },
    ]),
  )
  await ok(admin.from('platform_admins').insert({ user_id: support.id }))

  p1 = (await ok(ownerA.client.from('projects').insert({ org_id: orgA, name: 'Site 1' }).select().single())).id
  p2 = (await ok(ownerA.client.from('projects').insert({ org_id: orgA, name: 'Site 2' }).select().single())).id
  projectB = (await ok(ownerB.client.from('projects').insert({ org_id: orgB, name: 'Site B' }).select().single())).id
  await ok(ownerA.client.from('project_finance').update({ contract_amount: 1000000 }).eq('project_id', p1).select())

  await ok(ownerA.client.from('project_members').insert({ project_id: p1, org_id: orgA, user_id: staffA.id, permissions: STAFF_PERMS }))
  await ok(ownerA.client.from('project_members').insert({ project_id: p2, org_id: orgA, user_id: otherStaffA.id, permissions: ['labour.view'] }))
}, 60_000)

afterAll(async () => {
  if (orgA) await admin.from('organizations').delete().eq('id', orgA)
  if (orgB) await admin.from('organizations').delete().eq('id', orgB)
  for (const u of [ownerA, staffA, otherStaffA, ownerB, support]) if (u) await admin.auth.admin.deleteUser(u.id)
}, 60_000)

describe('project scoping', () => {
  it('staff see only the projects they are added to; the owner sees all', async () => {
    const staff = await ok(staffA.client.from('projects').select('id').eq('org_id', orgA))
    expect(staff.map((p) => p.id)).toEqual([p1])
    const owner = await ok(ownerA.client.from('projects').select('id').eq('org_id', orgA))
    expect(owner).toHaveLength(2)
  })

  it('staff cannot read records of a project they are not on', async () => {
    await ok(ownerA.client.from('labour_entries').insert({ org_id: orgA, project_id: p2, category: 'Mason', worker_count: 1, daily_rate: 1000, remarks: 'P2 work' }))
    const rows = await ok(staffA.client.from('labour_entries').select('id').eq('project_id', p2))
    expect(rows).toEqual([])
    const add = await staffA.client.from('labour_entries').insert({ org_id: orgA, project_id: p2, category: 'Mason', worker_count: 1, daily_rate: 1, remarks: 'x' })
    expect(add.error?.code).toBe('42501')
  })

  it('staff see only themselves in the team; the owner sees everyone', async () => {
    const m = await ok(staffA.client.from('memberships').select('user_id').eq('org_id', orgA))
    expect(m.map((r) => r.user_id)).toEqual([staffA.id])
    const pm = await ok(staffA.client.from('project_members').select('user_id').eq('org_id', orgA))
    expect(pm.map((r) => r.user_id)).toEqual([staffA.id])
    const other = await ok(staffA.client.from('profiles').select('id').eq('id', otherStaffA.id))
    expect(other).toEqual([])
    expect(await ok(ownerA.client.from('memberships').select('user_id').eq('org_id', orgA))).toHaveLength(3)
    expect(await ok(ownerA.client.from('profiles').select('id').eq('id', otherStaffA.id))).toHaveLength(1)
  })
})

describe('per-project permissions', () => {
  it('add without edit/delete: can add, cannot change or remove', async () => {
    const row = await ok(
      staffA.client.from('labour_entries').insert({ org_id: orgA, project_id: p1, category: 'Mason', worker_count: 4, daily_rate: 1150, remarks: 'Column casting' }).select().single(),
    )
    expect(Number(row.total_wage)).toBe(4600)
    expect(await ok(staffA.client.from('labour_entries').update({ daily_rate: 1 }).eq('id', row.id).select())).toEqual([])
    expect(await ok(staffA.client.from('labour_entries').delete().eq('id', row.id).select())).toEqual([])
  })

  it('a module without permission is closed: BOQ and drawings', async () => {
    await ok(ownerA.client.from('boq_items').insert({ org_id: orgA, project_id: p1, description: 'PCC', unit: 'm3', quantity: 1, rate: 100 }))
    expect(await ok(staffA.client.from('boq_items').select('id').eq('project_id', p1))).toEqual([])
    const b = await staffA.client.from('boq_items').insert({ org_id: orgA, project_id: p1, description: 'x', unit: 'm3', quantity: 1, rate: 1 })
    expect(b.error?.code).toBe('42501')
  })

  it('turning on edit lets the staff member edit', async () => {
    const { id } = await ok(staffA.client.from('labour_entries').select('id').eq('project_id', p1).limit(1).single())
    await ok(ownerA.client.from('project_members').update({ permissions: [...STAFF_PERMS, 'labour.edit'] }).eq('project_id', p1).eq('user_id', staffA.id).select())
    expect(await ok(staffA.client.from('labour_entries').update({ daily_rate: 1200 }).eq('id', id).select())).toHaveLength(1)
  })

  it('money needs money.view', async () => {
    expect(await ok(staffA.client.from('project_finance').select('*').eq('project_id', p1))).toEqual([])
    const owner = await ok(ownerA.client.from('project_finance').select('contract_amount').eq('project_id', p1).single())
    expect(Number(owner.contract_amount)).toBe(1000000)
    await ok(ownerA.client.from('project_members').update({ permissions: [...STAFF_PERMS, 'money.view'] }).eq('project_id', p1).eq('user_id', staffA.id).select())
    expect(await ok(staffA.client.from('project_finance').select('*').eq('project_id', p1))).toHaveLength(1)
    // Seeing money is not changing it.
    expect(await ok(staffA.client.from('project_finance').update({ billed_amount: 5 }).eq('project_id', p1).select())).toEqual([])
  })

  it('unknown permissions are rejected by the DB', async () => {
    const r = await ownerA.client.from('project_members').update({ permissions: ['labour.view', 'everything'] }).eq('project_id', p1).eq('user_id', staffA.id)
    expect(r.error?.code).toBe('23514')
  })

  it('staff cannot give themselves permissions, join projects or promote themselves', async () => {
    const self = await ok(staffA.client.from('project_members').update({ permissions: ['labour.delete'] }).eq('user_id', staffA.id).select())
    expect(self).toEqual([])
    const join = await staffA.client.from('project_members').insert({ project_id: p2, org_id: orgA, user_id: staffA.id, permissions: [] })
    expect(join.error?.code).toBe('42501')
    expect(await ok(staffA.client.from('memberships').update({ role: 'admin' }).eq('user_id', staffA.id).select())).toEqual([])
  })

  it('only the server creates firms and members', async () => {
    const org = await ownerA.client.from('organizations').insert({ name: 'Mine' })
    expect(org.error?.code).toBe('42501')
    const mem = await ownerA.client.from('memberships').insert({ org_id: orgA, user_id: ownerB.id, role: 'admin' })
    expect(mem.error?.code).toBe('42501')
    const pa = await ownerA.client.from('platform_admins').insert({ user_id: ownerA.id })
    expect(pa.error?.code).toBe('42501')
  })

  it('VAT and BBS math is done by the DB', async () => {
    const v = await ok(
      staffA.client.from('vat_bills').insert({ org_id: orgA, project_id: p1, bill_date: '2026-11-18', bill_no: 'VAT-1', supplier_name: 'Mithila', supplier_pan: '601845219', taxable_amount: 125000 }).select().single(),
    )
    expect(Number(v.vat_amount)).toBe(16250)
    expect(Number(v.gross_amount)).toBe(141250)
    const s = await ok(staffA.client.from('bbs_items').insert({ org_id: orgA, project_id: p1, member: 'F1', bar_dia_mm: 12, bar_count: 20, cut_length_m: 1.7 }).select().single())
    expect(Number(s.total_weight_kg)).toBe(30.22)
  })

  it('nobody can forge who recorded an entry or rewrite tenancy keys', async () => {
    const forged = await staffA.client.from('labour_entries').insert({ org_id: orgA, project_id: p1, category: 'Mason', worker_count: 1, daily_rate: 1, remarks: 'x', created_by: ownerA.id })
    expect(forged.error?.code).toBe('42501')
    const moved = await ownerA.client.from('projects').update({ org_id: orgB }).eq('id', p1)
    expect(moved.error?.code).toBe('42501')
    const email = await staffA.client.from('profiles').update({ email: 'boss@evil.test' }).eq('id', staffA.id)
    expect(email.error?.code).toBe('42501')
  })
})

describe('turning access off', () => {
  it('a turned-off member loses data access at once, and can be turned back on', async () => {
    await ok(ownerA.client.from('memberships').update({ active: false }).eq('org_id', orgA).eq('user_id', otherStaffA.id).select())
    expect(await ok(otherStaffA.client.from('projects').select('id'))).toEqual([])
    // The app can still tell them why.
    expect(await ok(otherStaffA.client.from('organizations').select('id').eq('id', orgA))).toHaveLength(1)
    await ok(ownerA.client.from('memberships').update({ active: true }).eq('org_id', orgA).eq('user_id', otherStaffA.id).select())
    expect(await ok(otherStaffA.client.from('projects').select('id'))).toHaveLength(1)
  })

  it('admins cannot turn off the owner or themselves', async () => {
    expect(await ok(ownerA.client.from('memberships').update({ active: false }).eq('user_id', ownerA.id).select())).toEqual([])
  })

  it('a suspended firm sees nothing', async () => {
    await ok(admin.from('organizations').update({ status: 'suspended' }).eq('id', orgB))
    expect(await ok(ownerB.client.from('projects').select('id'))).toEqual([])
    const write = await ownerB.client.from('projects').insert({ org_id: orgB, name: 'During suspension' })
    expect(write.error?.code).toBe('42501')
    await ok(admin.from('organizations').update({ status: 'active' }).eq('id', orgB))
    expect(await ok(ownerB.client.from('projects').select('id'))).toHaveLength(1)
  })
})

describe('super admin (support)', () => {
  it('reads every firm', async () => {
    expect(await ok(support.client.from('organizations').select('id').in('id', [orgA, orgB]))).toHaveLength(2)
    expect(await ok(support.client.from('projects').select('id').eq('org_id', orgA))).toHaveLength(2)
    expect((await ok(support.client.from('labour_entries').select('id').eq('org_id', orgA))).length).toBeGreaterThan(0)
    expect(await ok(support.client.from('project_finance').select('project_id').eq('project_id', p1))).toHaveLength(1)
  })

  it('never writes firm records', async () => {
    const add = await support.client.from('labour_entries').insert({ org_id: orgA, project_id: p1, category: 'Mason', worker_count: 1, daily_rate: 1, remarks: 'x' })
    expect(add.error?.code).toBe('42501')
    expect(await ok(support.client.from('projects').update({ name: 'x' }).eq('id', p1).select())).toEqual([])
    expect(await ok(support.client.from('labour_entries').delete().eq('org_id', orgA).select())).toEqual([])
    const project = await support.client.from('projects').insert({ org_id: orgA, name: 'Support project' })
    expect(project.error?.code).toBe('42501')
  })
})

describe('tenant isolation', () => {
  it('another firm sees nothing of firm A', async () => {
    for (const table of ['projects', 'labour_entries', 'vat_bills', 'bbs_items', 'memberships', 'project_members', 'project_finance', 'organizations', 'project_summaries']) {
      const { data, error } = await ownerB.client.from(table).select('*').eq(table === 'organizations' ? 'id' : 'org_id', orgA)
      expect(error, table).toBeNull()
      expect(data, table).toEqual([])
    }
    expect(await ok(ownerB.client.from('profiles').select('id').eq('id', ownerA.id))).toEqual([])
  })

  it('another firm cannot write into firm A', async () => {
    const direct = await ownerB.client.from('material_entries').insert({ org_id: orgA, project_id: p1, material: 'Cement', quantity: 10, unit: 'Bags' })
    expect(direct.error?.code).toBe('42501')
    // Own org id + someone else's project: blocked by the composite FK.
    const crossed = await ownerB.client.from('material_entries').insert({ org_id: orgB, project_id: p1, material: 'Cement', quantity: 10, unit: 'Bags' })
    expect(crossed.error?.code).toBe('23503')
    // Adding firm A's staff to a firm B project: blocked by the membership FK.
    const poach = await ownerB.client.from('project_members').insert({ project_id: projectB, org_id: orgB, user_id: staffA.id, permissions: [] })
    expect(poach.error?.code).toBe('23503')
    expect(await ok(ownerB.client.from('projects').update({ name: 'hacked' }).eq('id', p1).select())).toEqual([])
  })

  it('storage follows project permissions', async () => {
    const file = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
    const path = `${orgA}/${p1}/challan-${run}.png`
    expect((await staffA.client.storage.from('receipts').upload(path, file)).error).toBeNull()
    // Not on project 2, no drawings permission, other firm: all refused.
    expect((await staffA.client.storage.from('receipts').upload(`${orgA}/${p2}/x-${run}.png`, file)).error).not.toBeNull()
    expect((await staffA.client.storage.from('drawings').upload(`${orgA}/${p1}/d-${run}.png`, file)).error).not.toBeNull()
    expect((await ownerB.client.storage.from('receipts').download(path)).error).not.toBeNull()
    expect((await otherStaffA.client.storage.from('receipts').download(path)).error).not.toBeNull()
    expect((await ownerA.client.storage.from('receipts').download(path)).error).toBeNull()
    expect((await support.client.storage.from('receipts').download(path)).error).toBeNull()
    await admin.storage.from('receipts').remove([path])
  })

  it('project_summaries only counts what the person may see', async () => {
    const s = await ok(staffA.client.from('project_summaries').select('*').eq('project_id', p1).single())
    expect(Number(s.vat_gross)).toBe(141250)
    expect(Number(s.boq_total)).toBe(0) // no boq.view
    const o = await ok(ownerA.client.from('project_summaries').select('*').eq('project_id', p1).single())
    expect(Number(o.boq_total)).toBe(100)
  })
})

describe('profile photos', () => {
  it('each person reads and writes only their own photo', async () => {
    const file = new Blob([new Uint8Array([255, 216, 255])], { type: 'image/jpeg' })
    const mine = `${staffA.id}/a-${run}.jpg`
    expect((await staffA.client.storage.from('avatars').upload(mine, file)).error).toBeNull()
    await ok(staffA.client.from('profiles').update({ avatar_path: mine }).eq('id', staffA.id).select('id').single())
    // Someone else's folder, someone else's photo, or pointing the profile outside the own folder: refused.
    expect((await staffA.client.storage.from('avatars').upload(`${ownerA.id}/x-${run}.jpg`, file)).error).not.toBeNull()
    expect((await ownerA.client.storage.from('avatars').download(mine)).error).not.toBeNull()
    expect((await ownerB.client.storage.from('avatars').download(mine)).error).not.toBeNull()
    expect((await staffA.client.from('profiles').update({ avatar_path: `${ownerA.id}/x.jpg` }).eq('id', staffA.id)).error?.code).toBe('23514')
    expect((await staffA.client.storage.from('avatars').download(mine)).error).toBeNull()
    expect((await staffA.client.storage.from('avatars').remove([mine])).error).toBeNull()
  })
})

describe('offline saves and push', () => {
  const labour = (id: string) => ({ id, org_id: orgA, project_id: p1, category: 'Helper', worker_count: 2, daily_rate: 800, remarks: 'Saved offline' })

  it('a record sent twice with its own id is saved once (the retry gets 23505)', async () => {
    const id = randomUUID()
    await ok(staffA.client.from('labour_entries').insert(labour(id)))
    const again = await staffA.client.from('labour_entries').insert(labour(id))
    expect(again.error?.code).toBe('23505')
    expect(await ok(staffA.client.from('labour_entries').select('id').eq('id', id))).toHaveLength(1)
  })

  it('push subscriptions: own rows only, saved through the function, a shared phone moves to the new person', async () => {
    const endpoint = `https://push.example.test/${run}`
    const save = (u: User) => ok(u.client.rpc('save_push_subscription', { p_endpoint: endpoint, p_p256dh: 'key', p_auth: 'auth' }))
    await save(staffA)
    expect(await ok(staffA.client.from('push_subscriptions').select('endpoint').eq('endpoint', endpoint))).toHaveLength(1)
    expect(await ok(ownerA.client.from('push_subscriptions').select('id').eq('endpoint', endpoint))).toEqual([])
    await save(ownerA)
    expect(await ok(staffA.client.from('push_subscriptions').select('id').eq('endpoint', endpoint))).toEqual([])
    expect(await ok(ownerA.client.from('push_subscriptions').select('user_id').eq('endpoint', endpoint))).toEqual([{ user_id: ownerA.id }])
    const direct = await staffA.client.from('push_subscriptions').insert({ user_id: ownerA.id, endpoint: `${endpoint}/x`, p256dh: 'k', auth: 'a' })
    expect(direct.error?.code).toBe('42501')
    const anon = await createClient(url, publishable, { auth: { persistSession: false } }).rpc('save_push_subscription', { p_endpoint: endpoint, p_p256dh: 'k', p_auth: 'a' })
    expect(anon.error).toBeTruthy()
    await ok(ownerA.client.from('push_subscriptions').delete().eq('endpoint', endpoint))
  })

  it('a staff entry calls the push function; an owner entry does not', async () => {
    const db = new pg.Client({ connectionString: process.env.DIRECT_URL, ssl: { rejectUnauthorized: false } })
    await db.connect()
    // Replies from the push function look like {"sent":0,...}.
    const calls = async (since: Date) =>
      (await db.query(`select count(*)::int n from net._http_response where created > $1 and content like '{"sent":%'`, [since])).rows[0].n as number
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    try {
      const t1 = new Date()
      await ok(staffA.client.from('labour_entries').insert(labour(randomUUID())))
      let n = 0
      for (let i = 0; i < 15 && n === 0; i++) {
        await wait(1000)
        n = await calls(t1)
      }
      expect(n).toBeGreaterThan(0)

      const t2 = new Date()
      await ok(ownerA.client.from('labour_entries').insert(labour(randomUUID())))
      await wait(5000)
      expect(await calls(t2)).toBe(0)
    } finally {
      await db.end()
    }
  }, 40_000)
})
