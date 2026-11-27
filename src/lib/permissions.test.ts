import { describe, expect, it } from 'vitest'
import sql from '../../supabase/migrations/20261127000004_managed_saas.sql?raw'
import { ALL_PERMISSIONS, allowed, PRESETS, togglePermission } from './permissions'

describe('permissions', () => {
  it('matches the list the database accepts', () => {
    const block = sql.slice(sql.indexOf('check (permissions <@ array['), sql.indexOf(']::text[])'))
    const dbList = [...block.matchAll(/'([a-z]+\.[a-z]+)'/g)].map((m) => m[1])
    expect([...ALL_PERMISSIONS].sort()).toEqual(dbList.sort())
  })

  it('presets only use known permissions', () => {
    for (const p of PRESETS) for (const perm of p.permissions) expect(ALL_PERMISSIONS).toContain(perm)
  })

  it('add turns on view; view off turns the module off; other modules stay', () => {
    const on = togglePermission(['bills.view'], 'labour.add', true)
    expect(on).toEqual(['labour.view', 'labour.add', 'bills.view'])
    expect(togglePermission([...on, 'labour.delete'], 'labour.view', false)).toEqual(['bills.view'])
    expect(togglePermission(['labour.view', 'labour.add'], 'labour.add', false)).toEqual(['labour.view'])
    expect(togglePermission([], 'money.view', true)).toEqual(['money.view'])
  })

  it('admins do anything, support only looks, staff need the toggle', () => {
    expect(allowed({ admin: true, readOnly: false, permissions: [] }, 'boq.delete')).toBe(true)
    expect(allowed({ admin: false, readOnly: true, permissions: [] }, 'boq.view')).toBe(true)
    expect(allowed({ admin: false, readOnly: true, permissions: [] }, 'boq.add')).toBe(false)
    expect(allowed({ admin: false, readOnly: false, permissions: ['boq.view'] }, 'boq.view')).toBe(true)
    expect(allowed({ admin: false, readOnly: false, permissions: ['boq.view'] }, 'boq.add')).toBe(false)
  })
})
