import { useEffect, useState, useSyncExternalStore } from 'react'
import { isSyncing, listOutbox, onOutboxChange, sync, type OutboxItem } from './outbox'

/** Entries waiting on this phone, and whether an upload is running. */
export function useOutbox() {
  const [items, setItems] = useState<OutboxItem[]>([])
  const [syncing, setSyncing] = useState(isSyncing)
  useEffect(() => {
    let alive = true
    const load = () => {
      setSyncing(isSyncing())
      void listOutbox().then((list) => alive && setItems(list))
    }
    load()
    const off = onOutboxChange(load)
    return () => {
      alive = false
      off()
    }
  }, [])
  return { items, syncing }
}

/** Uploads waiting entries when signal comes back or the app is opened again. Mount once. */
export function useOutboxSync() {
  useEffect(() => {
    const run = () => void sync()
    const onVisible = () => document.visibilityState === 'visible' && run()
    window.addEventListener('online', run)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', run)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
}

const subscribe = (fn: () => void) => {
  window.addEventListener('online', fn)
  window.addEventListener('offline', fn)
  return () => {
    window.removeEventListener('online', fn)
    window.removeEventListener('offline', fn)
  }
}

/** True while the phone says it has a connection. */
export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine)

