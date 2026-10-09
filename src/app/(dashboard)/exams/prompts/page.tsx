import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckIcon, CopyIcon, SaveIcon, Undo2Icon, XIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { LoadError } from '@/components/LoadError'
import { StatusPill } from '@/components/StatusPill'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { TitleBar } from '@/features/dashboard/TitleBar'
import { gradeLabel } from '@/features/exams/ExamHelpers'
import {
  EXAM_PROMPT_JSON_KEYS,
  examPromptsQueryOptions,
  missingPromptKeys,
  storeExamPrompt,
  updateExamPrompt,
} from '@/features/exams/ExamPromptsApi'
import { MetaRow } from '@/features/exams/StatTiles'
import { ConfirmActionDialog } from '@/features/system/ConfirmActionDialog'
import { EXAM_GRADES } from '@/types/Exam'
import { cn, formatServerTime } from '@/utils/Helpers'

/** The exam-generation system prompt of each grade: read, copy, rewrite. */
export default function ExamPromptsPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const grade = EXAM_GRADES.find((option) => String(option) === params.get('grade')) ?? 0
  const list = useQuery(examPromptsQueryOptions())
  // Unsaved text per grade, kept while switching tabs; a grade without an entry shows the saved text.
  const [drafts, setDrafts] = useState<Partial<Record<number, string>>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)

  const save = useMutation({
    mutationFn: ({ target, text }: { target: number; text: string }) => updateExamPrompt(target, text),
    // Silent: the confirm dialog shows the error itself.
    meta: { silentError: true },
    onSuccess: (prompt) => {
      storeExamPrompt(queryClient, prompt)
      clearDraft(prompt.grade)
      setConfirmOpen(false)
      toast.success(
        t('exams.prompts.saved', { grade: gradeLabel(t, prompt.grade), version: prompt.prompt_version }),
      )
    },
  })

  function clearDraft(target: number) {
    setDrafts((current) => {
      const next = { ...current }
      delete next[target]
      return next
    })
  }

  const prompts = list.data
  const isDirty = (target: number) => {
    const draft = drafts[target]
    const saved = prompts?.find((row) => row.grade === target)
    return draft !== undefined && saved !== undefined && draft !== saved.system_prompt
  }

  const prompt = prompts?.find((row) => row.grade === grade)
  const text = drafts[grade] ?? prompt?.system_prompt ?? ''
  const dirty = isDirty(grade)
  const missing = missingPromptKeys(text)
  const canSave = dirty && text.trim() !== '' && missing.length === 0 && !save.isPending
  const gradeName = gradeLabel(t, grade)

  async function copySaved(saved: string) {
    try {
      await navigator.clipboard.writeText(saved)
      toast.success(t('exams.prompts.copied', { grade: gradeName }))
    } catch {
      toast.error(t('exams.prompts.copyFailed'))
    }
  }

  let content: ReactNode
  if (list.isError && !prompts) {
    content = (
      <LoadError
        title={t('exams.prompts.loadFailed')}
        error={list.error}
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
      />
    )
  } else if (!prompts) {
    content = (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-10 w-full max-w-2xl rounded-xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-[50vh] rounded-2xl" />
      </div>
    )
  } else {
    content = (
      <>
        <div role="group" aria-label={t('exams.prompts.tabsLabel')} className="flex w-max max-w-full flex-wrap gap-1 rounded-xl bg-muted p-1">
          {EXAM_GRADES.map((option) => {
            const row = prompts.find((item) => item.grade === option)
            return (
              <button
                key={option}
                type="button"
                aria-pressed={option === grade}
                onClick={() => setParams({ grade: String(option) })}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground',
                  option === grade && 'bg-card text-primary shadow-sm',
                )}
              >
                {gradeLabel(t, option)}
                {row && (
                  <span className="font-mono text-xs font-normal">{t('exams.prompts.version', { version: row.prompt_version })}</span>
                )}
                {isDirty(option) && (
                  <span className="size-2 rounded-full bg-warning">
                    <span className="sr-only">{t('exams.prompts.unsaved')}</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {!prompt ? (
          <p className="rounded-2xl border bg-card px-5 py-8 text-center text-muted-foreground">
            {t('exams.prompts.missing', { grade: gradeName })}
          </p>
        ) : (
          <>
            <MetaRow
              items={[
                {
                  label: t('exams.prompts.meta.version'),
                  value: <span className="font-mono">{t('exams.prompts.version', { version: prompt.prompt_version })}</span>,
                },
                { label: t('exams.prompts.meta.edited'), value: formatServerTime(prompt.modify_dt, i18n.language) },
                {
                  label: t('exams.prompts.meta.editedBy'),
                  value: prompt.modify_id
                    ? t('exams.prompts.uid', { uid: prompt.modify_id })
                    : t(prompt.prompt_version > 1 ? 'exams.prompts.apiKey' : 'exams.prompts.seed'),
                },
                {
                  label: t('exams.prompts.meta.length'),
                  value: t('exams.prompts.lengthValue', {
                    n: Array.from(prompt.system_prompt).length.toLocaleString(i18n.language),
                  }),
                },
              ]}
            />

            <section className="flex flex-col gap-3 rounded-2xl border bg-card px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="exam-prompt">{t('exams.prompts.editor', { grade: gradeName })}</Label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => void copySaved(prompt.system_prompt)}>
                    <CopyIcon aria-hidden />
                    {t('exams.prompts.copy')}
                  </Button>
                  <Button variant="outline" size="sm" disabled={!dirty} onClick={() => clearDraft(grade)}>
                    <Undo2Icon aria-hidden />
                    {t('exams.prompts.revert')}
                  </Button>
                  <Button size="sm" disabled={!canSave} onClick={() => setConfirmOpen(true)}>
                    <SaveIcon aria-hidden />
                    {t('exams.prompts.save')}
                  </Button>
                </div>
              </div>
              <Textarea
                id="exam-prompt"
                value={text}
                spellCheck={false}
                aria-invalid={missing.length > 0 ? true : undefined}
                aria-describedby="exam-prompt-keys"
                onChange={(event) => setDrafts((current) => ({ ...current, [grade]: event.target.value }))}
                className="min-h-[60vh] font-mono text-[13px] leading-relaxed"
              />
              <div id="exam-prompt-keys" className="flex flex-col gap-2">
                <span className={cn('text-sm', missing.length > 0 ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
                  {missing.length > 0
                    ? t('exams.prompts.keysMissing', { n: missing.length })
                    : t('exams.prompts.keysOk', { n: EXAM_PROMPT_JSON_KEYS.length })}
                </span>
                <ul aria-label={t('exams.prompts.keysTitle')} className="flex flex-wrap gap-1.5">
                  {EXAM_PROMPT_JSON_KEYS.map((key) => {
                    const absent = missing.includes(key)
                    return (
                      <li key={key}>
                        <StatusPill tone={absent ? 'danger' : 'success'} className="font-mono">
                          {absent ? <XIcon aria-hidden /> : <CheckIcon aria-hidden />}
                          {key}
                          <span className="sr-only">{t(absent ? 'exams.prompts.absent' : 'exams.prompts.present')}</span>
                        </StatusPill>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </section>

            <ConfirmActionDialog
              open={confirmOpen}
              onClose={() => {
                setConfirmOpen(false)
                save.reset()
              }}
              title={t('exams.prompts.confirmTitle', { grade: gradeName })}
              description={
                <>
                  <p>{t('exams.prompts.confirmOverwrite')}</p>
                  <p>{t('exams.prompts.confirmVersion', { from: prompt.prompt_version, to: prompt.prompt_version + 1 })}</p>
                  <p>{t('exams.prompts.confirmCache', { grade: gradeName })}</p>
                </>
              }
              confirmLabel={t('exams.prompts.save')}
              pendingLabel={t('exams.prompts.saving')}
              pending={save.isPending}
              error={save.error}
              onConfirm={() => save.mutate({ target: grade, text })}
            />
          </>
        )}
      </>
    )
  }

  return (
    <>
      <TitleBar title={t('exams.prompts.title')} description={t('exams.prompts.description')} />
      {content}
    </>
  )
}
