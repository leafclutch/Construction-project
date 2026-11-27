// The push Edge Function only answers the database trigger, which sends PUSH_SECRET.
// Run: pnpm test:db   (needs PUSH_SECRET in .env.local, the same value set on the function)
import { describe, expect, it } from 'vitest'

const endpoint = `${process.env.VITE_SUPABASE_URL}/functions/v1/push`
const call = (secret: string, body: unknown) =>
  fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-push-secret': secret }, body: JSON.stringify(body) })

describe('push function', () => {
  it('refuses callers without the secret', async () => {
    expect((await call('wrong', { table: 'labour_entries', id: crypto.randomUUID() })).status).toBe(401)
    expect((await fetch(endpoint, { method: 'POST', body: '{}' })).status).toBe(401)
  })

  it('checks its input and does nothing for an unknown record', async () => {
    const secret = process.env.PUSH_SECRET!
    expect((await call(secret, { table: 'projects', id: crypto.randomUUID() })).status).toBe(400)
    const res = await call(secret, { table: 'labour_entries', id: crypto.randomUUID() })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: 0 })
  })
})
