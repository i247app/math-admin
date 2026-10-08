import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckIcon, EraserIcon } from 'lucide-react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { ClearableTable } from '@/types/System'
import { CLEARABLE_TABLES } from '@/types/System'
import { ClearDataResultPanel } from './ClearDataResultPanel'
import { ConfirmActionDialog } from './ConfirmActionDialog'
import { clearDataTables } from './SystemApi'

/** Pick tables from the server's allow-list and TRUNCATE them. */
export function ClearTablesCard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<ClearableTable[]>([])
  const [confirming, setConfirming] = useState(false)

  const clear = useMutation({
    mutationFn: () => clearDataTables(selected),
    meta: { silentError: true },
    onSuccess: () => {
      setConfirming(false)
      setSelected([])
      // Any cached list may now point at deleted rows.
      void queryClient.invalidateQueries()
    },
  })

  function toggle(table: ClearableTable) {
    const next = selected.includes(table) ? selected.filter((name) => name !== table) : [...selected, table]
    setSelected(CLEARABLE_TABLES.filter((name) => next.includes(name)))
  }

  const allSelected = selected.length === CLEARABLE_TABLES.length

  return (
    <section aria-labelledby="clear-tables-title" className="flex flex-col gap-4 rounded-2xl border bg-card p-6">
      <div className="flex flex-col gap-1">
        <h2 id="clear-tables-title" className="text-lg font-bold">
          {t('system.data.clearTables.title')}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t('system.data.clearTables.summary')}</p>
      </div>

      <div role="group" aria-labelledby="clear-tables-title" className="flex flex-wrap gap-2">
        {CLEARABLE_TABLES.map((table) => {
          const pressed = selected.includes(table)
          return (
            <Button
              key={table}
              type="button"
              size="sm"
              variant={pressed ? 'default' : 'outline'}
              aria-pressed={pressed}
              onClick={() => toggle(table)}
              className="rounded-full font-mono text-xs"
            >
              {pressed && <CheckIcon aria-hidden />}
              {table}
            </Button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setSelected(allSelected ? [] : [...CLEARABLE_TABLES])}>
          {allSelected ? t('system.data.clearTables.selectNone') : t('system.data.clearTables.selectAll')}
        </Button>
        <Button
          variant="destructive"
          className="ml-auto"
          disabled={selected.length === 0}
          onClick={() => {
            clear.reset()
            setConfirming(true)
          }}
        >
          <EraserIcon />
          {t('system.data.clearTables.button', { count: selected.length })}
        </Button>
      </div>

      {clear.isSuccess && <ClearDataResultPanel result={clear.data} />}

      <ConfirmActionDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('system.data.clearTables.confirmTitle')}
        description={
          <>
            <p>
              <Trans
                i18nKey="system.data.clearTables.confirmDescription"
                components={{ warn: <strong className="text-destructive" /> }}
              />
            </p>
            <p className="font-mono text-xs leading-relaxed break-words text-foreground">{selected.join(', ')}</p>
            {selected.includes('ma_users') && (
              <p className="font-semibold text-destructive">{t('system.data.clearTables.usersWarning')}</p>
            )}
          </>
        }
        confirmLabel={t('system.data.clearTables.confirm')}
        pendingLabel={t('common.deleting')}
        pending={clear.isPending}
        error={clear.error}
        onConfirm={() => clear.mutate()}
      />
    </section>
  )
}
