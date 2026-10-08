import { LogOutIcon, ShieldCheckIcon, ShieldOffIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RowAction } from '@/components/RowAction'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { isCurrentAuthToken } from '@/libs/ApiClient'
import type { ServerSession } from '@/types/System'
import { formatDateTime, parseIsoTime } from '@/utils/Helpers'
import type { PillTone } from '@/components/StatusPill'
import { StatusPill } from '@/components/StatusPill'
import { maskToken } from './SystemApi'

type SessionState = 'secure' | 'unsecure' | 'expired' | 'deleting'

const stateTones: Record<SessionState, PillTone> = {
  secure: 'success',
  unsecure: 'warning',
  expired: 'neutral',
  deleting: 'danger',
}

function sessionState(session: ServerSession, now: number): SessionState {
  if (session.marked_for_deletion) return 'deleting'
  const expiresAt = parseIsoTime(session.expires_at)
  if (expiresAt && expiresAt.getTime() < now) return 'expired'
  return session.is_secure ? 'secure' : 'unsecure'
}

type SessionsTableProps = {
  /** undefined while loading. */
  sessions: ServerSession[] | undefined
  /** When the list was fetched (ms); "expired" is judged against it. */
  fetchedAt: number
  onAction: (action: SessionRowAction, session: ServerSession) => void
}

export type SessionRowAction = 'markSecure' | 'markUnsecure' | 'deleteOne'

export function SessionsTable({ sessions, fetchedAt, onAction }: SessionsTableProps) {
  const { t, i18n } = useTranslation()

  return (
    <Table className="min-w-[860px]">
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead className="w-36 pl-5">{t('system.sessions.columns.token')}</TableHead>
          <TableHead className="w-24">{t('system.sessions.columns.uid')}</TableHead>
          <TableHead>{t('system.sessions.columns.account')}</TableHead>
          <TableHead className="w-32">{t('system.sessions.columns.source')}</TableHead>
          <TableHead className="w-36">{t('system.sessions.columns.state')}</TableHead>
          <TableHead className="w-44">{t('system.sessions.columns.expiresAt')}</TableHead>
          <TableHead className="w-28 pr-5 text-right">{t('system.sessions.columns.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions
          ? sessions.map((session) => {
              const state = sessionState(session, fetchedAt)
              const account = [session.login_name, session.email].filter(Boolean)
              const isCurrent = isCurrentAuthToken(session.token)
              const token = maskToken(session.token)
              // The server refuses to secure a session nobody is signed into.
              const hasUser = Boolean(session.uid && session.uid > 0)
              return (
                <TableRow key={session.token}>
                  <TableCell className="pl-5">
                    <div className="flex flex-col items-start gap-1">
                      <span className="font-mono text-[13px] text-muted-foreground">{token}</span>
                      {isCurrent && <StatusPill tone="info">{t('system.sessions.current')}</StatusPill>}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-[13px]">{session.uid || '—'}</TableCell>
                  <TableCell>
                    <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                      <span className="truncate">{account[0] ?? t('system.sessions.anonymous')}</span>
                      {account[1] && account[1] !== account[0] && (
                        <span className="truncate text-muted-foreground">{account[1]}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{session.source || '—'}</TableCell>
                  <TableCell>
                    <StatusPill tone={stateTones[state]}>{t(`system.sessions.state.${state}`)}</StatusPill>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(parseIsoTime(session.expires_at), i18n.language)}
                  </TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end gap-1">
                      {session.is_secure ? (
                        <RowAction
                          label={t('system.sessions.markUnsecure.action', { token })}
                          onClick={() => onAction('markUnsecure', session)}
                        >
                          <ShieldOffIcon />
                        </RowAction>
                      ) : (
                        <RowAction
                          label={
                            hasUser
                              ? t('system.sessions.markSecure.action', { token })
                              : t('system.sessions.markSecure.noUser')
                          }
                          disabled={!hasUser}
                          onClick={() => onAction('markSecure', session)}
                        >
                          <ShieldCheckIcon />
                        </RowAction>
                      )}
                      <RowAction
                        label={t('system.sessions.deleteOne.action', { token })}
                        destructive
                        onClick={() => onAction('deleteOne', session)}
                      >
                        <LogOutIcon />
                      </RowAction>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          : Array.from({ length: 6 }, (_, index) => (
              <TableRow key={index} aria-hidden>
                {[20, 12, 40, 16, 20, 28, 8].map((width, cell) => (
                  <TableCell key={cell} className={cell === 0 ? 'pl-5' : undefined}>
                    <Skeleton className="h-3" style={{ width: `${width * 4}px` }} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
      </TableBody>
    </Table>
  )
}
