import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert } from '@/components/FormAlert'
import { FormField } from '@/components/FormField'
import { PasswordInput } from '@/components/PasswordInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { getErrorMessage } from '@/libs/ApiClient'
import type { CreateUserRequest, UserRole } from '@/types/User'
import { ALL_ROLES } from '@/types/User'
import { byteLength, isValidEmail, normalizePhone, userDisplayName } from '@/utils/Helpers'
import { adminCreateUser, usersQueryKey } from './UsersApi'

/** internal/domain/login/password.go */
const PASSWORD_MIN_CHARS = 8
const PASSWORD_MAX_BYTES = 72

export function UserCreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]">
        {/* Mounted only while open, so every opening starts with an empty form. */}
        {open && <CreateForm onClose={onClose} />}
      </SheetContent>
    </Sheet>
  )
}

type FieldName = 'name' | 'phone' | 'email' | 'password'
type FieldErrors = Partial<Record<FieldName, string>>

function CreateForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [role, setRole] = useState<UserRole>('STUDENT')

  const create = useMutation({
    mutationFn: adminCreateUser,
    meta: { silentError: true },
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: usersQueryKey })
      toast.success(t('users.create.done', { name: userDisplayName(user, t) }))
      onClose()
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const errors: FieldErrors = {}
    const req: CreateUserRequest = { name: String(form.get('name') ?? '').trim(), role }

    if (!req.name) errors.name = t('users.edit.errors.nameRequired')

    const phoneText = String(form.get('phone') ?? '').trim()
    const emailText = String(form.get('email') ?? '').trim()
    if (!phoneText && !emailText) {
      // Phone and email are the login keys; an account needs at least one.
      errors.phone = t('users.create.errors.contactRequired')
    }
    if (phoneText) {
      const phone = normalizePhone(phoneText)
      if (phone) req.phone = phone
      else errors.phone = t('users.edit.errors.phoneInvalid')
    }
    if (emailText) {
      if (isValidEmail(emailText)) req.email = emailText
      else errors.email = t('users.edit.errors.emailInvalid')
    }

    // Not trimmed: spaces are valid password characters.
    const password = String(form.get('password') ?? '')
    if (password) {
      if ([...password].length < PASSWORD_MIN_CHARS || byteLength(password) > PASSWORD_MAX_BYTES)
        errors.password = t('users.create.errors.passwordLength', { min: PASSWORD_MIN_CHARS })
      else req.password = password
    }

    setFieldErrors(errors)
    if (Object.keys(errors).length === 0) create.mutate(req)
  }

  const describedBy = (name: FieldName, hasHint = false) =>
    fieldErrors[name] ? `${name}-error` : hasHint ? `${name}-hint` : undefined

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="border-b px-6 py-5">
        <SheetTitle className="text-xl font-bold">{t('users.create.title')}</SheetTitle>
        <SheetDescription className="sr-only">{t('users.create.description')}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        {create.isError && <FormAlert>{getErrorMessage(create.error)}</FormAlert>}

        <div className="flex flex-col gap-4">
          <FormField id="name" label={t('users.edit.name')} error={fieldErrors.name}>
            <Input
              id="name"
              name="name"
              autoFocus
              autoComplete="off"
              aria-invalid={!!fieldErrors.name}
              aria-describedby={describedBy('name')}
              className="h-11 rounded-xl"
            />
          </FormField>

          <FormField
            id="phone"
            label={t('users.edit.phone')}
            error={fieldErrors.phone}
            hint={t('users.create.contactHint')}
          >
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="off"
              placeholder={t('auth.signIn.loginNamePlaceholder')}
              aria-invalid={!!fieldErrors.phone}
              aria-describedby={describedBy('phone', true)}
              className="h-11 rounded-xl"
            />
          </FormField>

          <FormField
            id="email"
            label={t('users.edit.email')}
            error={fieldErrors.email}
            hint={t('users.create.emailHint')}
          >
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="off"
              aria-invalid={!!fieldErrors.email}
              aria-describedby={describedBy('email', true)}
              className="h-11 rounded-xl"
            />
          </FormField>

          <FormField
            id="role"
            label={t('users.edit.role')}
            hint={role === 'ADMIN' ? t('users.create.adminRoleHint') : undefined}
          >
            <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
              <SelectTrigger
                id="role"
                aria-describedby={role === 'ADMIN' ? 'role-hint' : undefined}
                className="h-11! w-full rounded-xl"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`users.roles.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            id="password"
            label={t('auth.signIn.password')}
            error={fieldErrors.password}
            hint={t('users.create.passwordHint', { min: PASSWORD_MIN_CHARS })}
          >
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              aria-invalid={!!fieldErrors.password}
              aria-describedby={describedBy('password', true)}
              className="h-11 rounded-xl"
            />
          </FormField>
        </div>
      </div>

      <SheetFooter className="flex-row justify-end gap-3 border-t px-6 py-4">
        <Button type="button" variant="outline" className="h-11 rounded-xl px-4.5" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="h-11 rounded-xl px-4.5" disabled={create.isPending}>
          {create.isPending ? t('common.saving') : t('users.create.submit')}
        </Button>
      </SheetFooter>
    </form>
  )
}
