// Tiny IndexedDB wrapper for the two things the app keeps on the phone:
//   cache   last loaded lists, per signed-in person (offlineCache.ts)
//   outbox  records added without signal, with their photos (outbox.ts)
const NAME = 'thekka'
const VERSION = 1

let db: Promise<IDBDatabase> | undefined

function open() {
  return (db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('cache')
      req.result.createObjectStore('outbox', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }))
}

type Store = 'cache' | 'outbox'

function run<T>(store: Store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest) {
  return open().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(d.transaction(store, mode).objectStore(store))
        req.onsuccess = () => resolve(req.result as T)
        req.onerror = () => reject(req.error)
      }),
  )
}

export const idb = {
  get: <T>(store: Store, key: string) => run<T | undefined>(store, 'readonly', (s) => s.get(key)),
  all: <T>(store: Store) => run<T[]>(store, 'readonly', (s) => s.getAll()),
  put: (store: Store, value: unknown, key?: string) => run<void>(store, 'readwrite', (s) => s.put(value, key)),
  del: (store: Store, key: string) => run<void>(store, 'readwrite', (s) => s.delete(key)),
  clear: (store: Store) => run<void>(store, 'readwrite', (s) => s.clear()),
}
