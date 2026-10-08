import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BombIcon } from 'lucide-react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSessionUser } from '@/features/auth/AuthApi'
import { ClearDataResultPanel } from './ClearDataResultPanel'
import { ConfirmActionDialog } from './ConfirmActionDialog'
import { clearAllData } from './SystemApi'

const DELETE_PHRASE = 'DELETE'

/** "12, 34" → [12, 34]; null when any part is not a positive integer. */
function parseUids(value: string): number[] | null {
  const parts = value.split(/[\s,]+/).filter(Boolean)
  const uids = parts.map(Number)
  if (uids.some((uid) => !Number.isSafeInteger(uid) || uid <= 0)) return null
  return [...new Set(uids)]
}

/** /misc/clear-data: wipes every clearable table, keeping the whitelisted users and their data. */
export function ClearAllDataCard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const currentUser = useSessionUser()
  const [confirming, setConfirming] = useState(false)
  const [whitelist, setWhitelist] = useState('')

  const uids = parseUids(whitelist)
  const keepsSelf = uids?.includes(currentUser.uid) ?? false

  const clear = useMutation({
    mutationFn: (keep: number[]) => clearAllData(keep),
    meta: { silentError: true },
    onSuccess: () => {
      setConfirming(false)
      void queryClient.invalidateQueries()
    },
  })

  function openConfirm() {
    clear.reset()
    // Keep the signed-in admin by default; wiping ma_users would delete this account too.
    setWhitelist(String(currentUser.uid))
    setConfirming(true)
  }

  return (
    <section
      aria-labelledby="clear-all-title"
      className="flex flex-col gap-4 rounded-2xl border border-destructive/30 bg-card p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="clear-all-title" className="text-lg font-bold text-destructive">
          {t('system.data.clearAll.title')}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t('system.data.clearAll.summary')}</p>
      </div>
      <Button variant="destructive" className="self-start" onClick={openConfirm}>
        <BombIcon />
        {t('system.data.clearAll.button')}
      </Button>

      {clear.isSuccess && <ClearDataResultPanel result={clear.data} />}

      <ConfirmActionDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('system.data.clearAll.confirmTitle')}
        description={
          <p>
            <Trans
              i18nKey="system.data.clearAll.confirmDescription"
              components={{ warn: <strong className="text-destructive" /> }}
            />
          </p>
        }
        confirmLabel={t('system.data.clearAll.confirm')}
        pendingLabel={t('common.deleting')}
        confirmPhrase={DELETE_PHRASE}
        confirmDisabled={uids === null}
        pending={clear.isPending}
        error={clear.error}
        onConfirm={() => uids && clear.mutate(uids)}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="whitelist-uids" className="text-sm font-semibold">
            {t('system.data.clearAll.whitelistLabel')}
          </label>
          <Input
            id="whitelist-uids"
            autoComplete="off"
            value={whitelist}
            onChange={(event) => setWhitelist(event.target.value)}
            aria-invalid={uids === null}
            aria-describedby="whitelist-hint"
            className="h-11 rounded-xl font-mono"
          />
          <p id="whitelist-hint" className="text-[13px] text-muted-foreground">
            {uids === null ? (
              <span className="text-destructive">{t('system.data.clearAll.whitelistInvalid')}</span>
            ) : (
              t('system.data.clearAll.whitelistHint')
            )}
          </p>
          {uids !== null && !keepsSelf && (
            <p className="text-sm font-semibold text-destructive">
              {t('system.data.clearAll.selfWarning', { uid: currentUser.uid })}
            </p>
          )}
        </div>
      </ConfirmActionDialog>
    </section>
  )
}
