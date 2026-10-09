/** /exams/prompts/* calls (docs/API-CONTRACT.md §4, Exam prompts). ADMIN sessions only. */
import type { QueryClient } from '@tanstack/react-query'
import { queryOptions } from '@tanstack/react-query'
import { apiPost } from '@/libs/ApiClient'
import type { ExamPrompt, ExamPromptResponse, ListExamPromptsResponse } from '@/types/Exam'
import { examsQueryKey } from './ExamsApi'

/** Every grade's prompt, full text included (one row per grade, lowest first). */
export function examPromptsQueryOptions() {
  return queryOptions({
    queryKey: [...examsQueryKey, 'prompts'],
    queryFn: async ({ signal }) =>
      (await apiPost<ListExamPromptsResponse>('/exams/prompts/list', {}, { signal })).exam_prompts ?? [],
  })
}

/** Overwrites the grade's prompt (no history) and bumps its prompt_version. */
export async function updateExamPrompt(grade: number, systemPrompt: string) {
  return (await apiPost<ExamPromptResponse>('/exams/prompts/update', { grade, system_prompt: systemPrompt }))
    .exam_prompt
}

export function storeExamPrompt(queryClient: QueryClient, prompt: ExamPrompt) {
  queryClient.setQueryData(examPromptsQueryOptions().queryKey, (current) =>
    current?.map((row) => (row.grade === prompt.grade ? prompt : row)),
  )
}

/**
 * The JSON keys math-svr refuses a prompt without, quoted as the output-structure block names them.
 * Mirrors examPromptJSONKeys in math-svr internal/module/exam/validator.go — keep the two in sync.
 */
export const EXAM_PROMPT_JSON_KEYS = [
  '"short_text"',
  '"questions"',
  '"question_number"',
  '"question_type"',
  '"question_name"',
  '"answers"',
  '"label"',
  '"content"',
  '"right_answer_label"',
  '"right_answer_content"',
  '"question_topic"',
  '"question_grade"',
] as const

export function missingPromptKeys(text: string) {
  return EXAM_PROMPT_JSON_KEYS.filter((key) => !text.includes(key))
}

/**
 * Answer objects with a key deleted: innermost {…} blocks that name "label" or "content" but not both.
 * Stricter than math-svr, which only checks each key appears somewhere — the four example answers
 * (A–D) keep a key "present" after it is removed from one of them, and the model copies the example.
 */
export function brokenAnswerObjects(text: string) {
  return (text.match(/\{[^{}]*\}/g) ?? []).filter((block) => block.includes('"label"') !== block.includes('"content"'))
}
