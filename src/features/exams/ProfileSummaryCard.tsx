import { StarIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { StatusPill } from '@/components/StatusPill'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ProfileStatusPill } from '@/features/profiles/ProfilesTable'
import { RoleBadge } from '@/features/users/UserBadges'
import type { Profile } from '@/types/Profile'
import { initialsOf } from '@/utils/Helpers'

/** Header card of the profile whose exams are listed. */
export function ProfileSummaryCard({ profile, onChange }: { profile: Profile; onChange: () => void }) {
  const { t } = useTranslation()
  const name = profile.name || profile.profile_code
  const learning = [profile.program?.label, profile.grade?.label, profile.semester?.name].filter(Boolean)
  const contact = profile.phone || profile.email

  return (
    <section aria-label={name} className="flex flex-wrap items-start gap-4 rounded-2xl border bg-card px-5 py-4.5">
      <Avatar className="size-14">
        {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
        <AvatarFallback className="bg-secondary text-lg font-bold text-primary">{initialsOf(name)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 grow flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold">{name}</h2>
          <RoleBadge role={profile.role} />
          <ProfileStatusPill status={profile.profile_status} />
          {profile.is_default && (
            <StatusPill tone="warning">
              <StarIcon className="size-3 fill-current" aria-hidden />
              {t('profiles.default')}
            </StatusPill>
          )}
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <Field label={t('exams.profile.code')}>
            <span className="font-mono">{profile.profile_code}</span> · #{profile.profile_id}
          </Field>
          <Field label={t('exams.profile.account')}>
            <span className="font-mono">#{profile.uid}</span>
            {contact && ` · ${contact}`}
          </Field>
          <Field label={t('exams.profile.learning')}>{learning.length > 0 ? learning.join(' · ') : '—'}</Field>
          <Field label={t('exams.profile.school')}>{profile.school?.name ?? '—'}</Field>
        </dl>
      </div>
      <Button variant="outline" size="sm" onClick={onChange}>
        {t('exams.profile.change')}
      </Button>
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate">{children}</dd>
    </div>
  )
}
