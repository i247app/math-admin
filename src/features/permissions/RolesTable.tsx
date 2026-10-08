import { ArchiveIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ItemImage } from '@/components/ItemImage'
import { RowAction } from '@/components/RowAction'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusPill } from '@/components/StatusPill'
import type { Role, RoleStatus } from '@/types/Role'
import { formatServerTime } from '@/utils/Helpers'

export type RoleAction = 'edit' | 'softDelete' | 'forceDelete'

type RolesTableProps = {
  /** undefined while the first page loads. */
  roles: Role[] | undefined
  onAction: (action: RoleAction, role: Role) => void
}

export function RolesTable({ roles, onAction }: RolesTableProps) {
  const { t, i18n } = useTranslation()

  return (
    <Table className="min-w-[960px]">
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead className="w-20 pl-5">{t('roles.columns.id')}</TableHead>
          <TableHead>{t('roles.columns.role')}</TableHead>
          <TableHead>{t('roles.columns.description')}</TableHead>
          <TableHead className="w-32">{t('roles.columns.status')}</TableHead>
          <TableHead className="w-40">{t('roles.columns.created')}</TableHead>
          <TableHead className="w-36 pr-5 text-right">{t('roles.columns.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {roles
          ? roles.map((role) => (
              <TableRow key={role.role_id}>
                <TableCell className="pl-5 font-mono text-[13px] text-muted-foreground">{role.role_id}</TableCell>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-3">
                    <ItemImage url={role.role_image_url} />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-semibold">{role.role_name}</span>
                      <code className="truncate font-mono text-[13px] text-muted-foreground">{role.role_code}</code>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="max-w-80 text-sm">
                  <div className="truncate">{role.description || '—'}</div>
                  {role.note && <div className="truncate text-[13px] text-muted-foreground">{role.note}</div>}
                </TableCell>
                <TableCell>
                  <RoleStatusPill status={role.role_status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatServerTime(role.create_dt, i18n.language)}
                </TableCell>
                <TableCell className="pr-5">
                  <div className="flex justify-end gap-1">
                    <RowAction
                      label={t('roles.actions.edit', { name: role.role_name })}
                      onClick={() => onAction('edit', role)}
                    >
                      <PencilIcon />
                    </RowAction>
                    <RowAction
                      label={t('roles.actions.softDelete', { name: role.role_name })}
                      onClick={() => onAction('softDelete', role)}
                    >
                      <ArchiveIcon />
                    </RowAction>
                    <RowAction
                      label={t('roles.actions.forceDelete', { name: role.role_name })}
                      destructive
                      onClick={() => onAction('forceDelete', role)}
                    >
                      <Trash2Icon />
                    </RowAction>
                  </div>
                </TableCell>
              </TableRow>
            ))
          : Array.from({ length: 5 }, (_, index) => (
              <TableRow key={index} aria-hidden>
                <TableCell className="pl-5">
                  <Skeleton className="h-3 w-10" />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-lg" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-48" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-28" />
                </TableCell>
                <TableCell className="pr-5">
                  <Skeleton className="ml-auto h-3 w-24" />
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  )
}

export function RoleStatusPill({ status }: { status: RoleStatus | undefined }) {
  const { t } = useTranslation()
  if (!status) return <span className="text-muted-foreground">—</span>
  return <StatusPill tone={status === 'ACTIVE' ? 'success' : 'neutral'}>{t(`roles.status.${status}`)}</StatusPill>
}
