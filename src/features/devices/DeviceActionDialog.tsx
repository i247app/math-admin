import { useMutation, useQueryClient } from '@tanstack/react-query'
import { TriangleAlertIcon } from 'lucide-react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert } from '@/components/FormAlert'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getErrorMessage, isCurrentDeviceUuid } from '@/libs/ApiClient'
import type { Device } from '@/types/Device'
import { devicesQueryKey, forceDeleteDevice, revokeDevice, softDeleteDevice } from './DevicesApi'

export type DeviceConfirmKind = 'revoke' | 'softDelete' | 'forceDelete'

type DeviceActionDialogProps = {
  uid: number
  /** What to do to which device; null = closed. */
  target: { kind: DeviceConfirmKind; device: Device } | null
  onClose: () => void
}

/**
 * Confirmation for revoke and both deletes. None can be undone from the dashboard;
 * force delete also makes the admin type the device id.
 */
export function DeviceActionDialog({ uid, target, onClose }: DeviceActionDialogProps) {
  return (
    <AlertDialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="gap-5 rounded-2xl p-7 sm:max-w-[480px]">
        {target && (
          <ConfirmBody key={`${target.kind}-${target.device.device_id}`} uid={uid} {...target} onClose={onClose} />
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}

function run(kind: DeviceConfirmKind, uid: number, device: Device) {
  switch (kind) {
    case 'revoke':
      return revokeDevice(uid, device.device_uuid)
    case 'softDelete':
      return softDeleteDevice(uid, device.device_id)
    case 'forceDelete':
      return forceDeleteDevice(uid, device.device_id)
  }
}

function ConfirmBody({
  kind,
  uid,
  device,
  onClose,
}: {
  kind: DeviceConfirmKind
  uid: number
  device: Device
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [typed, setTyped] = useState('')
  const isForce = kind === 'forceDelete'
  const name = device.device_name || t('devices.unnamed')

  const action = useMutation({
    mutationFn: () => run(kind, uid, device),
    meta: { silentError: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: devicesQueryKey })
      toast.success(t(`devices.${kind}.done`, { name }))
      onClose()
    },
  })

  const confirmed = !isForce || typed.trim() === String(device.device_id)

  return (
    <>
      <span className="flex size-12 items-center justify-center rounded-xl bg-destructive-surface text-destructive">
        <TriangleAlertIcon className="size-6" aria-hidden />
      </span>
      <AlertDialogHeader className="gap-2 text-left">
        <AlertDialogTitle className="text-xl font-bold">{t(`devices.${kind}.title`)}</AlertDialogTitle>
        <AlertDialogDescription className="leading-relaxed text-muted-foreground">
          <Trans
            i18nKey={`devices.${kind}.description`}
            values={{ name, id: device.device_id, uid }}
            components={{ strong: <strong className="text-foreground" />, warn: <strong className="text-destructive" /> }}
          />
        </AlertDialogDescription>
      </AlertDialogHeader>

      {isCurrentDeviceUuid(device.device_uuid) && <FormAlert>{t('devices.thisBrowserWarning')}</FormAlert>}
      {action.isError && <FormAlert>{getErrorMessage(action.error)}</FormAlert>}

      {isForce && (
        <div className="flex flex-col gap-2">
          <label htmlFor="confirm-device-id" className="text-sm font-semibold">
            <Trans
              i18nKey="devices.forceDelete.typeToConfirm"
              values={{ id: device.device_id }}
              components={{ code: <code className="rounded-md bg-secondary px-1.5 py-0.5 font-mono" /> }}
            />
          </label>
          <Input
            id="confirm-device-id"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            className="h-11 rounded-xl font-mono"
          />
        </div>
      )}

      <AlertDialogFooter className="gap-3">
        <AlertDialogCancel className="h-11 rounded-xl px-4.5" disabled={action.isPending}>
          {t('common.cancel')}
        </AlertDialogCancel>
        {/* A plain button, not AlertDialogAction: the dialog must stay open until the call ends. */}
        <Button
          variant="destructive"
          className="h-11 rounded-xl px-4.5"
          disabled={!confirmed || action.isPending}
          onClick={() => action.mutate()}
        >
          {action.isPending ? t('devices.working') : t(`devices.${kind}.confirm`)}
        </Button>
      </AlertDialogFooter>
    </>
  )
}
