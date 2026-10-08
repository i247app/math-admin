/**
 * The pool editor's working copy and its rules (docs/superpowers/specs/2026-10-08-exam-pool-admin-design.md).
 * Pure, with type-only imports, so `node scripts/check-exam-pool-draft.ts` can run it.
 */
import type { AnswerChoice, ExamQuestion } from '@/types/Exam'

/** At submit math-svr copies these into VARCHAR(255) / VARCHAR(64) columns (ma_exam_session_lines). */
export const MAX_ANSWER_LENGTH = 255
export const MAX_TOPIC_LENGTH = 64

/** The editable part of one question. Number, type, grade and answer labels are never edited. */
export type DraftQuestion = {
  name: string
  answers: AnswerChoice[]
  rightLabel: string
  topic: string
}

export type AnswerError = 'required' | 'tooLong' | 'duplicate'

export type QuestionErrors = {
  name?: 'required'
  /** By answer label. */
  answers: Partial<Record<string, AnswerError>>
  topic?: 'tooLong'
  right?: 'missing'
}

export function toDraft(question: ExamQuestion): DraftQuestion {
  return {
    name: question.question_name,
    answers: (question.answers ?? []).map(({ label, content }) => ({ label, content })),
    rightLabel: question.right_answer_label ?? '',
    topic: question.question_topic ?? '',
  }
}

/** MySQL utf8mb4 VARCHAR counts code points, as Array.from does (an emoji is 1, not 2). */
function lengthOf(text: string) {
  return Array.from(text).length
}

/** null when the question can be saved. Values are judged trimmed, as they are sent. */
export function questionErrors(draft: DraftQuestion): QuestionErrors | null {
  const errors: QuestionErrors = { answers: {} }
  if (!draft.name.trim()) errors.name = 'required'

  const firstLabelOf = new Map<string, string>()
  for (const { label, content } of draft.answers) {
    const value = content.trim()
    const first = firstLabelOf.get(value)
    if (!value) errors.answers[label] = 'required'
    else if (lengthOf(value) > MAX_ANSWER_LENGTH) errors.answers[label] = 'tooLong'
    else if (first !== undefined) {
      errors.answers[label] = 'duplicate'
      errors.answers[first] ??= 'duplicate'
    } else firstLabelOf.set(value, label)
  }

  if (lengthOf(draft.topic.trim()) > MAX_TOPIC_LENGTH) errors.topic = 'tooLong'
  if (!draft.answers.some(({ label }) => label === draft.rightLabel)) errors.right = 'missing'

  const found = errors.name || errors.topic || errors.right || Object.keys(errors.answers).length > 0
  return found ? errors : null
}

export function isChanged(original: ExamQuestion, draft: DraftQuestion): boolean {
  const before = toDraft(original)
  return (
    before.name !== draft.name ||
    before.topic !== draft.topic ||
    before.rightLabel !== draft.rightLabel ||
    before.answers.some((answer, index) => answer.content !== draft.answers[index]?.content)
  )
}

/**
 * The whole set for /exams/pools/verify, in stored order: edited fields trimmed, everything else
 * (question_number, question_type, question_grade, labels) copied from the stored question.
 */
export function toVerifyQuestions(originals: ExamQuestion[], drafts: DraftQuestion[]): ExamQuestion[] {
  return originals.map((original, index) => {
    const draft = drafts[index] ?? toDraft(original)
    const answers = draft.answers.map(({ label, content }) => ({ label, content: content.trim() }))
    return {
      ...original,
      question_name: draft.name.trim(),
      answers,
      right_answer_label: draft.rightLabel,
      // Derived, never typed: the label and its content cannot disagree (the AI mistake this screen fixes).
      right_answer_content: answers.find(({ label }) => label === draft.rightLabel)?.content ?? '',
      question_topic: draft.topic.trim() || undefined,
    }
  })
}
