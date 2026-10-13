/**
 * LLM system prompts as the admin reads them (docs/API-CONTRACT.md §4, Prompts).
 * Source: math-svr internal/application/dto/prompt/prompt_dto.go, internal/domain/prompt/catalog.go.
 */

/** The prompt kinds math-svr reads today (catalog.go). A row may still carry a code this list does not know. */
export const PROMPT_CODES = ['EXAM_ASSESSMENT', 'EXAM_GRADE', 'EXAM_PRACTICE', 'EXAM_JOURNEY_REVIEW'] as const
export type PromptCode = (typeof PROMPT_CODES)[number]

/** One row of ma_prompts: the system prompt of one kind of LLM call, per grade / language when the kind varies by them. */
export type Prompt = {
  prompt_id: number
  prompt_code: string
  /** null when the code does not vary by grade (0 = Mẫu giáo). */
  grade: number | null
  /** null when the code does not vary by language. */
  language: string | null
  description: string | null
  /** Sent to the model verbatim; nothing in it is filled in. */
  system_prompt: string
  /** +1 per rewrite (1 = the seed); part of the exam cache tag for EXAM_ASSESSMENT and EXAM_GRADE. */
  prompt_version: number
  /** Admin uid of the last rewrite; absent on the seed and on API-key rewrites. */
  modify_id?: number
  modify_dt: string
}

export type ListPromptsResponse = { prompts: Prompt[] | null }

export type PromptResponse = { prompt: Prompt }
