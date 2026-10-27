/**
 * Question bank (ma_question_pools, routes /question-pools/*) as the admin reads and writes it
 * (docs/API-CONTRACT.md §4, Question pool). Source: math-svr internal/application/dto/questionpool/
 * question_pool_dto.go, internal/domain/questionpool/.
 * Independent of the exam pool: nothing here refers to ma_exam_pools.
 */
import type { OffsetPagination } from '@/types/Api'

/** kind.go: decides the shape of options and correct_answer. */
export const QUESTION_KINDS = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'NUMERIC_INPUT'] as const
export type QuestionKind = (typeof QUESTION_KINDS)[number]

/** Review states. Admin-created questions start APPROVED (AI ones PENDING_REVIEW); /question-pools/mark-status changes them. */
export const QUESTION_STATUSES = ['PENDING_REVIEW', 'APPROVED', 'REJECTED'] as const
export type QuestionStatus = (typeof QUESTION_STATUSES)[number]

/** Who wrote it: a model, or an admin (every /question-pools/create row is ADMIN). */
export const QUESTION_SOURCES = ['AI', 'ADMIN'] as const
export type QuestionSource = (typeof QUESTION_SOURCES)[number]

/** 0 = Mẫu giáo, 1..5 = Lớp 1..5 (rules.go). */
export const QUESTION_GRADES = [0, 1, 2, 3, 4, 5] as const
/** 0 = easiest .. 9 = hardest; optional. */
export const QUESTION_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const

export type QuestionOption = {
  /** Short, unique in the question, `^[a-z0-9_]{1,16}$`; the key names options by id. */
  id: string
  text: string
  image_key?: string
  /** Response only: presigned, short-lived. */
  image_url?: string | null
}

/**
 * Exactly one part, by kind: option_ids (choice kinds), value (TRUE_FALSE), values (NUMERIC_INPUT:
 * accepted numbers as strings, stored canonical — "0,50" → "0.5").
 */
export type CorrectAnswer = { option_ids?: string[]; value?: boolean; values?: string[] }

export type Question = {
  question_pool_id: number
  question_kind: QuestionKind
  question_text: string
  question_image_key: string | null
  /** Presigned, short-lived; null without an image or when signing failed. */
  question_image_url: string | null
  /** null for TRUE_FALSE and NUMERIC_INPUT. */
  options: QuestionOption[] | null
  correct_answer: CorrectAnswer
  explanation: string | null
  question_grade: number
  question_topic: string | null
  question_level: number | null
  question_tags: string[]
  question_source: QuestionSource
  question_status: QuestionStatus | null
  /** 0 = not verified. */
  verified_count: number
  note?: string
  create_id: number | null
  /** "YYYYMMDDHHmmss.ffffff" — parse with parseServerTime. */
  create_dt: string
  modify_id: number | null
  modify_dt: string
}

/** What /question-pools/create takes per question and /question-pools/update takes beside question_pool_id. */
export type QuestionInput = {
  question_kind: QuestionKind
  question_text: string
  question_image_key: string | null
  options: Pick<QuestionOption, 'id' | 'text' | 'image_key'>[] | null
  correct_answer: CorrectAnswer
  explanation: string | null
  question_grade: number
  question_topic: string | null
  question_level: number | null
  question_tags: string[]
}

export type ListQuestionsRequest = {
  question_grade?: number
  /** Exact match. */
  question_topic?: string
  /** Matches a question holding at least one of them. */
  question_tags?: string[]
  question_kinds?: QuestionKind[]
  is_verified?: boolean
  question_statuses?: QuestionStatus[]
  question_source?: QuestionSource
  page: number
  size: number
}

export type ListQuestionsResponse = { question_pools: Question[] | null; pagination: OffsetPagination }
export type CreateQuestionsResponse = { question_pools: Question[] }
export type QuestionResponse = { question_pool: Question }
export type UploadQuestionImageResponse = { image_key: string; image_url: string | null }
