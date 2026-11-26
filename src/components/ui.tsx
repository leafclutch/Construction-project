import { AlertTriangle, Loader2, RotateCw } from 'lucide-react'
import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { getErrorMessage } from '../lib/errors'

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  busy?: boolean
}

const variants = {
  primary: 'bg-ink text-ink-text hover:bg-ink/90 dark:bg-hivis dark:text-hivis-ink dark:hover:bg-hivis/90',
  secondary: 'bg-surface text-text border border-line hover:bg-surface-2',
  ghost: 'text-text hover:bg-surface-2',
  danger: 'bg-signal text-white hover:bg-signal/90',
}

export function Button({ variant = 'primary', busy, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
    >
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export const inputClass =
  'block min-h-11 rounded-md border border-line bg-surface px-3 text-base text-text placeholder:text-muted/70 ' +
  'focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/30 disabled:opacity-60 sm:text-sm'

type FieldProps = { label: string; hint?: ReactNode; className?: string; children: (id: string) => ReactNode }

/** Label + control + hint. `children` receives the id to put on the control. */
export function Field({ label, hint, className, children }: FieldProps) {
  const id = useId()
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}

/** Full width unless `className` sets a width (w-*). */
const width = (className?: string) => (/(^|\s)w-/.test(className ?? '') ? '' : 'w-full')

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(inputClass, width(className), className)} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(inputClass, width(className), 'pr-8', className)}>
      {children}
    </select>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('animate-pulse rounded-md bg-line/60', className)} />
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cx('flex flex-col items-start gap-3 rounded-lg border border-signal/30 bg-signal-soft p-4', className)}>
      <p className="flex items-center gap-2 text-sm font-medium text-signal">
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        {getErrorMessage(error)}
      </p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          <RotateCw className="size-4" aria-hidden />
          Try again
        </Button>
      )}
    </div>
  )
}

/** `messages` overrides the text for specific error codes, e.g. { '23505': 'Bill already recorded.' }. */
export function FormError({ error, messages }: { error: unknown; messages?: Record<string, string> }) {
  if (!error) return null
  const code = (error as { code?: string }).code
  return (
    <p role="alert" className="rounded-md bg-signal-soft px-3 py-2 text-sm text-signal">
      {(code && messages?.[code]) || getErrorMessage(error)}
    </p>
  )
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="mb-1 text-muted" aria-hidden>
        {icon}
      </div>
      <p className="font-semibold">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
    </div>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]" style={{ fontVariationSettings: "'wdth' 88" }}>
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

/** White panel that groups a form or a ledger. */
export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx('rounded-lg border border-line bg-surface', className)}>{children}</section>
}
