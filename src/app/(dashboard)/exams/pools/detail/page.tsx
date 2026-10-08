import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckIcon, InfoIcon, PencilIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useBlocker, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { LoadError } from '@/components/LoadError'
import { StatusPill } from '@/components/StatusPill'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { TitleBar } from '@/features/dashboard/TitleBar'
import { ExamTypeBadge, VerifiedPill } from '@/features/exams/ExamBadges'
import { gradeLevelLabel, poolQuestion, positiveIntParam } from '@/features/exams/ExamHelpers'
import { BackLink, InvalidLink } from '@/features/exams/ExamNav'
import type { DraftQuestion } from '@/features/exams/ExamPoolDraft'
import { isChanged, questionErrors, toDraft, toVerifyQuestions } from '@/features/exams/ExamPoolDraft'
import {
  EXAM_POOLS_PATH,
  examPoolDetailQueryOptions,
  markExamPoolVerify,
  storeExamPool,
  verifyExamPool,
} from '@/features/exams/ExamPoolsApi'
import { PoolQuestionEditor } from '@/features/exams/PoolQuestionEditor'
import { QuestionCard } from '@/features/exams/QuestionCard'
import { MetaRow } from '@/features/exams/StatTiles'
import { ConfirmActionDialog } from '@/features/system/ConfirmActionDialog'
import type { ExamQuestion } from '@/types/Exam'
import { formatServerTime } from '@/utils/Helpers'

/** Snapshot taken when editing starts, so a background refetch cannot move the questions under the form. */
type EditState = { originals: ExamQuestion[]; drafts: DraftQuestion[] }

/** One pool set with its answer key: mark it verified, or fix its questions and verify. */
export default function ExamPoolDetailPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const examId = positiveIntParam(params.get('exam'))
  const detail = useQuery({ ...examPoolDetailQueryOptions(examId ?? 0), enabled: examId !== null })
  const [unmarkOpen, setUnmarkOpen] = useState(false)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [confirm, setConfirm] = useState<'save' | 'discard' | null>(null)

  const changed = edit
    ? edit.originals.filter((question, index) => isChanged(question, edit.drafts[index])).map((q) => q.question_number)
    : []
  const errors = edit ? edit.drafts.map(questionErrors) : []
  const errorCount = errors.filter((error) => error !== null).length
  const dirty = changed.length > 0

  // In-app navigation with unsaved changes asks first; reload / tab close gets the browser's prompt.
  const blocker = useBlocker(dirty)
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const mark = useMutation({
    mutationFn: (id: number) => markExamPoolVerify(id, true),
    onSuccess: (pool) => {
      storeExamPool(queryClient, pool)
      toast.success(t('exams.pools.detail.marked', { id: pool.exam_id }))
    },
  })
  // Silent: the confirm dialogs show their own errors.
  const unmark = useMutation({
    mutationFn: (id: number) => markExamPoolVerify(id, false),
    meta: { silentError: true },
    onSuccess: (pool) => {
      storeExamPool(queryClient, pool)
      setUnmarkOpen(false)
      toast.success(t('exams.pools.detail.unmarked', { id: pool.exam_id }))
    },
  })
  const save = useMutation({
    mutationFn: ({ id, questions }: { id: number; questions: ExamQuestion[] }) => verifyExamPool(id, questions),
    meta: { silentError: true },
    onSuccess: (pool) => {
      storeExamPool(queryClient, pool)
      setEdit(null)
      setConfirm(null)
      toast.success(t('exams.pools.edit.saved', { id: pool.exam_id }))
    },
  })

  if (examId === null) {
    return (
      <InvalidLink
        message={t('exams.pools.detail.missing')}
        to={EXAM_POOLS_PATH}
        label={t('exams.pools.detail.backToPools')}
      />
    )
  }

  const pool = detail.data
  const questions = pool?.questions ?? []
  const editable = questions.length > 0 && questions.every((question) => (question.answers ?? []).length > 0)

  function closeConfirm() {
    setConfirm(null)
    save.reset()
  }

  let content: ReactNode
  if (detail.isError && !pool) {
    content = (
      <div className="flex flex-col gap-3">
        <LoadError
          title={t('exams.pools.detail.loadFailed')}
          error={detail.error}
          onRetry={() => void detail.refetch()}
          retrying={detail.isFetching}
        />
        <Button asChild variant="outline" className="self-start">
          <Link to={EXAM_POOLS_PATH}>{t('exams.pools.detail.backToPools')}</Link>
        </Button>
      </div>
    )
  } else if (!pool) {
    content = (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    )
  } else {
    content = (
      <>
        {edit && (
          <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm">
            <strong>{t('exams.pools.edit.bar', { id: pool.exam_id })}</strong>
            <StatusPill tone="info">{t('exams.pools.edit.changed', { count: changed.length })}</StatusPill>
            {errorCount > 0 && (
              <StatusPill tone="danger">{t('exams.pools.edit.errorCount', { count: errorCount })}</StatusPill>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={() => (dirty ? setConfirm('discard') : setEdit(null))}>
                {t('common.cancel')}
              </Button>
              <Button disabled={!dirty || errorCount > 0 || save.isPending} onClick={() => setConfirm('save')}>
                {t('exams.pools.edit.save')}
              </Button>
            </div>
          </div>
        )}
        <MetaRow
          items={[
            { label: t('exams.pools.detail.meta.gradeLevel'), value: gradeLevelLabel(t, pool.grade, pool.level) },
            {
              label: t('exams.pools.detail.meta.questions'),
              value: t('exams.pools.detail.meta.questionsValue', {
                actual: questions.length,
                requested: pool.num_questions,
              }),
            },
            { label: t('exams.pools.detail.meta.semester'), value: pool.semester || '—' },
            { label: t('exams.pools.detail.meta.program'), value: pool.program || '—' },
            { label: t('exams.pools.detail.meta.verifiedCount'), value: pool.verified_count },
            { label: t('exams.pools.detail.meta.created'), value: formatServerTime(pool.create_dt, i18n.language) },
            {
              label: t('exams.pools.detail.meta.cacheTag'),
              value: pool.req_extras ? <span className="font-mono text-[13px]">{pool.req_extras}</span> : '—',
            },
          ]}
        />
        {edit ? (
          <>
            <div role="note" className="flex items-start gap-2.5 rounded-xl bg-warning-surface px-4 py-3 text-sm text-warning">
              <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{t('exams.pools.edit.banner')}</span>
            </div>
            <div className="flex flex-col gap-3">
              {edit.originals.map((question, index) => (
                <PoolQuestionEditor
                  key={question.question_number}
                  question={question}
                  draft={edit.drafts[index]}
                  errors={errors[index]}
                  changed={changed.includes(question.question_number)}
                  poolGrade={pool.grade}
                  onChange={(draft) =>
                    setEdit((current) =>
                      current && { ...current, drafts: current.drafts.map((d, i) => (i === index ? draft : d)) },
                    )
                  }
                />
              ))}
            </div>
          </>
        ) : questions.length === 0 ? (
          <p className="rounded-2xl border bg-card px-5 py-8 text-center text-muted-foreground">
            {t('exams.pools.detail.empty')}
          </p>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">{t('exams.pools.detail.storedOrder')}</span>
            <div className="flex flex-col gap-3">
              {questions.map((question) => (
                <QuestionCard key={question.question_number} question={poolQuestion(question)} sittingGrade={pool.grade} />
              ))}
            </div>
          </>
        )}
      </>
    )
  }

  const editButton = (
    <Button
      className="h-11 rounded-xl px-4.5"
      disabled={!editable}
      aria-describedby={editable ? undefined : 'edit-blocked'}
      onClick={() => setEdit({ originals: questions, drafts: questions.map(toDraft) })}
    >
      <PencilIcon aria-hidden />
      {t('exams.pools.detail.edit')}
    </Button>
  )

  // Hidden while editing: the sticky bar holds the edit actions.
  const actions = pool && !edit && (
    <div className="flex flex-wrap gap-2">
      {pool.verified_count > 0 ? (
        <Button variant="outline" className="h-11 rounded-xl px-4.5" onClick={() => setUnmarkOpen(true)}>
          {t('exams.pools.detail.unmark')}
        </Button>
      ) : (
        <Button
          variant="outline"
          className="h-11 rounded-xl px-4.5"
          disabled={mark.isPending}
          onClick={() => mark.mutate(pool.exam_id)}
        >
          <CheckIcon aria-hidden />
          {mark.isPending ? t('common.saving') : t('exams.pools.detail.mark')}
        </Button>
      )}
      {editable ? (
        editButton
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>{editButton}</span>
          </TooltipTrigger>
          <TooltipContent>{t('exams.pools.detail.editBlocked')}</TooltipContent>
          {/* Tooltip content only exists while open; this keeps the reason for screen readers. */}
          <span id="edit-blocked" className="sr-only">
            {t('exams.pools.detail.editBlocked')}
          </span>
        </Tooltip>
      )}
    </div>
  )

  return (
    <>
      <BackLink to={EXAM_POOLS_PATH}>{t('exams.pools.detail.backToPools')}</BackLink>
      <TitleBar
        title={t('exams.pools.detail.heading', { id: examId })}
        description={
          pool && (
            <span className="flex flex-wrap items-center gap-2">
              <ExamTypeBadge type={pool.exam_type} />
              <VerifiedPill count={pool.verified_count} />
              {(pool.ai_title || pool.ai_short_text) && (
                <span>{[pool.ai_title, pool.ai_short_text].filter(Boolean).join(' — ')}</span>
              )}
            </span>
          )
        }
        actions={actions}
      />
      {content}

      {pool && (
        <ConfirmActionDialog
          open={unmarkOpen}
          onClose={() => {
            setUnmarkOpen(false)
            unmark.reset()
          }}
          title={t('exams.pools.detail.unmarkTitle', { id: pool.exam_id })}
          description={t('exams.pools.detail.unmarkDescription', { n: pool.verified_count })}
          confirmLabel={t('exams.pools.detail.unmark')}
          pendingLabel={t('exams.pools.detail.unmarking')}
          pending={unmark.isPending}
          error={unmark.error}
          onConfirm={() => unmark.mutate(pool.exam_id)}
        />
      )}
      {pool && edit && (
        <ConfirmActionDialog
          open={confirm === 'save'}
          onClose={closeConfirm}
          title={t('exams.pools.edit.confirmTitle', { id: pool.exam_id })}
          description={
            <>
              <p>
                {t('exams.pools.edit.confirmChanged', {
                  list: changed.map((number) => t('exams.question.number', { number })).join(', '),
                })}
              </p>
              <p>{t('exams.pools.edit.confirmLive')}</p>
              <p>{t('exams.pools.edit.confirmHistory')}</p>
              <p>{t('exams.pools.edit.confirmCount', { from: pool.verified_count, to: pool.verified_count + 1 })}</p>
            </>
          }
          confirmLabel={t('exams.pools.edit.save')}
          pendingLabel={t('exams.pools.edit.saving')}
          pending={save.isPending}
          error={save.error}
          onConfirm={() => save.mutate({ id: pool.exam_id, questions: toVerifyQuestions(edit.originals, edit.drafts) })}
        />
      )}
      <ConfirmActionDialog
        open={confirm === 'discard'}
        onClose={() => setConfirm(null)}
        title={t('exams.pools.edit.discardTitle')}
        description={t('exams.pools.edit.discardDescription')}
        confirmLabel={t('exams.pools.edit.discard')}
        pendingLabel={t('exams.pools.edit.discard')}
        pending={false}
        error={null}
        onConfirm={() => {
          setEdit(null)
          setConfirm(null)
        }}
      />
      <ConfirmActionDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        title={t('exams.pools.edit.leaveTitle')}
        description={t('exams.pools.edit.leaveDescription', { id: examId })}
        confirmLabel={t('exams.pools.edit.leave')}
        pendingLabel={t('exams.pools.edit.leave')}
        pending={false}
        error={null}
        onConfirm={() => blocker.proceed?.()}
      />
    </>
  )
}
