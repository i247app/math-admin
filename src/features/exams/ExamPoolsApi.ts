/** /exams/pools/* calls (docs/API-CONTRACT.md §4, Exam pool). ADMIN sessions only. */
import type { QueryClient } from '@tanstack/react-query'
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { apiPost } from '@/libs/ApiClient'
import type { ExamPool, ExamPoolResponse, ExamQuestion, ListExamPoolsRequest, ListExamPoolsResponse } from '@/types/Exam'
import { examsQueryKey } from './ExamsApi'

const poolsQueryKey = [...examsQueryKey, 'pools'] as const

export function examPoolsListQueryOptions(request: ListExamPoolsRequest) {
  return queryOptions({
    queryKey: [...poolsQueryKey, 'list', request],
    queryFn: async ({ signal }) => {
      const res = await apiPost<ListExamPoolsResponse>('/exams/pools/list', request, { signal })
      return { pools: res.exam_pools ?? [], pagination: res.pagination }
    },
    placeholderData: keepPreviousData,
  })
}

export function examPoolDetailQueryOptions(examId: number) {
  return queryOptions({
    queryKey: [...poolsQueryKey, 'detail', examId],
    queryFn: async ({ signal }) =>
      (await apiPost<ExamPoolResponse>('/exams/pools/detail', { exam_id: examId }, { signal })).exam_pool,
  })
}

/** true: verified_count 0 → 1 (a verified set keeps its count); false: back to 0. */
export async function markExamPoolVerify(examId: number, isVerify: boolean) {
  return (await apiPost<ExamPoolResponse>('/exams/pools/mark-verify', { exam_id: examId, is_verify: isVerify }))
    .exam_pool
}

/** Replaces the whole stored set (same shape) and adds 1 to verified_count. */
export async function verifyExamPool(examId: number, questions: ExamQuestion[]) {
  return (await apiPost<ExamPoolResponse>('/exams/pools/verify', { exam_id: examId, questions })).exam_pool
}

/** After a write: the response is the fresh set; lists may still show the old count. */
export function storeExamPool(queryClient: QueryClient, pool: ExamPool) {
  queryClient.setQueryData(examPoolDetailQueryOptions(pool.exam_id).queryKey, pool)
  void queryClient.invalidateQueries({ queryKey: [...poolsQueryKey, 'list'] })
}

export const EXAM_POOLS_PATH = '/exams/pools'

export function examPoolPath(examId: number) {
  return `${EXAM_POOLS_PATH}/detail?exam=${examId}`
}
