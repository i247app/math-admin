import { CalendarClockIcon, LoaderCircleIcon, PauseIcon, PlayIcon, RotateCcwIcon, ZapIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RowAction } from '@/components/RowAction'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { JobInfo, JobRunStatus } from '@/types/System'
import { formatDateTime, parseIsoTime } from '@/utils/Helpers'
import type { PillTone } from '@/components/StatusPill'
import { StatusPill } from '@/components/StatusPill'
import type { JobAction } from './SystemApi'

const runTones: Record<JobRunStatus, PillTone> = {
  succeeded: 'success',
  failed: 'danger',
  panicked: 'danger',
  timed_out: 'warning',
}

type JobsTableProps = {
  /** undefined while loading. */
  jobs: JobInfo[] | undefined
  /** Name of the job whose action is running; its buttons are disabled meanwhile. */
  busyJob: string | null
  onAction: (action: JobAction, job: JobInfo) => void
  onEditSchedule: (job: JobInfo) => void
}

export function JobsTable({ jobs, busyJob, onAction, onEditSchedule }: JobsTableProps) {
  const { t, i18n } = useTranslation()

  return (
    <Table className="min-w-[1080px]">
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead className="pl-5">{t('system.jobs.columns.name')}</TableHead>
          <TableHead>{t('system.jobs.columns.schedule')}</TableHead>
          <TableHead className="w-36">{t('system.jobs.columns.status')}</TableHead>
          <TableHead className="w-56">{t('system.jobs.columns.lastRun')}</TableHead>
          <TableHead className="w-40">{t('system.jobs.columns.nextRun')}</TableHead>
          <TableHead className="w-48 pr-5 text-right">{t('system.jobs.columns.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs
          ? jobs.map((job) => {
              const busy = busyJob === job.name
              const paused = job.status === 'paused'
              return (
                <TableRow key={job.name}>
                  <TableCell className="pl-5 font-mono text-[13px] font-semibold">{job.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[13px]">{job.schedule}</span>
                        {job.schedule_overridden && (
                          <StatusPill tone="info">{t('system.jobs.overridden')}</StatusPill>
                        )}
                      </span>
                      {job.schedule_overridden && (
                        <span className="text-xs text-muted-foreground">
                          {t('system.jobs.defaultSchedule', { schedule: job.default_schedule })}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <StatusPill tone={paused ? 'warning' : 'success'}>{t(`system.jobs.status.${job.status}`)}</StatusPill>
                      {job.in_flight && (
                        <StatusPill tone="info">
                          <LoaderCircleIcon className="animate-spin" aria-hidden />
                          {t('system.jobs.inFlight')}
                        </StatusPill>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1 text-sm">
                      <span className="text-muted-foreground">
                        {formatDateTime(parseIsoTime(job.last_run_at), i18n.language, true)}
                      </span>
                      {job.last_status && (
                        <span className="flex items-center gap-2">
                          <StatusPill tone={runTones[job.last_status]}>
                            {t(`system.jobs.runStatus.${job.last_status}`)}
                          </StatusPill>
                          {job.last_duration_ms && (
                            <span className="text-xs text-muted-foreground">{job.last_duration_ms} ms</span>
                          )}
                        </span>
                      )}
                      {job.last_error && (
                        <span className="line-clamp-2 text-xs break-all text-destructive" title={job.last_error}>
                          {job.last_error}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {paused ? '—' : formatDateTime(parseIsoTime(job.next_run_at), i18n.language, true)}
                  </TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end gap-1">
                      <RowAction
                        label={t('system.jobs.actions.trigger', { name: job.name })}
                        disabled={busy || job.in_flight}
                        onClick={() => onAction('trigger', job)}
                      >
                        <ZapIcon />
                      </RowAction>
                      <RowAction
                        label={t(`system.jobs.actions.${paused ? 'resume' : 'pause'}`, { name: job.name })}
                        disabled={busy}
                        onClick={() => onAction(paused ? 'resume' : 'pause', job)}
                      >
                        {paused ? <PlayIcon /> : <PauseIcon />}
                      </RowAction>
                      <RowAction
                        label={t('system.jobs.actions.editSchedule', { name: job.name })}
                        disabled={busy}
                        onClick={() => onEditSchedule(job)}
                      >
                        <CalendarClockIcon />
                      </RowAction>
                      <RowAction
                        label={
                          job.schedule_overridden
                            ? t('system.jobs.actions.resetSchedule', { name: job.name })
                            : t('system.jobs.actions.resetScheduleNone')
                        }
                        disabled={busy || !job.schedule_overridden}
                        onClick={() => onAction('resetSchedule', job)}
                      >
                        <RotateCcwIcon />
                      </RowAction>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          : Array.from({ length: 4 }, (_, index) => (
              <TableRow key={index} aria-hidden>
                {[40, 36, 20, 32, 28, 32].map((width, cell) => (
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
