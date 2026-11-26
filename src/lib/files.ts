import { supabase } from './supabase'
import { unwrap } from './useAsyncData'

export type Bucket = 'drawings' | 'receipts'

/** Uploads to "<org>/<project>/<uuid>-<name>" (the path storage RLS checks) and returns the path. */
export async function uploadFile(bucket: Bucket, orgId: string, projectId: string, file: File): Promise<string> {
  const safeName = file.name.normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(-80) || 'file'
  const path = `${orgId}/${projectId}/${crypto.randomUUID()}-${safeName}`
  await unwrap(supabase.storage.from(bucket).upload(path, file, { contentType: file.type || undefined }))
  return path
}

export async function removeFile(bucket: Bucket, path: string | null) {
  if (path) await unwrap(supabase.storage.from(bucket).remove([path]))
}

/** Opens a private file in a new tab through a short-lived signed URL. */
export async function openFile(bucket: Bucket, path: string) {
  // Open the tab synchronously so pop-up blockers allow it, then point it at the file.
  const tab = window.open('', '_blank')
  try {
    const { signedUrl } = await unwrap(supabase.storage.from(bucket).createSignedUrl(path, 300))
    if (tab) tab.location.href = signedUrl
    else window.location.href = signedUrl
  } catch (e) {
    tab?.close()
    throw e
  }
}

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024
export const MAX_DRAWING_BYTES = 50 * 1024 * 1024
