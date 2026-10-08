import { ChevronRightIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ExamPool } from '@/types/Exam'
import { formatServerTime } from '@/utils/Helpers'
import { ExamTypeBadge, VerifiedPill } from './ExamBadges'
import { gradeLevelLabel } from './ExamHelpers'
import { examPoolPath } from './ExamPoolsApi'

/** The pool, newest first; the whole row opens the set. `pools` is undefined while the first page loads. */
export function ExamPoolsTable({ pools }: { pools: ExamPool[] | undefined }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  return (
    <Table className="min-w-[980px]">
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead className="w-24 pl-5">{t('exams.pools.list.columns.id')}</TableHead>
          <TableHead>{t('exams.pools.list.columns.title')}</TableHead>
          <TableHead className="w-40">{t('exams.pools.list.columns.type')}</TableHead>
          <TableHead className="w-36">{t('exams.pools.list.columns.gradeLevel')}</TableHead>
          <TableHead className="w-24">{t('exams.pools.list.columns.questions')}</TableHead>
          <TableHead className="w-44">{t('exams.pools.list.columns.verified')}</TableHead>
          <TableHead className="w-40">{t('exams.pools.list.columns.created')}</TableHead>
          <TableHead className="w-10 pr-5" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {pools
          ? pools.map((pool) => {
              const path = examPoolPath(pool.exam_id)
              return (
                <TableRow key={pool.exam_id} className="cursor-pointer" onClick={() => void navigate(path)}>
                  <TableCell className="pl-5">
                    <Link
                      to={path}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={t('exams.pools.list.open', { id: pool.exam_id })}
                      className="font-mono text-[13px] font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      #{pool.exam_id}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-96">
                    <div className="flex flex-col gap-0.5">
                      <span className="truncate font-semibold">{pool.ai_title || '—'}</span>
                      {pool.ai_short_text && (
                        <span className="truncate text-[13px] text-muted-foreground">{pool.ai_short_text}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ExamTypeBadge type={pool.exam_type} />
                  </TableCell>
                  <TableCell className="text-sm">{gradeLevelLabel(t, pool.grade, pool.level)}</TableCell>
                  <TableCell className="text-sm">{pool.num_questions}</TableCell>
                  <TableCell>
                    <VerifiedPill count={pool.verified_count} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatServerTime(pool.create_dt, i18n.language)}
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
                  <Skeleton className="h-3 w-56" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-28 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-8" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-28 rounded-full" />
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
