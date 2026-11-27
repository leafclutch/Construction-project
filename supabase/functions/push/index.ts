// Sends a phone notification to a firm's owners and admins when site staff add a record.
// Called only by the database trigger private.notify_record() (pg_net), which sends the
// shared secret PUSH_SECRET. Runs with the service key.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default
const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const secret = Deno.env.get('PUSH_SECRET') ?? ''

webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@thekka.app', Deno.env.get('VAPID_PUBLIC_KEY') ?? '', Deno.env.get('VAPID_PRIVATE_KEY') ?? '')

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Constant-time compare so the secret can't be guessed byte by byte. */
function same(a: string, b: string) {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

const npr = (n: number) => `Rs. ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)}`

type Row = Record<string, unknown> & { org_id: string; project_id: string; created_by: string }

// What each table says, and which page it opens.
const MESSAGES: Record<string, { section: string; title: string; body: (r: Row) => string }> = {
  labour_entries: { section: 'labour', title: 'Labour added', body: (r) => `${r.worker_count} × ${r.category}` },
  material_entries: { section: 'materials', title: 'Material received', body: (r) => `${Number(r.quantity)} ${r.unit} ${r.material}` },
  vat_bills: { section: 'bills', title: 'VAT bill added', body: (r) => `${r.supplier_name} · ${npr(Number(r.gross_amount))}` },
  bbs_items: { section: 'steel', title: 'Steel added', body: (r) => `${r.bar_count} × ${r.bar_dia_mm} mm bars · ${r.member}` },
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' })
  if (!secret || !same(req.headers.get('x-push-secret') ?? '', secret)) return reply(401, { error: 'unauthorized' })

  const { table, id } = await req.json().catch(() => ({}))
  const message = MESSAGES[table as string]
  if (!message || typeof id !== 'string') return reply(400, { error: 'invalid_input' })

  const { data: row } = await admin.from(table).select('*').eq('id', id).maybeSingle<Row>()
  if (!row) return reply(200, { sent: 0 })

  const [{ data: project }, { data: author }, { data: managers }] = await Promise.all([
    admin.from('projects').select('name').eq('id', row.project_id).single(),
    admin.from('profiles').select('full_name, email').eq('id', row.created_by).single(),
    admin.from('memberships').select('user_id').eq('org_id', row.org_id).eq('active', true).in('role', ['owner', 'admin']),
  ])
  const userIds = (managers ?? []).map((m) => m.user_id)
  if (!userIds.length) return reply(200, { sent: 0 })
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', userIds)

  const payload = JSON.stringify({
    title: `${message.title} · ${project?.name ?? ''}`,
    body: `${author?.full_name || author?.email || 'Staff'}: ${message.body(row)}`,
    url: `/p/${row.project_id}/${message.section}`,
    tag: `${table}:${row.project_id}`,
  })

  let sent = 0
  const gone: string[] = []
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 })
        sent++
      } catch (e) {
        // 404/410: the browser dropped this subscription.
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) gone.push(s.id)
        else console.error('push failed', status)
      }
    }),
  )
  if (gone.length) await admin.from('push_subscriptions').delete().in('id', gone)
  return reply(200, { sent, removed: gone.length })
})
