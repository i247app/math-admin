import { CheckIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { UserRole } from '@/types/User'
import { ALL_ROLES } from '@/types/User'

type RoleFilterProps = {
  /** Selected roles; empty = every user. */
  value: UserRole[]
  onChange: (roles: UserRole[]) => void
}

/** Toggle buttons, one per role, any number selected. "All" clears the filter. */
export function RoleFilter({ value, onChange }: RoleFilterProps) {
  const { t } = useTranslation()

  function toggle(role: UserRole) {
    const next = value.includes(role) ? value.filter((r) => r !== role) : [...value, role]
    // Same order as ALL_ROLES, so the URL and the query key don't depend on click order.
    onChange(ALL_ROLES.filter((r) => next.includes(r)))
  }

  return (
    <div role="group" aria-labelledby="role-filter-label" className="flex flex-wrap items-center gap-2">
      <span id="role-filter-label" className="mr-1 text-sm text-muted-foreground">
        {t('users.filter.label')}
      </span>
      <Chip pressed={value.length === 0} onClick={() => onChange([])}>
        {t('users.filter.all')}
      </Chip>
      {ALL_ROLES.map((role) => (
        <Chip key={role} pressed={value.includes(role)} onClick={() => toggle(role)}>
          {t(`users.roles.${role}`)}
        </Chip>
      ))}
    </div>
  )
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <Button
      type="button"
      variant={pressed ? 'default' : 'outline'}
      size="sm"
      aria-pressed={pressed}
      onClick={onClick}
      className="rounded-full"
    >
      {pressed && <CheckIcon aria-hidden />}
      {children}
    </Button>
  )
}
