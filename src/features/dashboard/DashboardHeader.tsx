import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOutIcon } from 'lucide-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { useMatches, useNavigate } from 'react-router'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { UserAvatar } from '@/components/UserAvatar'
import { Button } from '@/components/ui/button'
import { logout } from '@/features/auth/AuthApi'
import type { RouteHandle } from '@/types/Route'
import type { User } from '@/types/User'
import { userDisplayName } from '@/utils/Helpers'

export function DashboardHeader({ user }: { user: User }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // One crumb per matched route that names itself: "System / Sessions".
  const titleKeys = useMatches()
    .map((match) => (match.handle as RouteHandle | undefined)?.titleKey)
    .filter((key) => key !== undefined)

  const signOut = useMutation({
    mutationFn: logout,
    // The token is dropped either way, so a failed server call is not worth a toast.
    meta: { silentError: true },
    onSettled: () => {
      queryClient.clear()
      void navigate('/sign-in', { replace: true })
    },
  })

  const displayName = userDisplayName(user, t)

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b bg-card px-4 md:px-8">
      <nav aria-label="breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{t('nav.breadcrumbRoot')}</span>
        {titleKeys.map((key, index) => (
          <Fragment key={key}>
            <span aria-hidden>/</span>
            <span className={index === titleKeys.length - 1 ? 'font-bold text-foreground' : undefined}>{t(key)}</span>
          </Fragment>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        <LocaleSwitcher />
        <div className="flex items-center gap-2">
          <UserAvatar user={user} name={displayName} fallbackClassName="bg-success-surface" />
          <span className="hidden max-w-48 truncate text-sm font-medium sm:inline">{displayName}</span>
        </div>
        <Button variant="outline" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
          <LogOutIcon />
          {t('common.logout')}
        </Button>
      </div>
    </header>
  )
}
