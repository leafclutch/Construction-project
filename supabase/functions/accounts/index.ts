// Creates accounts and resets passwords. Runs with the service key, so every action
// checks who is calling first. Accounts are created already confirmed: no email is sent.
//
//   create_firm      super admin   firm + owner account
//   set_firm_status  super admin   active / suspended
//   create_staff     firm admin    member account, optionally added to a project with permissions
//   reset_password   super admin (anyone) or firm admin (their staff; owners also their admins)
import { createClient } from 'npm:@supabase/supabase-js@2'

const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default
const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

class Fail extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

function text(value: unknown, field: string, min: number, max: number) {
  const v = typeof value === 'string' ? value.trim() : ''
  if (v.length < min || v.length > max) throw new Fail(400, 'invalid_input', `Check the ${field}.`)
  return v
}

function email(value: unknown) {
  const v = text(value, 'email', 3, 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new Fail(400, 'invalid_input', 'Check the email.')
  return v
}

// 12 characters from an alphabet without look-alikes (0/O, 1/l/I), shown as xxxx-xxxx-xxxx.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function tempPassword() {
  const out: string[] = []
  while (out.length < 12) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < ALPHABET.length * 4 && out.length < 12) out.push(ALPHABET[b % ALPHABET.length])
    }
  }
  return `${out.slice(0, 4).join('')}-${out.slice(4, 8).join('')}-${out.slice(8).join('')}`
}

async function must<T>(p: PromiseLike<{ data: T; error: unknown }>) {
  const { data, error } = await p
  if (error) {
    const code = (error as { code?: string }).code
    if (code === '23514' || code === '22P02') throw new Fail(400, 'invalid_input', 'Some values are not valid.')
    throw error
  }
  return data
}

async function isPlatformAdmin(userId: string) {
  const rows = await must(admin.from('platform_admins').select('user_id').eq('user_id', userId))
  return rows.length > 0
}

async function memberRole(orgId: string, userId: string) {
  const rows = await must(admin.from('memberships').select('role, active, organizations(status)').eq('org_id', orgId).eq('user_id', userId))
  const m = rows[0] as { role: string; active: boolean; organizations: { status: string } | null } | undefined
  return m && m.active && m.organizations?.status === 'active' ? m.role : null
}

async function createAccount(address: string, fullName: string) {
  const password = tempPassword()
  const { data, error } = await admin.auth.admin.createUser({ email: address, password, email_confirm: true, user_metadata: { full_name: fullName } })
  if (error) {
    if (error.code === 'email_exists' || error.status === 422) throw new Fail(409, 'email_exists', 'This email already has an account.')
    throw error
  }
  await must(admin.from('profiles').update({ must_change_password: true }).eq('id', data.user.id))
  return { userId: data.user.id, password }
}

type Body = Record<string, unknown>

async function createFirm(callerId: string, body: Body) {
  if (!(await isPlatformAdmin(callerId))) throw new Fail(403, 'forbidden', 'Only Thekka admins can create firms.')
  const firmName = text(body.firm_name, 'firm name', 2, 120)
  const ownerName = text(body.owner_name, 'owner name', 1, 120)
  const ownerEmail = email(body.owner_email)

  const { userId, password } = await createAccount(ownerEmail, ownerName)
  let orgId: string | undefined
  try {
    orgId = (await must(admin.from('organizations').insert({ name: firmName }).select('id').single())).id
    await must(admin.from('memberships').insert({ org_id: orgId, user_id: userId, role: 'owner' }))
    return { org_id: orgId, email: ownerEmail, password }
  } catch (e) {
    // Undo, so a retry with the same email works.
    if (orgId) await admin.from('organizations').delete().eq('id', orgId)
    await admin.auth.admin.deleteUser(userId)
    throw e
  }
}

async function setFirmStatus(callerId: string, body: Body) {
  if (!(await isPlatformAdmin(callerId))) throw new Fail(403, 'forbidden', 'Only Thekka admins can change a firm.')
  if (body.status !== 'active' && body.status !== 'suspended') throw new Fail(400, 'invalid_input', 'Unknown status.')
  const rows = await must(admin.from('organizations').update({ status: body.status }).eq('id', String(body.org_id)).select('id'))
  if (!rows.length) throw new Fail(404, 'not_found', 'Firm not found.')
  return { ok: true }
}

async function createStaff(callerId: string, body: Body) {
  const orgId = String(body.org_id)
  const callerRole = await memberRole(orgId, callerId)
  if (callerRole !== 'owner' && callerRole !== 'admin') throw new Fail(403, 'forbidden', 'Only the firm owner or an admin can add staff.')
  const role = body.role === 'admin' ? 'admin' : 'site_staff'
  if (role === 'admin' && callerRole !== 'owner') throw new Fail(403, 'forbidden', 'Only the firm owner can add admins.')
  const fullName = text(body.full_name, 'name', 1, 120)
  const address = email(body.email)
  const permissions = Array.isArray(body.permissions) ? body.permissions.map(String) : []

  const { userId, password } = await createAccount(address, fullName)
  try {
    await must(admin.from('memberships').insert({ org_id: orgId, user_id: userId, role }))
    if (body.project_id) {
      await must(admin.from('project_members').insert({ project_id: String(body.project_id), org_id: orgId, user_id: userId, permissions }))
    }
    return { user_id: userId, email: address, password }
  } catch (e) {
    await admin.auth.admin.deleteUser(userId)
    throw e
  }
}

async function resetPassword(callerId: string, body: Body) {
  const targetId = String(body.user_id)
  if (targetId === callerId) throw new Fail(400, 'invalid_input', 'Change your own password from My profile.')

  if (!(await isPlatformAdmin(callerId))) {
    const orgId = String(body.org_id)
    const callerRole = await memberRole(orgId, callerId)
    const rows = await must(admin.from('memberships').select('role').eq('org_id', orgId).eq('user_id', targetId))
    const targetRole = rows[0]?.role
    const allowed =
      (callerRole === 'owner' && (targetRole === 'admin' || targetRole === 'site_staff')) ||
      (callerRole === 'admin' && targetRole === 'site_staff')
    if (!allowed) throw new Fail(403, 'forbidden', 'You cannot reset this person’s password.')
  }

  const password = tempPassword()
  const { data, error } = await admin.auth.admin.updateUserById(targetId, { password })
  if (error) throw error
  await must(admin.from('profiles').update({ must_change_password: true }).eq('id', targetId))
  return { email: data.user.email, password }
}

const actions: Record<string, (callerId: string, body: Body) => Promise<unknown>> = {
  create_firm: createFirm,
  set_firm_status: setFirmStatus,
  create_staff: createStaff,
  reset_password: resetPassword,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (req.method !== 'POST') throw new Fail(405, 'invalid_input', 'Use POST.')
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    const { data } = token ? await admin.auth.getUser(token) : { data: { user: null } }
    if (!data.user) throw new Fail(401, 'not_signed_in', 'Log in again.')

    const body = (await req.json().catch(() => ({}))) as Body
    const action = actions[String(body.action)]
    if (!action) throw new Fail(400, 'invalid_input', 'Unknown action.')
    return reply(200, await action(data.user.id, body))
  } catch (e) {
    if (e instanceof Fail) return reply(e.status, { code: e.code, message: e.message })
    console.error(e)
    return reply(500, { code: 'server_error', message: 'Something went wrong.' })
  }
})
