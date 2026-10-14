import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { FormAlert } from '@/components/FormAlert'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getErrorMessage } from '@/libs/ApiClient'
import type { GenerateExamPoolRequest, JourneyType } from '@/types/Exam'
import { EXAM_GRADES, JOURNEY_TYPES } from '@/types/Exam'
import { gradeLabel } from './ExamHelpers'
import { examPoolPath, generateExamPool, storeExamPool } from './ExamPoolsApi'

/** ExamLevelMin..ExamLevelMax in math-svr internal/shared/enum/exam.go. */
const LEVELS = Array.from({ length: 10 }, (_, level) => level)

type GenerateExamPoolDialogProps = {
  open: boolean
  onClose: () => void
  /** Pre-filled from the list filters; null = not chosen yet. */
  defaults: { type: JourneyType | null; grade: number | null }
}

/**
 * "Tạo đề bằng AI": one /exams/pools/generate call, then straight to the new set so the admin reviews it.
 * The dialog cannot be closed while the model runs, so a second click cannot start a second (paid) call.
 */
export function GenerateExamPoolDialog({ open, onClose, defaults }: GenerateExamPoolDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const generate = useMutation({
    mutationFn: generateExamPool,
    // Silent: the dialog shows the error itself.
    meta: { silentError: true },
    onSuccess: (pool) => {
      storeExamPool(queryClient, pool)
      toast.success(t('exams.pools.generate.created', { id: pool.exam_id }))
      close()
      void navigate(examPoolPath(pool.exam_id))
    },
  })

  function close() {
    generate.reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !generate.isPending && close()}>
      <DialogContent
        showCloseButton={!generate.isPending}
        onEscapeKeyDown={(event) => generate.isPending && event.preventDefault()}
        onInteractOutside={(event) => generate.isPending && event.preventDefault()}
        className="gap-5 rounded-2xl p-7 sm:max-w-[480px]"
      >
        {/* Mounted only while open, so every opening starts from the current filters. */}
        {open && (
          <GenerateForm
            defaults={defaults}
            pending={generate.isPending}
            error={generate.error}
            onCancel={close}
            onSubmit={(request) => generate.mutate(request)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

type GenerateFormProps = {
  defaults: GenerateExamPoolDialogProps['defaults']
  pending: boolean
  error: unknown
  onCancel: () => void
  onSubmit: (request: GenerateExamPoolRequest) => void
}

function GenerateForm({ defaults, pending, error, onCancel, onSubmit }: GenerateFormProps) {
  const { t } = useTranslation()
  const [type, setType] = useState<JourneyType>(defaults.type ?? 'ASSESSMENT')
  const [grade, setGrade] = useState<number | null>(defaults.grade)
  const [level, setLevel] = useState<number | null>(null)

  // A GRADE set without a level is tagged LNA, which no child's request (always levelled) ever matches.
  const needsLevel = type === 'GRADE'
  const ready = grade !== null && (!needsLevel || level !== null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (grade === null || (needsLevel && level === null)) return
    onSubmit({ exam_type: type, grade, ...(needsLevel && level !== null ? { level } : {}) })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <DialogHeader className="gap-2 text-left">
        <DialogTitle className="text-xl font-bold">{t('exams.pools.generate.title')}</DialogTitle>
        <DialogDescription className="leading-relaxed">{t('exams.pools.generate.description')}</DialogDescription>
      </DialogHeader>

      <FormField id="generate-type" label={t('exams.pools.generate.type')} hint={t('exams.pools.generate.typeHint')}>
        <Select
          value={type}
          disabled={pending}
          onValueChange={(value) => setType(JOURNEY_TYPES.find((option) => option === value) ?? 'ASSESSMENT')}
        >
          <SelectTrigger id="generate-type" aria-describedby="generate-type-hint" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {JOURNEY_TYPES.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`exams.types.${option}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <FormField id="generate-grade" label={t('exams.pools.generate.grade')}>
        <Select
          value={grade === null ? '' : String(grade)}
          disabled={pending}
          onValueChange={(value) => setGrade(EXAM_GRADES.find((option) => String(option) === value) ?? null)}
        >
          <SelectTrigger id="generate-grade" className="w-full">
            <SelectValue placeholder={t('exams.pools.generate.pickGrade')} />
          </SelectTrigger>
          <SelectContent>
            {EXAM_GRADES.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {gradeLabel(t, option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {needsLevel && (
        <FormField id="generate-level" label={t('exams.pools.generate.level')} hint={t('exams.pools.generate.levelHint')}>
          <Select
            value={level === null ? '' : String(level)}
            disabled={pending}
            onValueChange={(value) => setLevel(LEVELS.find((option) => String(option) === value) ?? null)}
          >
            <SelectTrigger id="generate-level" aria-describedby="generate-level-hint" className="w-full">
              <SelectValue placeholder={t('exams.pools.generate.pickLevel')} />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {t('exams.level', { level: option })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      )}

      {error != null && <FormAlert>{getErrorMessage(error)}</FormAlert>}

      <DialogFooter className="gap-3">
        <Button type="button" variant="outline" className="h-11 rounded-xl px-4.5" disabled={pending} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="h-11 rounded-xl px-4.5" disabled={!ready || pending}>
          {pending ? t('exams.pools.generate.generating') : t('exams.pools.generate.submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}
