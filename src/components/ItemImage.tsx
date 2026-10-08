import { ImageOffIcon } from 'lucide-react'
import { cn } from '@/utils/Helpers'

/** Thumbnail of a row's image, or a placeholder when it has none. */
export function ItemImage({ url, className }: { url: string | null; className?: string }) {
  return url ? (
    <img src={url} alt="" className={cn('size-10 shrink-0 rounded-lg border object-cover', className)} />
  ) : (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground',
        className,
      )}
    >
      <ImageOffIcon className="size-4" aria-hidden />
    </span>
  )
}
