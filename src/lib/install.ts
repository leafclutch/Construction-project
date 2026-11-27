import { useSyncExternalStore } from 'react'

// Android/desktop Chrome offer installing through this event; it fires once, early, so it is
// caught here (imported by main.tsx) and kept until the person taps Install.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((fn) => fn())

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as InstallEvent
  notify()
})
window.addEventListener('appinstalled', () => {
  deferred = null
  notify()
})

export const isInstalled = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
/** iPhone/iPad: no install event; people add it from the Share menu. */
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** What install help this phone can get: the native prompt, iPhone steps, or nothing. */
export function useInstall() {
  const event = useSyncExternalStore(subscribe, () => deferred)
  const installed = isInstalled()
  return {
    installed,
    canPrompt: !installed && Boolean(event),
    iosSteps: !installed && !event && isIos(),
    prompt: async () => {
      if (!deferred) return
      await deferred.prompt()
      await deferred.userChoice
      deferred = null
      notify()
    },
  }
}
