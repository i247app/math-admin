import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileJsonIcon } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert } from '@/components/FormAlert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getErrorMessage } from '@/libs/ApiClient'
import type { ImportQuestionsReport } from '@/types/Question'
import { cn } from '@/utils/Helpers'
import { IMPORT_FILE_MAX_BYTES, importQuestionFile, questionsQueryKey, validateQuestionFile } from './QuestionsApi'

type ImportQuestionsDialogProps = {
  open: boolean
  onClose: () => void
}

/**
 * Import a .json file of questions: picking a file runs validate-file (writes nothing) and shows
 * its report; Import is offered only when no question is invalid, since import-file refuses the
 * whole file otherwise. Duplicates are skipped by the server, not refused.
 */
export function ImportQuestionsDialog({ open, onClose }: ImportQuestionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="gap-5 rounded-2xl p-7 sm:max-w-[640px]">{open && <ImportBody onClose={onClose} />}</DialogContent>
    </Dialog>
  )
}

function ImportBody({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const validate = useMutation({ mutationFn: validateQuestionFile, meta: { silentError: true } })
  const importFile = useMutation({
    mutationFn: importQuestionFile,
    meta: { silentError: true },
    onSuccess: (report) => {
      void queryClient.invalidateQueries({ queryKey: questionsQueryKey })
      toast.success(t('questions.import.done', { count: report.imported_count }))
    },
  })

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0]
    event.target.value = '' // picking the same file again re-validates it
    if (!picked) return
    validate.reset()
    importFile.reset()
    setFile(null)
    // Same checks as readImportFile, so an obviously wrong file never travels.
    if (!picked.name.toLowerCase().endsWith('.json')) return setFileError(t('questions.import.notJson'))
    if (picked.size > IMPORT_FILE_MAX_BYTES) return setFileError(t('questions.import.tooLarge'))
    setFileError(null)
    setFile(picked)
    validate.mutate(picked)
  }

  const imported = importFile.data
  const report = imported ?? validate.data
  const error = fileError ?? (validate.isError ? getErrorMessage(validate.error) : null) ??
    (importFile.isError ? getErrorMessage(importFile.error) : null)
  const busy = validate.isPending || importFile.isPending
  const canImport = !!file && !!validate.data && !imported && validate.data.invalid_count === 0 && validate.data.importable_count > 0

  return (
    <>
      <DialogHeader className="gap-2 text-left">
        <DialogTitle className="text-xl font-bold">{t('questions.import.title')}</DialogTitle>
        <DialogDescription className="leading-relaxed text-muted-foreground">{t('questions.import.description')}</DialogDescription>
      </DialogHeader>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3.5 hover:bg-muted/50">
        <FileJsonIcon className="size-6 shrink-0 text-primary" aria-hidden />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{file?.name ?? t('questions.import.pick')}</span>
          <span className="text-sm text-muted-foreground">
            {validate.isPending ? t('questions.import.validating') : t('questions.import.pickHint')}
          </span>
        </span>
        <input type="file" accept=".json,application/json" className="sr-only" disabled={busy} onChange={handleFile} />
      </label>

      {error && <FormAlert>{error}</FormAlert>}
      {report && !error && <ImportReport report={report} imported={!!imported} />}

      <DialogFooter className="gap-3">
        <Button variant="outline" className="h-11 rounded-xl px-4.5" disabled={importFile.isPending} onClick={onClose}>
          {imported ? t('questions.import.close') : t('common.cancel')}
        </Button>
        {!imported && (
          <Button className="h-11 rounded-xl px-4.5" disabled={!canImport || busy} onClick={() => file && importFile.mutate(file)}>
            {importFile.isPending
              ? t('questions.import.importing')
              : t('questions.import.confirm', { count: validate.data?.importable_count ?? 0 })}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}

function ImportReport({ report, imported }: { report: ImportQuestionsReport; imported: boolean }) {
  const { t } = useTranslation()
  const stats = [
    ['total', report.total],
    ['valid', report.valid_count],
    ['invalid', report.invalid_count],
    ['duplicateInFile', report.duplicate_in_file_count],
    ['duplicateInPool', report.duplicate_in_pool_count],
    imported ? (['imported', report.imported_count] as const) : (['importable', report.importable_count] as const),
  ] as const

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {stats.map(([key, value]) => (
          <div
            key={key}
            className={cn(
              'rounded-xl bg-muted/60 px-3.5 py-2.5',
              key === 'invalid' && value > 0 && 'bg-destructive-surface text-destructive',
              (key === 'importable' || key === 'imported') && value > 0 && 'bg-success-surface',
            )}
          >
            <dt className="text-xs">{t(`questions.import.stats.${key}`)}</dt>
            <dd className="text-lg font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      {report.invalid_count > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t('questions.import.errorsTitle')}</h3>
          <ul className="max-h-48 overflow-y-auto rounded-xl border px-3.5 py-2 font-mono text-xs leading-relaxed">
            {report.errors.map((issue, i) => (
              <li key={i} className="break-words">
                {issue.message}
              </li>
            ))}
          </ul>
          {report.errors_truncated && (
            <p className="text-xs text-muted-foreground">{t('questions.import.errorsTruncated', { count: report.errors.length })}</p>
          )}
          <p className="text-sm text-muted-foreground">{t('questions.import.fixFirst')}</p>
        </section>
      )}

      {report.duplicates.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t('questions.import.duplicatesTitle')}</h3>
          <ul className="max-h-36 overflow-y-auto rounded-xl border px-3.5 py-2 text-xs leading-relaxed">
            {report.duplicates.map((dup) => (
              <li key={dup.index}>
                {dup.reason === 'IN_FILE'
                  ? t('questions.import.duplicateInFile', { index: dup.index, of: dup.duplicate_of })
                  : t('questions.import.duplicateInPool', { index: dup.index })}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!imported && report.invalid_count === 0 && report.importable_count === 0 && (
        <p className="text-sm text-muted-foreground">{t('questions.import.nothingNew')}</p>
      )}
    </div>
  )
}
