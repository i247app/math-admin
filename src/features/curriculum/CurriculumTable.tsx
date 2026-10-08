import { ArchiveIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ItemImage } from '@/components/ItemImage'
import { RowAction } from '@/components/RowAction'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { CurriculumItem, CurriculumKind } from '@/types/Curriculum'
import { cn, formatServerTime } from '@/utils/Helpers'
import { KIND_CONFIG } from './CurriculumApi'

export type CurriculumAction = 'edit' | 'softDelete' | 'forceDelete'

type CurriculumTableProps = {
  kind: CurriculumKind
  /** undefined while the first page loads. */
  items: CurriculumItem[] | undefined
  onAction: (action: CurriculumAction, item: CurriculumItem) => void
}

export function CurriculumTable({ kind, items, onAction }: CurriculumTableProps) {
  const { t, i18n } = useTranslation()
  const { displayOrder, location } = KIND_CONFIG[kind]

  return (
    <Table className="min-w-[900px]">
      <TableHeader className="bg-muted/50">
        <TableRow>
          {displayOrder && <TableHead className="w-24 pl-5">{t('curriculum.columns.order')}</TableHead>}
          <TableHead className={cn('w-24', !displayOrder && 'pl-5')}>{t('curriculum.columns.id')}</TableHead>
          <TableHead>{t(`curriculum.${kind}.titleField`)}</TableHead>
          {location && <TableHead className="w-48">{t('curriculum.columns.location')}</TableHead>}
          <TableHead>{t('curriculum.columns.description')}</TableHead>
          <TableHead className="w-40">{t('curriculum.columns.created')}</TableHead>
          <TableHead className="w-36 pr-5 text-right">{t('curriculum.columns.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items
          ? items.map((item) => (
              <TableRow key={item.id}>
                {displayOrder && (
                  <TableCell className="pl-5 font-mono text-[13px] font-semibold">{item.displayOrder}</TableCell>
                )}
                <TableCell className={cn('font-mono text-[13px] text-muted-foreground', !displayOrder && 'pl-5')}>
                  {item.id}
                </TableCell>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-3">
                    <ItemImage url={item.imageUrl} />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-semibold">{item.title}</span>
                      {item.note && <span className="truncate text-[13px] text-muted-foreground">{item.note}</span>}
                    </div>
                  </div>
                </TableCell>
                {location && (
                  <TableCell className="text-sm">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate">{item.district || '—'}</span>
                      {item.province && <span className="truncate text-muted-foreground">{item.province}</span>}
                    </div>
                  </TableCell>
                )}
                <TableCell className="max-w-80 truncate text-sm">{item.description || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatServerTime(item.createDt, i18n.language)}
                </TableCell>
                <TableCell className="pr-5">
                  <div className="flex justify-end gap-1">
                    <RowAction
                      label={t('curriculum.actions.edit', { name: item.title })}
                      onClick={() => onAction('edit', item)}
                    >
                      <PencilIcon />
                    </RowAction>
                    <RowAction
                      label={t('curriculum.actions.softDelete', { name: item.title })}
                      onClick={() => onAction('softDelete', item)}
                    >
                      <ArchiveIcon />
                    </RowAction>
                    <RowAction
                      label={t('curriculum.actions.forceDelete', { name: item.title })}
                      destructive
                      onClick={() => onAction('forceDelete', item)}
                    >
                      <Trash2Icon />
                    </RowAction>
                  </div>
                </TableCell>
              </TableRow>
            ))
          : Array.from({ length: 5 }, (_, index) => (
              <TableRow key={index} aria-hidden>
                {displayOrder && (
                  <TableCell className="pl-5">
                    <Skeleton className="h-3 w-8" />
                  </TableCell>
                )}
                <TableCell className={cn(!displayOrder && 'pl-5')}>
                  <Skeleton className="h-3 w-10" />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-lg" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </TableCell>
                {location && (
                  <TableCell>
                    <Skeleton className="h-3 w-28" />
                  </TableCell>
                )}
                <TableCell>
                  <Skeleton className="h-3 w-48" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-28" />
                </TableCell>
                <TableCell className="pr-5">
                  <Skeleton className="ml-auto h-3 w-24" />
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  )
}
