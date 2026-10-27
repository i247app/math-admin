/** /questions/* calls of the question bank (docs/API-CONTRACT.md §4, Question bank). ADMIN sessions only. */
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { ApiError, apiPost, apiPostMultipart } from '@/libs/ApiClient'
import type {
  CreateQuestionsResponse,
  ListQuestionsRequest,
  ListQuestionsResponse,
  QuestionInput,
  QuestionResponse,
  QuestionStatus,
  UploadQuestionImageResponse,
} from '@/types/Question'

/** Every questions query starts with this key — invalidate it after any change. */
export const questionsQueryKey = ['questions'] as const

export function questionsListQueryOptions(request: ListQuestionsRequest) {
  return queryOptions({
    queryKey: [...questionsQueryKey, 'list', request],
    queryFn: async ({ signal }) => {
      // Newest first; answer key and explanation included (admin-only route).
      const res = await apiPost<ListQuestionsResponse>('/questions/list', request, { signal })
      return { questions: res.questions ?? [], pagination: res.pagination }
    },
    placeholderData: keepPreviousData,
  })
}

/** MaxQuestionsPerCreate in internal/module/question/validator.go. */
export const MAX_QUESTIONS_PER_CREATE = 100

/** Stores every question or none; the response lists them in request order. */
export async function createQuestions(inputs: QuestionInput[]) {
  return (await apiPost<CreateQuestionsResponse>('/questions/create', { questions: inputs })).questions
}

/**
 * Which questions of a refused create the server named. mmessage names only the first
 * issue; every issue's path (`questions[3].options[1].id`, `questions[5] repeats questions[2]`)
 * is in debug. Only the indexes are read, to mark those questions — debug is never shown.
 */
export function rejectedIndexes(error: unknown): number[] {
  if (!(error instanceof ApiError) || !error.debug) return []
  return [...new Set([...error.debug.matchAll(/questions\[(\d+)\]/g)].map((match) => Number(match[1])))]
}

/**
 * Sends every editable field: an absent field would be kept, null clears it. Source,
 * status and verified_count are not editable here (see markQuestionStatus, verifyQuestion).
 */
export async function updateQuestion(questionId: number, input: QuestionInput) {
  return (await apiPost<QuestionResponse>('/questions/update', { question_id: questionId, ...input })).question
}

/** MaxImageBytes in internal/module/question/image.go. */
export const QUESTION_IMAGE_MAX_BYTES = 5 << 20
/** imageTypes in image.go; checked by extension, declared type and content. No SVG. */
export const QUESTION_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

/** The form disables Save while an upload with this key is in flight (useIsMutating). */
export const questionImageUploadKey = [...questionsQueryKey, 'upload'] as const

/** Stores the file under question-images/ and returns its key. Nothing deletes an unused upload. */
export async function uploadQuestionImage(file: File) {
  return apiPostMultipart<UploadQuestionImageResponse>('/questions/images/upload', { image: file })
}

/** Sets the review state only (content and verified_count stay); any state to any state. */
export async function markQuestionStatus(questionId: number, status: QuestionStatus) {
  return (await apiPost<QuestionResponse>('/questions/mark-status', { question_id: questionId, question_status: status }))
    .question
}

/** verified_count + 1, nothing else changes. No route takes it back down. */
export async function verifyQuestion(questionId: number) {
  return (await apiPost<QuestionResponse>('/questions/verify', { question_id: questionId })).question
}

/** Hides the question (the row stays, its content can be created again). No restore route. */
export async function softDeleteQuestion(questionId: number) {
  await apiPost('/questions/soft-delete', { question_id: questionId })
}

/** Deletes the row for good, live or soft-deleted. Uploaded images stay in S3 either way. */
export async function forceDeleteQuestion(questionId: number) {
  await apiPost('/questions/force-delete', { question_id: questionId })
}
