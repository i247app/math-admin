import { useTranslation } from 'react-i18next'
import type { PillTone } from '@/components/StatusPill'
import { StatusPill } from '@/components/StatusPill'
import { Badge } from '@/components/ui/badge'
import type { ExamSession, ExamType, SittingStatus } from '@/types/Exam'
import { cn } from '@/utils/Helpers'

const typeStyles: Record<ExamType, string> = {
  ASSESSMENT: 'bg-info-surface text-info',
  GRADE: 'bg-coral-surface text-coral',
  PRACTICE: 'bg-accent text-accent-foreground',
}

export function ExamTypeBadge({ type }: { type: ExamType }) {
  const { t } = useTranslation()
  return <Badge className={cn('h-6 px-2.5 text-xs font-semibold', typeStyles[type])}>{t(`exams.types.${type}`)}</Badge>
}

const journeyTones: Record<ExamSession['status'], PillTone> = {
  ACTIVE: 'info',
  COMPLETE: 'success',
  CANCEL: 'neutral',
  DELETED: 'danger',
}

export function JourneyStatusPill({ status }: { status: ExamSession['status'] }) {
  const { t } = useTranslation()
  return <StatusPill tone={journeyTones[status]}>{t(`exams.journeyStatus.${status}`)}</StatusPill>
}

export function SittingStatusPill({ status }: { status: SittingStatus }) {
  const { t } = useTranslation()
  if (!status) return null
  const tone: PillTone = status === 'SUBMITTED' ? 'success' : status === 'IN_PROGRESS' ? 'warning' : 'danger'
  return <StatusPill tone={tone}>{t(`exams.sittingStatus.${status}`)}</StatusPill>
}

/** GRADE pass verdict; nothing when the server has none. */
export function VerdictPill({ flag }: { flag: boolean | null }) {
  const { t } = useTranslation()
  if (flag === null) return null
  return (
    <StatusPill tone={flag ? 'success' : 'danger'}>{t(flag ? 'exams.verdict.passed' : 'exams.verdict.failed')}</StatusPill>
  )
}

type ScoreSummaryProps = { correct: number; total: number; skipped: number; percent?: number }

/** "14/20 · 70%", a bar, and the skipped count. */
export function ScoreSummary({ correct, total, skipped, percent }: ScoreSummaryProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm">
        <strong>{t('exams.score', { correct, total })}</strong>
        {percent !== undefined && <span className="text-muted-foreground"> · {percent}%</span>}
      </span>
      {percent !== undefined && (
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className={cn('h-full rounded-full', percent < 50 ? 'bg-destructive' : 'bg-primary')}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      )}
      <span className="text-xs text-muted-foreground">{t('exams.skipped', { count: skipped })}</span>
    </div>
  )
}

/** verified_count: 0 = not verified; every verify (questions re-sent) adds 1. */
export function VerifiedPill({ count }: { count: number }) {
  const { t } = useTranslation()
  return count > 0 ? (
    <StatusPill tone="success">{t('exams.pools.verified', { count })}</StatusPill>
  ) : (
    <StatusPill tone="warning">{t('exams.pools.unverified')}</StatusPill>
  )
}
