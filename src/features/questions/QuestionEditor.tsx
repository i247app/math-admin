import { PlusIcon, Trash2Icon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { gradeLabel } from '@/features/exams/ExamHelpers'
import type { QuestionKind } from '@/types/Question'
import { QUESTION_GRADES, QUESTION_KINDS, QUESTION_LEVELS } from '@/types/Question'
import { cn } from '@/utils/Helpers'
import type { DraftErrorKey, DraftErrors, DraftOption, QuestionDraft } from './QuestionDraft'
import { hasOptions, nextOptionId, QUESTION_LIMITS, withKind } from './QuestionDraft'
import { QuestionImagePicker } from './QuestionImagePicker'

const NO_LEVEL = 'none'

export type DraftPatch = (change: (current: QuestionDraft) => QuestionDraft) => void

type QuestionEditorProps = {
  draft: QuestionDraft
  /** null = nothing to show (before the first Save, or a valid draft). */
  errors: DraftErrors | null
  /**
   * Functional, so an image upload that finishes later patches the draft it was started
   * for — even after the admin moved to another question.
   */
  onPatch: DraftPatch
  autoFocus?: boolean
}

/** Every editable field of one question: kind, text, image, the answer, classification. */
export function QuestionEditor({ draft, errors, onPatch: patch, autoFocus }: QuestionEditorProps) {
  const { t } = useTranslation()
  const patchOption = (id: string, change: Partial<DraftOption>) =>
    patch((d) => ({ ...d, options: d.options.map((o) => (o.id === id ? { ...o, ...change } : o)) }))
  const errorText = (key: DraftErrorKey | undefined) =>
    key ? t(`questions.form.errors.${key}`, { ...QUESTION_LIMITS }) : undefined
  const choice = hasOptions(draft.kind)

  return (
    <>
      <Section title={t('questions.form.sections.question')}>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="grade" label={t('questions.form.grade')} error={errorText(errors?.grade)}>
            <Select
              value={draft.grade === null ? '' : String(draft.grade)}
              onValueChange={(value) => patch((d) => ({ ...d, grade: Number(value) }))}
            >
              <SelectTrigger id="grade" aria-invalid={!!errors?.grade} className="h-11 w-full rounded-xl">
                <SelectValue placeholder={t('questions.form.gradePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {QUESTION_GRADES.map((grade) => (
                  <SelectItem key={grade} value={String(grade)}>
                    {gradeLabel(t, grade)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="level" label={t('questions.form.level')} hint={t('questions.form.levelHint')}>
            <Select
              value={draft.level === null ? NO_LEVEL : String(draft.level)}
              onValueChange={(value) => patch((d) => ({ ...d, level: value === NO_LEVEL ? null : Number(value) }))}
            >
              <SelectTrigger id="level" aria-describedby="level-hint" className="h-11 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LEVEL}>{t('questions.form.noLevel')}</SelectItem>
                {QUESTION_LEVELS.map((level) => (
                  <SelectItem key={level} value={String(level)}>
                    {t('exams.level', { level })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="subLevel" label={t('questions.form.subLevel')} hint={t('questions.form.subLevelHint')}>
            <Select
              value={draft.subLevel === null ? NO_LEVEL : String(draft.subLevel)}
              onValueChange={(value) => patch((d) => ({ ...d, subLevel: value === NO_LEVEL ? null : Number(value) }))}
            >
              <SelectTrigger id="subLevel" aria-describedby="subLevel-hint" className="h-11 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LEVEL}>{t('questions.form.noLevel')}</SelectItem>
                {QUESTION_LEVELS.map((level) => (
                  <SelectItem key={level} value={String(level)}>
                    {t('questions.subLevelValue', { level })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <FormField id="kind" label={t('questions.form.kind')} hint={t(`questions.kindHints.${draft.kind}`)}>
          <Select value={draft.kind} onValueChange={(value) => patch((d) => withKind(d, value as QuestionKind))}>
            <SelectTrigger id="kind" aria-describedby="kind-hint" className="h-11 w-60 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {t(`questions.kinds.${kind}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField
          id="text"
          label={t('questions.form.text')}
          error={errorText(errors?.text)}
          hint={t('questions.form.count', { n: Array.from(draft.text.trim()).length, max: QUESTION_LIMITS.text })}
        >
          <Textarea
            id="text"
            value={draft.text}
            autoFocus={autoFocus}
            rows={3}
            aria-invalid={!!errors?.text}
            aria-describedby={errors?.text ? 'text-error' : 'text-hint'}
            onChange={(event) => patch((d) => ({ ...d, text: event.target.value }))}
            className="rounded-xl text-base"
          />
        </FormField>

        <div className="flex flex-col gap-2">
          <Label className="font-semibold">{t('questions.form.image')}</Label>
          <QuestionImagePicker
            imageKey={draft.imageKey}
            imageUrl={draft.imageUrl}
            label={t('questions.form.image')}
            onChange={(imageKey, imageUrl) => patch((d) => ({ ...d, imageKey, imageUrl }))}
          />
        </div>
      </Section>

      <Section title={t('questions.form.sections.answer')}>
        {choice ? (
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2 text-[13px] text-muted-foreground">
              {t(draft.kind === 'SINGLE_CHOICE' ? 'questions.form.pickOne' : 'questions.form.pickMany')}
            </legend>
            <OptionList
              draft={draft}
              optionErrors={errors?.options}
              errorText={errorText}
              onPatch={patch}
              onPatchOption={patchOption}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-max"
              disabled={draft.options.length >= QUESTION_LIMITS.maxOptions}
              onClick={() =>
                patch((d) => ({
                  ...d,
                  options: [...d.options, { id: nextOptionId(d.options), text: '', imageKey: null, imageUrl: null }],
                }))
              }
            >
              <PlusIcon aria-hidden />
              {t('questions.form.addOption', { max: QUESTION_LIMITS.maxOptions })}
            </Button>
            {(errors?.optionList || errors?.answer) && (
              <p role="alert" className="text-[13px] font-medium text-destructive">
                {errorText(errors.optionList ?? errors.answer)}
              </p>
            )}
          </fieldset>
        ) : draft.kind === 'NUMERIC_INPUT' ? (
          <NumberList
            draft={draft}
            numberErrors={errors?.numbers}
            answerError={errorText(errors?.answer)}
            errorText={errorText}
            onPatch={patch}
          />
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] text-muted-foreground">{t('questions.form.pickTrueFalse')}</legend>
            <RadioGroup
              value={draft.value === null ? '' : String(draft.value)}
              onValueChange={(value) => patch((d) => ({ ...d, value: value === 'true' }))}
              className="flex gap-3"
            >
              {(['true', 'false'] as const).map((value) => (
                <Label
                  key={value}
                  className={cn(
                    'flex h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-4 font-semibold',
                    String(draft.value) === value && 'border-success bg-success-surface text-success',
                  )}
                >
                  <RadioGroupItem value={value} aria-label={t(`questions.trueFalse.${value}`)} />
                  {t(`questions.trueFalse.${value}`)}
                </Label>
              ))}
            </RadioGroup>
            {errors?.answer && (
              <p role="alert" className="text-[13px] font-medium text-destructive">
                {errorText(errors.answer)}
              </p>
            )}
          </fieldset>
        )}
      </Section>

      <Section title={t('questions.form.sections.classify')}>
        <FormField
          id="topic"
          label={t('questions.form.topic')}
          error={errorText(errors?.topic)}
          hint={t('questions.form.optional')}
        >
          <Input
            id="topic"
            value={draft.topic}
            aria-invalid={!!errors?.topic}
            aria-describedby={errors?.topic ? 'topic-error' : 'topic-hint'}
            onChange={(event) => patch((d) => ({ ...d, topic: event.target.value }))}
            className="h-11 rounded-xl"
          />
        </FormField>

        <FormField
          id="tags"
          label={t('questions.form.tags')}
          error={errorText(errors?.tags)}
          hint={t('questions.form.tagsHint', { max: QUESTION_LIMITS.tags })}
        >
          <Input
            id="tags"
            value={draft.tags}
            autoComplete="off"
            aria-invalid={!!errors?.tags}
            aria-describedby={errors?.tags ? 'tags-error' : 'tags-hint'}
            onChange={(event) => patch((d) => ({ ...d, tags: event.target.value }))}
            className="h-11 rounded-xl"
          />
        </FormField>

        <FormField
          id="explanation"
          label={t('questions.form.explanation')}
          error={errorText(errors?.explanation)}
          hint={t('questions.form.explanationHint')}
        >
          <Textarea
            id="explanation"
            value={draft.explanation}
            rows={3}
            aria-invalid={!!errors?.explanation}
            aria-describedby={errors?.explanation ? 'explanation-error' : 'explanation-hint'}
            onChange={(event) => patch((d) => ({ ...d, explanation: event.target.value }))}
            className="rounded-xl"
          />
        </FormField>
      </Section>
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}

type OptionListProps = {
  draft: QuestionDraft
  optionErrors: Record<string, DraftErrorKey> | undefined
  errorText: (key: DraftErrorKey | undefined) => string | undefined
  onPatch: DraftPatch
  onPatchOption: (id: string, change: Partial<DraftOption>) => void
}

/** Choice options in display order; the marker on the left sets the key (radio = one, checkbox = several). */
function OptionList({ draft, optionErrors, errorText, onPatch, onPatchOption }: OptionListProps) {
  const { t } = useTranslation()
  const single = draft.kind === 'SINGLE_CHOICE'
  const canRemove = draft.options.length > QUESTION_LIMITS.minOptions

  const rows = draft.options.map((option, index) => {
    const correct = draft.correctIds.includes(option.id)
    const error = optionErrors?.[option.id]
    const label = t('questions.form.option', { id: option.id })
    return (
      <div key={option.id} className="flex flex-col gap-1">
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-xl border p-2 pl-3 transition-colors',
            correct && 'border-success bg-success-surface/60',
          )}
        >
          {single ? (
            <RadioGroupItem value={option.id} aria-label={t('questions.form.markCorrect', { id: option.id })} />
          ) : (
            <input
              type="checkbox"
              checked={correct}
              aria-label={t('questions.form.markCorrect', { id: option.id })}
              onChange={(event) =>
                onPatch((d) => ({
                  ...d,
                  correctIds: event.target.checked
                    ? [...d.correctIds, option.id]
                    : d.correctIds.filter((id) => id !== option.id),
                }))
              }
              className="size-4 shrink-0 accent-primary"
            />
          )}
          <span
            aria-hidden
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-sm font-bold',
              correct && 'bg-success text-primary-foreground',
            )}
          >
            {option.id}
          </span>
          <Input
            value={option.text}
            placeholder={t('questions.form.optionPlaceholder', { n: index + 1 })}
            aria-label={label}
            aria-invalid={!!error}
            onChange={(event) => onPatchOption(option.id, { text: event.target.value })}
            className="h-10 rounded-lg bg-background"
          />
          <QuestionImagePicker
            compact
            imageKey={option.imageKey}
            imageUrl={option.imageUrl}
            label={label}
            onChange={(imageKey, imageUrl) => onPatchOption(option.id, { imageKey, imageUrl })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
            disabled={!canRemove}
            aria-label={t('questions.form.removeOption', { id: option.id })}
            onClick={() =>
              onPatch((d) => ({
                ...d,
                options: d.options.filter((o) => o.id !== option.id),
                correctIds: d.correctIds.filter((id) => id !== option.id),
              }))
            }
          >
            <Trash2Icon className="size-4" aria-hidden />
          </Button>
        </div>
        {error && <span className="pl-3 text-[13px] font-medium text-destructive">{errorText(error)}</span>}
      </div>
    )
  })

  return single ? (
    <RadioGroup
      value={draft.correctIds[0] ?? ''}
      onValueChange={(id) => onPatch((d) => ({ ...d, correctIds: [id] }))}
      className="flex flex-col gap-2"
    >
      {rows}
    </RadioGroup>
  ) : (
    <div className="flex flex-col gap-2">{rows}</div>
  )
}

type NumberListProps = {
  draft: QuestionDraft
  numberErrors: Record<number, DraftErrorKey> | undefined
  answerError: string | undefined
  errorText: (key: DraftErrorKey | undefined) => string | undefined
  onPatch: DraftPatch
}

/** NUMERIC_INPUT key: every number the child may type to be right, one per row. */
function NumberList({ draft, numberErrors, answerError, errorText, onPatch }: NumberListProps) {
  const { t } = useTranslation()
  const setNumbers = (change: (numbers: string[]) => string[]) => onPatch((d) => ({ ...d, numbers: change(d.numbers) }))

  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2 text-[13px] text-muted-foreground">{t('questions.form.pickNumbers')}</legend>
      {draft.numbers.map((value, index) => {
        const error = numberErrors?.[index]
        return (
          <div key={index} className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success text-sm font-bold text-primary-foreground"
              >
                {index + 1}
              </span>
              <Input
                value={value}
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                maxLength={QUESTION_LIMITS.numberLength}
                placeholder={t('questions.form.numberPlaceholder')}
                aria-label={t('questions.form.number', { n: index + 1 })}
                aria-invalid={!!error}
                onChange={(event) =>
                  setNumbers((numbers) => numbers.map((item, i) => (i === index ? event.target.value : item)))
                }
                className="h-10 max-w-60 rounded-lg font-mono"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                disabled={draft.numbers.length === 1}
                aria-label={t('questions.form.removeNumber', { n: index + 1 })}
                onClick={() => setNumbers((numbers) => numbers.filter((_, i) => i !== index))}
              >
                <Trash2Icon className="size-4" aria-hidden />
              </Button>
            </div>
            {error && <span className="pl-10 text-[13px] font-medium text-destructive">{errorText(error)}</span>}
          </div>
        )
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-max"
        disabled={draft.numbers.length >= QUESTION_LIMITS.maxNumbers}
        onClick={() => setNumbers((numbers) => [...numbers, ''])}
      >
        <PlusIcon aria-hidden />
        {t('questions.form.addNumber', { max: QUESTION_LIMITS.maxNumbers })}
      </Button>
      {answerError && (
        <p role="alert" className="text-[13px] font-medium text-destructive">
          {answerError}
        </p>
      )}
    </fieldset>
  )
}
