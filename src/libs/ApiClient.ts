/**
 * The only module that talks HTTP to math-svr. Components and hooks call
 * apiPost / apiPostMultipart; they never use fetch directly.
 *
 * Wire rules (docs/API-CONTRACT.md §1):
 * - every route is POST; the body carries `metadata` (token, device, language)
 * - the auth token travels in metadata.authorization, never in a header
 * - X-Auth-Token on any response replaces the stored token
 * - HTTP is always 200; `mstatus` 200–299 is success, anything else throws ApiError
 */
import i18n from '@/libs/I18n'
import type { ApiEnvelope } from '@/types/Api'
import { AppConfig } from '@/utils/AppConfig'

const { basePath, deviceName, tokenStorageKey, deviceUuidStorageKey } = AppConfig.api

/** mstatus for a missing or not-yet-OTP-verified session. */
export const UNAUTHORIZED = 401
/** mstatus we use for failures that never produced an envelope (offline, proxy error, bad JSON). */
export const NETWORK_ERROR = 0

export class ApiError extends Error {
  /** Server outcome code, or NETWORK_ERROR. */
  readonly mstatus: number
  /** Internal server error text — for logs only. */
  readonly debug?: string
  readonly path: string

  constructor(args: { path: string; mstatus: number; message: string; debug?: string }) {
    super(args.message)
    this.name = 'ApiError'
    this.path = args.path
    this.mstatus = args.mstatus
    this.debug = args.debug
  }

  get isUnauthorized() {
    return this.mstatus === UNAUTHORIZED
  }
}

/** The message to show the user for any error thrown by a request. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.isUnauthorized ? i18n.t('errors.sessionExpired') : error.message
  }
  return i18n.t('errors.unknown')
}

// ---------------------------------------------------------------------------
// Persistent client state: auth token + device id
// ---------------------------------------------------------------------------

// localStorage can throw (private mode, blocked storage); the app then keeps
// working for the current tab only.
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Not persisted; the in-memory value still applies.
  }
}

let authToken = readStorage(tokenStorageKey)

function setAuthToken(token: string | null) {
  authToken = token
  writeStorage(tokenStorageKey, token)
}

export function hasAuthToken() {
  return authToken !== null
}

/** Whether `token` is this browser's session token, without handing the token out. */
export function isCurrentAuthToken(token: string) {
  return authToken !== null && token === authToken
}

/** Forget the session token (after logout or a 401). */
export function clearAuthToken() {
  setAuthToken(null)
}

/**
 * One stable id per browser. The server trusts devices by it, so losing it
 * means the next login asks for an OTP again.
 */
const deviceUuid = (() => {
  const stored = readStorage(deviceUuidStorageKey)
  if (stored) return stored
  const created = crypto.randomUUID()
  writeStorage(deviceUuidStorageKey, created)
  return created
})()

/** Whether `uuid` is the device_uuid this browser sends. */
export function isCurrentDeviceUuid(uuid: string) {
  return uuid === deviceUuid
}

function buildMetadata() {
  return {
    authorization: authToken ? `Bearer ${authToken}` : undefined,
    platform: 'web',
    device_uuid: deviceUuid,
    device_name: deviceName,
    language: i18n.language,
    app_version: `math-admin ${AppConfig.version}`,
    version: AppConfig.version,
    user_context: {
      locale: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: i18n.language,
    },
  }
}

// ---------------------------------------------------------------------------
// 401 hook — the app decides what to do (redirect to sign-in)
// ---------------------------------------------------------------------------

let unauthorizedHandler: (() => void) | null = null

/** Register the callback run after any request answers 401 (token already cleared). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

type RequestOptions = {
  signal?: AbortSignal
}

/** JSON request. `body` holds the route's top-level fields; metadata is added here. */
export function apiPost<T extends object = object>(
  path: string,
  body: object = {},
  options: RequestOptions = {},
): Promise<T & ApiEnvelope> {
  return send<T>(path, {
    method: 'POST',
    // Exactly this value: upload handlers compare it by equality.
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, metadata: buildMetadata() }),
    signal: options.signal,
  })
}

export type MultipartFields = Record<string, string | number | boolean | Blob | null | undefined>

/**
 * multipart/form-data request (file uploads). Metadata goes in a `metadata`
 * form field as a JSON string; null/undefined fields are left out.
 */
export function apiPostMultipart<T extends object = object>(
  path: string,
  fields: MultipartFields,
  options: RequestOptions = {},
): Promise<T & ApiEnvelope> {
  const form = new FormData()
  form.append('metadata', JSON.stringify(buildMetadata()))
  for (const [name, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue
    form.append(name, value instanceof Blob ? value : String(value))
  }
  // No Content-Type header: the browser sets it with the multipart boundary.
  return send<T>(path, { method: 'POST', body: form, signal: options.signal })
}

function networkError(path: string, cause: unknown): ApiError {
  console.warn(`[api] ${path} failed before reaching math-svr`, cause)
  return new ApiError({ path, mstatus: NETWORK_ERROR, message: i18n.t('errors.network') })
}

function isEnvelope(value: unknown): value is ApiEnvelope {
  return typeof value === 'object' && value !== null && typeof (value as ApiEnvelope).mstatus === 'number'
}

async function send<T>(path: string, init: RequestInit): Promise<T & ApiEnvelope> {
  let response: Response
  try {
    response = await fetch(`${basePath}${path}`, init)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw networkError(path, error)
  }

  const newToken = response.headers.get('X-Auth-Token')
  if (newToken) setAuthToken(newToken)

  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    throw networkError(path, `HTTP ${response.status}, body is not JSON: ${String(error)}`)
  }
  if (!isEnvelope(body)) {
    throw networkError(path, `HTTP ${response.status}, body has no mstatus`)
  }

  if (body.mstatus >= 200 && body.mstatus < 300) {
    return body as T & ApiEnvelope
  }

  console.warn(`[api] ${path} → mstatus ${body.mstatus}`, body.debug ?? body.mmessage)
  const error = new ApiError({
    path,
    mstatus: body.mstatus,
    message: body.mmessage || i18n.t('errors.unknown'),
    debug: body.debug,
  })
  if (error.isUnauthorized) {
    clearAuthToken()
    unauthorizedHandler?.()
  }
  throw error
}
