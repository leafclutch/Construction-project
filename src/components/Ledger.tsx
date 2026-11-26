import type { ReactNode } from 'react'
import { cx } from './ui'

export type Column<T> = { header: string; cell: (row: T) => ReactNode; align?: 'right'; className?: string }

type Props<T> = {
  rows: T[]
  rowKey: (row: T) => string
  columns: Column<T>[]
  /** Phone layout: left block (what/when) and right block (amount). */
  mobile: (row: T) => { main: ReactNode; side: ReactNode }
  actions?: (row: T) => ReactNode
  footer?: { label: string; cells: Record<number, ReactNode> }
}

/** Measurement-book style ledger: a table from md up, stacked rows on phones. Prints as the table. */
export function Ledger<T>({ rows, rowKey, columns, mobile, actions, footer }: Props<T>) {
  return (
    <>
      <ul className="md:hidden print:hidden">
        {rows.map((r) => {
          const m = mobile(r)
          return (
            <li key={rowKey(r)} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-3 pl-4 pr-1 last:border-0">
              {/* The amount drops under the text when the row is too narrow for both. */}
              <div className="min-w-44 flex-1 text-sm">{m.main}</div>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                <div className="num text-right text-sm font-semibold">{m.side}</div>
                {actions?.(r)}
              </div>
            </li>
          )
        })}
        {footer && (
          <li className="flex items-center justify-between gap-3 bg-surface-2 px-4 py-3 text-sm font-semibold">
            <span>{footer.label}</span>
            <span className="num">{Object.values(footer.cells).at(-1)}</span>
          </li>
        )}
      </ul>

      <div className="hidden overflow-x-auto md:block print:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              {columns.map((c) => (
                <th key={c.header} scope="col" className={cx('px-4 py-3 font-medium', c.align === 'right' && 'whitespace-nowrap text-right', c.className)}>
                  {c.header}
                </th>
              ))}
              {actions && (
                <th className="w-14 print:hidden">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                {columns.map((c) => (
                  <td key={c.header} className={cx('px-4 py-3 align-middle', c.align === 'right' && 'num whitespace-nowrap text-right', c.className)}>
                    {c.cell(r)}
                  </td>
                ))}
                {actions && <td className="pr-2 print:hidden">{actions(r)}</td>}
              </tr>
            ))}
          </tbody>
          {footer && (
            <tfoot>
              <tr className="border-t-2 border-line bg-surface-2 font-semibold">
                {columns.map((c, i) => (
                  <td key={c.header} className={cx('whitespace-nowrap px-4 py-3', c.align === 'right' && 'num text-right', c.className)}>
                    {i === 0 ? footer.label : footer.cells[i]}
                  </td>
                ))}
                {actions && <td className="print:hidden" />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  )
}
