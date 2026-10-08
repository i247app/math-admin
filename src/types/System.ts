/**
 * Admin-only ops routes (docs/API-CONTRACT.md §6). All sit behind math-svr's
 * AdminOrApiKeyMiddleware, so only an ADMIN session can call them.
 * Times here are RFC 3339 strings (Go time.Time) — parse with parseIsoTime.
 */

/**
 * One live session from POST /sessions/dump. The server answers with a map
 * keyed by the session's raw JWT; `token` is that key. Never render it whole.
 * Source: math-svr internal/infrastructure/session/session.go (Init).
 */
export type ServerSession = {
  token: string
  uid?: number
  login_name?: string
  email?: string
  /** How the session was created, e.g. "login". */
  source?: string
  /** true once login (or OTP) finished; false = signed out or still waiting for OTP. */
  is_secure?: boolean
  expires_at?: string
  marked_for_deletion?: boolean
  [key: string]: unknown
}

/** POST /misc/db-pool-stats — internal/application/dto/misc/misc_dto.go (DBPoolStatsRes). */
export type DbPoolStats = {
  captured_at: string
  autocommit: boolean
  isolation_level: string
  /** 0 = unlimited. */
  max_open_connections: number
  open_connections: number
  in_use: number
  idle: number
  /** The fields below are cumulative since the server started. */
  wait_count: number
  wait_duration_ms: number
  avg_wait_duration_ms: number
  max_idle_closed: number
  max_idle_time_closed: number
  max_lifetime_closed: number
  /** in_use / max_open × 100; 0 when unlimited. */
  utilization_percent: number
}

/** POST /misc/clear-data and /misc/clear-data-tables (ClearDataRes). */
export type ClearDataResult = {
  tables_cleared: string[] | null
  seqs_reset: string[] | null
  /** Users preserved through whitelist_id (clear-data only). */
  kept_uids?: number[]
}

/**
 * Tables /misc/clear-data-tables accepts. No endpoint lists them: this mirrors
 * clearDataTargets in math-svr internal/infrastructure/persistence/mysql/repositories/maintenance_repository.go.
 * The server rejects any other name, so a stale entry fails safely.
 */
export const CLEARABLE_TABLES = [
  'ma_users',
  'ma_aliases',
  'ma_logins',
  'ma_devices',
  'ma_login_logs',
  'ma_profiles',
  'ma_otps',
  'ma_classrooms',
  'ma_classroom_members',
  'ma_classroom_programs',
  'ma_exercises',
  'ma_exercise_submissions',
  'ma_notifications',
  'ma_banners',
  'ma_chat_conversations',
  'ma_chat_participants',
  'ma_chat_messages',
  'ma_exam_links',
  'ma_exam_sessions',
  'ma_exam_session_lines',
] as const

export type ClearableTable = (typeof CLEARABLE_TABLES)[number]

/** internal/infrastructure/job/types.go */
export type JobStatus = 'running' | 'paused'
export type JobRunStatus = 'succeeded' | 'failed' | 'panicked' | 'timed_out'

export type JobInfo = {
  name: string
  /** Effective schedule as Go prints it: "every 15m0s", "daily 06:30 Asia/Ho_Chi_Minh", "weekly Monday 08:00 UTC". */
  schedule: string
  /** What the code declares — what a schedule reset restores. */
  default_schedule: string
  schedule_overridden: boolean
  status: JobStatus
  in_flight: boolean
  next_run_at?: string
  last_run_at?: string
  last_status?: JobRunStatus
  last_error?: string
  /** Whole milliseconds, as a string. */
  last_duration_ms?: string
}

/** POST /jobs/list. Go encodes empty slices as null. */
export type JobsSnapshot = {
  started: boolean
  jobs: JobInfo[] | null
  tasks: { name: string }[] | null
  queue: { capacity: number; depth: number; workers: number }
}

/** POST /jobs/schedule/update `schedule`. Weekday: 0 = Sunday … 6 = Saturday. Empty timezone = UTC. */
export type JobSchedule =
  | { kind: 'every'; every_seconds: number }
  | { kind: 'daily'; hour: number; minute: number; timezone: string }
  | { kind: 'weekly'; weekday: number; hour: number; minute: number; timezone: string }

/** Bounds the server enforces on kind=every (internal/module/job/validator.go). */
export const MIN_EVERY_SECONDS = 60
export const MAX_EVERY_SECONDS = 30 * 24 * 3600

/** Response of the schedule update/reset routes: the job as the runtime resolved it. */
export type JobScheduleResponse = {
  result: string
  job: JobInfo
}
