/// <reference lib="webworker" />
// Service worker: keeps the app itself (HTML, JS, CSS, fonts, icons) on the phone so it opens
// without signal, and shows push notifications. Data from Supabase is NOT cached here; the app
// keeps its own copy per signed-in person (src/lib/offlineCache.ts) and clears it on log out.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] }

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
// Every page of the single-page app is index.html.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

// The app asks for this after the person taps "Reload" on the update banner.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

type PushData = { title?: string; body?: string; url?: string; tag?: string }

self.addEventListener('push', (event) => {
  const data: PushData = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Thekka', {
      body: data.body,
      icon: '/pwa-192.png',
      tag: data.tag,
      data: { url: data.url ?? '/' },
    }),
  )
})

// Opens the record's page: reuse an open app window if there is one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url ?? '/', self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (open) {
        await open.focus()
        await open.navigate(url).catch(() => undefined)
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})
