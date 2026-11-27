import { FileText, Ruler, Truck, UsersRound, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { addBill } from '../modules/bills/api'
import { BillForm } from '../modules/bills/BillsPage'
import { addLabour } from '../modules/labour/api'
import { LabourForm } from '../modules/labour/LabourPage'
import { addMaterial } from '../modules/materials/api'
import { MaterialForm } from '../modules/materials/MaterialsPage'
import { addBbs } from '../modules/steel/api'
import { SteelForm } from '../modules/steel/SteelPage'
import { savedText } from '../lib/outbox'
import type { Project } from '../projects/api'
import { Modal } from './Modal'
import { useToast } from './toast'

export type QuickKind = 'labour' | 'materials' | 'bills' | 'steel'

const META: Record<QuickKind, { label: string; title: string; icon: LucideIcon }> = {
  labour: { label: 'Labour', title: 'Add labour', icon: UsersRound },
  materials: { label: 'Material', title: 'Add delivery', icon: Truck },
  bills: { label: 'VAT bill', title: 'Add VAT bill', icon: FileText },
  steel: { label: 'Steel', title: 'Add steel row', icon: Ruler },
}

/** The + button's sheet: pick what to record, then the same form the record page uses. Works offline. */
export default function QuickAdd({ project, kinds, start, onClose }: { project: Project; kinds: QuickKind[]; start: QuickKind | 'menu'; onClose: () => void }) {
  const [step, setStep] = useState(start)
  const toast = useToast()

  function saved(queued: boolean, message: string) {
    navigator.vibrate?.(15)
    toast(savedText(queued, message))
    window.dispatchEvent(new Event('app:refresh'))
  }

  const { org_id: orgId, id: projectId } = project
  return (
    <Modal open title={step === 'menu' ? `Add to ${project.name}` : META[step].title} onClose={onClose}>
      {step === 'menu' ? (
        <div className="grid grid-cols-2 gap-3">
          {kinds.map((k) => {
            const { label, icon: Icon } = META[k]
            return (
              <button
                key={k}
                type="button"
                onClick={() => setStep(k)}
                className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-line bg-surface-2 text-sm font-semibold transition-transform hover:border-focus active:scale-[0.97]"
              >
                <Icon className="size-7" aria-hidden />
                {label}
              </button>
            )
          })}
        </div>
      ) : step === 'labour' ? (
        <LabourForm onSave={async (input) => saved((await addLabour(orgId, projectId, input)).queued, 'Labour added')} onDone={onClose} />
      ) : step === 'materials' ? (
        <MaterialForm
          onSave={async (input, file) => {
            saved((await addMaterial(orgId, projectId, input, file)).queued, 'Delivery added')
            onClose()
          }}
        />
      ) : step === 'bills' ? (
        <BillForm
          onSave={async (input, file) => {
            saved((await addBill(orgId, projectId, input, file)).queued, 'Bill added')
            onClose()
          }}
        />
      ) : (
        <SteelForm
          onSave={async (input) => {
            saved((await addBbs(orgId, projectId, input)).queued, 'Steel row added')
            onClose()
          }}
        />
      )}
    </Modal>
  )
}
