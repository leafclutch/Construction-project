import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { BrandMark } from '../components/BrandMark'
import { APP_NAME } from '../lib/brand'

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="px-5 py-5 sm:px-8">
        <Link to="/" className="inline-flex items-center gap-2.5 rounded-md">
          <BrandMark className="size-9" />
          <span className="text-lg font-bold tracking-tight" style={{ fontVariationSettings: "'wdth' 85" }}>
            {APP_NAME}
          </span>
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight" style={{ fontVariationSettings: "'wdth' 85" }}>
            {title}
          </h1>
          {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
