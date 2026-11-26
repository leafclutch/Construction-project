import { useState, type FormEvent } from 'react'
import { Button, Field, FormError, Input, Select } from '../components/ui'
import type { Project, ProjectInput } from './api'

export const statusLabel: Record<Project['status'], string> = { running: 'Running', on_hold: 'On hold', completed: 'Completed' }

export function ProjectForm({ initial, submitLabel, onSubmit }: { initial?: Project; submitLabel: string; onSubmit: (input: ProjectInput) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const text = (k: string) => String(f.get(k) ?? '').trim() || null
    setBusy(true)
    setError(null)
    try {
      await onSubmit({
        name: text('name')!,
        code: text('code'),
        location: text('location'),
        client_name: text('client_name'),
        contract_amount: Number(f.get('contract_amount') || 0),
        status: f.get('status') as Project['status'],
        start_date: text('start_date'),
      })
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Project name" className="sm:col-span-2">
        {(id) => <Input id={id} name="name" defaultValue={initial?.name} required minLength={2} maxLength={200} placeholder="Area Police Office, Duhabi" />}
      </Field>
      <Field label="Contract ID" hint="Optional">
        {(id) => <Input id={id} name="code" defaultValue={initial?.code ?? ''} maxLength={120} />}
      </Field>
      <Field label="Location" hint="Optional">
        {(id) => <Input id={id} name="location" defaultValue={initial?.location ?? ''} maxLength={200} placeholder="Dhanusha" />}
      </Field>
      <Field label="Client" hint="Optional">
        {(id) => <Input id={id} name="client_name" defaultValue={initial?.client_name ?? ''} maxLength={200} />}
      </Field>
      <Field label="Contract amount (Rs.)">
        {(id) => (
          <Input id={id} name="contract_amount" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={initial?.contract_amount ?? ''} required />
        )}
      </Field>
      <Field label="Status">
        {(id) => (
          <Select id={id} name="status" defaultValue={initial?.status ?? 'running'}>
            {Object.entries(statusLabel).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Start date" hint="Optional">
        {(id) => <Input id={id} name="start_date" type="date" defaultValue={initial?.start_date ?? ''} />}
      </Field>
      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormError error={error} />
        <Button type="submit" busy={busy} className="sm:self-end">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
