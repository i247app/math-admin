import { ArchiveIcon, IdCardIcon, PencilIcon, SmartphoneIcon, Trash2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RowAction } from '@/components/RowAction'
import { UserAvatar } from '@/components/UserAvatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { userDevicesPath } from '@/features/devices/DevicesApi'
import { userProfilesPath } from '@/features/profiles/ProfilesApi'
import type { User } from '@/types/User'
import { formatServerTime, userDisplayName } from '@/utils/Helpers'
import { IdentityBadge, RoleBadge } from './UserBadges'

export type UserAction = 'edit' | 'softDelete' | 'forceDelete'

type UsersTableProps = {
  /** undefined while the first page loads. */
  users: User[] | undefined
  pageSize: number
  /** The signed-in admin; their own row can't be deleted. */
  currentUid: number
  onAction: (action: UserAction, user: User) => void
}

export function UsersTable({ users, pageSize, currentUid, onAction }: UsersTableProps) {
  const { t, i18n } = useTranslation()

  return (
    <Table className="min-w-[1040px]">
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead className="w-28 pl-5">{t('users.columns.uid')}</TableHead>
          <TableHead>{t('users.columns.name')}</TableHead>
          <TableHead>{t('users.columns.contact')}</TableHead>
          <TableHead className="w-32">{t('users.columns.role')}</TableHead>
          <TableHead className="w-36">{t('users.columns.identity')}</TableHead>
          <TableHead className="w-40">{t('users.columns.created')}</TableHead>
          <TableHead className="w-44 pr-5 text-right">{t('users.columns.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users
          ? users.map((user) => {
              const name = userDisplayName(user, t)
              const contacts = [user.email, user.phone].filter(Boolean)
              const isSelf = user.uid === currentUid
              return (
                <TableRow key={user.uid}>
                  <TableCell className="pl-5 font-mono text-[13px] text-muted-foreground">{user.uid}</TableCell>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar user={user} name={name} />
                      <span className="truncate font-semibold">{name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                      <span className="truncate">{contacts[0] ?? t('users.noContact')}</span>
                      {contacts[1] && <span className="truncate text-muted-foreground">{contacts[1]}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={user.role} />
                  </TableCell>
                  <TableCell>
                    <IdentityBadge identity={user.identity_code} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatServerTime(user.create_dt, i18n.language)}
                  </TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end gap-1">
                      <RowAction label={t('users.actions.edit', { name })} onClick={() => onAction('edit', user)}>
                        <PencilIcon />
                      </RowAction>
                      <RowAction label={t('users.actions.profiles', { name })} to={userProfilesPath(user.uid)}>
                        <IdCardIcon />
                      </RowAction>
                      <RowAction label={t('users.actions.devices', { name })} to={userDevicesPath(user.uid)}>
                        <SmartphoneIcon />
                      </RowAction>
                      <RowAction
                        label={isSelf ? t('users.selfDeleteBlocked') : t('users.actions.softDelete', { name })}
                        disabled={isSelf}
                        onClick={() => onAction('softDelete', user)}
                      >
                        <ArchiveIcon />
                      </RowAction>
                      <RowAction
                        label={isSelf ? t('users.selfDeleteBlocked') : t('users.actions.forceDelete', { name })}
                        disabled={isSelf}
                        destructive
                        onClick={() => onAction('forceDelete', user)}
                      >
                        <Trash2Icon />
                      </RowAction>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          : Array.from({ length: Math.min(pageSize, 8) }, (_, index) => (
              <TableRow key={index} aria-hidden>
                <TableCell className="pl-5">
                  <Skeleton className="h-3 w-16" />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-9 rounded-full" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-44" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-24 rounded-full" />
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
