import { describe, expect, it } from 'vitest'
import { compressImage, fitWithin } from './compressImage'

describe('compressImage', () => {
  it('fits the longer side within the limit and keeps the shape', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 })
    expect(fitWithin(1200, 800, 1600)).toEqual({ width: 1200, height: 800 })
  })

  it('leaves PDFs and small images alone', async () => {
    const pdf = new File([new Uint8Array(500_000)], 'bill.pdf', { type: 'application/pdf' })
    const small = new File([new Uint8Array(1000)], 'a.jpg', { type: 'image/jpeg' })
    expect(await compressImage(pdf)).toBe(pdf)
    expect(await compressImage(small)).toBe(small)
  })
})
