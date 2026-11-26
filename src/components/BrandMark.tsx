/** Hard-hat on a hi-vis tile — carried over from the CEO's prototype. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="8" fill="var(--hivis)" />
      <path d="M9 27h22v3H9z" fill="var(--hivis-ink)" />
      <path d="M11 26a9 9 0 0 1 18 0z" fill="var(--hivis-ink)" />
      <path d="M18.5 15.2h3V20h-3z" fill="var(--hivis)" />
    </svg>
  )
}
