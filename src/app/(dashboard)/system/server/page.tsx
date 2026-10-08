import { useMutation } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import { PowerIcon, RefreshCwIcon } from 'lucide-react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { TitleBar } from '@/features/dashboard/TitleBar'
import { ConfirmActionDialog } from '@/features/system/ConfirmActionDialog'
import { reloadServer, shutdownServer } from '@/features/system/SystemApi'

type ServerAction = 'reload' | 'shutdown'

const actions: { kind: ServerAction; icon: LucideIcon }[] = [
  { kind: 'reload', icon: RefreshCwIcon },
  { kind: 'shutdown', icon: PowerIcon },
]

const SHUTDOWN_PHRASE = 'SHUTDOWN'

export default function ServerPage() {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState<ServerAction | null>(null)

  const run = useMutation({
    mutationFn: (kind: ServerAction) => (kind === 'reload' ? reloadServer() : shutdownServer()),
    meta: { silentError: true },
    onSuccess: () => setConfirming(null),
  })

  function openConfirm(kind: ServerAction) {
    run.reset()
    setConfirming(kind)
  }

  // Shown until the page is left: the server stops right after answering.
  const done = run.isSuccess ? run.variables : null

  return (
    <>
      <TitleBar title={t('system.server.title')} description={t('system.server.description')} />

      {done && (
        <div role="status" className="rounded-2xl bg-warning-surface px-5 py-4 text-warning">
          <strong className="font-semibold">{t(`system.server.${done}.doneTitle`)}</strong>
          <p className="mt-1 text-sm">{t(`system.server.${done}.doneDescription`)}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {actions.map(({ kind, icon: Icon }) => (
          <section key={kind} className="flex flex-col gap-4 rounded-2xl border bg-card p-6">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive-surface text-destructive">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-bold">{t(`system.server.${kind}.title`)}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{t(`system.server.${kind}.summary`)}</p>
              </div>
            </div>
            <Button variant="destructive" className="self-start" onClick={() => openConfirm(kind)}>
              <Icon />
              {t(`system.server.${kind}.button`)}
            </Button>
          </section>
        ))}
      </div>

      <ConfirmActionDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming ? t(`system.server.${confirming}.confirmTitle`) : ''}
        description={
          confirming && (
            <p>
              <Trans
                i18nKey={`system.server.${confirming}.confirmDescription`}
                components={{ warn: <strong className="text-destructive" /> }}
              />
            </p>
          )
        }
        confirmLabel={confirming ? t(`system.server.${confirming}.button`) : ''}
        pendingLabel={t('system.working')}
        confirmPhrase={confirming === 'shutdown' ? SHUTDOWN_PHRASE : undefined}
        pending={run.isPending}
        error={run.error}
        onConfirm={() => confirming && run.mutate(confirming)}
      />
    </>
  )
}
