/**
 * Wire types shared by every math-svr endpoint (docs/API-CONTRACT.md §1–2).
 * Source: math-svr internal/shared/response, internal/shared/pagination.
 */

/** Envelope fields the server adds to every response body. */
export type ApiEnvelope = {
  status?: 'Success'
  /** Outcome code; 200–299 is success. HTTP status is always 200. */
  mstatus: number
  /** Localized error message — safe to show to the user. */
  mmessage?: string
  /** Internal error text — log it, never show it. */
  debug?: string
}

/** Offset pagination returned by list endpoints. */
export type OffsetPagination = {
  page: number
  size: number
  take_all: boolean
  skip: number
  total_count: number
  total_pages: number
  has_previous: boolean
  has_next: boolean
}

/** Cursor pagination (lists that support both styles return one or the other). */
export type CursorPagination = {
  start_cursor: string | null
  end_cursor: string | null
  has_next: boolean
  has_prev: boolean
}

/** Request fields for OFFSET pagination. `size` outside [1, 1000] becomes 20. */
export type OffsetPageRequest = {
  page: number
  size: number
}
