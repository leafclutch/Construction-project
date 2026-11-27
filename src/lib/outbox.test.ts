import { beforeEach, describe, expect, it, vi } from 'vitest'

// In-memory stand-ins for IndexedDB and Supabase.
const store = new Map<string, Record<string, unknown>>()
vi.mock('./idb', () => ({
  idb: {
    all: async () => [...store.values()],
    get: async (_s: string, k: string) => store.get(k),
    put: async (_s: string, v: Record<string, unknown>) => void store.set(v.id as string, v),
    del: async (_s: string, k: string) => void store.delete(k),
  },
}))

const server = {
  insert: vi.fn<(row: Record<string, unknown>) => Promise<{ error: unknown }>>(),
  exists: vi.fn<() => Promise<{ data: unknown }>>(),
  upload: vi.fn<() => Promise<{ error: unknown }>>(),
}
vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      insert: (row: Record<string, unknown>) => server.insert(row),
      select: () => ({ eq: () => ({ maybeSingle: () => server.exists() }) }),
    }),
    storage: { from: () => ({ upload: () => server.upload(), remove: async () => ({}) }) },
  },
}))

const { saveRecord, setOutboxUser, sync, listOutbox } = await import('./outbox')

const offline = { message: 'TypeError: Failed to fetch' }
const input = { table: 'labour_entries' as const, orgId: 'org', projectId: 'p1', row: { worker_count: 6 }, summary: '6 × Helper' }

beforeEach(() => {
  store.clear()
  vi.resetAllMocks()
  vi.stubGlobal('navigator', { onLine: true })
  vi.stubGlobal('window', new EventTarget())
  server.upload.mockResolvedValue({ error: null })
  setOutboxUser('u1')
})

describe('outbox', () => {
  it('saves straight away with its own id when there is signal', async () => {
    server.insert.mockResolvedValue({ error: null })
    expect(await saveRecord(input)).toEqual({ queued: false })
    expect(server.insert).toHaveBeenCalledWith(expect.objectContaining({ worker_count: 6, org_id: 'org', project_id: 'p1', id: expect.any(String) }))
    expect(store.size).toBe(0)
  })

  it('keeps the entry on the phone when the connection drops, and refusals still throw', async () => {
    server.insert.mockResolvedValue({ error: offline })
    expect(await saveRecord(input)).toEqual({ queued: true })
    expect(await listOutbox()).toHaveLength(1)

    server.insert.mockResolvedValue({ error: { code: '42501' } })
    await expect(saveRecord(input)).rejects.toEqual({ code: '42501' })
    expect(store.size).toBe(1)
  })

  it('a retry that hits its own id (23505) counts as uploaded, never as a second row', async () => {
    server.insert.mockResolvedValueOnce({ error: offline })
    await saveRecord(input)
    server.insert.mockResolvedValue({ error: { code: '23505' } })
    server.exists.mockResolvedValue({ data: { id: 'x' } })
    await sync()
    expect(store.size).toBe(0)
  })

  it('a clash with another row (same bill number) is shown, not hidden', async () => {
    server.insert.mockResolvedValueOnce({ error: offline })
    await saveRecord(input)
    server.insert.mockResolvedValue({ error: { code: '23505' } })
    server.exists.mockResolvedValue({ data: null })
    await sync()
    expect((await listOutbox())[0].error).toBe('This entry already exists.')
  })

  it('stops at a network failure and keeps the rest in order; refusals are marked and skipped', async () => {
    server.insert.mockResolvedValue({ error: offline })
    await saveRecord({ ...input, summary: 'first' })
    await saveRecord({ ...input, summary: 'second' })

    await sync()
    expect((await listOutbox()).map((i) => [i.summary, i.error])).toEqual([
      ['first', undefined],
      ['second', undefined],
    ])

    server.insert.mockResolvedValueOnce({ error: { code: '42501' } }).mockResolvedValueOnce({ error: null })
    await sync()
    const left = await listOutbox()
    expect(left).toHaveLength(1)
    expect(left[0].summary).toBe('first')
    expect(left[0].error).toMatch(/permission/)
  })

  it('only shows and sends the signed-in person’s entries', async () => {
    server.insert.mockResolvedValue({ error: offline })
    await saveRecord(input)
    setOutboxUser('u2')
    expect(await listOutbox()).toEqual([])
  })
})
