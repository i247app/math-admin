/** /admin/exams/* calls (docs/API-CONTRACT.md §4). Read-only; ADMIN sessions only. */
import { queryOptions } from '@tanstack/react-query'
import { apiPost } from '@/libs/ApiClient'
import type {
  ExamType,
  JourneyDetailResponse,
  JourneyType,
  ListExamSessionsRequest,
  ListExamSessionsResponse,
  SittingDetailResponse,
} from '@/types/Exam'

export const examsQueryKey = ['exams'] as const

export function examSessionsListQueryOptions(request: ListExamSessionsRequest) {
  return queryOptions({
    queryKey: [...examsQueryKey, 'sessions', request],
    queryFn: async ({ signal }) => {
      const res = await apiPost<ListExamSessionsResponse>(
        '/admin/exams/sessions/list',
        { ...request, pagination_type: 'OFFSET' },
        { signal },
      )
      return { sessions: res.exam_sessions ?? [], pagination: res.pagination }
    },
    // Keep the old page while filters/page change, but never show another profile's journeys.
    placeholderData: (previous, previousQuery) =>
      (previousQuery?.queryKey[2] as ListExamSessionsRequest | undefined)?.profile_id === request.profile_id
        ? previous
        : undefined,
  })
}

/** One journey row: the journey's own type, or PRACTICE for the practice row that shares its id. */
export function journeyDetailQueryOptions(profileId: number, esessId: number, examType: ExamType) {
  return queryOptions({
    queryKey: [...examsQueryKey, 'journey', profileId, esessId, examType],
    queryFn: async ({ signal }) => {
      const res = await apiPost<JourneyDetailResponse>(
        '/admin/exams/sessions/detail',
        { profile_id: profileId, esess_id: esessId, exam_type: examType },
        { signal },
      )
      return {
        journey: res.exam_session,
        sittings: res.exams ?? [],
        details: res.details ?? [],
        practicePreview: res.practice_preview,
      }
    },
  })
}

export function sittingDetailQueryOptions(profileId: number, elinkId: number) {
  return queryOptions({
    queryKey: [...examsQueryKey, 'sitting', profileId, elinkId],
    queryFn: async ({ signal }) => {
      const res = await apiPost<SittingDetailResponse>(
        '/admin/exams/sessions/detail',
        { profile_id: profileId, elink_id: elinkId },
        { signal },
      )
      return { sitting: res.exam, details: res.details ?? [] }
    },
  })
}

/** A journey page; `type` is the journey's own type, never PRACTICE. */
export type JourneyRef = { profileId: number; esessId: number; type: JourneyType }

export function profileExamsPath(profileId: number) {
  return `/exams?profile=${profileId}`
}

export function journeyPath({ profileId, esessId, type }: JourneyRef, practice = false) {
  const params = new URLSearchParams({ profile: String(profileId), esess: String(esessId), type })
  if (practice) params.set('view', 'practice')
  return `/exams/journey?${params}`
}

/** `journey` only feeds the sitting page's back link: the sitting response has no esess_id. */
export function sittingPath(profileId: number, elinkId: number, journey?: Omit<JourneyRef, 'profileId'>) {
  const params = new URLSearchParams({ profile: String(profileId), elink: String(elinkId) })
  if (journey) {
    params.set('esess', String(journey.esessId))
    params.set('type', journey.type)
  }
  return `/exams/sitting?${params}`
}
