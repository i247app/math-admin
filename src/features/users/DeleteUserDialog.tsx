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
import type { User } from '@/types/User'
import { userDisplayName } from '@/utils/Helpers'
import { forceDeleteUser, softDeleteUser, usersQueryKey } from './UsersApi'

export type DeleteKind = 'softDelete' | 'forceDelete'

type DeleteUserDialogProps = {
  /** What to do to whom; null = closed. */
  target: { kind: DeleteKind; user: User } | null
  onClose: () => void
}

/**
 * Confirmation for both deletes. Soft delete also physically removes the
 * account's child profiles, so it gets a confirm too; force delete
 * additionally makes the admin type the UID.
 */
export function DeleteUserDialog({ target, onClose }: DeleteUserDialogProps) {
  return (
    <AlertDialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="gap-5 rounded-2xl p-7 sm:max-w-[480px]">
        {target && <DeleteBody key={`${target.kind}-${target.user.uid}`} {...target} onClose={onClose} />}
      </AlertDialogContent>
    </AlertDialog>
  )
}

function DeleteBody({ kind, user, onClose }: { kind: DeleteKind; user: User; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [typedUid, setTypedUid] = useState('')
  const name = userDisplayName(user, t)
  const isForce = kind === 'forceDelete'

  const remove = useMutation({
    mutationFn: () => (isForce ? forceDeleteUser(user.uid) : softDeleteUser(user.uid)),
    meta: { silentError: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersQueryKey })
      toast.success(t(`users.${kind}.done`, { name }))
      onClose()
    },
  })

  const confirmed = !isForce || typedUid.trim() === String(user.uid)

  return (
    <>
      <span className="flex size-12 items-center justify-center rounded-xl bg-destructive-surface text-destructive">
        <TriangleAlertIcon className="size-6" aria-hidden />
      </span>
      <AlertDialogHeader className="gap-2 text-left">
        <AlertDialogTitle className="text-xl font-bold">{t(`users.${kind}.title`)}</AlertDialogTitle>
        <AlertDialogDescription className="leading-relaxed text-muted-foreground">
          <Trans
            i18nKey={`users.${kind}.description`}
            values={{ name, uid: user.uid }}
            components={{ strong: <strong className="text-foreground" />, warn: <strong className="text-destructive" /> }}
          />
        </AlertDialogDescription>
      </AlertDialogHeader>

      {remove.isError && <FormAlert>{getErrorMessage(remove.error)}</FormAlert>}

      {isForce && (
        <div className="flex flex-col gap-2">
          <label htmlFor="confirm-uid" className="text-sm font-semibold">
            <Trans
              i18nKey="users.forceDelete.typeToConfirm"
              values={{ uid: user.uid }}
              components={{ code: <code className="rounded-md bg-secondary px-1.5 py-0.5 font-mono" /> }}
            />
          </label>
          <Input
            id="confirm-uid"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={typedUid}
            onChange={(event) => setTypedUid(event.target.value)}
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
          {remove.isPending ? t('common.deleting') : t(`users.${kind}.confirm`)}
        </Button>
      </AlertDialogFooter>
    </>
  )
}
