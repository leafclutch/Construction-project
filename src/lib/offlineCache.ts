import { idb } from './idb'

// Last loaded data, so the app opens with something on screen and keeps working without signal.
// Keys are per person; everything is wiped on log out (shared phones).
let user: string | null = null

export function setCacheUser(id: string | null) {
  user = id
}

export async function readCache<T>(key: string): Promise<T | undefined> {
  if (!user) return undefined
  return idb.get<T>('cache', `${user}:${key}`).catch(() => undefined)
}

export function writeCache(key: string, value: unknown) {
  if (user) void idb.put('cache', value, `${user}:${key}`).catch(() => undefined)
}

export const clearCache = () => idb.clear('cache').catch(() => undefined)
