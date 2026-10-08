import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert } from '@/components/FormAlert'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { getErrorMessage } from '@/libs/ApiClient'
import type { Device, UpdateDeviceRequest } from '@/types/Device'
import { devicesQueryKey, updateDevice } from './DevicesApi'

/** Column sizes in migrations/up/003_ma_devices.sql (VARCHAR counts characters). */
const DEVICE_LIMITS = { name: 255, note: 500 } as const

type DeviceEditSheetProps = {
  uid: number
  /** null = closed. */
  device: Device | null
  onClose: () => void
}

export function DeviceEditSheet({ uid, device, onClose }: DeviceEditSheetProps) {
  return (
    <Sheet open={device !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]">
        {device && <DeviceForm key={device.device_id} uid={uid} device={device} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  )
}

type FieldErrors = Partial<Record<'name' | 'note', string>>

function charCount(value: string) {
  return Array.from(value).length
}

function DeviceForm({ uid, device, onClose }: { uid: number; device: Device; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const save = useMutation({
    mutationFn: (req: UpdateDeviceRequest) => updateDevice(req),
    meta: { silentError: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: devicesQueryKey })
      toast.success(t('devices.edit.saved'))
      onClose()
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const errors: FieldErrors = {}

    // The server ignores an empty name, so it can't be cleared.
    const name = String(form.get('name') ?? '').trim()
    if (!name) errors.name = t('devices.edit.errors.required')
    else if (charCount(name) > DEVICE_LIMITS.name) errors.name = t('devices.edit.errors.tooLong', { max: DEVICE_LIMITS.name })

    const note = String(form.get('note') ?? '').trim()
    if (charCount(note) > DEVICE_LIMITS.note) errors.note = t('devices.edit.errors.tooLong', { max: DEVICE_LIMITS.note })

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    // Send only what changed; an emptied note goes as "" to clear it.
    const req: UpdateDeviceRequest = {
      uid,
      device_id: device.device_id,
      device_name: name !== device.device_name ? name : undefined,
      note: note !== (device.note ?? '') ? note : undefined,
    }
    if (req.device_name === undefined && req.note === undefined) {
      onClose() // nothing changed
      return
    }
    save.mutate(req)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="border-b px-6 py-5">
        <SheetTitle className="text-xl font-bold">{t('devices.edit.title')}</SheetTitle>
        <SheetDescription className="sr-only">{t('devices.description')}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        <div className="flex flex-col gap-1 rounded-xl border border-secondary bg-muted/40 p-4">
          <strong className="truncate font-semibold">{device.device_name || t('devices.unnamed')}</strong>
          <span className="font-mono text-[13px] break-all text-muted-foreground">
            ID {device.device_id} · {device.device_uuid}
          </span>
        </div>

        {save.isError && <FormAlert>{getErrorMessage(save.error)}</FormAlert>}

        <div className="flex flex-col gap-4">
          <FormField id="name" label={t('devices.edit.name')} error={fieldErrors.name}>
            <Input
              id="name"
              name="name"
              autoFocus
              defaultValue={device.device_name}
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
              className="h-11 rounded-xl"
            />
          </FormField>

          <FormField id="note" label={t('devices.edit.note')} error={fieldErrors.note} hint={t('devices.edit.optional')}>
            <Textarea
              id="note"
              name="note"
              defaultValue={device.note ?? ''}
              rows={3}
              aria-invalid={!!fieldErrors.note}
              aria-describedby={fieldErrors.note ? 'note-error' : 'note-hint'}
              className="rounded-xl"
            />
          </FormField>
        </div>
      </div>

      <SheetFooter className="flex-row justify-end gap-3 border-t px-6 py-4">
        <Button type="button" variant="outline" className="h-11 rounded-xl px-4.5" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="h-11 rounded-xl px-4.5" disabled={save.isPending}>
          {save.isPending ? t('common.saving') : t('devices.edit.save')}
        </Button>
      </SheetFooter>
    </form>
  )
}
