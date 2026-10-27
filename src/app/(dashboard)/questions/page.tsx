import { useQuery } from '@tanstack/react-query'
import { FileUpIcon, PlusIcon, SearchIcon } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { DataPagination } from '@/components/DataPagination'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TitleBar } from '@/features/dashboard/TitleBar'
import { gradeLabel, positiveIntParam } from '@/features/exams/ExamHelpers'
import type { QuestionDeleteKind } from '@/features/questions/DeleteQuestionDialog'
import { DeleteQuestionDialog } from '@/features/questions/DeleteQuestionDialog'
import { ImportQuestionsDialog } from '@/features/questions/ImportQuestionsDialog'
import { QuestionFormSheet } from '@/features/questions/QuestionFormSheet'
import { questionsListQueryOptions } from '@/features/questions/QuestionsApi'
import { QuestionsTable } from '@/features/questions/QuestionsTable'
import type { Question } from '@/types/Question'
import { QUESTION_GRADES, QUESTION_KINDS, QUESTION_SOURCES, QUESTION_STATUSES } from '@/types/Question'
import { cn } from '@/utils/Helpers'

const PAGE_SIZE = 20
const ALL = 'all'
const VERIFIED_OPTIONS = ['no', 'yes'] as const
/** URL params cleared by "Xoá bộ lọc". */
const FILTER_PARAMS = ['grade', 'kind', 'status', 'source', 'verified', 'topic', 'tag'] as const

/** The question bank (math-svr /questions/*), newest first. Admin only. */
export default function QuestionsPage() {
  const { t } = useTranslation()

  // Filters and page live in the URL, like the pool screen.
  const [params, setParams] = useSearchParams()
  const page = positiveIntParam(params.get('page')) ?? 1
  const grade = QUESTION_GRADES.find((option) => String(option) === params.get('grade')) ?? null
  const kind = QUESTION_KINDS.find((option) => option === params.get('kind')) ?? null
  const status = QUESTION_STATUSES.find((option) => option === params.get('status')) ?? null
  const source = QUESTION_SOURCES.find((option) => option === params.get('source')) ?? null
  const verified = VERIFIED_OPTIONS.find((option) => option === params.get('verified')) ?? null
  const topic = params.get('topic')?.trim() || null
  const tag = params.get('tag')?.trim() || null
  const [editing, setEditing] = useState<Question | null>(null)
  const [importing, setImporting] = useState(false)
  const [deleting, setDeleting] = useState<{ kind: QuestionDeleteKind; question: Question } | null>(null)
  // The grade filter pre-fills the first new question.
  const newPath = grade === null ? '/questions/new' : `/questions/new?grade=${grade}`

  const list = useQuery(
    questionsListQueryOptions({
      question_grade: grade ?? undefined,
      question_kinds: kind ? [kind] : undefined,
      question_statuses: status ? [status] : undefined,
      question_source: source ?? undefined,
      is_verified: verified === null ? undefined : verified === 'yes',
      question_topic: topic ?? undefined,
      question_tags: tag ? [tag] : undefined,
      page,
      size: PAGE_SIZE,
    }),
  )

  /** Sets (or with null, removes) URL params; any filter change goes back to page 1. */
  function update(changes: Record<string, string | null>) {
    setParams((current) => {
      const updated = new URLSearchParams(current)
      if (!('page' in changes)) updated.set('page', '1')
      for (const [key, value] of Object.entries(changes)) {
        if (value) updated.set(key, value)
        else updated.delete(key)
      }
      return updated
    })
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    update({ topic: String(form.get('topic') ?? '').trim(), tag: String(form.get('tag') ?? '').trim() })
  }

  const pagination = list.data?.pagination
  const rows = list.data?.questions
  const totalPages = pagination?.total_pages ?? 0

  // The server does not clamp: past the last page (an old link), show the last real page.
  useEffect(() => {
    if (!list.isPlaceholderData && totalPages > 0 && page > totalPages) {
      setParams(
        (current) => {
          const updated = new URLSearchParams(current)
          updated.set('page', String(totalPages))
          return updated
        },
        { replace: true },
      )
    }
  }, [page, totalPages, list.isPlaceholderData, setParams])

  const filtered = FILTER_PARAMS.some((key) => params.get(key))
  const first = pagination ? pagination.skip + 1 : 0
  const last = pagination ? pagination.skip + (rows?.length ?? 0) : 0

  /** One filter select: "all" + the options. */
  const filterSelect = <T extends string | number>(
    name: string,
    value: T | null,
    options: readonly T[],
    allLabel: string,
    label: (option: T) => string,
    width: string,
  ) => (
    <Select value={value === null ? ALL : String(value)} onValueChange={(v) => update({ [name]: v === ALL ? null : v })}>
      <SelectTrigger size="sm" aria-label={t(`questions.filters.${name}` as 'questions.filters.grade')} className={width}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={String(option)}>
            {label(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <>
      <TitleBar
        title={t('questions.title')}
        description={t('questions.description')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-11 rounded-xl px-4.5" onClick={() => setImporting(true)}>
              <FileUpIcon aria-hidden />
              {t('questions.import.open')}
            </Button>
            <Button asChild className="h-11 rounded-xl px-4.5">
              <Link to={newPath}>
                <PlusIcon aria-hidden />
                {t('questions.create')}
              </Link>
            </Button>
          </div>
        }
      />
      <QuestionFormSheet question={editing} onClose={() => setEditing(null)} />
      <DeleteQuestionDialog target={deleting} onClose={() => setDeleting(null)} />
      <ImportQuestionsDialog open={importing} onClose={() => setImporting(false)} />

      {list.isError && !list.data ? (
        <LoadError
          title={t('questions.loadFailed')}
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
        />
      ) : (
        <section aria-label={t('questions.title')} className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-col gap-3 border-b px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <strong className="font-semibold" aria-live="polite">
                {pagination ? t('questions.count', { count: pagination.total_count }) : ' '}
              </strong>
              {/* Keyed on the URL so Back / "clear filters" refill the inputs. */}
              <form key={`${topic}|${tag}`} onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
                <Input
                  name="topic"
                  defaultValue={topic ?? ''}
                  placeholder={t('questions.filters.topic')}
                  aria-label={t('questions.filters.topic')}
                  className="h-8 w-48"
                />
                <Input
                  name="tag"
                  defaultValue={tag ?? ''}
                  placeholder={t('questions.filters.tag')}
                  aria-label={t('questions.filters.tag')}
                  className="h-8 w-36"
                />
                <Button type="submit" size="sm" variant="outline">
                  <SearchIcon aria-hidden />
                  {t('questions.filters.apply')}
                </Button>
              </form>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {filterSelect('grade', grade, QUESTION_GRADES, t('questions.filters.allGrades'), (g) => gradeLabel(t, g), 'w-32')}
              {filterSelect('kind', kind, QUESTION_KINDS, t('questions.filters.allKinds'), (k) => t(`questions.kinds.${k}`), 'w-40')}
              {filterSelect('status', status, QUESTION_STATUSES, t('questions.filters.allStatuses'), (s) => t(`questions.statuses.${s}`), 'w-40')}
              {filterSelect('source', source, QUESTION_SOURCES, t('questions.filters.allSources'), (s) => t(`questions.sources.${s}`), 'w-36')}
              {filterSelect('verified', verified, VERIFIED_OPTIONS, t('questions.filters.verifiedOptions.all'), (v) => t(`questions.filters.verifiedOptions.${v}`), 'w-48')}
              {filtered && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => update(Object.fromEntries(FILTER_PARAMS.map((key) => [key, null])))}
                >
                  {t('questions.filters.clear')}
                </Button>
              )}
            </div>
          </div>

          {rows && rows.length === 0 && page <= 1 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <img src={`${import.meta.env.BASE_URL}assets/images/numi-thinking.png`} alt="" className="size-30 object-contain" />
              <strong className="text-[17px] font-semibold">
                {t(filtered ? 'questions.filterEmptyTitle' : 'questions.emptyTitle')}
              </strong>
              {!filtered && (
                <Button asChild>
                  <Link to={newPath}>
                    <PlusIcon aria-hidden />
                    {t('questions.create')}
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div
              className={cn('overflow-x-auto transition-opacity', list.isPlaceholderData && 'opacity-60')}
              aria-busy={list.isFetching}
            >
              <QuestionsTable questions={rows} onOpen={setEditing} onTag={(value) => update({ tag: value })}
                onDelete={(kind, question) => setDeleting({ kind, question })}
              />
            </div>
          )}

          {pagination && totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5">
              <span className="text-sm text-muted-foreground">
                {t('pagination.range', { first, last, total: pagination.total_count })}
              </span>
              <DataPagination
                page={pagination.page}
                totalPages={totalPages}
                onPageChange={(p) => update({ page: String(p) })}
              />
            </div>
          )}
        </section>
      )}
    </>
  )
}
