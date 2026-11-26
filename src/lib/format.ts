// en-IN gives the lakh/crore grouping used in Nepal: 1,79,42,326.00
const npr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 })
const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** "Rs. 1,79,42,326.00". Accepts the numeric strings Postgres returns. */
export function formatNPR(value: number | string | null | undefined): string {
  return `Rs. ${npr.format(Number(value ?? 0))}`
}

/** Short form for tight spaces: "Rs. 1.79 Cr", "Rs. 95.67 L", "Rs. 9,400". */
export function formatNPRShort(value: number | string | null | undefined): string {
  const n = Number(value ?? 0)
  const abs = Math.abs(n)
  if (abs >= 1e7) return `Rs. ${trim(n / 1e7)} Cr`
  if (abs >= 1e5) return `Rs. ${trim(n / 1e5)} L`
  return `Rs. ${num.format(Math.round(n))}`
}

function trim(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, '')
}

export function formatNumber(value: number | string | null | undefined): string {
  return num.format(Number(value ?? 0))
}

/** "26 Nov 2026" from a "2026-11-26" date or ISO timestamp, without timezone drift. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return date.format(new Date(y, m - 1, d))
}

/** Today's date as "YYYY-MM-DD" in local time (for <input type="date">). */
export function todayISO(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Mirrors the DB's generated columns so forms can preview before saving. */
export const calc = {
  wage: (workers: number, rate: number) => round2(workers * rate),
  vat: (taxable: number, included: boolean) => (included ? round2(taxable * 0.13) : 0),
  boqAmount: (qty: number, rate: number) => round2(qty * rate),
  steelUnitWeight: (diaMm: number) => Math.round(((diaMm * diaMm) / 162) * 1000) / 1000,
  steelWeight: (diaMm: number, bars: number, lengthM: number) => round2((bars * lengthM * diaMm * diaMm) / 162),
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
