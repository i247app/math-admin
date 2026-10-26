/**
 * The question editor's form state, its mapping to the wire shape, and the checks of
 * math-svr internal/module/question/validator.go + internal/domain/question/rules.go.
 * The server re-checks everything; these only catch mistakes before the round trip.
 */
import type { Question, QuestionInput, QuestionKind } from '@/types/Question'

/** Limits of validator.go, counted in characters (utf8.RuneCountInString). */
export const QUESTION_LIMITS = {
  text: 2000,
  optionText: 500,
  explanation: 5000,
  topic: 255,
  tags: 20,
  tagLength: 64,
  minOptions: 2,
  maxOptions: 10,
  /** MaxNumericValues / MaxNumberLen in internal/domain/question/numeric.go. */
  maxNumbers: 10,
  numberLength: 32,
} as const

export type DraftOption = { id: string; text: string; imageKey: string | null; imageUrl: string | null }

export type QuestionDraft = {
  kind: QuestionKind
  text: string
  imageKey: string | null
  imageUrl: string | null
  /** Kept while the kind has no options (not sent), so switching back restores them. */
  options: DraftOption[]
  /** Correct option ids (choice kinds). */
  correctIds: string[]
  /** TRUE_FALSE key; null = not picked yet. */
  value: boolean | null
  /** NUMERIC_INPUT key: the accepted answers as typed, one per row (blank rows are not sent). */
  numbers: string[]
  grade: number | null
  level: number | null
  topic: string
  /** Comma-separated in the form. */
  tags: string
  explanation: string
}

/** Kind.HasOptions in kind.go: only the choice kinds carry options. */
export function hasOptions(kind: QuestionKind) {
  return kind === 'SINGLE_CHOICE' || kind === 'MULTIPLE_CHOICE'
}

/** First free id a, b, c… — ids never change once written, so new options take an unused one. */
export function nextOptionId(options: DraftOption[]) {
  const used = new Set(options.map((option) => option.id))
  for (let code = 97; code <= 122; code++) {
    const id = String.fromCharCode(code)
    if (!used.has(id)) return id
  }
  return `o${options.length + 1}`
}

export function emptyOptions(count = 4): DraftOption[] {
  const options: DraftOption[] = []
  while (options.length < count) options.push({ id: nextOptionId(options), text: '', imageKey: null, imageUrl: null })
  return options
}

export function emptyDraft(defaults: { grade?: number | null } = {}): QuestionDraft {
  return {
    kind: 'SINGLE_CHOICE',
    text: '',
    imageKey: null,
    imageUrl: null,
    options: emptyOptions(),
    correctIds: [],
    value: null,
    numbers: [''],
    grade: defaults.grade ?? null,
    level: null,
    topic: '',
    tags: '',
    explanation: '',
  }
}

export function draftOf(question: Question): QuestionDraft {
  return {
    kind: question.question_kind,
    text: question.question_text,
    imageKey: question.question_image_key,
    imageUrl: question.question_image_url,
    options: (question.options ?? []).map((option) => ({
      id: option.id,
      text: option.text,
      imageKey: option.image_key ?? null,
      imageUrl: option.image_url ?? null,
    })),
    correctIds: question.correct_answer.option_ids ?? [],
    value: question.correct_answer.value ?? null,
    numbers: question.correct_answer.values?.length ? question.correct_answer.values : [''],
    grade: question.question_grade,
    level: question.question_level,
    topic: question.question_topic ?? '',
    tags: question.question_tags.join(', '),
    explanation: question.explanation ?? '',
  }
}

/** Changing the kind keeps what still fits (every key part stays in the draft); a single choice keeps only the first correct option. */
export function withKind(draft: QuestionDraft, kind: QuestionKind): QuestionDraft {
  const options = hasOptions(kind) && draft.options.length < QUESTION_LIMITS.minOptions ? emptyOptions() : draft.options
  const correctIds = kind === 'SINGLE_CHOICE' ? draft.correctIds.slice(0, 1) : draft.correctIds
  return { ...draft, kind, options, correctIds }
}

/** cleanTags in validator.go: trimmed, blanks and repeats dropped. */
export function parseTags(value: string): string[] {
  return [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))]
}

const blankToNull = (value: string) => value.trim() || null

/** The accepted numbers that will be sent: trimmed, blank rows dropped. */
export function filledNumbers(draft: QuestionDraft) {
  return draft.numbers.map((value) => value.trim()).filter(Boolean)
}

function answerOf(draft: QuestionDraft): QuestionInput['correct_answer'] {
  switch (draft.kind) {
    case 'SINGLE_CHOICE':
    case 'MULTIPLE_CHOICE':
      // Option ids in display order, so an unchanged key compares equal.
      return { option_ids: draft.options.filter((option) => draft.correctIds.includes(option.id)).map((option) => option.id) }
    case 'TRUE_FALSE':
      return { value: draft.value ?? undefined }
    case 'NUMERIC_INPUT':
      // Sent as typed; the server stores the canonical form ("0,50" → "0.5").
      return { values: filledNumbers(draft) }
  }
}

/** A number as ParseNumber in numeric.go reads it: integer, decimal ("." or ","), or a/b. */
const NUMBER_PATTERN = /^(-?)(\d+)(?:[.,](\d+)|\/(\d+))?$/

/** The exact value as numerator / denominator, or null when the server would refuse it. */
export function parseNumber(value: string): { num: bigint; den: bigint } | null {
  const text = value.trim()
  if (Array.from(text).length > QUESTION_LIMITS.numberLength) return null
  const match = NUMBER_PATTERN.exec(text)
  if (!match) return null
  const [, sign, whole, frac, den] = match
  let num: bigint
  let denominator: bigint
  if (den !== undefined) {
    num = BigInt(whole)
    denominator = BigInt(den)
    if (denominator === 0n) return null
  } else {
    num = BigInt(whole + (frac ?? ''))
    denominator = 10n ** BigInt(frac?.length ?? 0)
  }
  return { num: sign === '-' ? -num : num, den: denominator }
}

/** The wire shape; grade must be set (validateDraft checks it first). */
export function toInput(draft: QuestionDraft): QuestionInput {
  const choice = hasOptions(draft.kind)
  return {
    question_kind: draft.kind,
    question_text: draft.text.trim(),
    question_image_key: draft.imageKey,
    options: choice
      ? draft.options.map((option) => ({ id: option.id, text: option.text.trim(), image_key: option.imageKey ?? undefined }))
      : null,
    correct_answer: answerOf(draft),
    explanation: blankToNull(draft.explanation),
    question_grade: draft.grade ?? 0,
    question_topic: blankToNull(draft.topic),
    question_level: draft.level,
    question_tags: parseTags(draft.tags),
  }
}

export type DraftErrorKey =
  | 'textRequired'
  | 'textTooLong'
  | 'optionEmpty'
  | 'optionTooLong'
  | 'tooFewOptions'
  | 'answerSingle'
  | 'answerMultiple'
  | 'answerTrueFalse'
  | 'numbersRequired'
  | 'tooManyNumbers'
  | 'numberInvalid'
  | 'numberDuplicate'
  | 'gradeRequired'
  | 'topicTooLong'
  | 'explanationTooLong'
  | 'tooManyTags'
  | 'tagTooLong'

export type DraftErrors = {
  text?: DraftErrorKey
  /** By option id. */
  options?: Record<string, DraftErrorKey>
  optionList?: DraftErrorKey
  /** NUMERIC_INPUT: by row index. */
  numbers?: Record<number, DraftErrorKey>
  answer?: DraftErrorKey
  grade?: DraftErrorKey
  topic?: DraftErrorKey
  explanation?: DraftErrorKey
  tags?: DraftErrorKey
}

const chars = (value: string) => Array.from(value.trim()).length

/** null when the draft passes every check the server runs that needs no stored row. */
export function validateDraft(draft: QuestionDraft): DraftErrors | null {
  const errors: DraftErrors = {}

  if (!draft.text.trim()) errors.text = 'textRequired'
  else if (chars(draft.text) > QUESTION_LIMITS.text) errors.text = 'textTooLong'

  if (hasOptions(draft.kind)) {
    const optionErrors: Record<string, DraftErrorKey> = {}
    for (const option of draft.options) {
      if (!option.text.trim() && !option.imageKey) optionErrors[option.id] = 'optionEmpty'
      else if (chars(option.text) > QUESTION_LIMITS.optionText) optionErrors[option.id] = 'optionTooLong'
    }
    if (Object.keys(optionErrors).length > 0) errors.options = optionErrors
    if (draft.options.length < QUESTION_LIMITS.minOptions) errors.optionList = 'tooFewOptions'

    const picked = draft.options.filter((option) => draft.correctIds.includes(option.id)).length
    if (draft.kind === 'SINGLE_CHOICE' && picked !== 1) errors.answer = 'answerSingle'
    if (draft.kind === 'MULTIPLE_CHOICE' && picked < 1) errors.answer = 'answerMultiple'
  } else if (draft.kind === 'TRUE_FALSE') {
    if (draft.value === null) errors.answer = 'answerTrueFalse'
  } else {
    // NormalizeNumbers: 1..10 values, each a number, no two equal as numbers ("0.5" = "1/2").
    const filled = filledNumbers(draft)
    if (filled.length === 0) errors.answer = 'numbersRequired'
    else if (filled.length > QUESTION_LIMITS.maxNumbers) errors.answer = 'tooManyNumbers'
    const numberErrors: Record<number, DraftErrorKey> = {}
    const seen: { num: bigint; den: bigint }[] = []
    draft.numbers.forEach((value, index) => {
      if (!value.trim()) return
      const parsed = parseNumber(value)
      if (!parsed) numberErrors[index] = 'numberInvalid'
      else if (seen.some((other) => other.num * parsed.den === parsed.num * other.den)) numberErrors[index] = 'numberDuplicate'
      else seen.push(parsed)
    })
    if (Object.keys(numberErrors).length > 0) errors.numbers = numberErrors
  }

  if (draft.grade === null) errors.grade = 'gradeRequired'
  if (chars(draft.topic) > QUESTION_LIMITS.topic) errors.topic = 'topicTooLong'
  if (chars(draft.explanation) > QUESTION_LIMITS.explanation) errors.explanation = 'explanationTooLong'

  const tags = parseTags(draft.tags)
  if (tags.length > QUESTION_LIMITS.tags) errors.tags = 'tooManyTags'
  else if (tags.some((tag) => chars(tag) > QUESTION_LIMITS.tagLength)) errors.tags = 'tagTooLong'

  return Object.keys(errors).length > 0 ? errors : null
}
