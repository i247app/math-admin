import { useMutation, useQuery } from '@tanstack/react-query'
import { SearchIcon } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { FormAlert } from '@/components/FormAlert'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSessionUser } from '@/features/auth/AuthApi'
import { TitleBar } from '@/features/dashboard/TitleBar'
import type { DeviceConfirmKind } from '@/features/devices/DeviceActionDialog'
import { DeviceActionDialog } from '@/features/devices/DeviceActionDialog'
import { DeviceEditSheet } from '@/features/devices/DeviceEditSheet'
import { devicesListQueryOptions, getDevice } from '@/features/devices/DevicesApi'
import type { DeviceAction } from '@/features/devices/DevicesTable'
import { DevicesTable } from '@/features/devices/DevicesTable'
import { getErrorMessage } from '@/libs/ApiClient'
import type { Device } from '@/types/Device'
import { cn } from '@/utils/Helpers'

type LookupMode = 'uid' | 'device'
const TRUST_FILTERS = ['all', 'true', 'false'] as const
type TrustFilter = (typeof TRUST_FILTERS)[number]

/**
 * Devices of one user. math-svr has no "every device" list: /devices/list needs a uid,
 * so the admin picks a user by UID, or by a device id (looked up with /devices/detail).
 */
export default function DevicesPage() {
  const { t } = useTranslation()
  const isAdmin = useSessionUser().role === 'ADMIN'

  // uid, trust filter and the highlighted device live in the URL so the Users screen can link here.
  const [params, setParams] = useSearchParams()
  const uid = positiveInt(params.get('uid'))
  const highlightId = positiveInt(params.get('device')) ?? undefined
  const trust = TRUST_FILTERS.find((option) => option === params.get('verified')) ?? 'all'

  const list = useQuery({
    ...devicesListQueryOptions({ uid: uid ?? 0, verified: trust === 'all' ? undefined : trust === 'true' }),
    enabled: uid !== null,
  })

  const [mode, setMode] = useState<LookupMode>(highlightId ? 'device' : 'uid')
  const [lookupText, setLookupText] = useState(String((highlightId ? highlightId : uid) ?? ''))
  const [lookupError, setLookupError] = useState<string | null>(null)

  const [editing, setEditing] = useState<Device | null>(null)
  const [confirming, setConfirming] = useState<{ kind: DeviceConfirmKind; device: Device } | null>(null)

  function show(next: { uid: number; device?: number }) {
    setParams((current) => {
      const updated = new URLSearchParams(current)
      updated.set('uid', String(next.uid))
      if (next.device) updated.set('device', String(next.device))
      else updated.delete('device')
      return updated
    })
  }

  // A device id only tells us the owner after a /devices/detail call.
  const findDevice = useMutation({
    mutationFn: getDevice,
    meta: { silentError: true },
    onSuccess: (device) => {
      if (!device.uid) {
        setLookupError(t('devices.lookup.noOwner'))
        return
      }
      // The trust filter could hide the device we just looked up.
      setParams({ uid: String(device.uid), device: String(device.device_id) })
    },
    onError: (error) => setLookupError(getErrorMessage(error)),
  })

  function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const id = positiveInt(lookupText.trim())
    if (!id) {
      setLookupError(t('devices.lookup.invalid'))
      return
    }
    setLookupError(null)
    if (mode === 'uid') show({ uid: id })
    else findDevice.mutate(id)
  }

  function setTrust(value: TrustFilter) {
    setParams((current) => {
      const updated = new URLSearchParams(current)
      if (value === 'all') updated.delete('verified')
      else updated.set('verified', value)
      return updated
    })
  }

  function handleAction(action: DeviceAction, device: Device) {
    if (action === 'edit') {
      setEditing(device)
    } else {
      setEditing(null)
      setConfirming({ kind: action, device })
    }
  }

  const rows = list.data

  return (
    <>
      <TitleBar title={t('devices.title')} description={t('devices.description')} />

      <form
        onSubmit={handleLookup}
        noValidate
        aria-label={t('devices.lookup.label')}
        className="flex flex-col gap-3 rounded-2xl border bg-card px-5 py-4"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={mode}
            onValueChange={(value) => {
              setMode(value as LookupMode)
              setLookupError(null)
            }}
          >
            <SelectTrigger aria-label={t('devices.lookup.mode')} className="h-11 w-48 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="uid">{t('devices.lookup.byUid')}</SelectItem>
              <SelectItem value="device">{t('devices.lookup.byDevice')}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            inputMode="numeric"
            autoComplete="off"
            aria-label={t(mode === 'uid' ? 'devices.lookup.uidPlaceholder' : 'devices.lookup.devicePlaceholder')}
            placeholder={t(mode === 'uid' ? 'devices.lookup.uidPlaceholder' : 'devices.lookup.devicePlaceholder')}
            value={lookupText}
            onChange={(event) => setLookupText(event.target.value)}
            aria-invalid={lookupError !== null}
            className="h-11 w-56 rounded-xl font-mono"
          />
          <Button type="submit" className="h-11 rounded-xl px-4.5" disabled={findDevice.isPending}>
            <SearchIcon aria-hidden />
            {t('devices.lookup.submit')}
          </Button>
        </div>
        {lookupError && <FormAlert>{lookupError}</FormAlert>}
      </form>

      {uid === null ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-12 text-center">
          <img src={`${import.meta.env.BASE_URL}assets/images/numi-thinking.png`} alt="" className="size-30 object-contain" />
          <strong className="text-[17px] font-semibold">{t('devices.pickTitle')}</strong>
          <span className="max-w-md text-muted-foreground">{t('devices.pickDescription')}</span>
        </div>
      ) : list.isError && !list.data ? (
        <LoadError
          title={t('devices.loadFailed')}
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
        />
      ) : (
        <section aria-label={t('devices.title')} className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <strong className="font-semibold" aria-live="polite">
              {rows ? t('devices.count', { count: rows.length, uid }) : ' '}
            </strong>
            <Select value={trust} onValueChange={(value) => setTrust(value as TrustFilter)}>
              <SelectTrigger size="sm" aria-label={t('devices.filter.label')} className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRUST_FILTERS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`devices.filter.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {rows && rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <img src={`${import.meta.env.BASE_URL}assets/images/numi-thinking.png`} alt="" className="size-30 object-contain" />
              <strong className="text-[17px] font-semibold">
                {t(trust === 'all' ? 'devices.emptyTitle' : 'devices.filter.emptyTitle')}
              </strong>
              {trust !== 'all' && (
                <Button variant="outline" onClick={() => setTrust('all')}>
                  {t('devices.filter.clear')}
                </Button>
              )}
            </div>
          ) : (
            <div
              className={cn('overflow-x-auto transition-opacity', list.isFetching && rows && 'opacity-60')}
              aria-busy={list.isFetching}
            >
              <DevicesTable
                devices={rows}
                highlightId={highlightId}
                canForceDelete={isAdmin}
                onAction={handleAction}
              />
            </div>
          )}
        </section>
      )}

      {uid !== null && (
        <>
          <DeviceEditSheet uid={uid} device={editing} onClose={() => setEditing(null)} />
          <DeviceActionDialog uid={uid} target={confirming} onClose={() => setConfirming(null)} />
        </>
      )}
    </>
  )
}

function positiveInt(value: string | null): number | null {
  const n = Number(value)
  return value && Number.isSafeInteger(n) && n >= 1 ? n : null
}
