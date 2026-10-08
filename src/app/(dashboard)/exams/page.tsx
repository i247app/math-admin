import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { DataPagination } from '@/components/DataPagination'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { TitleBar } from '@/features/dashboard/TitleBar'
import { journeyTypeParam, positiveIntParam } from '@/features/exams/ExamHelpers'
import { examSessionsListQueryOptions } from '@/features/exams/ExamsApi'
import { JourneysTable } from '@/features/exams/JourneysTable'
import { ProfilePicker } from '@/features/exams/ProfilePicker'
import { ProfileSummaryCard } from '@/features/exams/ProfileSummaryCard'
import { profileDetailQueryOptions } from '@/features/profiles/ProfilesApi'
import { getErrorMessage } from '@/libs/ApiClient'
import { JOURNEY_STATUSES, JOURNEY_TYPES } from '@/types/Exam'
import { cn } from '@/utils/Helpers'

const PAGE_SIZE = 20
const ALL = 'all'

/** One profile's journeys. math-svr has no list across profiles, so a profile is picked first. */
export default function ExamsPage() {
  const { t } = useTranslation()

  // Profile, filters and page live in the URL so the Profiles screen can link here and Back works.
  const [params, setParams] = useSearchParams()
  const profileId = positiveIntParam(params.get('profile'))
  const page = positiveIntParam(params.get('page')) ?? 1
  const type = journeyTypeParam(params.get('type'))
  const status = JOURNEY_STATUSES.find((option) => option === params.get('status')) ?? null

  const profile = useQuery({ ...profileDetailQueryOptions(profileId ?? 0), enabled: profileId !== null })
  const list = useQuery({
    ...examSessionsListQueryOptions({
      profile_id: profileId ?? 0,
      exam_types: type ? [type] : undefined,
      status: status ?? undefined,
      page,
      size: PAGE_SIZE,
    }),
    enabled: profileId !== null,
  })

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
  const rows = list.data?.sessions
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

  const filtered = type !== null || status !== null
  const first = pagination ? pagination.skip + 1 : 0
  const last = pagination ? pagination.skip + (rows?.length ?? 0) : 0

  return (
    <>
      <TitleBar title={t('exams.title')} description={t('exams.description')} />

      {profileId === null || profile.isError ? (
        <>
          <ProfilePicker
            onPick={(id) => setParams({ profile: String(id) })}
            error={profile.isError ? getErrorMessage(profile.error) : undefined}
          />
          {profileId === null && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-12 text-center">
              <img src={`${import.meta.env.BASE_URL}assets/images/numi-thinking.png`} alt="" className="size-30 object-contain" />
              <strong className="text-[17px] font-semibold">{t('exams.picker.pickTitle')}</strong>
              <span className="max-w-md text-muted-foreground">{t('exams.picker.pickDescription')}</span>
            </div>
          )}
        </>
      ) : (
        <>
          {profile.data ? (
            <ProfileSummaryCard profile={profile.data} onChange={() => setParams({})} />
          ) : (
            <Skeleton className="h-28 rounded-2xl" />
          )}

          {list.isError && !list.data ? (
            <LoadError
              title={t('exams.list.loadFailed')}
              error={list.error}
              onRetry={() => void list.refetch()}
              retrying={list.isFetching}
            />
          ) : (
            <section aria-label={t('exams.title')} className="overflow-hidden rounded-2xl border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                <strong className="font-semibold" aria-live="polite">
                  {pagination ? t('exams.list.count', { count: pagination.total_count }) : ' '}
                </strong>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={type ?? ALL} onValueChange={(value) => update({ type: value === ALL ? null : value })}>
                    <SelectTrigger size="sm" aria-label={t('exams.list.filterType')} className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>{t('exams.list.allTypes')}</SelectItem>
                      {JOURNEY_TYPES.map((option) => (
                        <SelectItem key={option} value={option}>
                          {t(`exams.types.${option}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={status ?? ALL}
                    onValueChange={(value) => update({ status: value === ALL ? null : value })}
                  >
                    <SelectTrigger size="sm" aria-label={t('exams.list.filterStatus')} className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>{t('exams.list.allStatuses')}</SelectItem>
                      {JOURNEY_STATUSES.map((option) => (
                        <SelectItem key={option} value={option}>
                          {t(`exams.journeyStatus.${option}`)}
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
                    {t(filtered ? 'exams.list.filterEmptyTitle' : 'exams.list.emptyTitle')}
                  </strong>
                  {filtered && (
                    <Button variant="outline" onClick={() => update({ type: null, status: null })}>
                      {t('exams.list.clearFilters')}
                    </Button>
                  )}
                </div>
              ) : (
                <div
                  className={cn('overflow-x-auto transition-opacity', list.isPlaceholderData && 'opacity-60')}
                  aria-busy={list.isFetching}
                >
                  <JourneysTable profileId={profileId} sessions={rows} />
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
      )}
    </>
  )
}
