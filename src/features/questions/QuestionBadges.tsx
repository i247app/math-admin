import { useTranslation } from 'react-i18next'
import type { PillTone } from '@/components/StatusPill'
import { StatusPill } from '@/components/StatusPill'
import { Badge } from '@/components/ui/badge'
import type { QuestionKind, QuestionSource, QuestionStatus } from '@/types/Question'
import { cn } from '@/utils/Helpers'

const kindStyles: Record<QuestionKind, string> = {
  SINGLE_CHOICE: 'bg-info-surface text-info',
  MULTIPLE_CHOICE: 'bg-coral-surface text-coral',
  TRUE_FALSE: 'bg-accent text-accent-foreground',
  NUMERIC_INPUT: 'bg-warning-surface text-warning',
}

export function QuestionKindBadge({ kind }: { kind: QuestionKind }) {
  const { t } = useTranslation()
  return <Badge className={cn('h-6 px-2.5 text-xs font-semibold', kindStyles[kind])}>{t(`questions.kinds.${kind}`)}</Badge>
}

const statusTones: Record<QuestionStatus, PillTone> = {
  PENDING_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}

export function QuestionStatusPill({ status }: { status: QuestionStatus | null }) {
  const { t } = useTranslation()
  if (!status) return <span className="text-muted-foreground">—</span>
  return <StatusPill tone={statusTones[status]}>{t(`questions.statuses.${status}`)}</StatusPill>
}

export function QuestionSourcePill({ source }: { source: QuestionSource }) {
  const { t } = useTranslation()
  return <StatusPill tone={source === 'AI' ? 'info' : 'neutral'}>{t(`questions.sources.${source}`)}</StatusPill>
}
