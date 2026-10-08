import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { IdentityCode, UserRole } from '@/types/User'
import { cn } from '@/utils/Helpers'

const pill = 'h-6 px-2.5 text-xs font-semibold'

const roleStyles: Record<UserRole | 'GUEST', string> = {
  STUDENT: 'bg-info-surface text-info',
  TEACHER: 'bg-coral-surface text-coral',
  PARENT: 'bg-accent text-accent-foreground',
  ADMIN: 'bg-primary text-primary-foreground',
  GUEST: 'bg-secondary text-muted-foreground',
}

/** Role pill; a null role is a guest. */
export function RoleBadge({ role }: { role: UserRole | null }) {
  const { t } = useTranslation()
  const key = role ?? 'GUEST'
  return <Badge className={cn(pill, roleStyles[key])}>{t(`users.roles.${key}`)}</Badge>
}

const identityStyles: Record<IdentityCode, string> = {
  VERIFIED: 'bg-success-surface text-success',
  USER: 'bg-secondary text-secondary-foreground',
  GUEST: 'bg-secondary text-muted-foreground',
}

export function IdentityBadge({ identity }: { identity: IdentityCode | null }) {
  const { t } = useTranslation()
  const key = identity ?? 'GUEST'
  return <Badge className={cn(pill, identityStyles[key])}>{t(`users.identity.${key}`)}</Badge>
}
