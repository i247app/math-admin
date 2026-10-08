/** Admin-only ops calls: sessions, server, misc (data), jobs (docs/API-CONTRACT.md §6). */
import { queryOptions } from '@tanstack/react-query'
import { apiPost } from '@/libs/ApiClient'
import type {
  ClearableTable,
  ClearDataResult,
  DbPoolStats,
  JobSchedule,
  JobScheduleResponse,
  JobsSnapshot,
  ServerSession,
} from '@/types/System'

export const systemQueryKey = ['system'] as const

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

// Keys the envelope adds beside the flattened data; everything else in a
// /sessions/dump response is one session, keyed by its token.
const ENVELOPE_KEYS = new Set(['status', 'mstatus', 'mmessage', 'debug', 'result'])

export const sessionsQueryOptions = queryOptions({
  queryKey: [...systemQueryKey, 'sessions'],
  queryFn: async ({ signal }): Promise<ServerSession[]> => {
    const res: Record<string, unknown> = await apiPost('/sessions/dump', {}, { signal })
    return Object.entries(res)
      .filter(
        (entry): entry is [string, object] =>
          !ENVELOPE_KEYS.has(entry[0]) && typeof entry[1] === 'object' && entry[1] !== null,
      )
      .map(([token, value]) => ({ ...value, token }) as ServerSession)
      .sort((a, b) => String(b.expires_at ?? '').localeCompare(String(a.expires_at ?? '')))
  },
})

/**
 * How a session token is shown. It is the user's live JWT — anyone holding it
 * is signed in as them — so it is never rendered whole. JWTs all start with
 * the same header, so the tail is what tells them apart.
 */
export function maskToken(token: string) {
  return `…${token.slice(-8)}`
}

/**
 * Signs out the one session stored under `token` (its holder gets a fresh,
 * empty session on the next request). Fails with SESSION_NOT_FOUND when it is already gone.
 */
export function deleteSession(token: string) {
  return apiPost<{ uid: number | null; is_secure: boolean }>('/sessions/delete', { token })
}

/**
 * Flips is_secure on one session, keeping its uid and expiry. false is a soft
 * sign-out; true skips the OTP step and is refused (SESSION_MISSING_UID) on a
 * session nobody is signed into.
 */
export function markSessionSecure(token: string, isSecure: boolean) {
  return apiPost<{ uid: number | null; is_secure: boolean }>('/sessions/mark-secure', { token, is_secure: isSecure })
}

/** Drops sessions that never finished login/OTP, or were signed out. The caller's own session is secure. */
export function deleteUnsecureSessions() {
  return apiPost('/sessions/delete-unsecure')
}

/** Drops every session, the caller's included — the next request answers 401. */
export function deleteAllSessions() {
  return apiPost('/sessions/delete-all')
}

// ---------------------------------------------------------------------------
// Server lifecycle — both answer first, then the process stops ~250 ms later.
// ---------------------------------------------------------------------------

/** Re-validates .env, then restarts the process in place (same PID). */
export function reloadServer() {
  return apiPost('/server/reload')
}

/** Stops the process. It can only be started again on the host. */
export function shutdownServer() {
  return apiPost('/server/shutdown')
}

// ---------------------------------------------------------------------------
// Misc: database
// ---------------------------------------------------------------------------

export const dbPoolStatsQueryOptions = queryOptions({
  queryKey: [...systemQueryKey, 'db-pool-stats'],
  queryFn: ({ signal }) => apiPost<DbPoolStats>('/misc/db-pool-stats', {}, { signal }),
  // A live gauge: always fetch fresh when the screen opens.
  staleTime: 0,
})

/** TRUNCATEs the given tables and resets their id counters. Irreversible. */
export function clearDataTables(tables: ClearableTable[]) {
  return apiPost<ClearDataResult>('/misc/clear-data-tables', { tables })
}

/** Wipes every clearable table except the rows of the whitelisted users. Irreversible. */
export function clearAllData(whitelistUids: number[]) {
  return apiPost<ClearDataResult>('/misc/clear-data', { whitelist_id: whitelistUids })
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export const jobsQueryOptions = queryOptions({
  queryKey: [...systemQueryKey, 'jobs'],
  queryFn: ({ signal }) => apiPost<JobsSnapshot>('/jobs/list', {}, { signal }),
  staleTime: 0,
})

export type JobAction = 'trigger' | 'pause' | 'resume' | 'resetSchedule'

const JOB_ACTION_PATHS: Record<JobAction, string> = {
  trigger: '/jobs/trigger',
  pause: '/jobs/pause',
  resume: '/jobs/resume',
  resetSchedule: '/jobs/schedule/reset',
}

/** Run now / pause / resume a cron job, or drop its schedule override. */
export function runJobAction(action: JobAction, name: string) {
  return apiPost(JOB_ACTION_PATHS[action], { name })
}

/** Retargets the job's cadence until the next server restart. */
export function updateJobSchedule(name: string, schedule: JobSchedule) {
  return apiPost<JobScheduleResponse>('/jobs/schedule/update', { name, schedule })
}
