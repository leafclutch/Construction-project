// Records added on site without signal. Each one gets its own id up front, so sending it
// twice (lost reply, app closed mid-upload) can never create two rows: the retry hits the
// primary key (23505) and counts as done. Photos are kept as Blobs and uploaded first, to a
// path made from that id, so a repeated upload is also harmless.
import { getErrorMessage, isNetworkError } from './errors'
import type { Bucket } from './files'
import { idb } from './idb'
import { supabase } from './supabase'

export type RecordTable = 'labour_entries' | 'material_entries' | 'vat_bills' | 'bbs_items'

type StoredFile = { bucket: Bucket; column: string; blob: Blob; name: string; type: string }

export type OutboxItem = {
  id: string
  userId: string
  table: RecordTable
  orgId: string
  projectId: string
  row: Record<string, unknown>
  file?: StoredFile
  /** One line for the "waiting to upload" list, e.g. "6 × Helper (Labour)". */
  summary: string
  createdAt: number
  /** Set when the server refused it (not a network problem). It then waits for Retry or Discard. */
  error?: string
}

let userId: string | null = null
let syncing = false
const listeners = new Set<() => void>()

/** Re-render hooks (useOutbox) and lists after any change. */
function changed(uploaded = false) {
  listeners.forEach((fn) => fn())
  if (uploaded) window.dispatchEvent(new Event('app:refresh'))
}

export function onOutboxChange(fn: () => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

export const isSyncing = () => syncing

/** Called by AuthProvider: only the signed-in person's entries are shown and sent. */
export function setOutboxUser(id: string | null) {
  userId = id
  changed()
  if (id) void sync()
}

export async function listOutbox(): Promise<OutboxItem[]> {
  if (!userId) return []
  const all = await idb.all<OutboxItem>('outbox').catch(() => [])
  return all.filter((i) => i.userId === userId).sort((a, b) => a.createdAt - b.createdAt)
}

export function filePath(item: Pick<OutboxItem, 'id' | 'orgId' | 'projectId'> & { file: Pick<StoredFile, 'name'> }) {
  const safeName = item.file.name.normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(-80) || 'file'
  return `${item.orgId}/${item.projectId}/${item.id}-${safeName}`
}

const alreadyExists = (e: { message?: string; statusCode?: string | number } | null) =>
  Boolean(e) && (String(e?.statusCode) === '409' || /already exists|duplicate/i.test(e?.message ?? ''))

/** Sends one entry: photo first (path from the id), then the row. Safe to repeat. */
export async function send(item: OutboxItem) {
  const row: Record<string, unknown> = { ...item.row, id: item.id, org_id: item.orgId, project_id: item.projectId }
  let uploadedNow: { bucket: Bucket; path: string } | null = null
  if (item.file) {
    const path = filePath({ ...item, file: item.file })
    const { error } = await supabase.storage.from(item.file.bucket).upload(path, item.file.blob, { contentType: item.file.type || undefined })
    if (error && !alreadyExists(error as never)) throw error
    if (!error) uploadedNow = { bucket: item.file.bucket, path }
    row[item.file.column] = path
  }
  const { error } = await supabase.from(item.table).insert(row as never)
  if (!error) return
  if (error.code === '23505') {
    // Ours already went through, or another row clashes (e.g. the same bill number twice).
    const { data } = await supabase.from(item.table).select('id').eq('id', item.id).maybeSingle()
    if (data) return
  }
  if (uploadedNow && !isNetworkError(error)) await supabase.storage.from(uploadedNow.bucket).remove([uploadedNow.path])
  throw error
}

/** Toast text after a save: the normal message, or that it waits on the phone. */
export const savedText = (queued: boolean, done: string) => (queued ? 'Saved on this phone · uploads when online' : done)

type SaveInput = {
  table: RecordTable
  orgId: string
  projectId: string
  row: Record<string, unknown>
  summary: string
  file?: { bucket: Bucket; column: string; file: File | Blob | null; name?: string }
}

/**
 * Saves a new record: straight to the server when there is signal, otherwise (or if the
 * connection drops on the way) onto the phone to upload later. Server refusals still throw.
 */
export async function saveRecord({ table, orgId, projectId, row, summary, file }: SaveInput): Promise<{ queued: boolean }> {
  if (!userId) throw { code: 'not_signed_in' }
  const blob = file?.file
  const item: OutboxItem = {
    id: crypto.randomUUID(),
    userId,
    table,
    orgId,
    projectId,
    row,
    summary,
    createdAt: Date.now(),
    file: file && blob ? { bucket: file.bucket, column: file.column, blob, name: file.name ?? (blob as File).name ?? 'photo.jpg', type: blob.type } : undefined,
  }
  if (navigator.onLine) {
    try {
      await send(item)
      return { queued: false }
    } catch (e) {
      if (!isNetworkError(e)) throw e
    }
  }
  await idb.put('outbox', item)
  changed()
  return { queued: true }
}

/** Uploads waiting entries in order. Stops at the first network failure; refusals are marked and skipped. */
export async function sync() {
  if (syncing || !userId || !navigator.onLine) return
  syncing = true
  changed()
  let uploaded = false
  try {
    for (const item of await listOutbox()) {
      if (item.error) continue
      try {
        await send(item)
        await idb.del('outbox', item.id)
        uploaded = true
      } catch (e) {
        if (isNetworkError(e)) break
        await idb.put('outbox', { ...item, error: getErrorMessage(e) })
      }
      changed()
    }
  } finally {
    syncing = false
    changed(uploaded)
  }
}

export async function retry(id: string) {
  const item = await idb.get<OutboxItem>('outbox', id)
  if (item) await idb.put('outbox', { ...item, error: undefined })
  await sync()
}

export async function discard(id: string) {
  await idb.del('outbox', id)
  changed()
}

/** Log out: the person confirmed losing what is still waiting. */
export async function clearOutbox() {
  for (const item of await listOutbox()) await idb.del('outbox', item.id)
  changed()
}
