/**
 * Exam journeys and sittings as the admin reads them (docs/API-CONTRACT.md §4).
 * Source: math-svr internal/application/dto/exam/exam_dto.go, internal/shared/enum/exam.go.
 */
import type { OffsetPagination } from '@/types/Api'

/** Journey types — the values /exams/sessions/list accepts in `exam_types`. */
export const JOURNEY_TYPES = ['ASSESSMENT', 'GRADE'] as const
export type JourneyType = (typeof JOURNEY_TYPES)[number]

/** PRACTICE is not a journey: it rides on one (ExamSession.practice) and shares its esess_id. */
export type ExamType = JourneyType | 'PRACTICE'

export const JOURNEY_STATUSES = ['ACTIVE', 'COMPLETE', 'CANCEL'] as const
export type JourneyStatus = (typeof JOURNEY_STATUSES)[number]

/** "" when the row carries no status. */
export type SittingStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'DELETED' | ''

/**
 * How the app renders a question; grading ignores it. Unknown values render as plain text.
 * FRACTION carries LaTeX \frac{a}{b} inside $…$; the admin shows it raw.
 */
export const QUESTION_TYPES = ['ARITHMETIC', 'COUNT', 'PICK_BY_ICON', 'IDENTIFY_SHAPE', 'FRACTION'] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

export type AnswerChoice = { label: string; content: string }

/** One question: on a sitting, the child's served numbering and A/B/C/D; on a pool set, the stored (canonical) ones. */
export type ExamQuestion = {
  question_number: number
  question_type?: string
  /** May embed emoji and [icon:NAME] tokens. */
  question_name: string
  answers: AnswerChoice[]
  /** Answer key: on SUBMITTED sittings and on pool sets. */
  right_answer_label?: string
  right_answer_content?: string
  question_topic?: string
  /** Above the sitting's grade on ASSESSMENT probe questions. */
  question_grade?: number
}

export type ExamResult = {
  /** Questions ANSWERED, not questions on the paper. */
  total_questions: number
  correct_number: number
  skipped_number: number
  score_percentage: number
}

/** One sitting. It carries no esess_id. */
export type ExamSitting = {
  elink_id: number
  exam_id: number
  profile_id: number
  exam_type: ExamType
  grade: number
  level?: number
  ai_title?: string
  ai_short_text?: string
  num_questions: number
  /** On a single-sitting read and on in_progress_exams; list cards drop it. */
  questions?: ExamQuestion[]
  /** Absent until submitted. */
  result?: ExamResult
  status: SittingStatus
  started_dt?: string
  submitted_dt?: string
  create_dt: string
}

/** One journey of one type, or (as `practice`) the journey's PRACTICE row. */
export type ExamSession = {
  esess_id: number
  exam_type: ExamType
  status: JourneyStatus | 'DELETED'
  total_questions: number
  correct_number: number
  skipped_number: number
  score_percentage?: number
  /** GRADE pass verdict on a COMPLETE journey; null = no verdict. */
  esess_flag: boolean | null
  ai_title?: string
  ai_short_text?: string
  ai_review_short?: string
  ai_review_long?: string
  grade?: number
  level?: number
  last_submitted_dt?: string
  ended_dt?: string
  create_dt: string
  practice?: ExamSession
  /** Filled by the list route only. */
  in_progress_exams?: ExamSitting[]
}

/** One answered question. Skipped questions have no row. */
export type ExamAnswerDetail = {
  elink_id: number
  question_number: number
  question_type?: string
  question_name?: string
  /** Omitted when the question set can no longer be found. */
  answers?: AnswerChoice[]
  question_topic?: string
  question_grade?: number
  right_answer_label?: string
  right_answer_content?: string
  selected_label: string
  selected_content?: string
  is_correct: boolean
}

export type PracticePreview = {
  mode: 'RETRY_WEAK' | 'ADVANCE'
  base_elink_id: number
  weak_topics: { topic: string; wrong: number; answered: number }[]
  strong_topics: string[]
}

/** POST /admin/exams/sessions/list; ExamsApi adds pagination_type OFFSET. */
export type ListExamSessionsRequest = {
  profile_id: number
  exam_types?: JourneyType[]
  status?: JourneyStatus
  page: number
  size: number
}

export type ListExamSessionsResponse = { exam_sessions: ExamSession[] | null; pagination?: OffsetPagination }

/** POST /admin/exams/sessions/detail with esess_id. */
export type JourneyDetailResponse = {
  exam_session: ExamSession
  /** Submitted sittings as cards (no questions), oldest first. */
  exams?: ExamSitting[]
  details?: ExamAnswerDetail[]
  practice_preview?: PracticePreview
}

/** POST /admin/exams/sessions/detail with elink_id. */
export type SittingDetailResponse = { exam: ExamSitting; details?: ExamAnswerDetail[] }

/** Every exam type; the pool list filters by these. */
export const EXAM_TYPES = ['ASSESSMENT', 'GRADE', 'PRACTICE'] as const satisfies readonly ExamType[]

/** 0 = kindergarten. */
export const EXAM_GRADES = [0, 1, 2, 3, 4, 5] as const

/**
 * One stored question set (math-svr ExamPoolResponse). `questions` — stored order, answer key
 * included — comes with detail, mark-verify and verify; the list leaves it out.
 */
export type ExamPool = {
  exam_id: number
  exam_type: ExamType
  grade: number
  level?: number
  /** Questions REQUESTED; the stored set can be shorter. */
  num_questions: number
  semester?: string
  program?: string
  /** Cache tag; absent on PRACTICE sets (never reused). */
  req_extras?: string
  ai_title?: string
  ai_short_text?: string
  questions?: ExamQuestion[]
  /** 0 = not verified; mark-verify sets 1, every verify adds 1. */
  verified_count: number
  status?: string
  create_dt: string
}

export type ListExamPoolsRequest = {
  exam_types?: ExamType[]
  grade?: number
  /** Requested from math-svr; ignored by the server until it lands. */
  is_verified?: boolean
  page: number
  size: number
}

export type ListExamPoolsResponse = { exam_pools: ExamPool[] | null; pagination: OffsetPagination }

/** detail, mark-verify and verify all answer with the set, questions included. */
export type ExamPoolResponse = { exam_pool: ExamPool }
