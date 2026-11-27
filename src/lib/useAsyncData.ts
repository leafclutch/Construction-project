import { useCallback, useEffect, useState } from 'react'
import { readCache, writeCache } from './offlineCache'

type Loaded<T> = { depsKey: string; version: number; data?: T; error: unknown }

/**
 * Loads data with `load`, re-running when `deps` (ids, filters) change.
 * `reload` refetches while keeping the current data on screen, so a save
 * doesn't flash the skeleton. Data from other deps is never shown.
 *
 * With `cacheKey`, the last result is kept on the phone (per person): it shows at once on
 * the next visit while fresh data loads, and stays on screen when there is no signal.
 * Pull to refresh (the `app:refresh` event) reloads every list on screen.
 */
export function useAsyncData<T>(load: () => Promise<T>, deps: unknown[], cacheKey?: string) {
  const depsKey = JSON.stringify(deps)
  const [version, setVersion] = useState(0)
  const [state, setState] = useState<Loaded<T> | null>(null)
  const fullKey = cacheKey && `${cacheKey}:${depsKey}`

  useEffect(() => {
    let cancelled = false
    if (fullKey)
      void readCache<T>(fullKey).then((cached) => {
        // Only fills an empty screen; never replaces fresher data.
        if (!cancelled && cached !== undefined) setState((s) => (s?.depsKey === depsKey && s.data !== undefined ? s : { depsKey, version: -1, data: cached, error: null }))
      })
    load().then(
      (data) => {
        if (cancelled) return
        setState({ depsKey, version, data, error: null })
        if (fullKey) writeCache(fullKey, data)
      },
      (error) => !cancelled && setState((s) => ({ depsKey, version, data: s?.depsKey === depsKey ? s.data : undefined, error })),
    )
    return () => {
      cancelled = true
    }
    // `load` closes over the same values `deps` lists.
  }, [depsKey, version]) // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    window.addEventListener('app:refresh', reload)
    return () => window.removeEventListener('app:refresh', reload)
  }, [reload])
  const sameDeps = state?.depsKey === depsKey
  const current = sameDeps && state.version === version

  return {
    data: sameDeps ? state.data : undefined,
    error: current ? state.error : null,
    loading: !current,
    reload,
  }
}

/** Unwraps a Supabase `{ data, error }` result, throwing the error. */
export async function unwrap<R extends { data: unknown; error: unknown }>(promise: PromiseLike<R>): Promise<NonNullable<R['data']>> {
  const { data, error } = await promise
  if (error) throw error
  return data as NonNullable<R['data']>
}

/** For `.update(...).select('id')`: RLS skips rows silently, so zero rows updated means "not allowed". */
export async function updateOne<R extends { data: unknown[] | null; error: unknown }>(promise: PromiseLike<R>) {
  const rows = await unwrap(promise)
  if (rows.length === 0) throw { code: '42501' }
}
