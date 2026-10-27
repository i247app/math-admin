import { useMutation } from '@tanstack/react-query'
import { ImagePlusIcon, Loader2Icon, XIcon } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ItemImage } from '@/components/ItemImage'
import { Button } from '@/components/ui/button'
import {
  QUESTION_IMAGE_MAX_BYTES,
  QUESTION_IMAGE_TYPES,
  questionImageUploadKey,
  uploadQuestionImage,
} from './QuestionsApi'

type QuestionImagePickerProps = {
  imageKey: string | null
  /** Presigned preview; null when signing failed (the key still counts). */
  imageUrl: string | null
  /** Names the image for screen readers ("Ảnh câu hỏi", "Ảnh phương án b"). */
  label: string
  /** Called with the new key, or nulls to remove the image. Must not depend on a stale form state. */
  onChange: (key: string | null, url: string | null) => void
  /** Small thumbnail button for an option row. */
  compact?: boolean
}

/**
 * Uploads at once on pick (/question-pools/images/upload) and hands the key to the form; the
 * question only uses it once saved. Removing an image only drops the key — the S3 object stays.
 */
export function QuestionImagePicker({ imageKey, imageUrl, label, onChange, compact }: QuestionImagePickerProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useMutation({ mutationKey: questionImageUploadKey, mutationFn: uploadQuestionImage })

  function handlePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // picking the same file again still fires
    if (!file) return
    if (!QUESTION_IMAGE_TYPES.includes(file.type)) {
      toast.error(t('questions.image.badType'))
      return
    }
    if (file.size > QUESTION_IMAGE_MAX_BYTES) {
      toast.error(t('questions.image.tooLarge'))
      return
    }
    // mutateAsync, not mutate's onSuccess: that one is dropped once this picker unmounts (the admin
    // moved to another question), and the key must still reach the draft. Failures toast globally.
    upload.mutateAsync(file).then(
      (res) => onChange(res.image_key, res.image_url),
      () => {},
    )
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={QUESTION_IMAGE_TYPES.join(',')}
      className="hidden"
      onChange={handlePick}
      tabIndex={-1}
      aria-hidden
    />
  )
  const pick = () => inputRef.current?.click()
  const hasImage = imageKey !== null

  if (compact) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        {fileInput}
        <button
          type="button"
          onClick={pick}
          disabled={upload.isPending}
          aria-label={t(hasImage ? 'questions.image.replaceLabel' : 'questions.image.addLabel', { label })}
          className="flex size-10 items-center justify-center overflow-hidden rounded-lg border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          {upload.isPending ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
          ) : hasImage ? (
            <ItemImage url={imageUrl} className="size-10 rounded-none border-0" />
          ) : (
            <ImagePlusIcon className="size-4" aria-hidden />
          )}
        </button>
        {hasImage && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => onChange(null, null)}
            aria-label={t('questions.image.removeLabel', { label })}
          >
            <XIcon className="size-3.5" aria-hidden />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {fileInput}
      {hasImage &&
        (imageUrl ? (
          <img src={imageUrl} alt={label} className="h-28 max-w-60 rounded-xl border object-contain" />
        ) : (
          <ItemImage url={null} className="size-28 rounded-xl" />
        ))}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={pick} disabled={upload.isPending}>
            {upload.isPending ? <Loader2Icon className="animate-spin" aria-hidden /> : <ImagePlusIcon aria-hidden />}
            {t(upload.isPending ? 'questions.image.uploading' : hasImage ? 'questions.image.replace' : 'questions.image.add')}
          </Button>
          {hasImage && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null, null)}>
              <XIcon aria-hidden />
              {t('questions.image.remove')}
            </Button>
          )}
        </div>
        <span className="text-[13px] text-muted-foreground">{t('questions.image.hint')}</span>
      </div>
    </div>
  )
}
