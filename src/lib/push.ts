// Phone notifications for owners/admins (sent by the `push` Edge Function when staff add records).
import { supabase } from './supabase'
import { unwrap } from './useAsyncData'

const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && Boolean(publicKey)

function keyBytes(base64url: string) {
  const raw = atob(base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** This phone's subscription, if notifications are on here. */
export async function currentSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

export async function enablePush() {
  if ((await Notification.requestPermission()) !== 'granted') throw { code: 'push_denied' }
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) throw { code: 'push_unavailable' }
  let sub = await reg.pushManager.getSubscription()
  try {
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey!) })
  } catch {
    // The browser's push service is off or unreachable (e.g. Brave by default).
    throw { code: 'push_service' }
  }
  const { keys } = sub.toJSON()
  await unwrap(supabase.rpc('save_push_subscription', { p_endpoint: sub.endpoint, p_p256dh: keys!.p256dh!, p_auth: keys!.auth! }))
}

/** Also runs on log out, so the next person on a shared phone never gets these. */
export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
