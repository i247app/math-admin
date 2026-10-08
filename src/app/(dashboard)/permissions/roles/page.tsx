import { useQuery } from '@tanstack/react-query'
import { PlusIcon, SearchIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { DataPagination } from '@/components/DataPagination'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TitleBar } from '@/features/dashboard/TitleBar'
import type { DeleteKind } from '@/features/permissions/DeleteRoleDialog'
import { DeleteRoleDialog } from '@/features/permissions/DeleteRoleDialog'
import { RoleFormSheet } from '@/features/permissions/RoleFormSheet'
import { rolesListQueryOptions } from '@/features/permissions/RolesApi'
import type { RoleAction } from '@/features/permissions/RolesTable'
import { RolesTable } from '@/features/permissions/RolesTable'
import type { EditableRoleStatus, Role } from '@/types/Role'
import { EDITABLE_ROLE_STATUSES } from '@/types/Role'
import { cn } from '@/utils/Helpers'

/** Role lists are short; one page usually holds them all. */
const PAGE_SIZE = 50
const SEARCH_DELAY_MS = 300
const ALL_STATUSES = 'all'

export default function RolesPage() {
  const { t } = useTranslation()

  // page, search and status live in the URL so a reload or a shared link keeps the same view.
  const [params, setParams] = useSearchParams()
  const page = positiveInt(params.get('page')) ?? 1
  const search = params.get('q')?.trim() ?? ''
  const status = parseStatus(params.get('status'))

  const list = useQuery(rolesListQueryOptions({ page, size: PAGE_SIZE, search, status }))
  const pagination = list.data?.pagination
  const rows = list.data?.roles

  // null = closed, 'new' = create form, a role = edit form.
  const [editing, setEditing] = useState<Role | 'new' | null>(null)
  const [deleting, setDeleting] = useState<{ kind: DeleteKind; role: Role } | null>(null)

  function goTo(next: { page?: number; search?: string; status?: EditableRoleStatus | null }) {
    setParams((current) => {
      const updated = new URLSearchParams(current)
      updated.set('page', String(next.page ?? page))
      const nextSearch = next.search ?? search
      if (nextSearch) updated.set('q', nextSearch)
      else updated.delete('q')
      const nextStatus = next.status === undefined ? status : next.status
      if (nextStatus) updated.set('status', nextStatus)
      else updated.delete('status')
      return updated
    })
  }

  // The box updates the URL once typing pauses; a new search starts again from page 1.
  const [searchText, setSearchText] = useState(search)
  useEffect(() => {
    const trimmed = searchText.trim()
    if (trimmed === search) return
    const timer = setTimeout(() => {
      setParams((current) => {
        const updated = new URLSearchParams(current)
        updated.set('page', '1')
        if (trimmed) updated.set('q', trimmed)
        else updated.delete('q')
        return updated
      })
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [searchText, search, setParams])

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

  function handleAction(action: RoleAction, role: Role) {
    if (action === 'edit') {
      setEditing(role)
    } else {
      setEditing(null)
      setDeleting({ kind: action, role })
    }
  }

  function clearFilters() {
    setSearchText('')
    goTo({ page: 1, search: '', status: null })
  }

  const filtered = search !== '' || status !== undefined
  const first = pagination ? pagination.skip + 1 : 0
  const last = pagination ? pagination.skip + (rows?.length ?? 0) : 0

  return (
    <>
      <TitleBar
        title={t('roles.title')}
        description={t('roles.description')}
        actions={
          <Button className="h-11 rounded-xl px-4.5" onClick={() => setEditing('new')}>
            <PlusIcon aria-hidden />
            {t('roles.create')}
          </Button>
        }
      />

      {list.isError && !list.data ? (
        <LoadError
          title={t('roles.loadFailed')}
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
        />
      ) : (
        <section aria-label={t('roles.title')} className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <strong className="font-semibold" aria-live="polite">
              {pagination ? t('roles.count', { count: pagination.total_count }) : ' '}
            </strong>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <SearchIcon
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  aria-label={t('roles.filter.search')}
                  placeholder={t('roles.filter.search')}
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  className="h-9 w-64 rounded-lg pl-9"
                />
              </div>
              <Select
                value={status ?? ALL_STATUSES}
                onValueChange={(value) =>
                  goTo({ page: 1, status: value === ALL_STATUSES ? null : (value as EditableRoleStatus) })
                }
              >
                <SelectTrigger size="sm" aria-label={t('roles.filter.status')} className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_STATUSES}>{t('roles.filter.allStatuses')}</SelectItem>
                  {EDITABLE_ROLE_STATUSES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`roles.status.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {rows && rows.length === 0 && page <= 1 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <img src={`${import.meta.env.BASE_URL}assets/images/numi-thinking.png`} alt="" className="size-30 object-contain" />
              {filtered ? (
                <>
                  <strong className="text-[17px] font-semibold">{t('roles.filter.emptyTitle')}</strong>
                  <Button variant="outline" onClick={clearFilters}>
                    {t('roles.filter.clear')}
                  </Button>
                </>
              ) : (
                <>
                  <strong className="text-[17px] font-semibold">{t('roles.emptyTitle')}</strong>
                  <span className="text-muted-foreground">{t('roles.emptyDescription')}</span>
                </>
              )}
            </div>
          ) : (
            <div
              className={cn('overflow-x-auto transition-opacity', list.isPlaceholderData && 'opacity-60')}
              aria-busy={list.isFetching}
            >
              <RolesTable roles={rows} onAction={handleAction} />
            </div>
          )}

          {pagination && totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5">
              <span className="text-sm text-muted-foreground">
                {t('pagination.range', { first, last, total: pagination.total_count })}
              </span>
              <DataPagination page={pagination.page} totalPages={totalPages} onPageChange={(p) => goTo({ page: p })} />
            </div>
          )}
        </section>
      )}

      <RoleFormSheet target={editing} onClose={() => setEditing(null)} />
      <DeleteRoleDialog target={deleting} onClose={() => setDeleting(null)} />
    </>
  )
}

function parseStatus(value: string | null): EditableRoleStatus | undefined {
  return EDITABLE_ROLE_STATUSES.find((option) => option === value)
}

function positiveInt(value: string | null): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 ? n : null
}
