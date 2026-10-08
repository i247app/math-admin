import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { DataPagination } from '@/components/DataPagination'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TitleBar } from '@/features/dashboard/TitleBar'
import { gradeLabel, positiveIntParam } from '@/features/exams/ExamHelpers'
import { examPoolsListQueryOptions } from '@/features/exams/ExamPoolsApi'
import { ExamPoolsTable } from '@/features/exams/ExamPoolsTable'
import { EXAM_GRADES, EXAM_TYPES } from '@/types/Exam'
import { cn } from '@/utils/Helpers'

const PAGE_SIZE = 20
const ALL = 'all'
const VERIFIED_OPTIONS = ['no', 'yes'] as const

/** The AI question sets in the pool, newest first. */
export default function ExamPoolsPage() {
  const { t } = useTranslation()

  // Filters and page live in the URL so Back from a set returns to the same list.
  const [params, setParams] = useSearchParams()
  const page = positiveIntParam(params.get('page')) ?? 1
  const type = EXAM_TYPES.find((option) => option === params.get('type')) ?? null
  const grade = EXAM_GRADES.find((option) => String(option) === params.get('grade')) ?? null
  const verified = VERIFIED_OPTIONS.find((option) => option === params.get('verified')) ?? null

  const list = useQuery(
    examPoolsListQueryOptions({
      exam_types: type ? [type] : undefined,
      grade: grade ?? undefined,
      is_verified: verified === null ? undefined : verified === 'yes',
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

  const pagination = list.data?.pagination
  const rows = list.data?.pools
  const totalPages = pagination?.total_pages ?? 0

  // The server does not clamp: past the last page (an old link), show the last real page.
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setParams(
        (current) => {
          const updated = new URLSearchParams(current)
          updated.set('page', String(totalPages))
          return updated
        },
        { replace: true },
      )
    }
  }, [page, totalPages, setParams])

  const filtered = type !== null || grade !== null || verified !== null
  const first = pagination ? pagination.skip + 1 : 0
  const last = pagination ? pagination.skip + (rows?.length ?? 0) : 0

  return (
    <>
      <TitleBar title={t('exams.pools.title')} description={t('exams.pools.description')} />

      {list.isError && !list.data ? (
        <LoadError
          title={t('exams.pools.list.loadFailed')}
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
        />
      ) : (
        <section aria-label={t('exams.pools.title')} className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <strong className="font-semibold" aria-live="polite">
              {pagination ? t('exams.pools.list.count', { count: pagination.total_count }) : ' '}
            </strong>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={type ?? ALL} onValueChange={(value) => update({ type: value === ALL ? null : value })}>
                <SelectTrigger size="sm" aria-label={t('exams.pools.list.filterType')} className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('exams.pools.list.allTypes')}</SelectItem>
                  {EXAM_TYPES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`exams.types.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={grade === null ? ALL : String(grade)}
                onValueChange={(value) => update({ grade: value === ALL ? null : value })}
              >
                <SelectTrigger size="sm" aria-label={t('exams.pools.list.filterGrade')} className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('exams.pools.list.allGrades')}</SelectItem>
                  {EXAM_GRADES.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {gradeLabel(t, option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={verified ?? ALL}
                onValueChange={(value) => update({ verified: value === ALL ? null : value })}
              >
                <SelectTrigger size="sm" aria-label={t('exams.pools.list.filterVerified')} className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('exams.pools.list.verifiedOptions.all')}</SelectItem>
                  {VERIFIED_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`exams.pools.list.verifiedOptions.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {rows && rows.length === 0 && page <= 1 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <img src={`${import.meta.env.BASE_URL}assets/images/numi-thinking.png`} alt="" className="size-30 object-contain" />
              <strong className="text-[17px] font-semibold">
                {t(filtered ? 'exams.pools.list.filterEmptyTitle' : 'exams.pools.list.emptyTitle')}
              </strong>
              {filtered && (
                <Button variant="outline" onClick={() => update({ type: null, grade: null, verified: null })}>
                  {t('exams.pools.list.clearFilters')}
                </Button>
              )}
            </div>
          ) : (
            <div
              className={cn('overflow-x-auto transition-opacity', list.isPlaceholderData && 'opacity-60')}
              aria-busy={list.isFetching}
            >
              <ExamPoolsTable pools={rows} />
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
