import { ArchiveIcon, CheckIcon, Trash2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RowAction } from '@/components/RowAction'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { VerifiedPill } from '@/features/exams/ExamBadges'
import { gradeLevelLabel } from '@/features/exams/ExamHelpers'
import type { Question } from '@/types/Question'
import { formatServerTime } from '@/utils/Helpers'
import type { QuestionDeleteKind } from './DeleteQuestionDialog'
import { QuestionKindBadge, QuestionSourcePill, QuestionStatusPill } from './QuestionBadges'

const MAX_TAGS_SHOWN = 3

/** The key in words: the correct options' text (or id when an option is image-only), Đúng / Sai, or the accepted numbers. */
function useAnswerSummary() {
  const { t } = useTranslation()
  return (question: Question) => {
    if (question.question_kind === 'NUMERIC_INPUT') return (question.correct_answer.values ?? []).join(' · ')
    if (question.question_kind === 'TRUE_FALSE') {
      return t(`questions.trueFalse.${question.correct_answer.value ? 'true' : 'false'}`)
    }
    const ids = question.correct_answer.option_ids ?? []
    return (question.options ?? [])
      .filter((option) => ids.includes(option.id))
      .map((option) => option.text || `(${option.id})`)
      .join(' · ')
  }
}

type QuestionsTableProps = {
  /** undefined while the first page loads. */
  questions: Question[] | undefined
  onOpen: (question: Question) => void
  /** Clicking a tag chip filters the list by it. */
  onTag: (tag: string) => void
  onDelete: (kind: QuestionDeleteKind, question: Question) => void
}

/** The bank, newest first; a row opens the editor (the list carries every field). */
export function QuestionsTable({ questions, onOpen, onTag, onDelete }: QuestionsTableProps) {
  const { t, i18n } = useTranslation()
  const answerSummary = useAnswerSummary()

  return (
    <Table className="min-w-[1380px]">
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead className="w-20 pl-5">{t('questions.columns.id')}</TableHead>
          <TableHead className="min-w-80">{t('questions.columns.question')}</TableHead>
          <TableHead className="w-36">{t('questions.columns.kind')}</TableHead>
          <TableHead className="w-32">{t('questions.columns.gradeLevel')}</TableHead>
          <TableHead className="w-52">{t('questions.columns.topic')}</TableHead>
          <TableHead className="w-24">{t('questions.columns.source')}</TableHead>
          <TableHead className="w-32">{t('questions.columns.status')}</TableHead>
          <TableHead className="w-36">{t('questions.columns.verified')}</TableHead>
          <TableHead className="w-36">{t('questions.columns.modified')}</TableHead>
          <TableHead className="w-24 pr-5 text-right">{t('questions.columns.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {questions
          ? questions.map((question) => {
              const tags = question.question_tags
              return (
                <TableRow key={question.question_pool_id} className="cursor-pointer" onClick={() => onOpen(question)}>
                  <TableCell className="pl-5 align-top">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpen(question)
                      }}
                      aria-label={t('questions.open', { id: question.question_pool_id })}
                      className="font-mono text-[13px] font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      #{question.question_pool_id}
                    </button>
                  </TableCell>
                  <TableCell className="min-w-80 max-w-[440px] align-top whitespace-normal">
                    <div className="flex gap-3">
                      {question.question_image_url && (
                        <img
                          src={question.question_image_url}
                          alt=""
                          className="size-12 shrink-0 rounded-lg border object-cover"
                        />
                      )}
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="line-clamp-2 font-semibold">{question.question_text}</span>
                        <span className="flex items-center gap-1 truncate text-[13px] text-success">
                          <CheckIcon className="size-3.5 shrink-0" aria-hidden />
                          <span className="sr-only">{t('questions.answerLabel')}</span>
                          <span className="truncate">{answerSummary(question)}</span>
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <QuestionKindBadge kind={question.question_kind} />
                  </TableCell>
                  <TableCell className="align-top text-sm">
                    {gradeLevelLabel(t, question.question_grade, question.question_level ?? undefined)}
                  </TableCell>
                  <TableCell className="align-top whitespace-normal">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm">{question.question_topic ?? '—'}</span>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {tags.slice(0, MAX_TAGS_SHOWN).map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                onTag(tag)
                              }}
                              aria-label={t('questions.filterByTag', { tag })}
                              className="rounded-md bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            >
                              #{tag}
                            </button>
                          ))}
                          {tags.length > MAX_TAGS_SHOWN && (
                            <span className="px-1 text-xs text-muted-foreground">
                              +{tags.length - MAX_TAGS_SHOWN}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <QuestionSourcePill source={question.question_source} />
                  </TableCell>
                  <TableCell className="align-top">
                    <QuestionStatusPill status={question.question_status} />
                  </TableCell>
                  <TableCell className="align-top">
                    <VerifiedPill count={question.verified_count} />
                  </TableCell>
                  <TableCell className="align-top text-sm text-muted-foreground">
                    {formatServerTime(question.modify_dt, i18n.language)}
                  </TableCell>
                  <TableCell className="pr-5 align-top">
                    {/* The row opens the editor; these buttons must not. */}
                    <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                      <RowAction
                        label={t('questions.actions.softDelete', { id: question.question_pool_id })}
                        onClick={() => onDelete('softDelete', question)}
                      >
                        <ArchiveIcon />
                      </RowAction>
                      <RowAction
                        label={t('questions.actions.forceDelete', { id: question.question_pool_id })}
                        destructive
                        onClick={() => onDelete('forceDelete', question)}
                      >
                        <Trash2Icon />
                      </RowAction>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          : Array.from({ length: 6 }, (_, index) => (
              <TableRow key={index} aria-hidden>
                <TableCell className="pl-5">
                  <Skeleton className="h-3 w-12" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-72" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-24 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-24 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-24" />
                </TableCell>
                <TableCell className="pr-5">
                  <Skeleton className="ml-auto h-8 w-16" />
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  )
}
