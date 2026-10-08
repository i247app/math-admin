import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert } from '@/components/FormAlert'
import { FormField } from '@/components/FormField'
import { ItemImage } from '@/components/ItemImage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { getErrorMessage } from '@/libs/ApiClient'
import type { EditableRoleStatus, Role, RoleFieldsInput } from '@/types/Role'
import { EDITABLE_ROLE_STATUSES } from '@/types/Role'
import type { RoleImageChange } from './RolesApi'
import {
  createRole,
  ROLE_CODE_PATTERN,
  ROLE_IMAGE_MAX_BYTES,
  ROLE_LIMITS,
  rolesQueryKey,
  updateRole,
} from './RolesApi'

type RoleFormSheetProps = {
  /** null = closed, 'new' = create, a role = edit it. */
  target: Role | 'new' | null
  onClose: () => void
}

export function RoleFormSheet({ target, onClose }: RoleFormSheetProps) {
  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]">
        {/* Keyed so the form starts fresh for every target. */}
        {target && (
          <RoleForm
            key={target === 'new' ? 'new' : target.role_id}
            role={target === 'new' ? null : target}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

type FieldName = 'code' | 'name' | 'description' | 'note' | 'image'
type FieldErrors = Partial<Record<FieldName, string>>

type SaveInput = { fields: RoleFieldsInput; code: string; image: RoleImageChange }

/** Characters as the server counts them (utf8.RuneCountInString), not UTF-16 units. */
function charCount(value: string) {
  return Array.from(value).length
}

function RoleForm({ role, onClose }: { role: Role | null; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  // A DELETED role never reaches this form (lists hide them); anything else maps to the two choices.
  const [status, setStatus] = useState<EditableRoleStatus>(role?.role_status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE')
  const [removeImage, setRemoveImage] = useState(false)

  const save = useMutation({
    mutationFn: ({ fields, code, image }: SaveInput) =>
      role
        ? updateRole(role.role_id, fields, image)
        : createRole({ ...fields, role_code: code }, image?.kind === 'replace' ? image.file : undefined),
    meta: { silentError: true },
    // Also on error: an edit with a new image is two calls, and the first may have saved.
    onSettled: () => queryClient.invalidateQueries({ queryKey: rolesQueryKey }),
    onSuccess: () => {
      toast.success(t(role ? 'roles.form.updated' : 'roles.form.created'))
      onClose()
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const errors: FieldErrors = {}

    // Same normalisation as ValidateCreateRole: trimmed, upper-cased.
    const code = String(form.get('code') ?? '').trim().toUpperCase()
    if (!role) {
      if (!code) errors.code = t('roles.form.errors.required')
      else if (!ROLE_CODE_PATTERN.test(code)) errors.code = t('roles.form.errors.code')
    }

    const name = String(form.get('name') ?? '').trim()
    if (!name) errors.name = t('roles.form.errors.required')
    else if (charCount(name) > ROLE_LIMITS.name) errors.name = t('roles.form.errors.tooLong', { max: ROLE_LIMITS.name })

    const description = String(form.get('description') ?? '').trim()
    if (charCount(description) > ROLE_LIMITS.description)
      errors.description = t('roles.form.errors.tooLong', { max: ROLE_LIMITS.description })

    const note = String(form.get('note') ?? '').trim()
    if (charCount(note) > ROLE_LIMITS.note) errors.note = t('roles.form.errors.tooLong', { max: ROLE_LIMITS.note })

    // The file input is disabled while "remove image" is ticked, so FormData never carries both
    // (the server refuses that with ROLE_IMAGE_CONFLICT).
    const file = form.get('image')
    const imageFile = file instanceof File && file.size > 0 ? file : undefined
    if (imageFile && !imageFile.type.startsWith('image/')) errors.image = t('roles.form.errors.imageType')
    else if (imageFile && imageFile.size > ROLE_IMAGE_MAX_BYTES) errors.image = t('roles.form.errors.imageSize')

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    const image: RoleImageChange = imageFile
      ? { kind: 'replace', file: imageFile }
      : removeImage
        ? { kind: 'remove' }
        : undefined

    if (!role) {
      save.mutate({
        code,
        image,
        fields: { role_name: name, description: description || undefined, note: note || undefined, role_status: status },
      })
      return
    }

    // Edit: send only what changed. An emptied description or note is sent as "" to clear it.
    const fields: RoleFieldsInput = {
      role_name: name !== role.role_name ? name : undefined,
      description: description !== (role.description ?? '') ? description : undefined,
      note: note !== (role.note ?? '') ? note : undefined,
      role_status: status !== role.role_status ? status : undefined,
    }
    if (!image && Object.values(fields).every((value) => value === undefined)) {
      onClose() // nothing changed
      return
    }
    save.mutate({ code: role.role_code, fields, image })
  }

  const describedBy = (name: FieldName, hasHint = false) =>
    fieldErrors[name] ? `${name}-error` : hasHint ? `${name}-hint` : undefined

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="border-b px-6 py-5">
        <SheetTitle className="text-xl font-bold">{t(role ? 'roles.editTitle' : 'roles.create')}</SheetTitle>
        <SheetDescription className="sr-only">{t('roles.description')}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        {role && (
          <div className="flex items-center gap-3.5 rounded-xl border border-secondary bg-muted/40 p-4">
            <ItemImage url={role.role_image_url} className="size-12" />
            <div className="flex min-w-0 flex-col gap-1">
              <strong className="truncate font-semibold">{role.role_name}</strong>
              <span className="font-mono text-[13px] text-muted-foreground">
                {role.role_code} · ID {role.role_id}
              </span>
            </div>
          </div>
        )}

        {save.isError && <FormAlert>{getErrorMessage(save.error)}</FormAlert>}

        <div className="flex flex-col gap-4">
          {!role && (
            <FormField id="code" label={t('roles.form.code')} error={fieldErrors.code} hint={t('roles.form.codeHint')}>
              <Input
                id="code"
                name="code"
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={64}
                aria-invalid={!!fieldErrors.code}
                aria-describedby={describedBy('code', true)}
                className="h-11 rounded-xl font-mono uppercase"
              />
            </FormField>
          )}

          <FormField id="name" label={t('roles.form.name')} error={fieldErrors.name}>
            <Input
              id="name"
              name="name"
              defaultValue={role?.role_name ?? ''}
              aria-invalid={!!fieldErrors.name}
              aria-describedby={describedBy('name')}
              className="h-11 rounded-xl"
            />
          </FormField>

          <FormField
            id="description"
            label={t('roles.form.description')}
            error={fieldErrors.description}
            hint={t('roles.form.optional')}
          >
            <Textarea
              id="description"
              name="description"
              defaultValue={role?.description ?? ''}
              rows={3}
              aria-invalid={!!fieldErrors.description}
              aria-describedby={describedBy('description', true)}
              className="rounded-xl"
            />
          </FormField>

          <FormField id="status" label={t('roles.form.status')}>
            <Select value={status} onValueChange={(value) => setStatus(value as EditableRoleStatus)}>
              <SelectTrigger id="status" className="h-11 w-48 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDITABLE_ROLE_STATUSES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`roles.status.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            id="image"
            label={t(role?.role_image_url ? 'roles.form.imageReplace' : 'roles.form.image')}
            error={fieldErrors.image}
            hint={t('roles.form.imageHint')}
          >
            <Input
              id="image"
              name="image"
              type="file"
              accept="image/*"
              disabled={removeImage}
              aria-invalid={!!fieldErrors.image}
              aria-describedby={describedBy('image', true)}
              className="h-11 rounded-xl pt-2.5"
            />
          </FormField>

          {role?.role_image_key && (
            <label className="flex items-center gap-2.5 text-sm font-medium">
              <input
                type="checkbox"
                checked={removeImage}
                onChange={(event) => setRemoveImage(event.target.checked)}
                className="size-4 accent-primary"
              />
              {t('roles.form.removeImage')}
            </label>
          )}

          <FormField id="note" label={t('roles.form.note')} error={fieldErrors.note} hint={t('roles.form.optional')}>
            <Textarea
              id="note"
              name="note"
              defaultValue={role?.note ?? ''}
              rows={2}
              aria-invalid={!!fieldErrors.note}
              aria-describedby={describedBy('note', true)}
              className="rounded-xl"
            />
          </FormField>
        </div>
      </div>

      <SheetFooter className="flex-row justify-end gap-3 border-t px-6 py-4">
        <Button type="button" variant="outline" className="h-11 rounded-xl px-4.5" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="h-11 rounded-xl px-4.5" disabled={save.isPending}>
          {save.isPending ? t('common.saving') : t(role ? 'roles.form.save' : 'roles.form.create')}
        </Button>
      </SheetFooter>
    </form>
  )
}
