import { ACTION_LABEL, ACTIONS, MODULES, MONEY, PRESETS, togglePermission, type Permission } from '../lib/permissions'
import { cx } from './ui'

const same = (a: readonly Permission[], b: readonly Permission[]) => a.length === b.length && a.every((p) => b.includes(p))

/** Per-project toggles. Presets fill the grid; every box can still be changed. */
export function PermissionPicker({ value, onChange }: { value: Permission[]; onChange: (next: Permission[]) => void }) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium">What can they do on this project?</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            aria-pressed={same(value, p.permissions)}
            onClick={() => onChange(p.permissions.reduce<Permission[]>((acc, perm) => togglePermission(acc, perm, true), []))}
            className={cx(
              'min-h-11 rounded-full border px-3 text-sm font-medium',
              same(value, p.permissions) ? 'border-ink bg-ink text-ink-text dark:border-hivis dark:bg-hivis dark:text-hivis-ink' : 'border-line hover:bg-surface-2',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr>
            <th scope="col" className="pb-1 text-left text-xs font-medium text-muted">
              Record
            </th>
            {ACTIONS.map((a) => (
              <th key={a} scope="col" className="w-11 pb-1 text-center text-xs font-medium text-muted">
                {ACTION_LABEL[a]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULES.map((m) => (
            <tr key={m.key} className="border-t border-line">
              <th scope="row" className="pr-2 text-left font-medium">
                {m.label}
              </th>
              {ACTIONS.map((a) => {
                const perm = `${m.key}.${a}` as Permission
                return (
                  <td key={a} className="text-center">
                    {(m.actions as readonly string[]).includes(a) ? (
                      <label className="mx-auto grid size-11 cursor-pointer place-items-center">
                        <input
                          type="checkbox"
                          aria-label={`${m.label}: ${ACTION_LABEL[a]}`}
                          checked={value.includes(perm)}
                          onChange={(e) => onChange(togglePermission(value, perm, e.target.checked))}
                          className="size-5 accent-ink dark:accent-hivis"
                        />
                      </label>
                    ) : (
                      <span className="text-muted" aria-hidden>
                        —
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2">
        <input
          type="checkbox"
          checked={value.includes(MONEY)}
          onChange={(e) => onChange(togglePermission(value, MONEY, e.target.checked))}
          className="size-5 shrink-0 accent-ink dark:accent-hivis"
        />
        <span className="text-sm">
          <span className="font-medium">See money</span>
          <span className="block text-xs text-muted">Contract amount, billing and margin of this project</span>
        </span>
      </label>
    </fieldset>
  )
}
