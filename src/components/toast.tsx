import { CheckCircle2, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { cx } from './ui'

type Toast = { id: number; message: string; tone: 'success' | 'error' }
const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cx(
              'pointer-events-auto flex max-w-md items-center gap-2 rounded-md bg-ink px-4 py-3 text-sm font-medium text-ink-text shadow-lg',
              'dark:border dark:border-line',
            )}
          >
            {t.tone === 'success' ? (
              <CheckCircle2 className="size-4 shrink-0 text-hivis" aria-hidden />
            ) : (
              <XCircle className="size-4 shrink-0 text-signal" aria-hidden />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext)
