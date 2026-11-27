import { RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { APP_NAME } from '../lib/brand'

/** Registers the service worker and offers new versions instead of swapping code mid-entry. */
export function AppUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Phones keep the app open for days: look for a new version every hour.
    onRegisteredSW: (_url, registration) => registration && setInterval(() => void registration.update(), 60 * 60 * 1000),
  })
  if (!needRefresh) return null
  return (
    <div role="status" className="no-print fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 lg:bottom-6">
      <div className="flex w-full max-w-md items-center gap-3 rounded-lg bg-ink px-4 py-3 text-sm text-ink-text shadow-lg dark:border dark:border-line">
        <RefreshCw className="size-4 shrink-0 text-hivis" aria-hidden />
        <span className="min-w-0 flex-1 font-medium">A new version of {APP_NAME} is ready.</span>
        <button type="button" onClick={() => setNeedRefresh(false)} className="min-h-11 px-2 font-medium text-ink-muted hover:text-ink-text">
          Later
        </button>
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="min-h-11 rounded-md bg-hivis px-4 font-semibold text-hivis-ink hover:bg-hivis/90"
        >
          Reload
        </button>
      </div>
    </div>
  )
}
