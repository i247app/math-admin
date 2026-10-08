import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { DataPagination } from '@/components/DataPagination'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSessionUser } from '@/features/auth/AuthApi'
import { TitleBar } from '@/features/dashboard/TitleBar'
import type { DeleteKind } from '@/features/users/DeleteUserDialog'
import { DeleteUserDialog } from '@/features/users/DeleteUserDialog'
import { RoleFilter } from '@/features/users/RoleFilter'
import { UserCreateSheet } from '@/features/users/UserCreateSheet'
import { UserEditSheet } from '@/features/users/UserEditSheet'
import type { UserAction } from '@/features/users/UsersTable'
import { UsersTable } from '@/features/users/UsersTable'
import { usersQueryOptions } from '@/features/users/UsersApi'
import type { User, UserRole } from '@/types/User'
import { ALL_ROLES } from '@/types/User'
import { cn } from '@/utils/Helpers'

const PAGE_SIZES = [20, 50, 100]
const DEFAULT_PAGE_SIZE = PAGE_SIZES[0]

export default function UsersPage() {
  const { t } = useTranslation()
  const currentUser = useSessionUser()

  // page, size and the role filter live in the URL so a reload or a shared link keeps the same view.
  const [params, setParams] = useSearchParams()
  const page = positiveInt(params.get('page')) ?? 1
  const requestedSize = positiveInt(params.get('size'))
  const size = requestedSize && PAGE_SIZES.includes(requestedSize) ? requestedSize : DEFAULT_PAGE_SIZE
  const roles = parseRoles(params.get('roles'))

  const users = useQuery(usersQueryOptions({ page, size, roles }))
  const pagination = users.data?.pagination

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const canCreate = currentUser.role === 'ADMIN'
  const [deleting, setDeleting] = useState<{ kind: DeleteKind; user: User } | null>(null)

  function goTo(next: { page?: number; size?: number; roles?: UserRole[] }) {
    setParams((current) => {
      const updated = new URLSearchParams(current)
      updated.set('page', String(next.page ?? page))
      updated.set('size', String(next.size ?? size))
      const nextRoles = next.roles ?? roles
      if (nextRoles.length > 0) updated.set('roles', nextRoles.join(','))
      else updated.delete('roles')
      return updated
    })
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

  function handleAction(action: UserAction, user: User) {
    if (action === 'edit') {
      setEditing(user)
    } else {
      setEditing(null)
      setDeleting({ kind: action, user })
    }
  }

  const rows = users.data?.users
  const first = pagination ? pagination.skip + 1 : 0
  const last = pagination ? pagination.skip + (rows?.length ?? 0) : 0

  return (
    <>
      <TitleBar
        title={t('users.title')}
        description={t('users.description')}
        actions={
          canCreate ? (
            <Button className="h-11 rounded-xl px-4.5" onClick={() => setCreating(true)}>
              <PlusIcon aria-hidden />
              {t('users.create.title')}
            </Button>
          ) : (
            // /users/admin/create answers 403 for non-ADMIN accounts; say why instead of failing.
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button className="h-11 rounded-xl px-4.5" disabled aria-describedby="create-blocked">
                    <PlusIcon aria-hidden />
                    {t('users.create.title')}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{t('users.create.adminOnly')}</TooltipContent>
              {/* Tooltip content only exists while open; this keeps the reason for screen readers. */}
              <span id="create-blocked" className="sr-only">
                {t('users.create.adminOnly')}
              </span>
            </Tooltip>
          )
        }
      />

      {users.isError && !users.data ? (
        <LoadError
          title={t('users.loadFailed')}
          error={users.error}
          onRetry={() => void users.refetch()}
          retrying={users.isFetching}
        />
      ) : (
        <section aria-label={t('users.listLabel')} className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <strong className="font-semibold" aria-live="polite">
              {pagination ? t('users.count', { count: pagination.total_count }) : ' '}
            </strong>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <label htmlFor="page-size">{t('pagination.show')}</label>
              <Select value={String(size)} onValueChange={(value) => goTo({ page: 1, size: Number(value) })}>
                <SelectTrigger id="page-size" size="sm" className="w-32 text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {t('pagination.perPage', { size: option })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-b px-5 py-3">
            {/* A new filter starts again from page 1. */}
            <RoleFilter value={roles} onChange={(next) => goTo({ page: 1, roles: next })} />
            {roles.length > 0 && <p className="text-[13px] text-muted-foreground">{t('users.filter.guestsHidden')}</p>}
          </div>

          {rows && rows.length === 0 && page <= 1 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <img src={`${import.meta.env.BASE_URL}assets/images/numi-thinking.png`} alt="" className="size-30 object-contain" />
              {roles.length > 0 ? (
                <>
                  <strong className="text-[17px] font-semibold">{t('users.filter.emptyTitle')}</strong>
                  <span className="text-muted-foreground">{t('users.filter.emptyDescription')}</span>
                  <Button variant="outline" onClick={() => goTo({ page: 1, roles: [] })}>
                    {t('users.filter.clear')}
                  </Button>
                </>
              ) : (
                <>
                  <strong className="text-[17px] font-semibold">{t('users.empty.title')}</strong>
                  <span className="text-muted-foreground">{t('users.empty.description')}</span>
                </>
              )}
            </div>
          ) : (
            <div
              className={cn('overflow-x-auto transition-opacity', users.isPlaceholderData && 'opacity-60')}
              aria-busy={users.isFetching}
            >
              <UsersTable users={rows} pageSize={size} currentUid={currentUser.uid} onAction={handleAction} />
            </div>
          )}

          {pagination && pagination.total_count > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5">
              <span className="text-sm text-muted-foreground">
                {t('pagination.range', { first, last, total: pagination.total_count })}
              </span>
              <DataPagination page={pagination.page} totalPages={totalPages} onPageChange={(p) => goTo({ page: p })} />
            </div>
          )}
        </section>
      )}

      <UserCreateSheet open={creating} onClose={() => setCreating(false)} />
      <UserEditSheet
        user={editing}
        currentUid={currentUser.uid}
        onClose={() => setEditing(null)}
        onAction={handleAction}
      />
      <DeleteUserDialog target={deleting} onClose={() => setDeleting(null)} />
    </>
  )
}

/** "STUDENT,TEACHER" → known roles in display order; unknown values are dropped. */
function parseRoles(value: string | null): UserRole[] {
  const requested = value?.split(',') ?? []
  return ALL_ROLES.filter((role) => requested.includes(role))
}

function positiveInt(value: string | null): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 ? n : null
}
