import { useCallback, useEffect, useState } from 'react'

type Loaded<T> = { depsKey: string; version: number; data?: T; error: unknown }

/**
 * Loads data with `load`, re-running when `deps` (ids, filters) change.
 * `reload` refetches while keeping the current data on screen, so a save
 * doesn't flash the skeleton. Data from other deps is never shown.
 */
export function useAsyncData<T>(load: () => Promise<T>, deps: unknown[]) {
  const depsKey = JSON.stringify(deps)
  const [version, setVersion] = useState(0)
  const [state, setState] = useState<Loaded<T> | null>(null)

  useEffect(() => {
    let cancelled = false
    load().then(
      (data) => !cancelled && setState({ depsKey, version, data, error: null }),
      (error) => !cancelled && setState((s) => ({ depsKey, version, data: s?.depsKey === depsKey ? s.data : undefined, error })),
    )
    return () => {
      cancelled = true
    }
    // `load` closes over the same values `deps` lists.
  }, [depsKey, version]) // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(() => setVersion((v) => v + 1), [])
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
