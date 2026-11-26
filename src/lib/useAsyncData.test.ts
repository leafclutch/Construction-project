import { describe, expect, it } from 'vitest'
import { updateOne } from './useAsyncData'

describe('updateOne', () => {
  it('passes when a row was updated', async () => {
    await expect(updateOne(Promise.resolve({ data: [{ id: '1' }], error: null }))).resolves.toBeUndefined()
  })

  it('treats zero updated rows (hidden by RLS) as not allowed', async () => {
    await expect(updateOne(Promise.resolve({ data: [], error: null }))).rejects.toEqual({ code: '42501' })
  })

  it('rethrows database errors', async () => {
    const error = { code: '23505' }
    await expect(updateOne(Promise.resolve({ data: null, error }))).rejects.toBe(error)
  })
})
