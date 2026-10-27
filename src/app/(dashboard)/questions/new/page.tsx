import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'
import { CircleAlertIcon, CopyIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useBlocker, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { FormAlert } from '@/components/FormAlert'
import { Button } from '@/components/ui/button'
import { TitleBar } from '@/features/dashboard/TitleBar'
import { BackLink } from '@/features/exams/ExamNav'
import { ConfirmActionDialog } from '@/features/system/ConfirmActionDialog'
import { QuestionKindBadge } from '@/features/questions/QuestionBadges'
import type { QuestionDraft } from '@/features/questions/QuestionDraft'
import { emptyDraft, toInput, validateDraft } from '@/features/questions/QuestionDraft'
import type { DraftPatch } from '@/features/questions/QuestionEditor'
import { QuestionEditor } from '@/features/questions/QuestionEditor'
import {
  createQuestions,
  MAX_QUESTIONS_PER_CREATE,
  questionImageUploadKey,
  questionsQueryKey,
  rejectedIndexes,
} from '@/features/questions/QuestionsApi'
import { getErrorMessage } from '@/libs/ApiClient'
import type { QuestionInput } from '@/types/Question'
import { QUESTION_GRADES } from '@/types/Question'
import { cn } from '@/utils/Helpers'

/** One question being written; `key` is local (React key + selection), never sent. */
type Slide = { key: string; draft: QuestionDraft }

let slideCounter = 0
const newSlide = (draft: QuestionDraft): Slide => ({ key: `slide-${++slideCounter}`, draft })

/** Anything typed worth asking about before it is thrown away. */
function hasContent(draft: QuestionDraft) {
  return Boolean(
    draft.text.trim() ||
      draft.imageKey ||
      draft.options.some((option) => option.text.trim() || option.imageKey) ||
      draft.topic.trim() ||
      draft.tags.trim() ||
      draft.explanation.trim(),
  )
}

/**
 * Writes several questions and stores them in one /question-pools/create call (all or none).
 * Left: the questions as slides, top to bottom; right: the selected one's editor.
 */
export default function NewQuestionsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  // The list's grade filter pre-fills the first question.
  const grade = QUESTION_GRADES.find((option) => String(option) === params.get('grade')) ?? null

  const [slides, setSlides] = useState<Slide[]>(() => [newSlide(emptyDraft({ grade }))])
  const [selectedKey, setSelectedKey] = useState(slides[0].key)
  // Errors show after the first Save and then follow every edit.
  const [submitted, setSubmitted] = useState(false)
  /** Questions the server named when it refused the batch; cleared once edited. */
  const [rejected, setRejected] = useState<ReadonlySet<string>>(new Set())
  const [removeKey, setRemoveKey] = useState<string | null>(null)
  const uploading = useIsMutating({ mutationKey: questionImageUploadKey }) > 0

  const selectedIndex = Math.max(0, slides.findIndex((slide) => slide.key === selectedKey))
  const selected = slides[selectedIndex]
  const invalid = (slide: Slide) => (submitted && validateDraft(slide.draft) !== null) || rejected.has(slide.key)

  // Leaving with typed questions asks first; reload / tab close gets the browser's prompt.
  const savedRef = useRef(false)
  const dirty = slides.length > 1 || hasContent(slides[0].draft)
  const blocker = useBlocker(() => dirty && !savedRef.current)
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const save = useMutation({
    // The keys travel with the request so a refusal maps back to the slides that were sent.
    mutationFn: ({ inputs }: { inputs: QuestionInput[]; keys: string[] }) => createQuestions(inputs),
    meta: { silentError: true },
    onSuccess: (created) => {
      savedRef.current = true
      void queryClient.invalidateQueries({ queryKey: questionsQueryKey })
      toast.success(t('questions.new.created', { count: created.length }))
      void navigate('/questions')
    },
    onError: (error, { keys }) => {
      const named = rejectedIndexes(error).flatMap((index) => (keys[index] ? [keys[index]] : []))
      setRejected(new Set(named))
      if (named[0]) setSelectedKey(named[0])
    },
  })

  const patchSlide =
    (key: string): DraftPatch =>
    (change) => {
      setSlides((current) => current.map((slide) => (slide.key === key ? { ...slide, draft: change(slide.draft) } : slide)))
      setRejected((current) => {
        if (!current.has(key)) return current
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }

  /** Inserts after the selected question and selects it. */
  function insertAfterSelected(slide: Slide) {
    setSlides((current) => {
      const at = current.findIndex((s) => s.key === selectedKey) + 1
      return [...current.slice(0, at), slide, ...current.slice(at)]
    })
    setSelectedKey(slide.key)
  }

  /** A new question keeps the selected one's grade, level, topic and tags: a batch usually shares them. */
  function addSlide() {
    const base = selected.draft
    insertAfterSelected(
      newSlide({ ...emptyDraft({ grade: base.grade }), level: base.level, topic: base.topic, tags: base.tags }),
    )
  }

  function duplicateSlide() {
    const draft = selected.draft
    insertAfterSelected(newSlide({ ...draft, options: draft.options.map((option) => ({ ...option })) }))
  }

  function removeSlide(key: string) {
    const index = slides.findIndex((slide) => slide.key === key)
    const rest = slides.filter((slide) => slide.key !== key)
    setSlides(rest)
    if (key === selectedKey) setSelectedKey(rest[Math.min(index, rest.length - 1)].key)
    setRemoveKey(null)
  }

  function handleSave() {
    setSubmitted(true)
    const firstInvalid = slides.find((slide) => validateDraft(slide.draft) !== null)
    if (firstInvalid) {
      setSelectedKey(firstInvalid.key)
      toast.error(t('questions.new.fixFirst', { count: slides.filter((slide) => validateDraft(slide.draft)).length }))
      return
    }
    save.mutate({ inputs: slides.map((slide) => toInput(slide.draft)), keys: slides.map((slide) => slide.key) })
  }

  const full = slides.length >= MAX_QUESTIONS_PER_CREATE

  return (
    <>
      <BackLink to="/questions">{t('questions.new.back')}</BackLink>
      <TitleBar
        title={t('questions.new.title')}
        description={t('questions.new.description', { max: MAX_QUESTIONS_PER_CREATE })}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" className="h-11 rounded-xl px-4.5">
              <Link to="/questions">{t('common.cancel')}</Link>
            </Button>
            <Button className="h-11 rounded-xl px-4.5" onClick={handleSave} disabled={save.isPending || uploading}>
              {save.isPending
                ? t('common.saving')
                : uploading
                  ? t('questions.image.uploading')
                  : t('questions.new.save', { count: slides.length })}
            </Button>
          </div>
        }
      />

      {save.isError && (
        <FormAlert>
          <span className="block">{getErrorMessage(save.error)}</span>
          {rejected.size > 0 && <span className="block">{t('questions.new.rejectedHint', { count: rejected.size })}</span>}
        </FormAlert>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside
          aria-label={t('questions.new.listLabel')}
          className="flex flex-col overflow-hidden rounded-2xl border bg-card lg:sticky lg:top-4"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <strong className="font-semibold">{t('questions.new.listLabel')}</strong>
            <span className="text-sm text-muted-foreground">
              {slides.length} / {MAX_QUESTIONS_PER_CREATE}
            </span>
          </div>
          <ol className="flex max-h-[40vh] flex-col gap-2 overflow-y-auto p-3 lg:max-h-[calc(100vh-300px)]">
            {slides.map((slide, index) => (
              <li key={slide.key}>
                <SlideCard
                  slide={slide}
                  number={index + 1}
                  active={slide.key === selected.key}
                  invalid={invalid(slide)}
                  onSelect={() => setSelectedKey(slide.key)}
                />
              </li>
            ))}
          </ol>
          <div className="border-t p-3">
            <Button variant="outline" className="w-full" onClick={addSlide} disabled={full}>
              <PlusIcon aria-hidden />
              {full ? t('questions.new.full', { max: MAX_QUESTIONS_PER_CREATE }) : t('questions.new.add')}
            </Button>
          </div>
        </aside>

        <section aria-labelledby="question-heading" className="rounded-2xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-6 py-4">
            <h2 id="question-heading" className="text-lg font-bold">
              {t('questions.new.heading', { number: selectedIndex + 1, total: slides.length })}
            </h2>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={duplicateSlide} disabled={full}>
                <CopyIcon aria-hidden />
                {t('questions.new.duplicate')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="hover:text-destructive"
                disabled={slides.length === 1}
                onClick={() => (hasContent(selected.draft) ? setRemoveKey(selected.key) : removeSlide(selected.key))}
              >
                <Trash2Icon aria-hidden />
                {t('questions.new.remove')}
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-6 p-6">
            {rejected.has(selected.key) && <FormAlert>{t('questions.new.rejectedHere')}</FormAlert>}
            {/* Keyed so focus and field ids start fresh per question. */}
            <QuestionEditor
              key={selected.key}
              draft={selected.draft}
              errors={submitted ? validateDraft(selected.draft) : null}
              onPatch={patchSlide(selected.key)}
              autoFocus
            />
          </div>
        </section>
      </div>

      <ConfirmActionDialog
        open={removeKey !== null}
        onClose={() => setRemoveKey(null)}
        title={t('questions.new.removeTitle', {
          number: slides.findIndex((slide) => slide.key === removeKey) + 1,
        })}
        description={t('questions.new.removeDescription')}
        confirmLabel={t('questions.new.remove')}
        pendingLabel={t('questions.new.remove')}
        pending={false}
        error={null}
        onConfirm={() => removeKey && removeSlide(removeKey)}
      />
      <ConfirmActionDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        title={t('questions.new.leaveTitle')}
        description={t('questions.new.leaveDescription', { count: slides.length })}
        confirmLabel={t('questions.new.leave')}
        pendingLabel={t('questions.new.leave')}
        pending={false}
        error={null}
        onConfirm={() => blocker.proceed?.()}
      />
    </>
  )
}

type SlideCardProps = { slide: Slide; number: number; active: boolean; invalid: boolean; onSelect: () => void }

/** A question in the left list: number, kind, the start of its text, its image. */
function SlideCard({ slide, number, active, invalid, onSelect }: SlideCardProps) {
  const { t } = useTranslation()
  const { draft } = slide
  const text = draft.text.trim()
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      aria-label={t('questions.new.slideLabel', {
        number,
        text: text || t('questions.new.untitled'),
        status: invalid ? ` (${t('questions.new.needsFix')})` : '',
      })}
      className={cn(
        'flex w-full gap-3 rounded-xl border p-3 text-left transition-colors hover:border-primary/50',
        active && 'border-primary bg-accent/60 ring-1 ring-primary',
        invalid && 'border-destructive',
      )}
    >
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold',
          active && 'bg-primary text-primary-foreground',
          invalid && 'bg-destructive text-primary-foreground',
        )}
      >
        {number}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-center gap-1.5">
          <QuestionKindBadge kind={draft.kind} />
          {invalid && (
            <span className="flex items-center gap-1 text-xs font-semibold text-destructive">
              <CircleAlertIcon className="size-3.5" aria-hidden />
              {t('questions.new.needsFix')}
            </span>
          )}
        </span>
        <span className={cn('line-clamp-2 text-sm', !text && 'text-muted-foreground italic')}>
          {text || t('questions.new.untitled')}
        </span>
      </span>
      {draft.imageUrl && <img src={draft.imageUrl} alt="" className="size-10 shrink-0 rounded-lg border object-cover" />}
    </button>
  )
}
