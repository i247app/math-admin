import { CircleCheckIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ClearDataResult } from '@/types/System'

/** What the server reports it wiped after a clear-data call. */
export function ClearDataResultPanel({ result }: { result: ClearDataResult }) {
  const { t } = useTranslation()
  const tables = result.tables_cleared ?? []
  const seqs = result.seqs_reset ?? []
  const kept = result.kept_uids ?? []

  return (
    <div role="status" className="flex flex-col gap-2 rounded-xl bg-success-surface px-4 py-3 text-sm text-success">
      <strong className="flex items-center gap-2 font-semibold">
        <CircleCheckIcon className="size-4" aria-hidden />
        {t('system.data.result.summary', { tables: tables.length, seqs: seqs.length })}
      </strong>
      {tables.length > 0 && (
        <p className="font-mono text-xs leading-relaxed break-words text-foreground/80">{tables.join(', ')}</p>
      )}
      {kept.length > 0 && <p>{t('system.data.result.kept', { uids: kept.join(', ') })}</p>}
    </div>
  )
}
