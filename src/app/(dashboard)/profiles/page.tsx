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
import { useSessionUser } from '@/features/auth/AuthApi'
import { TitleBar } from '@/features/dashboard/TitleBar'
import type { DeleteKind } from '@/features/profiles/DeleteProfileDialog'
import { DeleteProfileDialog } from '@/features/profiles/DeleteProfileDialog'
import { ProfileFormSheet } from '@/features/profiles/ProfileFormSheet'
import { profilesListQueryOptions } from '@/features/profiles/ProfilesApi'
import type { ProfileAction } from '@/features/profiles/ProfilesTable'
import { ProfilesTable } from '@/features/profiles/ProfilesTable'
import type { Profile, ProfileRole } from '@/types/Profile'
import { PROFILE_ROLES, PROFILE_STATUSES } from '@/types/Profile'
import { cn } from '@/utils/Helpers'

const PAGE_SIZE = 20
const TYPING_DELAY_MS = 300
const ALL = 'all'

type FilterStatus = (typeof PROFILE_STATUSES)[number]

/** Every child profile on the platform; /profiles/list is not scoped to the caller. */
export default function ProfilesPage() {
  const { t } = useTranslation()
  const isAdmin = useSessionUser().role === 'ADMIN'

  // page and filters live in the URL so a reload or a link from the Users screen keeps the view.
  const [params, setParams] = useSearchParams()
  const page = positiveInt(params.get('page')) ?? 1
  const search = params.get('q')?.trim() ?? ''
  const uid = positiveInt(params.get('uid')) ?? undefined
  const role = PROFILE_ROLES.find((option) => option === params.get('role'))
  const status = PROFILE_STATUSES.find((option) => option === params.get('status'))

  const list = useQuery(
    profilesListQueryOptions({
      page,
      size: PAGE_SIZE,
      search: search || undefined,
      uid,
      role,
      profile_status: status,
    }),
  )
  const pagination = list.data?.pagination
  const rows = list.data?.profiles

  // null = closed, 'new' = create form, a profile = edit form.
  const [editing, setEditing] = useState<Profile | 'new' | null>(null)
  const [deleting, setDeleting] = useState<{ kind: DeleteKind; profile: Profile } | null>(null)

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

  // The text boxes update the URL once typing pauses (a new filter starts again from page 1).
  const [searchText, setSearchText] = useState(search)
  const [uidText, setUidText] = useState(uid ? String(uid) : '')
  // When the URL changes from elsewhere (an owner link in the table), the boxes follow it.
  const [shown, setShown] = useState({ search, uid })
  if (shown.search !== search || shown.uid !== uid) {
    setShown({ search, uid })
    setSearchText(search)
    setUidText(uid ? String(uid) : '')
  }
  useEffect(() => {
    const nextSearch = searchText.trim()
    const nextUid = positiveInt(uidText.trim())
    if (nextSearch === search && (nextUid ?? undefined) === uid) return
    const timer = setTimeout(() => {
      setParams((current) => {
        const updated = new URLSearchParams(current)
        updated.set('page', '1')
        if (nextSearch) updated.set('q', nextSearch)
        else updated.delete('q')
        if (nextUid) updated.set('uid', String(nextUid))
        else updated.delete('uid')
        return updated
      })
    }, TYPING_DELAY_MS)
    return () => clearTimeout(timer)
  }, [searchText, uidText, search, uid, setParams])

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

  function handleAction(action: ProfileAction, profile: Profile) {
    if (action === 'edit') {
      setEditing(profile)
    } else {
      setEditing(null)
      setDeleting({ kind: action, profile })
    }
  }

  function clearFilters() {
    setSearchText('')
    setUidText('')
    update({ q: null, uid: null, role: null, status: null })
  }

  const filtered = search !== '' || uid !== undefined || role !== undefined || status !== undefined
  const first = pagination ? pagination.skip + 1 : 0
  const last = pagination ? pagination.skip + (rows?.length ?? 0) : 0

  return (
    <>
      <TitleBar
        title={t('profiles.title')}
        description={t('profiles.description')}
        actions={
          <Button className="h-11 rounded-xl px-4.5" onClick={() => setEditing('new')}>
            <PlusIcon aria-hidden />
            {t('profiles.create')}
          </Button>
        }
      />

      {list.isError && !list.data ? (
        <LoadError
          title={t('profiles.loadFailed')}
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
        />
      ) : (
        <section aria-label={t('profiles.title')} className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <strong className="font-semibold" aria-live="polite">
              {pagination ? t('profiles.count', { count: pagination.total_count }) : ' '}
            </strong>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <SearchIcon
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  aria-label={t('profiles.filter.search')}
                  placeholder={t('profiles.filter.search')}
                  maxLength={128}
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  className="h-9 w-60 rounded-lg pl-9"
                />
              </div>
              <Input
                inputMode="numeric"
                aria-label={t('profiles.filter.uid')}
                placeholder={t('profiles.filter.uid')}
                value={uidText}
                onChange={(event) => setUidText(event.target.value)}
                className="h-9 w-32 rounded-lg font-mono"
              />
              <Select
                value={role ?? ALL}
                onValueChange={(value) => update({ role: value === ALL ? null : (value as ProfileRole) })}
              >
                <SelectTrigger size="sm" aria-label={t('profiles.filter.role')} className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('profiles.filter.allRoles')}</SelectItem>
                  {PROFILE_ROLES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`users.roles.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={status ?? ALL}
                onValueChange={(value) => update({ status: value === ALL ? null : (value as FilterStatus) })}
              >
                <SelectTrigger size="sm" aria-label={t('profiles.filter.status')} className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('profiles.filter.allStatuses')}</SelectItem>
                  {PROFILE_STATUSES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`profiles.status.${option}`)}
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
                  <strong className="text-[17px] font-semibold">{t('profiles.filter.emptyTitle')}</strong>
                  <Button variant="outline" onClick={clearFilters}>
                    {t('profiles.filter.clear')}
                  </Button>
                </>
              ) : (
                <>
                  <strong className="text-[17px] font-semibold">{t('profiles.emptyTitle')}</strong>
                  <span className="text-muted-foreground">{t('profiles.emptyDescription')}</span>
                </>
              )}
            </div>
          ) : (
            <div
              className={cn('overflow-x-auto transition-opacity', list.isPlaceholderData && 'opacity-60')}
              aria-busy={list.isFetching}
            >
              <ProfilesTable profiles={rows} canViewExams={isAdmin} onAction={handleAction} />
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

      <ProfileFormSheet target={editing} defaultUid={uid} onClose={() => setEditing(null)} />
      <DeleteProfileDialog target={deleting} onClose={() => setDeleting(null)} />
    </>
  )
}

function positiveInt(value: string | null): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 ? n : null
}
