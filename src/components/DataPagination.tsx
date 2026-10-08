import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/Helpers'

type DataPaginationProps = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

/** Previous / numbered pages / next. Long ranges collapse to 1 … 4 5 6 … 20. */
export function DataPagination({ page, totalPages, onPageChange, className }: DataPaginationProps) {
  const { t } = useTranslation()
  if (totalPages <= 1) return null

  return (
    <nav aria-label={t('pagination.label')} className={cn('flex items-center gap-1', className)}>
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeftIcon />
        {t('pagination.previous')}
      </Button>
      {pageItems(page, totalPages).map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} aria-hidden className="w-6 text-center text-muted-foreground">
            …
          </span>
        ) : (
          <Button
            key={item}
            variant={item === page ? 'default' : 'ghost'}
            size="icon-sm"
            aria-current={item === page ? 'page' : undefined}
            aria-label={t('pagination.page', { page: item })}
            onClick={() => onPageChange(item)}
          >
            {item}
          </Button>
        ),
      )}
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        {t('pagination.next')}
        <ChevronRightIcon />
      </Button>
    </nav>
  )
}

/** First, last, and the current page with one neighbour each side; gaps where pages are skipped. */
function pageItems(page: number, total: number): (number | 'gap')[] {
  const wanted = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total))
  const pages = [...wanted].sort((a, b) => a - b)
  const items: (number | 'gap')[] = []
  for (const p of pages) {
    const previous = items.at(-1)
    if (typeof previous === 'number' && p - previous === 2) items.push(previous + 1)
    else if (typeof previous === 'number' && p - previous > 2) items.push('gap')
    items.push(p)
  }
  return items
}
