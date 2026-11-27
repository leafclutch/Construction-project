import { Building2, Eye, FileImage, FileText, Upload } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Modal } from '../../components/Modal'
import { DeleteRowButton, FilePicker } from '../../components/records'
import { useToast } from '../../components/toast'
import { Button, EmptyState, ErrorState, Field, FormError, Input, PageHeader, Panel, Select, Skeleton, cx } from '../../components/ui'
import { MAX_DRAWING_BYTES, openFile, removeFile, uploadFile } from '../../lib/files'
import { formatDate } from '../../lib/format'
import { supabase, type Enums } from '../../lib/supabase'
import { unwrap, useAsyncData } from '../../lib/useAsyncData'
import { useProject } from '../../projects/ProjectLayout'

type Category = Enums<'drawing_category'>

const CATEGORIES: Record<Category, string> = { structural: 'Structural', architectural: 'Architectural', mep: 'MEP', as_built: 'As-built' }

const listDrawings = (projectId: string) =>
  unwrap(supabase.from('drawings').select('*').eq('project_id', projectId).order('created_at', { ascending: false }))

function fileSize(bytes: number) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function DrawingsPage() {
  const { project, can } = useProject()
  const { data, error, reload } = useAsyncData(() => listDrawings(project.id), [project.id])
  const [params, setParams] = useSearchParams()
  const category = (params.get('category') ?? '') as Category | ''
  const [uploading, setUploading] = useState(false)
  const toast = useToast()

  const rows = category ? data?.filter((d) => d.category === category) : data
  const count = (c: Category | '') => (c ? (data?.filter((d) => d.category === c).length ?? 0) : (data?.length ?? 0))

  return (
    <>
      <PageHeader
        title="Drawings"
        description="Structural, architectural, MEP and as-built drawings. Everyone on site sees the latest copy."
        actions={
          can('drawings.add') && (
            <Button onClick={() => setUploading(true)}>
              <Upload className="size-4" aria-hidden />
              Upload drawing
            </Button>
          )
        }
      />

      <div role="tablist" aria-label="Drawing type" className="no-print mb-5 flex gap-2 overflow-x-auto pb-1">
        {(['', ...Object.keys(CATEGORIES)] as (Category | '')[]).map((c) => (
          <button
            key={c || 'all'}
            role="tab"
            type="button"
            aria-selected={category === c}
            onClick={() => setParams(c ? { category: c } : {}, { replace: true })}
            className={cx(
              'min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold',
              category === c ? 'border-ink bg-ink text-ink-text dark:border-hivis dark:bg-hivis dark:text-hivis-ink' : 'border-line bg-surface text-muted hover:text-text',
            )}
          >
            {c ? CATEGORIES[c] : 'All'} <span className="num font-normal opacity-70">{data ? count(c) : ''}</span>
          </button>
        ))}
      </div>

      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !rows ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyState icon={<Building2 className="size-10" />} title={category ? `No ${CATEGORIES[category].toLowerCase()} drawings` : 'No drawings yet'}>
            {can('drawings.add') ? 'Upload PDF or image drawings so the site always works from the latest revision.' : 'The owner has not uploaded drawings yet.'}
          </EmptyState>
        </Panel>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((d) => (
            <li key={d.id} className="flex flex-col rounded-lg border border-line bg-surface">
              <div className="flex items-start gap-3 p-4">
                <div className="grid size-12 shrink-0 place-items-center rounded-md bg-surface-2 text-muted" aria-hidden>
                  {d.mime_type === 'application/pdf' ? <FileText className="size-6" /> : <FileImage className="size-6" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted">{CATEGORIES[d.category]}</p>
                  <p className="font-semibold leading-snug">{d.title}</p>
                  <p className="mt-1 truncate text-xs text-muted">
                    {formatDate(d.created_at)} · {fileSize(d.file_size)}
                  </p>
                </div>
              </div>
              <div className="mt-auto flex items-center gap-1 border-t border-line p-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => openFile('drawings', d.file_path).catch(() => toast('Could not open the drawing. Try again.', 'error'))}
                >
                  <Eye className="size-4" aria-hidden />
                  Open
                </Button>
                <DeleteRowButton
                  module="drawings"
                  what={d.title}
                  onDelete={async () => {
                    await unwrap(supabase.from('drawings').delete().eq('id', d.id))
                    await removeFile('drawings', d.file_path).catch(() => {})
                    reload()
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={uploading} title="Upload drawing" onClose={() => setUploading(false)}>
        <DrawingForm
          defaultCategory={category || 'structural'}
          onSave={async (title, cat, file) => {
            const path = await uploadFile('drawings', project.org_id, project.id, file)
            try {
              await unwrap(
                supabase.from('drawings').insert({
                  org_id: project.org_id,
                  project_id: project.id,
                  title,
                  category: cat,
                  file_path: path,
                  file_name: file.name,
                  file_size: file.size,
                  mime_type: file.type || 'application/octet-stream',
                }),
              )
            } catch (e) {
              await removeFile('drawings', path).catch(() => {})
              throw e
            }
            reload()
            setUploading(false)
            toast('Drawing uploaded')
          }}
        />
      </Modal>
    </>
  )
}

function DrawingForm({ defaultCategory, onSave }: { defaultCategory: Category; onSave: (title: string, category: Category, file: File) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const file = f.get('file') as File
    if (!file?.size) return setError({ code: 'no_file' })
    if (file.size > MAX_DRAWING_BYTES) return setError({ status: 413 })
    setBusy(true)
    setError(null)
    try {
      await onSave(String(f.get('title')).trim(), f.get('category') as Category, file)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Title">{(id) => <Input id={id} name="title" required maxLength={200} placeholder="Foundation & column details, Rev 2" />}</Field>
      <Field label="Type">
        {(id) => (
          <Select id={id} name="category" defaultValue={defaultCategory}>
            {Object.entries(CATEGORIES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="File" hint="PDF, PNG, JPG or WEBP up to 50 MB.">
        {(id) => <FilePicker id={id} name="file" accept="application/pdf,image/png,image/jpeg,image/webp" maxBytes={MAX_DRAWING_BYTES} label="Choose drawing file" />}
      </Field>
      <FormError error={error} messages={{ no_file: 'Choose a file to upload.' }} />
      <Button type="submit" busy={busy} className="self-end">
        Upload drawing
      </Button>
    </form>
  )
}
