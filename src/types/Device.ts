/**
 * A browser/phone a user signs in from (ma_devices).
 * Source: math-svr internal/application/dto/device/device_dto.go, internal/module/device/.
 */

export type Device = {
  device_id: number
  /** Owner; omitted for a device row with no user. Every write route needs it. */
  uid?: number
  /** Client-generated id (this dashboard's lives in localStorage). /devices/revoke takes it. */
  device_uuid: string
  device_name: string
  platform: string
  /** Trusted = sign-in skips the OTP step. /devices/revoke turns it off. */
  is_verified: boolean
  note?: string
  /** Row status; lists only return ACTIVE rows. The REVOKED device status is not exposed. */
  status: string
  /** "YYYYMMDDHHmmss.ffffff" — parse with parseServerTime. */
  create_dt: string
  modify_dt: string
}

/** POST /devices/list — every device of one user, newest first. Not paginated. */
export type ListDevicesResponse = { devices: Device[] | null }

/** POST /devices/update. An empty device_name is ignored by the server; note "" clears the note. */
export type UpdateDeviceRequest = {
  uid: number
  device_id: number
  device_name?: string
  note?: string
}
