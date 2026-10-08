import { ArchiveIcon, ClipboardCheckIcon, PencilIcon, StarIcon, Trash2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { RowAction } from '@/components/RowAction'
import { StatusPill } from '@/components/StatusPill'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { profileExamsPath } from '@/features/exams/ExamsApi'
import { RoleBadge } from '@/features/users/UserBadges'
import type { Profile, ProfileStatus } from '@/types/Profile'
import { formatServerTime, initialsOf } from '@/utils/Helpers'
import { userProfilesPath } from './ProfilesApi'

export type ProfileAction = 'edit' | 'softDelete' | 'forceDelete'

type ProfilesTableProps = {
  /** undefined while the first page loads. */
  profiles: Profile[] | undefined
  /** Exam reads are admin-only on the server. */
  canViewExams: boolean
  onAction: (action: ProfileAction, profile: Profile) => void
}

export function ProfilesTable({ profiles, canViewExams, onAction }: ProfilesTableProps) {
  const { t, i18n } = useTranslation()

  return (
    <Table className="min-w-[1080px]">
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead className="w-28 pl-5">{t('profiles.columns.id')}</TableHead>
          <TableHead>{t('profiles.columns.profile')}</TableHead>
          <TableHead className="w-28">{t('profiles.columns.owner')}</TableHead>
          <TableHead className="w-28">{t('profiles.columns.role')}</TableHead>
          <TableHead>{t('profiles.columns.learning')}</TableHead>
          <TableHead className="w-32">{t('profiles.columns.status')}</TableHead>
          <TableHead className="w-40">{t('profiles.columns.created')}</TableHead>
          <TableHead className="w-44 pr-5 text-right">{t('profiles.columns.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {profiles
          ? profiles.map((profile) => {
              const name = profile.name || profile.profile_code
              const learning = [profile.program?.label, profile.grade?.label, profile.semester?.name].filter(Boolean)
              return (
                <TableRow key={profile.profile_id}>
                  <TableCell className="pl-5">
                    <div className="flex flex-col gap-0.5">
                      <code className="font-mono text-[13px] font-semibold">{profile.profile_code}</code>
                      <span className="font-mono text-xs text-muted-foreground">{profile.profile_id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-9">
                        {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
                        <AvatarFallback className="bg-secondary text-[13px] font-bold text-primary">
                          {initialsOf(name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <span className="truncate">{name}</span>
                          {profile.is_default && (
                            <StarIcon
                              className="size-3.5 shrink-0 fill-warning text-warning"
                              aria-label={t('profiles.default')}
                            />
                          )}
                        </span>
                        <span className="truncate text-[13px] text-muted-foreground">
                          {profile.phone || profile.email || '—'}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      to={userProfilesPath(profile.uid)}
                      className="font-mono text-[13px] text-primary underline-offset-4 hover:underline"
                      aria-label={t('profiles.filterByOwner', { uid: profile.uid })}
                    >
                      {profile.uid}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={profile.role} />
                  </TableCell>
                  <TableCell className="max-w-72 text-sm">
                    <div className="truncate">{learning.length > 0 ? learning.join(' · ') : '—'}</div>
                    {profile.school && (
                      <div className="truncate text-[13px] text-muted-foreground">{profile.school.name}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <ProfileStatusPill status={profile.profile_status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatServerTime(profile.create_dt, i18n.language)}
                  </TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end gap-1">
                      {canViewExams && (
                        <RowAction label={t('profiles.actions.exams', { name })} to={profileExamsPath(profile.profile_id)}>
                          <ClipboardCheckIcon />
                        </RowAction>
                      )}
                      <RowAction label={t('profiles.actions.edit', { name })} onClick={() => onAction('edit', profile)}>
                        <PencilIcon />
                      </RowAction>
                      <RowAction
                        label={t('profiles.actions.softDelete', { name })}
                        onClick={() => onAction('softDelete', profile)}
                      >
                        <ArchiveIcon />
                      </RowAction>
                      <RowAction
                        label={t('profiles.actions.forceDelete', { name })}
                        destructive
                        onClick={() => onAction('forceDelete', profile)}
                      >
                        <Trash2Icon />
                      </RowAction>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          : Array.from({ length: 6 }, (_, index) => (
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
                  <Skeleton className="h-3 w-12" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-44" />
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

const statusTones = { OFFICIAL: 'success', INCOMPLETE: 'warning', ACTIVE: 'info', INACTIVE: 'neutral', DELETED: 'danger' } as const

export function ProfileStatusPill({ status }: { status: ProfileStatus | undefined }) {
  const { t } = useTranslation()
  if (!status) return <span className="text-muted-foreground">—</span>
  return <StatusPill tone={statusTones[status]}>{t(`profiles.status.${status}`)}</StatusPill>
}
