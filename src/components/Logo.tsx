import { useTranslation } from 'react-i18next'
import { cn } from '@/utils/Helpers'

type LogoProps = {
  className?: string
}

/** NUMI owl mark + product name, for dark (teal) backgrounds. */
export function Logo({ className }: LogoProps) {
  const { t } = useTranslation()

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <img
        src={`${import.meta.env.BASE_URL}assets/images/numi-logo.png`}
        alt=""
        className="size-9 rounded-lg bg-white object-contain"
      />
      <div className="flex flex-col leading-tight">
        <strong className="text-base font-bold text-white">NUMI</strong>
        <span className="text-xs text-sidebar-foreground/80">{t('common.appSubtitle')}</span>
      </div>
    </div>
  )
}
