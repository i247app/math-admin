import { ChevronRightIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ExamSession, ExamSitting } from '@/types/Exam'
import { formatServerTime } from '@/utils/Helpers'
import { ExamTypeBadge, JourneyStatusPill, ScoreSummary, VerdictPill } from './ExamBadges'
import { gradeLevelLabel, journeyTypeOf } from './ExamHelpers'
import type { JourneyRef } from './ExamsApi'
import { journeyPath, sittingPath } from './ExamsApi'

type JourneysTableProps = {
  profileId: number
  /** undefined while the first page loads. */
  sessions: ExamSession[] | undefined
}

/** A profile's journeys; the whole row opens the journey. */
export function JourneysTable({ profileId, sessions }: JourneysTableProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  return (
    <Table className="min-w-[1120px]">
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead className="w-24 pl-5">{t('exams.list.columns.id')}</TableHead>
          <TableHead>{t('exams.list.columns.journey')}</TableHead>
          <TableHead className="w-36">{t('exams.list.columns.gradeLevel')}</TableHead>
          <TableHead className="w-40">{t('exams.list.columns.status')}</TableHead>
          <TableHead className="w-40">{t('exams.list.columns.result')}</TableHead>
          <TableHead className="w-32">{t('exams.list.columns.practice')}</TableHead>
          <TableHead className="w-40">{t('exams.list.columns.lastSubmitted')}</TableHead>
          <TableHead className="w-40">{t('exams.list.columns.started')}</TableHead>
          <TableHead className="w-10 pr-5" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions
          ? sessions.map((session) => {
              const ref: JourneyRef = { profileId, esessId: session.esess_id, type: journeyTypeOf(session) }
              const path = journeyPath(ref)
              const open = session.in_progress_exams ?? []
              return (
                <TableRow key={session.esess_id} className="cursor-pointer" onClick={() => void navigate(path)}>
                  <TableCell className="pl-5">
                    <Link
                      to={path}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={t('exams.list.open', { id: session.esess_id })}
                      className="font-mono text-[13px] font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      #{session.esess_id}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-80">
                    <div className="flex flex-col items-start gap-1">
                      <ExamTypeBadge type={session.exam_type} />
                      <span className="max-w-full truncate text-[13px] text-muted-foreground">
                        {session.ai_title || '—'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{gradeLevelLabel(t, session.grade, session.level)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <JourneyStatusPill status={session.status} />
                      <VerdictPill flag={session.esess_flag} />
                      {open.length > 0 && <InProgressLink journey={ref} sittings={open} />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ScoreSummary
                      correct={session.correct_number}
                      total={session.total_questions}
                      skipped={session.skipped_number}
                      percent={session.score_percentage}
                    />
                  </TableCell>
                  <TableCell className="text-sm">
                    {session.practice ? (
                      <>
                        {t('exams.score', {
                          correct: session.practice.correct_number,
                          total: session.practice.total_questions,
                        })}
                        {session.practice.score_percentage !== undefined && (
                          <span className="text-muted-foreground"> · {session.practice.score_percentage}%</span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatServerTime(session.last_submitted_dt, i18n.language)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatServerTime(session.create_dt, i18n.language)}
                  </TableCell>
                  <TableCell className="pr-5 text-muted-foreground">
                    <ChevronRightIcon className="size-4" aria-hidden />
                  </TableCell>
                </TableRow>
              )
            })
          : Array.from({ length: 5 }, (_, index) => (
              <TableRow key={index} aria-hidden>
                <TableCell className="pl-5">
                  <Skeleton className="h-3 w-14" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-40 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-24 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-28" />
                </TableCell>
                <TableCell className="pr-5" />
              </TableRow>
            ))}
      </TableBody>
    </Table>
  )
}

const inProgressClass =
  'inline-flex h-6 items-center rounded-full bg-warning-surface px-2.5 text-xs font-semibold text-warning underline-offset-4 hover:underline'

/**
 * The only way into an unsubmitted sitting: the journey detail does not return them.
 * Clicks stop here so the row does not navigate too (React events bubble through portals).
 */
function InProgressLink({ journey, sittings }: { journey: JourneyRef; sittings: ExamSitting[] }) {
  const { t, i18n } = useTranslation()
  const label = t('exams.list.inProgress', { count: sittings.length })
  const hrefOf = (sitting: ExamSitting) =>
    sittingPath(journey.profileId, sitting.elink_id, { esessId: journey.esessId, type: journey.type })

  if (sittings.length === 1) {
    return (
      <Link to={hrefOf(sittings[0])} onClick={(event) => event.stopPropagation()} className={inProgressClass}>
        {label}
      </Link>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={inProgressClass} onClick={(event) => event.stopPropagation()}>
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(event) => event.stopPropagation()}>
        {sittings.map((sitting) => (
          <DropdownMenuItem key={sitting.elink_id} asChild>
            <Link to={hrefOf(sitting)}>
              {t('exams.list.inProgressItem', {
                id: sitting.elink_id,
                type: t(`exams.types.${sitting.exam_type}`),
                time: formatServerTime(sitting.started_dt || sitting.create_dt, i18n.language),
              })}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
