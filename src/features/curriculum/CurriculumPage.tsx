import { useQuery } from '@tanstack/react-query'
import { PlusIcon, SearchIcon } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { DataPagination } from '@/components/DataPagination'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TitleBar } from '@/features/dashboard/TitleBar'
import type { CurriculumItem, CurriculumKind } from '@/types/Curriculum'
import { cn } from '@/utils/Helpers'
import { curriculumListQueryOptions, KIND_CONFIG } from './CurriculumApi'
import type { CurriculumAction } from './CurriculumTable'
import { CurriculumTable } from './CurriculumTable'
import { CurriculumFormSheet } from './CurriculumFormSheet'
import type { DeleteKind } from './DeleteCurriculumDialog'
import { DeleteCurriculumDialog } from './DeleteCurriculumDialog'

/** Reference lists are short; one page usually holds them all. */
const PAGE_SIZE = 50

/** One screen for programs, grades, semesters and schools — they share routes and most fields. */
export function CurriculumPage({ kind }: { kind: CurriculumKind }) {
  const { t } = useTranslation()
  const config = KIND_CONFIG[kind]

  // The page and search live in the URL so a reload or a shared link keeps the same view.
  const [params, setParams] = useSearchParams()
  const page = positiveInt(params.get('page')) ?? 1
  const search = config.search ? (params.get('q') ?? '').trim() : ''

  const list = useQuery(curriculumListQueryOptions(kind, { page, size: PAGE_SIZE, search }))
  const pagination = list.data?.pagination
  const rows = list.data?.items

  // null = closed, 'new' = create form, an item = edit form.
  const [editing, setEditing] = useState<CurriculumItem | 'new' | null>(null)
  const [deleting, setDeleting] = useState<{ kind: DeleteKind; item: CurriculumItem } | null>(null)

  function goTo(nextPage: number, nextSearch = search) {
    setParams((current) => {
      const updated = new URLSearchParams(current)
      updated.set('page', String(nextPage))
      if (nextSearch) updated.set('q', nextSearch)
      else updated.delete('q')
      return updated
    })
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // A new search starts again from page 1.
    goTo(1, String(new FormData(event.currentTarget).get('q') ?? '').trim())
  }

  // Past the last page (a deleted last row, an old link): show the last real page.
  const totalPages = pagination?.total_pages ?? 0
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

  function handleAction(action: CurriculumAction, item: CurriculumItem) {
    if (action === 'edit') {
      setEditing(item)
    } else {
      setEditing(null)
      setDeleting({ kind: action, item })
    }
  }

  // Suggest the next display_order for a new row.
  const nextOrder = rows && rows.length > 0 ? Math.max(...rows.map((row) => row.displayOrder ?? 0)) + 1 : 0
  const first = pagination ? pagination.skip + 1 : 0
  const last = pagination ? pagination.skip + (rows?.length ?? 0) : 0

  return (
    <>
      <TitleBar
        title={t(`curriculum.${kind}.title`)}
        description={t(`curriculum.${kind}.description`)}
        actions={
          <Button className="h-11 rounded-xl px-4.5" onClick={() => setEditing('new')}>
            <PlusIcon aria-hidden />
            {t(`curriculum.${kind}.create`)}
          </Button>
        }
      />

      {list.isError && !list.data ? (
        <LoadError
          title={t(`curriculum.${kind}.loadFailed`)}
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
        />
      ) : (
        <section aria-label={t(`curriculum.${kind}.title`)} className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <strong className="font-semibold" aria-live="polite">
              {pagination ? t('curriculum.count', { count: pagination.total_count }) : ' '}
            </strong>
            {config.search && (
              // Keyed on the URL value so Back/Forward refills the box.
              <form key={search} role="search" onSubmit={handleSearch} className="relative w-full sm:w-80">
                <SearchIcon
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  name="q"
                  defaultValue={search}
                  placeholder={t('curriculum.search.placeholder')}
                  aria-label={t('curriculum.search.placeholder')}
                  className="h-10 rounded-xl pl-9"
                />
              </form>
            )}
          </div>

          {rows && rows.length === 0 && page <= 1 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <img src={`${import.meta.env.BASE_URL}assets/images/numi-thinking.png`} alt="" className="size-30 object-contain" />
              {search ? (
                <>
                  <strong className="text-[17px] font-semibold">{t('curriculum.search.emptyTitle', { search })}</strong>
                  <span className="text-muted-foreground">{t('curriculum.search.emptyDescription')}</span>
                  <Button variant="outline" onClick={() => goTo(1, '')}>
                    {t('curriculum.search.clear')}
                  </Button>
                </>
              ) : (
                <>
                  <strong className="text-[17px] font-semibold">{t(`curriculum.${kind}.emptyTitle`)}</strong>
                  <span className="text-muted-foreground">{t('curriculum.emptyDescription')}</span>
                </>
              )}
            </div>
          ) : (
            <div
              className={cn('overflow-x-auto transition-opacity', list.isPlaceholderData && 'opacity-60')}
              aria-busy={list.isFetching}
            >
              <CurriculumTable kind={kind} items={rows} onAction={handleAction} />
            </div>
          )}

          {pagination && totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5">
              <span className="text-sm text-muted-foreground">
                {t('pagination.range', { first, last, total: pagination.total_count })}
              </span>
              <DataPagination page={pagination.page} totalPages={totalPages} onPageChange={goTo} />
            </div>
          )}
        </section>
      )}

      <CurriculumFormSheet
        kind={kind}
        target={editing}
        nextOrder={nextOrder}
        onClose={() => setEditing(null)}
      />
      <DeleteCurriculumDialog curriculumKind={kind} target={deleting} onClose={() => setDeleting(null)} />
    </>
  )
}

function positiveInt(value: string | null): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 ? n : null
}
