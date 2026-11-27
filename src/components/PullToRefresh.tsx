import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { sync } from '../lib/outbox'
import { cx } from './ui'

const TRIGGER = 70

/**
 * Pull down at the top of a page to reload its lists (the `app:refresh` event) and upload
 * waiting entries. Only a small spinner moves; the page itself never shifts.
 */
export function PullToRefresh() {
  const [pull, setPull] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let startY: number | null = null
    let distance = 0
    const start = (e: TouchEvent) => {
      const inOverlay = (e.target as Element | null)?.closest('dialog, [popover]')
      startY = window.scrollY <= 0 && !inOverlay ? e.touches[0].clientY : null
      distance = 0
    }
    const move = (e: TouchEvent) => {
      if (startY === null) return
      distance = Math.max(0, e.touches[0].clientY - startY)
      setPull(Math.min(distance, 140))
    }
    const end = () => {
      if (startY !== null && distance > TRIGGER) {
        setBusy(true)
        window.dispatchEvent(new Event('app:refresh'))
        void sync()
        setTimeout(() => setBusy(false), 900)
      }
      startY = null
      setPull(0)
    }
    window.addEventListener('touchstart', start, { passive: true })
    window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('touchend', end)
    return () => {
      window.removeEventListener('touchstart', start)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', end)
    }
  }, [])

  if (!pull && !busy) return null
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center lg:hidden"
      style={{ transform: `translateY(${busy ? 20 : pull * 0.35}px)`, opacity: busy ? 1 : Math.min(1, pull / TRIGGER) }}
    >
      <span className="grid size-10 place-items-center rounded-full border border-line bg-surface shadow-md">
        <RefreshCw className={cx('size-4', busy && 'animate-spin', pull > TRIGGER && 'text-ledger')} style={busy ? undefined : { transform: `rotate(${pull * 3}deg)` }} />
      </span>
    </div>
  )
}
