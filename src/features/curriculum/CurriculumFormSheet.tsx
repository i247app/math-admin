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
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { getErrorMessage } from '@/libs/ApiClient'
import type { CurriculumFieldsInput, CurriculumItem, CurriculumKind } from '@/types/Curriculum'
import { byteLength } from '@/utils/Helpers'
import {
  createCurriculumItem,
  curriculumQueryKey,
  DISPLAY_ORDER_MAX,
  IMAGE_MAX_BYTES,
  KIND_CONFIG,
  LOCATION_MAX_BYTES,
  updateCurriculumItem,
} from './CurriculumApi'

type CurriculumFormSheetProps = {
  kind: CurriculumKind
  /** null = closed, 'new' = create, an item = edit it. */
  target: CurriculumItem | 'new' | null
  /** display_order prefilled on create. */
  nextOrder: number
  onClose: () => void
}

export function CurriculumFormSheet({ kind, target, nextOrder, onClose }: CurriculumFormSheetProps) {
  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]">
        {/* Keyed so the form starts fresh for every target. */}
        {target && (
          <CurriculumForm
            key={target === 'new' ? 'new' : target.id}
            kind={kind}
            item={target === 'new' ? null : target}
            nextOrder={nextOrder}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

type FieldName = 'title' | 'description' | 'displayOrder' | 'district' | 'province' | 'note' | 'image'
type FieldErrors = Partial<Record<FieldName, string>>

function CurriculumForm({
  kind,
  item,
  nextOrder,
  onClose,
}: {
  kind: CurriculumKind
  /** null = create. */
  item: CurriculumItem | null
  nextOrder: number
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const config = KIND_CONFIG[kind]
  // Grades replace their image by file upload, which /grades/update only takes on an existing row.
  const uploadsImage = config.imageUpload && item !== null

  const save = useMutation({
    mutationFn: ({ fields, image }: { fields: CurriculumFieldsInput; image?: File }) =>
      item ? updateCurriculumItem(kind, item.id, fields, image) : createCurriculumItem(kind, fields),
    meta: { silentError: true },
    // Also on error: a grade edit is two calls, and the first may have saved.
    onSettled: () => queryClient.invalidateQueries({ queryKey: curriculumQueryKey(kind) }),
    onSuccess: () => {
      toast.success(t(item ? 'curriculum.form.updated' : 'curriculum.form.created'))
      onClose()
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const errors: FieldErrors = {}

    const title = String(form.get('title') ?? '').trim()
    if (!title) errors.title = t('curriculum.form.errors.required')
    else if (byteLength(title) > config.titleMaxBytes)
      errors.title = t('curriculum.form.errors.tooLong', { max: config.titleMaxBytes })

    const description = String(form.get('description') ?? '').trim()
    if (config.descriptionMaxBytes !== null) {
      if (!description) errors.description = t('curriculum.form.errors.required')
      else if (byteLength(description) > config.descriptionMaxBytes)
        errors.description = t('curriculum.form.errors.tooLong', { max: config.descriptionMaxBytes })
    }

    // Schools have no display order: the value stays undefined and is never sent.
    let displayOrder: number | undefined
    if (config.displayOrder) {
      const orderText = String(form.get('displayOrder') ?? '').trim()
      displayOrder = Number(orderText)
      if (orderText === '' || !Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > DISPLAY_ORDER_MAX)
        errors.displayOrder = t('curriculum.form.errors.displayOrder', { max: DISPLAY_ORDER_MAX })
    }

    const district = String(form.get('district') ?? '').trim()
    const province = String(form.get('province') ?? '').trim()
    if (byteLength(district) > LOCATION_MAX_BYTES)
      errors.district = t('curriculum.form.errors.tooLong', { max: LOCATION_MAX_BYTES })
    if (byteLength(province) > LOCATION_MAX_BYTES)
      errors.province = t('curriculum.form.errors.tooLong', { max: LOCATION_MAX_BYTES })

    const note = String(form.get('note') ?? '').trim()
    if (config.noteMaxBytes !== null && byteLength(note) > config.noteMaxBytes)
      errors.note = t('curriculum.form.errors.tooLong', { max: config.noteMaxBytes })
    const imageKey = String(form.get('imageKey') ?? '').trim()

    const file = form.get('image')
    const image = file instanceof File && file.size > 0 ? file : undefined
    if (image && !image.type.startsWith('image/')) errors.image = t('curriculum.form.errors.imageType')
    else if (image && image.size > IMAGE_MAX_BYTES) errors.image = t('curriculum.form.errors.imageSize')

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    if (!item) {
      save.mutate({
        fields: {
          title,
          description,
          displayOrder,
          district: district || undefined,
          province: province || undefined,
          note: note || undefined,
          imageKey: imageKey || undefined,
        },
      })
      return
    }

    // Edit: send only what changed. The server can't clear an image key, so an emptied one is ignored.
    const changes: CurriculumFieldsInput = {
      title: title !== item.title ? title : undefined,
      description: description !== item.description ? description : undefined,
      displayOrder: displayOrder !== item.displayOrder ? displayOrder : undefined,
      // Only schools have these inputs; for them an emptied field is sent as '' and clears the column.
      district: config.location && district !== (item.district ?? '') ? district : undefined,
      province: config.location && province !== (item.province ?? '') ? province : undefined,
      note: note !== (item.note ?? '') ? note : undefined,
      imageKey: imageKey && imageKey !== item.imageKey ? imageKey : undefined,
    }
    if (!image && Object.values(changes).every((value) => value === undefined)) {
      onClose() // nothing changed
      return
    }
    save.mutate({ fields: changes, image })
  }

  const describedBy = (name: FieldName, hasHint = false) =>
    fieldErrors[name] ? `${name}-error` : hasHint ? `${name}-hint` : undefined

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="border-b px-6 py-5">
        <SheetTitle className="text-xl font-bold">
          {t(item ? `curriculum.${kind}.editTitle` : `curriculum.${kind}.create`)}
        </SheetTitle>
        <SheetDescription className="sr-only">{t(`curriculum.${kind}.description`)}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        {item && (
          <div className="flex items-center gap-3.5 rounded-xl border border-secondary bg-muted/40 p-4">
            <ItemImage url={item.imageUrl} className="size-12" />
            <div className="flex min-w-0 flex-col gap-1">
              <strong className="truncate font-semibold">{item.title}</strong>
              <span className="font-mono text-[13px] text-muted-foreground">ID {item.id}</span>
            </div>
          </div>
        )}

        {save.isError && <FormAlert>{getErrorMessage(save.error)}</FormAlert>}

        <div className="flex flex-col gap-4">
          <FormField id="title" label={t(`curriculum.${kind}.titleField`)} error={fieldErrors.title}>
            <Input
              id="title"
              name="title"
              defaultValue={item?.title ?? ''}
              autoFocus={!item}
              aria-invalid={!!fieldErrors.title}
              aria-describedby={describedBy('title')}
              className="h-11 rounded-xl"
            />
          </FormField>

          <FormField
            id="description"
            label={t('curriculum.form.description')}
            error={fieldErrors.description}
            hint={config.descriptionMaxBytes === null ? t('curriculum.form.optional') : undefined}
          >
            <Textarea
              id="description"
              name="description"
              defaultValue={item?.description ?? ''}
              rows={3}
              aria-invalid={!!fieldErrors.description}
              aria-describedby={describedBy('description', config.descriptionMaxBytes === null)}
              className="rounded-xl"
            />
          </FormField>

          {config.location && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="district"
                label={t('curriculum.form.district')}
                error={fieldErrors.district}
                hint={t('curriculum.form.optional')}
              >
                <Input
                  id="district"
                  name="district"
                  defaultValue={item?.district ?? ''}
                  aria-invalid={!!fieldErrors.district}
                  aria-describedby={describedBy('district', true)}
                  className="h-11 rounded-xl"
                />
              </FormField>
              <FormField
                id="province"
                label={t('curriculum.form.province')}
                error={fieldErrors.province}
                hint={t('curriculum.form.optional')}
              >
                <Input
                  id="province"
                  name="province"
                  defaultValue={item?.province ?? ''}
                  aria-invalid={!!fieldErrors.province}
                  aria-describedby={describedBy('province', true)}
                  className="h-11 rounded-xl"
                />
              </FormField>
            </div>
          )}

          {config.displayOrder && (
            <FormField
              id="displayOrder"
              label={t('curriculum.form.displayOrder')}
              error={fieldErrors.displayOrder}
              hint={t('curriculum.form.displayOrderHint')}
            >
              <Input
                id="displayOrder"
                name="displayOrder"
                type="number"
                min={0}
                max={DISPLAY_ORDER_MAX}
                step={1}
                defaultValue={item?.displayOrder ?? Math.min(nextOrder, DISPLAY_ORDER_MAX)}
                aria-invalid={!!fieldErrors.displayOrder}
                aria-describedby={describedBy('displayOrder', true)}
                className="h-11 w-32 rounded-xl"
              />
            </FormField>
          )}

          {uploadsImage ? (
            <FormField
              id="image"
              label={t('curriculum.form.image')}
              error={fieldErrors.image}
              hint={t('curriculum.form.imageHint')}
            >
              <Input
                id="image"
                name="image"
                type="file"
                accept="image/*"
                aria-invalid={!!fieldErrors.image}
                aria-describedby={describedBy('image', true)}
                className="h-11 rounded-xl pt-2.5"
              />
            </FormField>
          ) : (
            <FormField id="imageKey" label={t('curriculum.form.imageKey')} hint={t('curriculum.form.imageKeyHint')}>
              <Input
                id="imageKey"
                name="imageKey"
                defaultValue={item?.imageKey ?? ''}
                autoComplete="off"
                aria-describedby="imageKey-hint"
                className="h-11 rounded-xl font-mono text-sm"
              />
            </FormField>
          )}

          <FormField
            id="note"
            label={t('curriculum.form.note')}
            error={fieldErrors.note}
            hint={t('curriculum.form.optional')}
          >
            <Textarea
              id="note"
              name="note"
              defaultValue={item?.note ?? ''}
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
          {save.isPending ? t('common.saving') : t(item ? 'curriculum.form.save' : 'curriculum.form.create')}
        </Button>
      </SheetFooter>
    </form>
  )
}
