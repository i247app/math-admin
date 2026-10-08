import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCwIcon, ShieldOffIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { TitleBar } from '@/features/dashboard/TitleBar'
import { ConfirmActionDialog } from '@/features/system/ConfirmActionDialog'
import type { SessionRowAction } from '@/features/system/SessionsTable'
import { SessionsTable } from '@/features/system/SessionsTable'
import {
  deleteAllSessions,
  deleteSession,
  deleteUnsecureSessions,
  markSessionSecure,
  maskToken,
  sessionsQueryOptions,
} from '@/features/system/SystemApi'
import { isCurrentAuthToken } from '@/libs/ApiClient'
import type { ServerSession } from '@/types/System'
import { cn } from '@/utils/Helpers'

type BulkKind = 'deleteUnsecure' | 'deleteAll'
type SessionAction = { kind: BulkKind } | { kind: SessionRowAction; session: ServerSession }

function runAction(action: SessionAction) {
  switch (action.kind) {
    case 'deleteAll':
      return deleteAllSessions()
    case 'deleteUnsecure':
      return deleteUnsecureSessions()
    case 'deleteOne':
      return deleteSession(action.session.token)
    case 'markSecure':
    case 'markUnsecure':
      return markSessionSecure(action.session.token, action.kind === 'markSecure')
  }
}

export default function SessionsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const sessions = useQuery(sessionsQueryOptions)
  const [target, setTarget] = useState<SessionAction | null>(null)

  const run = useMutation({
    mutationFn: runAction,
    meta: { silentError: true },
    onSuccess: (_data, done) => {
      toast.success(
        'session' in done
          ? t(`system.sessions.${done.kind}.done`, { token: maskToken(done.session.token) })
          : t(`system.sessions.${done.kind}.done`),
      )
      setTarget(null)
    },
    // Also after a failure: SESSION_NOT_FOUND means the row is already stale.
    // When our own session was deleted or un-secured this refetch answers 401,
    // which clears the token and sends the app to /sign-in.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: sessionsQueryOptions.queryKey }),
  })

  function openConfirm(next: SessionAction) {
    run.reset()
    setTarget(next)
  }

  const isDelete = target?.kind === 'deleteOne' || target?.kind === 'deleteAll' || target?.kind === 'deleteUnsecure'

  const rows = sessions.data
  const secureCount = rows?.filter((s) => s.is_secure).length ?? 0

  return (
    <>
      <TitleBar
        title={t('system.sessions.title')}
        description={t('system.sessions.description')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => openConfirm({ kind: 'deleteUnsecure' })}>
              <ShieldOffIcon />
              {t('system.sessions.deleteUnsecure.button')}
            </Button>
            <Button variant="destructive" onClick={() => openConfirm({ kind: 'deleteAll' })}>
              <Trash2Icon />
              {t('system.sessions.deleteAll.button')}
            </Button>
          </div>
        }
      />

      {sessions.isError && !rows ? (
        <LoadError
          title={t('system.sessions.loadFailed')}
          error={sessions.error}
          onRetry={() => void sessions.refetch()}
          retrying={sessions.isFetching}
        />
      ) : (
        <section aria-label={t('system.sessions.listLabel')} className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <strong className="font-semibold" aria-live="polite">
              {rows ? t('system.sessions.count', { count: rows.length, secure: secureCount }) : ' '}
            </strong>
            <Button variant="outline" size="sm" onClick={() => void sessions.refetch()} disabled={sessions.isFetching}>
              <RotateCwIcon className={cn(sessions.isFetching && 'animate-spin')} />
              {t('system.refresh')}
            </Button>
          </div>
          {rows && rows.length === 0 ? (
            <p className="px-6 py-12 text-center text-muted-foreground">{t('system.sessions.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <SessionsTable
                sessions={rows}
                fetchedAt={sessions.dataUpdatedAt}
                onAction={(kind, session) => openConfirm({ kind, session })}
              />
            </div>
          )}
        </section>
      )}

      <ConfirmActionDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target ? t(`system.sessions.${target.kind}.title`) : ''}
        description={target && <ConfirmDescription target={target} />}
        confirmLabel={target ? t(`system.sessions.${target.kind}.confirm`) : ''}
        pendingLabel={isDelete ? t('common.deleting') : t('system.working')}
        pending={run.isPending}
        error={run.error}
        onConfirm={() => target && run.mutate(target)}
      />
    </>
  )
}

function ConfirmDescription({ target }: { target: SessionAction }) {
  const { t } = useTranslation()
  const warn = <strong className="text-destructive" />

  if (!('session' in target)) {
    return (
      <p>
        <Trans i18nKey={`system.sessions.${target.kind}.description`} components={{ warn }} />
      </p>
    )
  }

  const { kind, session } = target
  // Securing our own session changes nothing for us; the other two sign us out.
  const signsSelfOut = kind !== 'markSecure' && isCurrentAuthToken(session.token)
  return (
    <>
      <p>
        <Trans
          i18nKey={`system.sessions.${kind}.description`}
          values={{
            account: session.login_name || session.email || t('system.sessions.anonymous'),
            uid: session.uid || '—',
            token: maskToken(session.token),
          }}
          components={{ strong: <strong className="text-foreground" />, code: <code className="font-mono" />, warn }}
        />
      </p>
      {signsSelfOut && <p className="font-semibold text-destructive">{t('system.sessions.selfSignOutWarning')}</p>}
    </>
  )
}
