import { useMutation, useQueryClient } from '@tanstack/react-query'
import { TriangleAlertIcon } from 'lucide-react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert } from '@/components/FormAlert'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getErrorMessage } from '@/libs/ApiClient'
import type { CurriculumItem, CurriculumKind } from '@/types/Curriculum'
import { curriculumQueryKey, forceDeleteCurriculumItem, softDeleteCurriculumItem } from './CurriculumApi'

export type DeleteKind = 'softDelete' | 'forceDelete'

type DeleteCurriculumDialogProps = {
  curriculumKind: CurriculumKind
  /** What to do to which row; null = closed. */
  target: { kind: DeleteKind; item: CurriculumItem } | null
  onClose: () => void
}

/**
 * Confirmation for both deletes. Neither can be undone from the dashboard (no
 * restore endpoint), and force delete also makes the admin type the id.
 */
export function DeleteCurriculumDialog({ curriculumKind, target, onClose }: DeleteCurriculumDialogProps) {
  return (
    <AlertDialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="gap-5 rounded-2xl p-7 sm:max-w-[480px]">
        {target && (
          <DeleteBody
            key={`${target.kind}-${target.item.id}`}
            curriculumKind={curriculumKind}
            {...target}
            onClose={onClose}
          />
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}

function DeleteBody({
  curriculumKind,
  kind,
  item,
  onClose,
}: {
  curriculumKind: CurriculumKind
  kind: DeleteKind
  item: CurriculumItem
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [typedId, setTypedId] = useState('')
  const isForce = kind === 'forceDelete'

  const remove = useMutation({
    mutationFn: () =>
      isForce ? forceDeleteCurriculumItem(curriculumKind, item.id) : softDeleteCurriculumItem(curriculumKind, item.id),
    meta: { silentError: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: curriculumQueryKey(curriculumKind) })
      toast.success(t(`curriculum.${kind}.done`, { name: item.title }))
      onClose()
    },
  })

  const confirmed = !isForce || typedId.trim() === String(item.id)

  return (
    <>
      <span className="flex size-12 items-center justify-center rounded-xl bg-destructive-surface text-destructive">
        <TriangleAlertIcon className="size-6" aria-hidden />
      </span>
      <AlertDialogHeader className="gap-2 text-left">
        <AlertDialogTitle className="text-xl font-bold">{t(`curriculum.${kind}.title`)}</AlertDialogTitle>
        <AlertDialogDescription className="leading-relaxed text-muted-foreground">
          <Trans
            i18nKey={`curriculum.${kind}.description`}
            values={{ name: item.title, id: item.id }}
            components={{ strong: <strong className="text-foreground" />, warn: <strong className="text-destructive" /> }}
          />
        </AlertDialogDescription>
      </AlertDialogHeader>

      {remove.isError && <FormAlert>{getErrorMessage(remove.error)}</FormAlert>}

      {isForce && (
        <div className="flex flex-col gap-2">
          <label htmlFor="confirm-id" className="text-sm font-semibold">
            <Trans
              i18nKey="curriculum.forceDelete.typeToConfirm"
              values={{ id: item.id }}
              components={{ code: <code className="rounded-md bg-secondary px-1.5 py-0.5 font-mono" /> }}
            />
          </label>
          <Input
            id="confirm-id"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={typedId}
            onChange={(event) => setTypedId(event.target.value)}
            className="h-11 rounded-xl font-mono"
          />
        </div>
      )}

      <AlertDialogFooter className="gap-3">
        <AlertDialogCancel className="h-11 rounded-xl px-4.5" disabled={remove.isPending}>
          {t('common.cancel')}
        </AlertDialogCancel>
        {/* A plain button, not AlertDialogAction: the dialog must stay open until the call ends. */}
        <Button
          variant="destructive"
          className="h-11 rounded-xl px-4.5"
          disabled={!confirmed || remove.isPending}
          onClick={() => remove.mutate()}
        >
          {remove.isPending ? t('common.deleting') : t(`curriculum.${kind}.confirm`)}
        </Button>
      </AlertDialogFooter>
    </>
  )
}
