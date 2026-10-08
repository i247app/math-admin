import { useQuery } from '@tanstack/react-query'
import { RotateCwIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { DbPoolStats } from '@/types/System'
import { cn, formatDateTime, parseIsoTime } from '@/utils/Helpers'
import { dbPoolStatsQueryOptions } from './SystemApi'

/** Live MySQL pool gauges from /misc/db-pool-stats, refreshed on demand. */
export function DbPoolStatsCard() {
  const { t, i18n } = useTranslation()
  const stats = useQuery(dbPoolStatsQueryOptions)

  if (stats.isError && !stats.data) {
    return (
      <LoadError
        title={t('system.data.stats.loadFailed')}
        error={stats.error}
        onRetry={() => void stats.refetch()}
        retrying={stats.isFetching}
      />
    )
  }

  const data = stats.data
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 })

  return (
    <section aria-labelledby="db-stats-title" className="flex flex-col gap-5 rounded-2xl border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="db-stats-title" className="text-lg font-bold">
            {t('system.data.stats.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {data
              ? t('system.data.stats.capturedAt', {
                  time: formatDateTime(parseIsoTime(data.captured_at), i18n.language, true),
                })
              : ' '}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void stats.refetch()} disabled={stats.isFetching}>
          <RotateCwIcon className={cn(stats.isFetching && 'animate-spin')} />
          {t('system.refresh')}
        </Button>
      </div>

      {data ? (
        <>
          <Utilization data={data} />
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Stat label={t('system.data.stats.open')} value={number.format(data.open_connections)} />
            <Stat label={t('system.data.stats.idle')} value={number.format(data.idle)} />
            <Stat label={t('system.data.stats.waitCount')} value={number.format(data.wait_count)} />
            <Stat label={t('system.data.stats.waitDuration')} value={`${number.format(data.wait_duration_ms)} ms`} />
            <Stat label={t('system.data.stats.avgWait')} value={`${number.format(data.avg_wait_duration_ms)} ms`} />
            <Stat label={t('system.data.stats.maxIdleClosed')} value={number.format(data.max_idle_closed)} />
            <Stat label={t('system.data.stats.maxIdleTimeClosed')} value={number.format(data.max_idle_time_closed)} />
            <Stat label={t('system.data.stats.maxLifetimeClosed')} value={number.format(data.max_lifetime_closed)} />
            <Stat label={t('system.data.stats.isolation')} value={data.isolation_level} mono />
            <Stat
              label={t('system.data.stats.autocommit')}
              value={data.autocommit ? t('system.data.stats.on') : t('system.data.stats.off')}
            />
          </dl>
          <p className="text-xs text-muted-foreground">{t('system.data.stats.cumulativeHint')}</p>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-hidden>
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-18 rounded-xl" />
          ))}
        </div>
      )}
    </section>
  )
}

function Utilization({ data }: { data: DbPoolStats }) {
  const { t } = useTranslation()
  const unlimited = data.max_open_connections === 0
  const percent = Math.min(100, Math.max(0, data.utilization_percent))
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{t('system.data.stats.inUse')}</span>
        <span className="text-sm text-muted-foreground">
          {unlimited
            ? t('system.data.stats.inUseUnlimited', { inUse: data.in_use })
            : t('system.data.stats.inUseOf', { inUse: data.in_use, max: data.max_open_connections, percent: percent.toFixed(1) })}
        </span>
      </div>
      {!unlimited && (
        <div
          role="meter"
          aria-label={t('system.data.stats.inUse')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-2.5 overflow-hidden rounded-full bg-secondary"
        >
          <div
            className={cn('h-full rounded-full', percent >= 90 ? 'bg-destructive' : percent >= 70 ? 'bg-warning' : 'bg-primary')}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-muted/50 px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('text-lg font-bold', mono && 'font-mono text-base')}>{value}</dd>
    </div>
  )
}
