import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCwIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { TitleBar } from '@/features/dashboard/TitleBar'
import { JobScheduleDialog } from '@/features/system/JobScheduleDialog'
import { JobsTable } from '@/features/system/JobsTable'
import { StatusPill } from '@/components/StatusPill'
import type { JobAction } from '@/features/system/SystemApi'
import { jobsQueryOptions, runJobAction } from '@/features/system/SystemApi'
import type { JobInfo } from '@/types/System'
import { cn } from '@/utils/Helpers'

export default function JobsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const snapshot = useQuery(jobsQueryOptions)
  const [editing, setEditing] = useState<JobInfo | null>(null)

  // Trigger / pause / resume / reset are reversible, so they run without a confirm.
  const act = useMutation({
    mutationFn: ({ action, job }: { action: JobAction; job: JobInfo }) => runJobAction(action, job.name),
    onSuccess: (_data, { action, job }) => {
      toast.success(t(`system.jobs.done.${action}`, { name: job.name }))
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: jobsQueryOptions.queryKey }),
  })

  const data = snapshot.data
  const jobs = data ? (data.jobs ?? []) : undefined
  const tasks = data?.tasks ?? []

  return (
    <>
      <TitleBar
        title={t('system.jobs.title')}
        description={t('system.jobs.description')}
        actions={
          <Button variant="outline" onClick={() => void snapshot.refetch()} disabled={snapshot.isFetching}>
            <RotateCwIcon className={cn(snapshot.isFetching && 'animate-spin')} />
            {t('system.refresh')}
          </Button>
        }
      />

      {snapshot.isError && !data ? (
        <LoadError
          title={t('system.jobs.loadFailed')}
          error={snapshot.error}
          onRetry={() => void snapshot.refetch()}
          retrying={snapshot.isFetching}
        />
      ) : (
        <>
          {data && (
            <dl className="grid gap-3 sm:grid-cols-3">
              <Summary label={t('system.jobs.runtime')}>
                <StatusPill tone={data.started ? 'success' : 'danger'}>
                  {data.started ? t('system.jobs.started') : t('system.jobs.stopped')}
                </StatusPill>
              </Summary>
              <Summary label={t('system.jobs.queue')}>
                {t('system.jobs.queueValue', { depth: data.queue.depth, capacity: data.queue.capacity })}
              </Summary>
              <Summary label={t('system.jobs.workers')}>{data.queue.workers}</Summary>
            </dl>
          )}

          <section aria-label={t('system.jobs.listLabel')} className="overflow-hidden rounded-2xl border bg-card">
            <div className="border-b px-5 py-4">
              <strong className="font-semibold">{jobs ? t('system.jobs.count', { count: jobs.length }) : ' '}</strong>
            </div>
            {jobs && jobs.length === 0 ? (
              <p className="px-6 py-12 text-center text-muted-foreground">{t('system.jobs.empty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <JobsTable
                  jobs={jobs}
                  busyJob={act.isPending ? act.variables.job.name : null}
                  onAction={(action, job) => act.mutate({ action, job })}
                  onEditSchedule={setEditing}
                />
              </div>
            )}
          </section>

          {tasks.length > 0 && (
            <section aria-labelledby="tasks-title" className="flex flex-col gap-3 rounded-2xl border bg-card p-6">
              <div className="flex flex-col gap-1">
                <h2 id="tasks-title" className="text-lg font-bold">
                  {t('system.jobs.tasks.title')}
                </h2>
                <p className="text-sm text-muted-foreground">{t('system.jobs.tasks.description')}</p>
              </div>
              <ul className="flex flex-wrap gap-2">
                {tasks.map((task) => (
                  <li key={task.name} className="rounded-full bg-secondary px-3 py-1 font-mono text-xs">
                    {task.name}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <JobScheduleDialog job={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function Summary({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border bg-card px-5 py-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-lg font-bold">{children}</dd>
    </div>
  )
}
