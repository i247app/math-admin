import { ArchiveIcon, PencilIcon, ShieldOffIcon, Trash2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RowAction } from '@/components/RowAction'
import { StatusPill } from '@/components/StatusPill'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { isCurrentDeviceUuid } from '@/libs/ApiClient'
import type { Device } from '@/types/Device'
import { cn, formatServerTime } from '@/utils/Helpers'

export type DeviceAction = 'edit' | 'revoke' | 'softDelete' | 'forceDelete'

type DevicesTableProps = {
  /** undefined while loading. */
  devices: Device[] | undefined
  /** Row to highlight (the device looked up by id). */
  highlightId?: number
  /** /devices/force-delete answers 403 to non-ADMIN accounts. */
  canForceDelete: boolean
  onAction: (action: DeviceAction, device: Device) => void
}

export function DevicesTable({ devices, highlightId, canForceDelete, onAction }: DevicesTableProps) {
  const { t, i18n } = useTranslation()

  return (
    <Table className="min-w-[1000px]">
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead className="w-24 pl-5">{t('devices.columns.id')}</TableHead>
          <TableHead>{t('devices.columns.device')}</TableHead>
          <TableHead className="w-28">{t('devices.columns.platform')}</TableHead>
          <TableHead className="w-36">{t('devices.columns.trust')}</TableHead>
          <TableHead>{t('devices.columns.note')}</TableHead>
          <TableHead className="w-40">{t('devices.columns.updated')}</TableHead>
          <TableHead className="w-44 pr-5 text-right">{t('devices.columns.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {devices
          ? devices.map((device) => {
              const name = device.device_name || t('devices.unnamed')
              return (
                <TableRow
                  key={device.device_id}
                  className={cn(device.device_id === highlightId && 'bg-info-surface/60 hover:bg-info-surface')}
                >
                  <TableCell className="pl-5 font-mono text-[13px] text-muted-foreground">{device.device_id}</TableCell>
                  <TableCell>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold">{name}</span>
                        {isCurrentDeviceUuid(device.device_uuid) && (
                          <StatusPill tone="info">{t('devices.thisBrowser')}</StatusPill>
                        )}
                      </span>
                      <code className="truncate font-mono text-[13px] text-muted-foreground">{device.device_uuid}</code>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{device.platform || '—'}</TableCell>
                  <TableCell>
                    <StatusPill tone={device.is_verified ? 'success' : 'neutral'}>
                      {t(device.is_verified ? 'devices.trusted' : 'devices.untrusted')}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="max-w-72 text-sm">
                    <div className="truncate">{device.note || '—'}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatServerTime(device.modify_dt, i18n.language)}
                  </TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end gap-1">
                      <RowAction label={t('devices.actions.edit', { name })} onClick={() => onAction('edit', device)}>
                        <PencilIcon />
                      </RowAction>
                      <RowAction
                        label={
                          device.is_verified ? t('devices.actions.revoke', { name }) : t('devices.actions.revokeNotTrusted')
                        }
                        disabled={!device.is_verified}
                        onClick={() => onAction('revoke', device)}
                      >
                        <ShieldOffIcon />
                      </RowAction>
                      <RowAction
                        label={t('devices.actions.softDelete', { name })}
                        onClick={() => onAction('softDelete', device)}
                      >
                        <ArchiveIcon />
                      </RowAction>
                      <RowAction
                        label={canForceDelete ? t('devices.actions.forceDelete', { name }) : t('devices.actions.adminOnly')}
                        disabled={!canForceDelete}
                        destructive
                        onClick={() => onAction('forceDelete', device)}
                      >
                        <Trash2Icon />
                      </RowAction>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          : Array.from({ length: 4 }, (_, index) => (
              <TableRow key={index} aria-hidden>
                <TableCell className="pl-5">
                  <Skeleton className="h-3 w-12" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-48" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-14" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-24 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-36" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-28" />
                </TableCell>
                <TableCell className="pr-5">
                  <Skeleton className="ml-auto h-3 w-28" />
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  )
}
