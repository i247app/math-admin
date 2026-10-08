/** /devices/* calls of the device module (docs/API-CONTRACT.md §4). */
import { queryOptions } from '@tanstack/react-query'
import { apiPost } from '@/libs/ApiClient'
import type { Device, ListDevicesResponse, UpdateDeviceRequest } from '@/types/Device'

/** URL of the devices screen for one user — the page reads its `uid` search param. */
export function userDevicesPath(uid: number) {
  return `/devices?uid=${uid}`
}

/** Every devices query starts with this key — invalidate it after any change. */
export const devicesQueryKey = ['devices'] as const

export type DevicesListParams = {
  uid: number
  /** undefined = trusted and untrusted alike. */
  verified?: boolean
}

export function devicesListQueryOptions({ uid, verified }: DevicesListParams) {
  return queryOptions({
    queryKey: [...devicesQueryKey, 'list', { uid, verified }],
    queryFn: async ({ signal }) => {
      const res = await apiPost<ListDevicesResponse>('/devices/list', { uid, is_verified: verified }, { signal })
      return res.devices ?? []
    },
  })
}

/** Looks one device up by its id — the screen uses it to find the owner. */
export async function getDevice(deviceId: number): Promise<Device> {
  const res = await apiPost<{ device: Device }>('/devices/detail', { device_id: deviceId })
  return res.device
}

export function updateDevice(req: UpdateDeviceRequest) {
  return apiPost('/devices/update', req)
}

/**
 * Un-trusts the device (its next sign-in asks for an OTP again) and marks its login
 * logs REVOKED. The row stays. Keyed by device_uuid, not device_id.
 */
export function revokeDevice(uid: number, deviceUuid: string) {
  return apiPost('/devices/revoke', { uid, device_uuid: deviceUuid })
}

/** Hides the row (no restore endpoint) and marks its login logs REVOKED. */
export function softDeleteDevice(uid: number, deviceId: number) {
  return apiPost('/devices/soft-delete', { uid, device_id: deviceId })
}

/** Physically deletes the row. Irreversible. ADMIN accounts only (403 otherwise). */
export function forceDeleteDevice(uid: number, deviceId: number) {
  return apiPost('/devices/force-delete', { uid, device_id: deviceId })
}
