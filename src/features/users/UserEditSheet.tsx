import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRightIcon, SmartphoneIcon } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { FormAlert } from '@/components/FormAlert'
import { FormField } from '@/components/FormField'
import { UserAvatar } from '@/components/UserAvatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { sessionQueryOptions } from '@/features/auth/AuthApi'
import { userDevicesPath } from '@/features/devices/DevicesApi'
import { getErrorMessage } from '@/libs/ApiClient'
import type { UpdateUserRequest, User } from '@/types/User'
import { ASSIGNABLE_ROLES } from '@/types/User'
import { isValidEmail, normalizePhone, userDisplayName } from '@/utils/Helpers'
import { IdentityBadge } from './UserBadges'
import type { UserAction } from './UsersTable'
import { updateUser, usersQueryKey } from './UsersApi'


type UserEditSheetProps = {
  /** The user being edited; null = closed. */
  user: User | null
  currentUid: number
  onClose: () => void
  onAction: (action: Exclude<UserAction, 'edit'>, user: User) => void
}

export function UserEditSheet({ user, currentUid, onClose, onAction }: UserEditSheetProps) {
  return (
    <Sheet open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]">
        {/* Keyed so the form starts fresh for every user. */}
        {user && (
          <EditForm key={user.uid} user={user} currentUid={currentUid} onClose={onClose} onAction={onAction} />
        )}
      </SheetContent>
    </Sheet>
  )
}

type FieldErrors = Partial<Record<'name' | 'email' | 'phone', string>>

function EditForm({ user, currentUid, onClose, onAction }: UserEditSheetProps & { user: User }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [role, setRole] = useState(user.role ?? '')
  const name = userDisplayName(user, t)
  const isSelf = user.uid === currentUid

  const save = useMutation({
    mutationFn: updateUser,
    meta: { silentError: true },
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: usersQueryKey })
      if (updated.uid === currentUid) queryClient.setQueryData(sessionQueryOptions.queryKey, updated)
      toast.success(t('users.edit.saved'))
      onClose()
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const errors: FieldErrors = {}
    const req: UpdateUserRequest = { uid: user.uid }

    const newName = String(form.get('name') ?? '').trim()
    if (!newName) errors.name = t('users.edit.errors.nameRequired')
    else if (newName !== user.name) req.name = newName

    // email / phone inputs only exist when the account already has that contact.
    if (user.email !== undefined) {
      const email = String(form.get('email') ?? '').trim()
      if (!isValidEmail(email)) errors.email = t('users.edit.errors.emailInvalid')
      else if (email !== user.email) req.email = email
    }
    if (user.phone !== undefined) {
      const phone = normalizePhone(String(form.get('phone') ?? ''))
      if (!phone) errors.phone = t('users.edit.errors.phoneInvalid')
      else if (phone !== user.phone) req.phone = phone
    }

    if (role && role !== user.role && (ASSIGNABLE_ROLES as readonly string[]).includes(role)) {
      req.role = role as UpdateUserRequest['role']
    }

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    if (Object.keys(req).length === 1) {
      onClose() // nothing changed
      return
    }
    save.mutate(req)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="border-b px-6 py-5">
        <SheetTitle className="text-xl font-bold">{t('users.edit.title')}</SheetTitle>
        <SheetDescription className="sr-only">{t('users.edit.description', { name })}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        <div className="flex items-center gap-3.5 rounded-xl border border-secondary bg-muted/40 p-4">
          <UserAvatar user={user} name={name} className="size-12" fallbackClassName="text-base" />
          <div className="flex min-w-0 flex-col gap-1">
            <strong className="truncate font-semibold">{name}</strong>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[13px] text-muted-foreground">UID {user.uid}</span>
              <IdentityBadge identity={user.identity_code} />
            </div>
          </div>
        </div>

        {save.isError && <FormAlert>{getErrorMessage(save.error)}</FormAlert>}

        <div className="flex flex-col gap-4">
          <FormField id="name" label={t('users.edit.name')} error={fieldErrors.name}>
            <Input
              id="name"
              name="name"
              defaultValue={user.name}
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
              className="h-11 rounded-xl"
            />
          </FormField>

          <FormField
            id="email"
            label={t('users.edit.email')}
            error={fieldErrors.email}
            hint={user.email === undefined ? t('users.edit.noEmail') : t('users.edit.emailHint')}
          >
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={user.email ?? ''}
              disabled={user.email === undefined}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'email-error' : 'email-hint'}
              className="h-11 rounded-xl"
            />
          </FormField>

          <FormField
            id="phone"
            label={t('users.edit.phone')}
            error={fieldErrors.phone}
            hint={user.phone === undefined ? t('users.edit.noPhone') : undefined}
          >
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={user.phone ?? ''}
              disabled={user.phone === undefined}
              aria-invalid={!!fieldErrors.phone}
              aria-describedby={fieldErrors.phone ? 'phone-error' : user.phone === undefined ? 'phone-hint' : undefined}
              className="h-11 rounded-xl"
            />
          </FormField>

          <FormField
            id="role"
            label={t('users.edit.role')}
            hint={user.role === 'ADMIN' ? t('users.edit.adminRoleHint') : undefined}
          >
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role" className="h-11! w-full rounded-xl">
                <SelectValue placeholder={t('users.edit.rolePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`users.roles.${value}`)}
                  </SelectItem>
                ))}
                {/* ADMIN can be shown but never set through /users/update. */}
                {user.role === 'ADMIN' && (
                  <SelectItem value="ADMIN" disabled>
                    {t('users.roles.ADMIN')}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <section
          aria-labelledby="devices-title"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
        >
          <div className="flex min-w-0 items-center gap-3">
            <SmartphoneIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <h3 id="devices-title" className="text-sm font-bold">
                {t('users.edit.devicesTitle')}
              </h3>
              <span className="text-sm text-muted-foreground">{t('users.edit.devicesHint')}</span>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to={userDevicesPath(user.uid)}>
              {t('users.edit.devicesLink')}
              <ArrowRightIcon aria-hidden />
            </Link>
          </Button>
        </section>

        <section
          aria-labelledby="danger-title"
          className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive-surface/50 p-4"
        >
          <h3 id="danger-title" className="text-sm font-bold text-destructive">
            {t('users.edit.dangerZone')}
          </h3>
          {isSelf ? (
            <p className="text-sm text-muted-foreground">{t('users.selfDeleteBlocked')}</p>
          ) : (
            <>
              <DangerRow text={t('users.edit.softDeleteHint')}>
                <Button type="button" variant="outline" size="sm" onClick={() => onAction('softDelete', user)}>
                  {t('users.softDelete.confirm')}
                </Button>
              </DangerRow>
              <DangerRow text={t('users.edit.forceDeleteHint')}>
                <Button type="button" variant="destructive" size="sm" onClick={() => onAction('forceDelete', user)}>
                  {t('users.forceDelete.confirm')}
                </Button>
              </DangerRow>
            </>
          )}
        </section>
      </div>

      <SheetFooter className="flex-row justify-end gap-3 border-t px-6 py-4">
        <Button type="button" variant="outline" className="h-11 rounded-xl px-4.5" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="h-11 rounded-xl px-4.5" disabled={save.isPending}>
          {save.isPending ? t('common.saving') : t('users.edit.submit')}
        </Button>
      </SheetFooter>
    </form>
  )
}

function DangerRow({ text, children }: { text: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm leading-normal text-muted-foreground">{text}</span>
      {children}
    </div>
  )
}
