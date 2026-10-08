import { ChevronRightIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ExamSitting } from '@/types/Exam'
import { formatServerTime } from '@/utils/Helpers'
import { ScoreSummary } from './ExamBadges'
import { gradeLevelLabel } from './ExamHelpers'

/** A journey's submitted sittings; the whole row opens the sitting. */
export function SittingsTable({ sittings, hrefOf }: { sittings: ExamSitting[]; hrefOf: (sitting: ExamSitting) => string }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  return (
    <Table className="min-w-[960px]">
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead className="w-28 pl-5">{t('exams.journey.sittings.columns.id')}</TableHead>
          <TableHead>{t('exams.journey.sittings.columns.title')}</TableHead>
          <TableHead className="w-36">{t('exams.journey.sittings.columns.gradeLevel')}</TableHead>
          <TableHead className="w-24">{t('exams.journey.sittings.columns.questions')}</TableHead>
          <TableHead className="w-40">{t('exams.journey.sittings.columns.result')}</TableHead>
          <TableHead className="w-40">{t('exams.journey.sittings.columns.started')}</TableHead>
          <TableHead className="w-40">{t('exams.journey.sittings.columns.submitted')}</TableHead>
          <TableHead className="w-10 pr-5" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sittings.map((sitting) => {
          const href = hrefOf(sitting)
          return (
            <TableRow key={sitting.elink_id} className="cursor-pointer" onClick={() => void navigate(href)}>
              <TableCell className="pl-5">
                <Link
                  to={href}
                  onClick={(event) => event.stopPropagation()}
                  aria-label={t('exams.journey.sittings.open', { id: sitting.elink_id })}
                  className="font-mono text-[13px] font-semibold text-primary underline-offset-4 hover:underline"
                >
                  #{sitting.elink_id}
                </Link>
              </TableCell>
              <TableCell className="max-w-72 truncate">{sitting.ai_title || '—'}</TableCell>
              <TableCell className="text-sm">{gradeLevelLabel(t, sitting.grade, sitting.level)}</TableCell>
              <TableCell className="text-sm">{sitting.num_questions}</TableCell>
              <TableCell>
                {sitting.result ? (
                  <ScoreSummary
                    correct={sitting.result.correct_number}
                    total={sitting.result.total_questions}
                    skipped={sitting.result.skipped_number}
                    percent={sitting.result.score_percentage}
                  />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatServerTime(sitting.started_dt, i18n.language)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatServerTime(sitting.submitted_dt, i18n.language)}
              </TableCell>
              <TableCell className="pr-5 text-muted-foreground">
                <ChevronRightIcon className="size-4" aria-hidden />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
