import type { TFunction } from 'i18next'
import type { AnswerChoice, ExamAnswerDetail, ExamQuestion, ExamSession, ExamSitting, JourneyType } from '@/types/Exam'
import { JOURNEY_TYPES } from '@/types/Exam'
import type { Profile } from '@/types/Profile'

/** A URL param as a positive integer id, or null. */
export function positiveIntParam(value: string | null): number | null {
  const n = Number(value)
  return value && Number.isSafeInteger(n) && n >= 1 ? n : null
}

export function journeyTypeParam(value: string | null): JourneyType | null {
  return JOURNEY_TYPES.find((option) => option === value) ?? null
}

/** The list returns journeys only; ASSESSMENT (the server's default) covers anything else. */
export function journeyTypeOf(session: ExamSession): JourneyType {
  return journeyTypeParam(session.exam_type) ?? 'ASSESSMENT'
}

export function gradeLabel(t: TFunction, grade: number): string {
  return grade === 0 ? t('exams.kindergarten') : t('exams.grade', { grade })
}

/** "Lớp 2 · Mức 3"; level is shown as stored. */
export function gradeLevelLabel(t: TFunction, grade?: number, level?: number): string {
  const parts: string[] = []
  if (grade !== undefined) parts.push(gradeLabel(t, grade))
  if (level !== undefined) parts.push(t('exams.level', { level }))
  return parts.length > 0 ? parts.join(' · ') : '—'
}

/** "Nguyễn Bảo Anh · BA-4821", or "#1042" until the profile has loaded. */
export function profileLabel(profile: Profile | undefined, profileId: number): string {
  if (!profile) return `#${profileId}`
  return `${profile.name || profile.profile_code} · ${profile.profile_code}`
}

/** `unanswered` = the sitting is not submitted, so nothing can be marked; `key` = a pool question (answer key only). */
export type QuestionOutcome = 'correct' | 'wrong' | 'skipped' | 'unanswered' | 'key'

export type SittingQuestion = {
  number: number
  type?: string
  name: string
  topic?: string
  grade?: number
  /** Empty when the question set is gone (row rebuilt from the answer log). */
  answers: AnswerChoice[]
  rightLabel?: string
  rightContent?: string
  selectedLabel?: string
  selectedContent?: string
  outcome: QuestionOutcome
}

/**
 * The paper as served (every question, skipped ones included) joined with the answer log
 * on question_number — both use the child's served numbering. Log rows without a served
 * question are kept, so a sitting whose question set is gone still shows its answers.
 */
export function buildSittingQuestions(sitting: ExamSitting, details: ExamAnswerDetail[]): SittingQuestion[] {
  const submitted = sitting.status === 'SUBMITTED'
  const unmatched = new Map(details.map((detail) => [detail.question_number, detail]))

  const rows: SittingQuestion[] = (sitting.questions ?? []).map((question) => {
    const detail = unmatched.get(question.question_number)
    unmatched.delete(question.question_number)
    return {
      number: question.question_number,
      type: question.question_type || detail?.question_type,
      name: question.question_name,
      topic: question.question_topic || detail?.question_topic,
      grade: question.question_grade ?? detail?.question_grade,
      answers: question.answers ?? [],
      rightLabel: question.right_answer_label || detail?.right_answer_label,
      rightContent: question.right_answer_content || detail?.right_answer_content,
      selectedLabel: detail?.selected_label,
      selectedContent: detail?.selected_content,
      outcome: !submitted ? 'unanswered' : !detail ? 'skipped' : detail.is_correct ? 'correct' : 'wrong',
    }
  })

  for (const detail of unmatched.values()) {
    rows.push({
      number: detail.question_number,
      type: detail.question_type,
      name: detail.question_name ?? '',
      topic: detail.question_topic,
      grade: detail.question_grade,
      answers: detail.answers ?? [],
      rightLabel: detail.right_answer_label,
      rightContent: detail.right_answer_content,
      selectedLabel: detail.selected_label,
      selectedContent: detail.selected_content,
      outcome: detail.is_correct ? 'correct' : 'wrong',
    })
  }

  return rows.sort((a, b) => a.number - b.number)
}

/** `topic` null = questions the model gave no topic. */
export type TopicStat = { topic: string | null; correct: number; answered: number }

/** Correct / answered per topic across a journey, weakest first. */
export function topicBreakdown(details: ExamAnswerDetail[]): TopicStat[] {
  const stats = new Map<string | null, TopicStat>()
  for (const detail of details) {
    const topic = detail.question_topic?.trim() || null
    const stat = stats.get(topic) ?? { topic, correct: 0, answered: 0 }
    stat.answered += 1
    if (detail.is_correct) stat.correct += 1
    stats.set(topic, stat)
  }
  return [...stats.values()].sort((a, b) => a.correct / a.answered - b.correct / b.answered)
}

/** A pool question for QuestionCard: the answer key, no child's pick. */
export function poolQuestion(question: ExamQuestion): SittingQuestion {
  return {
    number: question.question_number,
    type: question.question_type,
    name: question.question_name,
    topic: question.question_topic,
    grade: question.question_grade,
    answers: question.answers ?? [],
    rightLabel: question.right_answer_label,
    rightContent: question.right_answer_content,
    outcome: 'key',
  }
}
