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
import type { Profile } from '@/types/Profile'
import { forceDeleteProfile, profilesQueryKey, softDeleteProfile } from './ProfilesApi'

export type DeleteKind = 'softDelete' | 'forceDelete'

type DeleteProfileDialogProps = {
  /** What to do to which profile; null = closed. */
  target: { kind: DeleteKind; profile: Profile } | null
  onClose: () => void
}

/**
 * Confirmation for both deletes. Neither can be undone from the dashboard (no
 * restore endpoint), and force delete also makes the admin type the profile code.
 */
export function DeleteProfileDialog({ target, onClose }: DeleteProfileDialogProps) {
  return (
    <AlertDialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="gap-5 rounded-2xl p-7 sm:max-w-[480px]">
        {target && <DeleteBody key={`${target.kind}-${target.profile.profile_id}`} {...target} onClose={onClose} />}
      </AlertDialogContent>
    </AlertDialog>
  )
}

function DeleteBody({ kind, profile, onClose }: { kind: DeleteKind; profile: Profile; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [typed, setTyped] = useState('')
  const isForce = kind === 'forceDelete'
  const name = profile.name || profile.profile_code

  const remove = useMutation({
    mutationFn: () => (isForce ? forceDeleteProfile(profile.profile_id) : softDeleteProfile(profile.profile_id)),
    meta: { silentError: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profilesQueryKey })
      toast.success(t(`profiles.${kind}.done`, { name }))
      onClose()
    },
  })

  const confirmed = !isForce || typed.trim().toUpperCase() === profile.profile_code.toUpperCase()

  return (
    <>
      <span className="flex size-12 items-center justify-center rounded-xl bg-destructive-surface text-destructive">
        <TriangleAlertIcon className="size-6" aria-hidden />
      </span>
      <AlertDialogHeader className="gap-2 text-left">
        <AlertDialogTitle className="text-xl font-bold">{t(`profiles.${kind}.title`)}</AlertDialogTitle>
        <AlertDialogDescription className="leading-relaxed text-muted-foreground">
          <Trans
            i18nKey={`profiles.${kind}.description`}
            values={{ name, code: profile.profile_code, uid: profile.uid }}
            components={{ strong: <strong className="text-foreground" />, warn: <strong className="text-destructive" /> }}
          />
        </AlertDialogDescription>
      </AlertDialogHeader>

      {remove.isError && <FormAlert>{getErrorMessage(remove.error)}</FormAlert>}

      {isForce && (
        <div className="flex flex-col gap-2">
          <label htmlFor="confirm-code" className="text-sm font-semibold">
            <Trans
              i18nKey="profiles.forceDelete.typeToConfirm"
              values={{ code: profile.profile_code }}
              components={{ code: <code className="rounded-md bg-secondary px-1.5 py-0.5 font-mono" /> }}
            />
          </label>
          <Input
            id="confirm-code"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
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
          {remove.isPending ? t('common.deleting') : t(`profiles.${kind}.confirm`)}
        </Button>
      </AlertDialogFooter>
    </>
  )
}
