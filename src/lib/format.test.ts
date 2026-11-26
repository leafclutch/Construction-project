import { describe, expect, it } from 'vitest'
import { calc, formatDate, formatNPR, formatNPRShort } from './format'

describe('format', () => {
  it('uses Nepali lakh/crore grouping', () => {
    expect(formatNPR(17942326)).toBe('Rs. 1,79,42,326.00')
    expect(formatNPR('9400')).toBe('Rs. 9,400.00')
    expect(formatNPR(null)).toBe('Rs. 0.00')
  })

  it('shortens to crore and lakh', () => {
    expect(formatNPRShort(17942326)).toBe('Rs. 1.79 Cr')
    expect(formatNPRShort(9567478)).toBe('Rs. 95.67 L')
    expect(formatNPRShort(9400)).toBe('Rs. 9,400')
  })

  it('formats DB dates without timezone drift', () => {
    expect(formatDate('2026-11-20')).toBe('20 Nov 2026')
    expect(formatDate('2026-11-20T23:59:00+05:45')).toBe('20 Nov 2026')
  })

  it('matches the DB math', () => {
    expect(calc.wage(4, 1150)).toBe(4600)
    expect(calc.vat(125000, true)).toBe(16250)
    expect(calc.vat(125000, false)).toBe(0)
    expect(calc.boqAmount(164.59, 11000)).toBe(1810490)
    expect(calc.steelUnitWeight(12)).toBe(0.889)
    expect(calc.steelWeight(12, 20, 1.7)).toBe(30.22)
  })
})
