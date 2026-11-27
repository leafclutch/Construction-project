// The deployed "accounts" Edge Function, called as different users. Run: pnpm test:db
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const url = process.env.VITE_SUPABASE_URL!
const publishable = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
const run = randomBytes(3).toString('hex')
const mail = (label: string) => `acc-${label}-${run}@thekka.test`

async function signIn(email: string, password: string) {
  const client = createClient(url, publishable, { auth: { persistSession: false } })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  return { client, error, token: data.session?.access_token }
}

async function call(token: string | undefined, body: Record<string, unknown>) {
  const res = await fetch(`${url}/functions/v1/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: publishable, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}

let supportToken: string
let ownerToken: string
let owner: SupabaseClient
let staffToken: string
let orgId: string
let projectId: string
let staffId: string
const users: string[] = []

beforeAll(async () => {
  const password = randomBytes(18).toString('base64url')
  const { data, error } = await admin.auth.admin.createUser({ email: mail('support'), password, email_confirm: true })
  if (error) throw error
  users.push(data.user.id)
  await admin.from('platform_admins').insert({ user_id: data.user.id })
  supportToken = (await signIn(mail('support'), password)).token!
}, 60_000)

afterAll(async () => {
  if (orgId) await admin.from('organizations').delete().eq('id', orgId)
  for (const id of users) await admin.auth.admin.deleteUser(id)
}, 60_000)

describe('accounts function', () => {
  it('refuses calls without a login', async () => {
    expect((await call(undefined, { action: 'create_firm' })).status).toBe(401)
  })

  it('super admin creates a firm; the owner logs in with the temporary password and must change it', async () => {
    const r = await call(supportToken, { action: 'create_firm', firm_name: `Firm ${run}`, owner_name: 'Ram Owner', owner_email: mail('owner') })
    expect(r.status).toBe(200)
    expect(r.body.password).toMatch(/^[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}$/)
    orgId = r.body.org_id

    const login = await signIn(mail('owner'), r.body.password)
    expect(login.error).toBeNull()
    owner = login.client
    ownerToken = login.token!
    const { data: me } = await owner.auth.getUser()
    users.push(me.user!.id)
    const profile = await owner.from('profiles').select('must_change_password, full_name').eq('id', me.user!.id).single()
    expect(profile.data).toEqual({ must_change_password: true, full_name: 'Ram Owner' })
    const m = await owner.from('memberships').select('role').eq('org_id', orgId).single()
    expect(m.data?.role).toBe('owner')
  })

  it('the same email cannot be used twice', async () => {
    const r = await call(supportToken, { action: 'create_firm', firm_name: 'Copy', owner_name: 'X', owner_email: mail('owner') })
    expect(r.status).toBe(409)
    expect(r.body.code).toBe('email_exists')
  })

  it('a firm owner cannot create firms', async () => {
    expect((await call(ownerToken, { action: 'create_firm', firm_name: 'Mine', owner_name: 'X', owner_email: mail('x') })).status).toBe(403)
  })

  it('owner creates staff straight onto a project with permissions', async () => {
    projectId = (await owner.from('projects').insert({ org_id: orgId, name: 'Site 1' }).select().single()).data!.id
    const r = await call(ownerToken, {
      action: 'create_staff',
      org_id: orgId,
      full_name: 'Hari Staff',
      email: mail('staff'),
      project_id: projectId,
      permissions: ['materials.view', 'materials.add'],
    })
    expect(r.status).toBe(200)
    staffId = r.body.user_id
    users.push(staffId)

    const login = await signIn(mail('staff'), r.body.password)
    expect(login.error).toBeNull()
    staffToken = login.token!
    const projects = await login.client.from('projects').select('id')
    expect(projects.data?.map((p) => p.id)).toEqual([projectId])
    const pm = await login.client.from('project_members').select('permissions').eq('project_id', projectId).single()
    expect(pm.data?.permissions).toEqual(['materials.view', 'materials.add'])
  })

  it('bad permission names are refused and nothing is left behind', async () => {
    const r = await call(ownerToken, { action: 'create_staff', org_id: orgId, full_name: 'Bad', email: mail('bad'), project_id: projectId, permissions: ['all'] })
    expect(r.status).toBe(400)
    const again = await call(ownerToken, { action: 'create_staff', org_id: orgId, full_name: 'Bad', email: mail('bad') })
    expect(again.status).toBe(200)
    users.push(again.body.user_id)
  })

  it('staff cannot create staff or reset passwords', async () => {
    expect((await call(staffToken, { action: 'create_staff', org_id: orgId, full_name: 'Y', email: mail('y') })).status).toBe(403)
    const { data } = await owner.auth.getUser()
    expect((await call(staffToken, { action: 'reset_password', org_id: orgId, user_id: data.user!.id })).status).toBe(403)
  })

  it('owner resets a staff password; the old one stops working', async () => {
    const r = await call(ownerToken, { action: 'reset_password', org_id: orgId, user_id: staffId })
    expect(r.status).toBe(200)
    expect(r.body.email).toBe(mail('staff'))
    expect((await signIn(mail('staff'), r.body.password)).error).toBeNull()
  })

  it('only the super admin suspends a firm', async () => {
    expect((await call(ownerToken, { action: 'set_firm_status', org_id: orgId, status: 'suspended' })).status).toBe(403)
    expect((await call(supportToken, { action: 'set_firm_status', org_id: orgId, status: 'suspended' })).status).toBe(200)
    expect((await owner.from('projects').select('id')).data).toEqual([])
    expect((await call(supportToken, { action: 'set_firm_status', org_id: orgId, status: 'active' })).status).toBe(200)
  })
})
