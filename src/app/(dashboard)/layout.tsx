import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet } from 'react-router'
import { LoadError } from '@/components/LoadError'
import { Skeleton } from '@/components/ui/skeleton'
import { sessionQueryOptions } from '@/features/auth/AuthApi'
import { DashboardHeader } from '@/features/dashboard/DashboardHeader'
import { Sidebar } from '@/features/dashboard/Sidebar'
import { ApiError } from '@/libs/ApiClient'

/**
 * Signed-in shell: sidebar + header, page content in <Outlet />.
 * Also the route guard: nothing below renders until the session is restored.
 */
export default function DashboardLayout() {
  const { t } = useTranslation()
  const session = useQuery(sessionQueryOptions)

  if (session.isPending) {
    return (
      <div aria-busy="true" aria-label={t('auth.restoringSession')} className="flex min-h-screen">
        <Skeleton className="hidden w-62 shrink-0 rounded-none md:block" />
        <div className="flex flex-1 flex-col gap-6 p-8">
          <Skeleton className="h-8 w-60" />
          <Skeleton className="h-64 w-full max-w-7xl" />
        </div>
      </div>
    )
  }

  if (session.isError && !(session.error instanceof ApiError && session.error.isUnauthorized)) {
    // Server unreachable or failing: keep the token and let the user retry.
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <LoadError
          title={t('auth.restoreFailed')}
          error={session.error}
          onRetry={() => void session.refetch()}
          retrying={session.isFetching}
          className="w-full max-w-xl"
        />
      </div>
    )
  }

  // No session (no token, or the server answered 401).
  if (!session.data) return <Navigate to="/sign-in" replace />

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader user={session.data} />
        <main className="flex w-full max-w-7xl flex-col gap-6 px-4 py-5 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
